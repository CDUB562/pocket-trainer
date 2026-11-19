(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pt." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("pt." + k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem("pt." + k); } catch {} },
    keys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("pt.")) out.push(k); } } catch {} return out; },
  };
  // Days are the phone's local calendar days: an evening session counts for today, not tomorrow's UTC date.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => iso(new Date());
  const addDays = (day, n) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 864e5);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const settings = Object.assign({ volume: 0.8, haptic: true, flash: false, budget: 60, custom: null }, store.get("settings", {}));
  const saveSettings = () => store.set("settings", settings);

  let toastTimer = 0;
  function toast(text, ms = 2600) {
    const t = $("toast"); t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  // ---------- Dogs: profiles in pt.dogs, each dog's training state in pt.d.<id> ----------
  const freshState = () => ({
    progress: {}, plan: null, history: [], last: null, charged: false, seen: {}, place: "home",
    ratings: [], reviews: [], days: [], passport: {}, potty: { on: null, last: 0, offset: 0, log: [] },
    treats: { day: "", used: 0 }, live: null,
  });
  const newId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // Version 1 kept one dog's progress in top-level keys; move it into the first dog profile.
  (function migrate() {
    if (store.get("dogs", null)) return;
    const old = store.get("settings", {});
    const had = store.get("progress", null) || store.get("charged", false) || store.get("history", null) || old.dog;
    if (!had) return;
    const id = newId();
    const st = freshState();
    st.progress = store.get("progress", {});
    st.history = (store.get("history", []) || []).map((h) => ({ ...h, blocks: [h.module] }));
    st.last = null; // v1 summaries have a different shape
    st.charged = store.get("charged", false);
    st.seen = store.get("seen", {});
    st.treats = store.get("treats", st.treats);
    const live = store.get("live", null);
    if (live) st.live = { start: live.start, at: live.at, marks: live.marks, blocks: [live.module] };
    store.set("d." + id, st);
    store.set("dogs", [{ id, name: old.dog || "", legacy: true, goals: ["foundations", "life"], days: [1, 2, 4, 6] }]);
    store.set("active", id);
    for (const k of ["progress", "plan", "history", "last", "charged", "seen", "treats", "live", "module", "dogAsked"]) store.del(k);
    delete settings.dog; saveSettings();
  })();

  let dogs = store.get("dogs", []);
  let dog = null, st = null;
  const saveDogs = () => store.set("dogs", dogs);
  const saveSt = () => { if (dog) store.set("d." + dog.id, st); };
  function loadDog(id) {
    dog = dogs.find((d) => d.id === id) || dogs[0] || null;
    store.set("active", dog ? dog.id : null);
    st = dog ? Object.assign(freshState(), store.get("d." + dog.id, {})) : null;
    if (!st) return;
    // Saved data may come from an older version or a backup: clamp it to the current step lists.
    for (const [sid, p] of Object.entries(st.progress)) {
      const s = SKILLS.find((x) => x.id === sid);
      if (!s || !p || typeof p !== "object") { delete st.progress[sid]; continue; }
      p.step = Math.max(0, Math.min(s.steps.length - 1, parseInt(p.step, 10) || 0));
      if (!Array.isArray(p.reps)) p.reps = [];
      p.done = !!p.done;
      if (s.proof && p.best) for (const d of Object.keys(p.best)) if (!s.proof[d]) delete p.best[d]; else p.best[d] = Math.min(p.best[d], s.proof[d].length - 1);
    }
    if (!PLACES.some((p) => p.id === st.place)) st.place = "home";
  }
  loadDog(store.get("active", null));

  // ---------- The dog's age, stage and drive ----------
  const ageWeeks = () => (dog && dog.birth ? Math.max(0, Math.floor(daysBetween(dog.birth, today()) / 7)) : null);
  function stage() {
    const w = ageWeeks();
    if (w == null) return "adult";
    const giant = dog.size === "g";
    if (w < 16) return "puppy";
    if (w < 26) return "juvenile";
    if (w < (giant ? 104 : 78)) return "adolescent";
    if (w >= (giant ? 6 : 8) * 52) return "senior";
    return "adult";
  }
  const dogName = () => (dog && dog.name ? dog.name : "your dog");
  const breedRow = (name) => BREEDS.find((b) => b[0].toLowerCase() === String(name || "").trim().toLowerCase());

  // ---------- Skills, levels and proofing ----------
  const FREE = { id: "free", name: "Free clicker", goal: "Just the marker pad, no plan.", steps: [], needs: [] };
  const CHARGE = { id: "charge", name: "Charge Yes", goal: "Yes means food.", steps: [], needs: [] };
  const skillById = (id) => SKILLS.find((s) => s.id === id);
  const getSkill = (id) => skillById(id) || (id === "charge" ? CHARGE : FREE);
  const prog = (id) => (st.progress[id] ||= { step: 0, reps: [], done: false });
  const peek = (id) => st.progress[id];
  const started = (id) => { const p = peek(id); return !!p && (p.step > 0 || p.reps.length > 0 || !!p.last); };
  const dims = (s) => (s.proof ? Object.keys(s.proof) : []);
  const top = (s, d) => s.proof[d].length - 1;
  const best = (id, d) => ((peek(id) || {}).best || {})[d] || 0;
  const dimLabel = (s, d, i) => { const v = s.proof[d][i]; return Array.isArray(v) ? v[1] : v; };
  const dimValue = (s, d, i) => { const v = s.proof[d][i]; return Array.isArray(v) ? v[0] : i; };
  // Puppies under 16 weeks hold for 10 s at most.
  const capFor = (s, d) => (d === "dur" && stage() === "puppy" ? Math.max(0, s.proof.dur.filter((v) => v[0] <= 10).length - 1) : top(s, d));

  // 0 Learning, 1 Fluent, 2 Proofed, 3 Reliable, 4 Maintained.
  function level(id) {
    const s = skillById(id), p = peek(id);
    if (!s || !p || !p.done) return 0;
    if (dims(s).some((d) => best(id, d) < top(s, d))) return 1;
    if (Object.keys(p.places || {}).length < 3 || (p.rdays || []).length < 3) return 2;
    return p.reviews > 0 ? 4 : 3;
  }
  function needMet(n) {
    const [id, rest] = n.split(/[@:]/);
    if (id === "charge") return !!st.charged;
    if (n.includes("@")) return started(id) && (prog(id).step >= +rest || level(id) >= 1);
    const want = rest ? LEVELS.findIndex((l) => l.toLowerCase() === rest) : 1;
    return level(id) >= want;
  }
  const isOpen = (id) => started(id) || (getSkill(id).needs || []).every(needMet);
  function needText(n) {
    const [id, rest] = n.split(/[@:]/);
    if (id === "charge") return "Charge Yes";
    const name = getSkill(id).name;
    if (n.includes("@")) return `${name} to step ${+rest + 1}`;
    return `${name} to ${rest ? rest[0].toUpperCase() + rest.slice(1) : "Fluent"}`;
  }
  const lockText = (id) => "Opens after " + (getSkill(id).needs || []).filter((n) => !needMet(n)).map(needText).join(" and ");

  // The proofing grid: raise the dimension furthest from its target, ease the others one level below their best.
  function proofTarget(id) {
    const s = getSkill(id), ds = dims(s);
    if (!ds.length) return null;
    const lv = {};
    const open = ds.filter((d) => best(id, d) < capFor(s, d));
    if (!open.length) { ds.forEach((d) => (lv[d] = best(id, d))); return { raise: null, lv }; }
    const raise = open.slice().sort((a, b) => best(id, a) / top(s, a) - best(id, b) / top(s, b))[0];
    ds.forEach((d) => (lv[d] = d === raise ? best(id, d) + 1 : Math.max(0, best(id, d) - 1)));
    return { raise, lv };
  }
  const bestLevels = (id) => { const lv = {}; dims(getSkill(id)).forEach((d) => (lv[d] = best(id, d))); return lv; };
  const describeLv = (s, lv) => dims(s).map((d) => dimLabel(s, d, lv[d])).join(" · ");

  // One plain sentence on what moves the ring next.
  function nextText(id) {
    const s = getSkill(id), p = peek(id), lv = level(id);
    if (!isOpen(id)) return lockText(id) + ".";
    if (lv === 0) {
      const step = p ? p.step : 0;
      return `Step ${step + 1} of ${s.steps.length}: ${s.steps[step].t}. Fluent after the last step is passed on 2 different days.`;
    }
    if (lv === 1) { const t = proofTarget(id); return t.raise ? `Next proofing level: ${describeLv(s, t.lv)}.` : `Proofing waits until ${dogName()} is older.`; }
    if (lv === 2) {
      const n = Math.max(0, 3 - Object.keys(p.places || {}).length), d = Math.max(0, 3 - (p.rdays || []).length);
      const parts = [n && `in ${n} more kind${n > 1 ? "s" : ""} of place`, d && `on ${d} more day${d > 1 ? "s" : ""}`].filter(Boolean);
      return `Pass it ${parts.join(", ")} to be Reliable.`;
    }
    return p.reviewDue ? `Next review ${p.reviewDue <= today() ? "is due now" : "on " + new Date(p.reviewDue + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}.` : "Kept fresh with reviews.";
  }

  function ring(id, size = 40) {
    const lv = level(id), s = skillById(id);
    const r = size / 2 - 4, c = 2 * Math.PI * r, seg = c / 5;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`); svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.setAttribute("class", "ring"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", s ? `${LEVELS[lv]}${lv === 0 && started(id) ? ", step " + (prog(id).step + 1) : ""}` : "");
    // Five segments, one per level; inside Learning, the current segment fills by step.
    const fill = lv + (lv === 0 && s && started(id) ? prog(id).step / s.steps.length : 0) + (lv === 4 ? 1 : 0);
    for (let i = 0; i < 5; i++) {
      const arc = document.createElementNS(svg.namespaceURI, "circle");
      arc.setAttribute("cx", size / 2); arc.setAttribute("cy", size / 2); arc.setAttribute("r", r);
      arc.setAttribute("fill", "none"); arc.setAttribute("stroke-width", "5");
      const part = Math.max(0, Math.min(1, fill - i));
      arc.setAttribute("stroke", part > 0 ? "var(--keep)" : "var(--line)");
      const len = part > 0 ? (seg - 3) * part : seg - 3;
      arc.setAttribute("stroke-dasharray", `${len} ${c - len}`);
      arc.setAttribute("stroke-dashoffset", String(-i * seg));
      arc.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
      svg.append(arc);
      if (part > 0 && part < 1) { // the unfilled rest of a partial segment
        const rest = arc.cloneNode(); const rl = (seg - 3) * (1 - part);
        rest.setAttribute("stroke", "var(--line)"); rest.setAttribute("stroke-dasharray", `${rl} ${c - rl}`);
        rest.setAttribute("stroke-dashoffset", String(-(i * seg + (seg - 3) * part)));
        svg.append(rest);
      }
    }
    if (s && !isOpen(id)) {
      const t = document.createElementNS(svg.namespaceURI, "text");
      t.setAttribute("x", size / 2); t.setAttribute("y", size / 2 + 4); t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "11"); t.setAttribute("font-weight", "700"); t.setAttribute("fill", "var(--muted)"); t.textContent = "••";
      svg.append(t);
    }
    return svg;
  }

  // ---------- Places, reviews, the week ----------
  const LADDER = [2, 5, 10, 21, 45, 90];
  function logPlace(id) {
    const p = prog(id), before = level(id);
    p.places ||= {}; p.places[st.place] = (p.places[st.place] || 0) + 1;
    p.rdays ||= []; if (!p.rdays.includes(today())) p.rdays.push(today());
    if (before < 3 && level(id) >= 3 && !p.reviewDue) { p.interval = 2; p.reviewDue = addDays(today(), 2); return true; }
    return false;
  }
  function reviewResult(id, pass) {
    const p = prog(id);
    st.reviews.push({ day: today(), pass }); st.reviews = st.reviews.slice(-60);
    if (pass) {
      p.reviews = (p.reviews || 0) + 1; p.fails = 0;
      const i = LADDER.indexOf(p.interval);
      p.interval = LADDER[Math.min(LADDER.length - 1, i + 1)] || 2;
    } else {
      p.fails = (p.fails || 0) + 1;
      p.interval = Math.max(1, Math.round((p.interval || 2) / 3));
      if (p.fails >= 2) { p.places = {}; p.rdays = []; p.reviews = 0; p.interval = 0; p.reviewDue = null; p.fails = 0; return "drop"; }
    }
    p.reviewDue = addDays(today(), p.interval);
    return pass ? "pass" : "fail";
  }
  // A hard week: review pass rate under 60% over the last 7 days (3+ reviews). Lifts as passes come back.
  function hardWeek() {
    const since = addDays(today(), -7), r = st.reviews.filter((x) => x.day >= since);
    return r.length >= 3 && r.filter((x) => x.pass).length / r.length < 0.6;
  }
  const tired = () => st.ratings.length >= 3 && st.ratings.slice(-3).every((r) => r === "tired");
  const trainingDay = () => !dog.days || !dog.days.length || dog.days.includes(new Date().getDay());

  // ---------- Planner: one session for today, here ----------
  const ROLE = { warm: "Warm-up", main: "Main", new: "New", finish: "Finish", review: "Review", only: "Skill" };
  function placeOk(s) { return !s.places || s.places.includes(st.place); }
  function wantsTrack(s) {
    if (s.track !== "puppy") return true;
    const w = ageWeeks();
    return (w != null && w < 30) || (dog.goals || []).includes("puppy");
  }
  function score(s) {
    const id = s.id, p = peek(id), lv = level(id);
    const due = p && p.reviewDue && p.reviewDue <= today();
    let v = due ? 100 : lv === 0 ? (started(id) ? 80 : 40) : lv === 1 ? 60 : lv === 2 ? 50 + (p.places && p.places[st.place] ? 0 : 20) : 10;
    v += 15 * ((dog.goals || ["foundations"]).includes(s.track) ? 1 : 0.3);
    v += Math.min(25, 5 * SKILLS.filter((o) => (o.needs || []).some((n) => n.split(/[@:]/)[0] === id)).length);
    if (due) v += Math.min(50, 10 * daysBetween(p.reviewDue, today()));
    if (p && p.last === today()) v -= 60;
    return v;
  }
  function kindFor(id) {
    const p = peek(id), lv = level(id);
    if (p && p.reviewDue && p.reviewDue <= today()) return "review";
    if (lv === 0) return "learn";
    if (lv === 1) return "proof";
    return "practice";
  }
  function buildPlan(opts = {}) {
    if (!st.charged) return { day: today(), place: st.place, blocks: [{ id: "charge", kind: "charge", role: "only" }] };
    const short = opts.short || tired(), hard = hardWeek();
    const avoid = new Set(opts.avoid || []);
    const pool = SKILLS.filter((s) => isOpen(s.id) && placeOk(s) && wantsTrack(s));
    const ranked = pool.map((s) => ({ s, v: score(s) - (avoid.has(s.id) ? 200 : 0) })).sort((a, b) => b.v - a.v);
    const blocks = [], used = new Set();
    // Warm-ups and finishes run at the dog's best level; only main blocks raise the bar.
    const add = (id, role) => { used.add(id); blocks.push({ id, kind: role === "new" ? "learn" : role === "warm" || role === "finish" ? (level(id) ? "practice" : "learn") : kindFor(id), role }); };
    const working = ranked.filter(({ s }) => started(s.id) || level(s.id) > 0);
    // A rest day keeps one light review; a dog with nothing under way yet just gets an optional normal session.
    const rest = !trainingDay() && working.length > 0, offDay = !trainingDay();
    const learning = working.filter(({ s }) => level(s.id) === 0).length;
    // Warm-up: an easy skill the dog already knows, so the session opens with wins.
    // A skill due for review is never spent as a warm-up, and a short or rest-day session has none.
    const warm = rest || short ? null : working.filter(({ s }) => level(s.id) >= 1 && s.id !== "mat" && kindFor(s.id) !== "review")
      .sort((a, b) => level(b.s.id) - level(a.s.id))[0];
    // Main: the top-scoring skills in progress, reviews first.
    const mains = working.filter(({ s }) => !(warm && s.id === warm.s.id)).slice(0, rest || short ? 1 : 2);
    if (warm && mains.length) add(warm.s.id, "warm");
    mains.forEach(({ s }) => add(s.id, kindFor(s.id) === "review" ? "review" : "main"));
    // New: one at most, never more than 3 skills in Learning, none in a hard week or on a rest day.
    if (!rest && !hard && learning < 3 && blocks.length < 4) {
      const fresh = ranked.find(({ s }) => !started(s.id) && level(s.id) === 0 && !used.has(s.id));
      if (fresh) add(fresh.s.id, "new");
    }
    // Finish calm, once Mat and settle is known.
    if (!rest && level("mat") >= 1 && !used.has("mat") && placeOk(skillById("mat"))) add("mat", "finish");
    if (!blocks.length) {
      const any = ranked.find(({ s }) => !used.has(s.id));
      if (any) add(any.s.id, started(any.s.id) ? "main" : "new");
    }
    return { day: today(), place: st.place, rest, offDay, hard, blocks };
  }
  function plan(force, opts) {
    if (force || !st.plan || st.plan.day !== today() || st.plan.place !== st.place || (st.plan.blocks[0] || {}).id === "charge" && st.charged) {
      st.plan = buildPlan(opts); saveSt();
    }
    return st.plan;
  }
  function blockLine(b) {
    const s = getSkill(b.id);
    if (b.kind === "charge") return "20 treats at random moments. Teaches that Yes means food.";
    if (b.kind === "learn") { const step = (peek(b.id) || { step: 0 }).step; return `Step ${step + 1} of ${s.steps.length}: ${s.steps[step].t}`; }
    if (b.kind === "proof") { const t = proofTarget(b.id); return t.raise ? describeLv(s, t.lv) : "At their best level"; }
    if (b.kind === "review") return "Quick check: one round of 5";
    return dims(s).length ? describeLv(s, bestLevels(b.id)) : "One round of 5";
  }

  // ---------- Audio: every sound is rendered once into a buffer, so a mark is one buffer start ----------
  let ctx = null, gain = null;
  const bufs = {};
  let customBuf = null;

  function render(seconds, fn) {
    const sr = ctx.sampleRate, n = Math.ceil(seconds * sr);
    const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < n; i++) { d[i] = fn(i / sr, i, sr); peak = Math.max(peak, Math.abs(d[i])); }
    if (peak > 0) for (let i = 0; i < n; i++) d[i] *= 0.95 / peak;
    return b;
  }
  // A box-clicker transient: a ringing metal tick plus a burst of noise, gone in a few ms.
  const tick = (t, f, decay) => t < 0 ? 0 : Math.exp(-t / decay) * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.4 * (Math.random() * 2 - 1));
  const note = (t, f, start, len) => {
    const u = t - start; if (u < 0 || u > len) return 0;
    const env = Math.min(1, u / 0.005) * Math.min(1, (len - u) / 0.03);
    return env * Math.sin(2 * Math.PI * f * u);
  };

  function buildSounds() {
    bufs.yes = render(0.09, (t) => tick(t, 2600, 0.004) + 0.7 * tick(t - 0.045, 1900, 0.005));
    bufs.catch = render(0.14, (t) => tick(t, 3600, 0.003) + tick(t - 0.08, 4300, 0.003));
    bufs.keep = render(0.12, (t) => 0.5 * Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t / 0.03));
    bufs.free = render(0.42, (t) => note(t, 880, 0, 0.14) + note(t, 587, 0.17, 0.24));
    // Recall: a rising three-note whistle with a little vibrato, played twice.
    const notes = [1760, 2217, 2637], len = 0.2, gap = 0.04, pass = notes.length * (len + gap) + 0.12;
    let phase = 0;
    bufs.recall = render(pass * 2, (t, i, sr) => {
      const tp = t % pass, k = Math.floor(tp / (len + gap)), u = tp - k * (len + gap);
      if (k >= notes.length || u > len) return 0;
      const f = notes[k] * (1 + 0.015 * Math.sin(2 * Math.PI * 6 * t));
      phase += 2 * Math.PI * f / sr;
      return Math.min(1, u / 0.01) * Math.min(1, (len - u) / 0.02) * Math.sin(phase);
    });
  }

  function initAudio() {
    if (ctx) return;
    // iOS 17+: play through the ringer switch like a media app.
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC({ latencyHint: "interactive" }); } catch { ctx = new AC(); }
    gain = ctx.createGain();
    gain.gain.value = settings.volume;
    gain.connect(ctx.destination);
    buildSounds();
    if (settings.custom) loadCustom(settings.custom).catch(() => {});
  }

  function play(name) {
    if (!ctx) initAudio();
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = (name === "yes" && customBuf) || bufs[name];
    src.connect(gain);
    src.start();
  }

  // ---------- Feedback ----------
  const hapticEl = $("haptic");
  function feedback(node) {
    if (settings.haptic) {
      if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(12);
      else if (!navigator.vibrate) hapticEl.click(); // iOS 18 Safari ticks the Taptic Engine when a switch toggles
    }
    if (settings.flash) { const f = $("flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); }
    if (node) { node.classList.add("hit"); setTimeout(() => node.classList.remove("hit"), 90); }
  }

  // ---------- Navigation: three tabs, plus full screens for training and charging ----------
  const tabs = document.querySelectorAll(".tab");
  let lastTab = "today";
  function show(name) {
    const full = name === "run" || name === "charge";
    if (!full) { lastTab = name; store.set("tab", name); }
    tabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === name));
    document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== "s-" + name));
    $("tabs").hidden = full;
    $("fab").hidden = full; // the training screen has its own Recall chip
    if (name === "today") renderToday();
    if (name === "skills") renderSkills();
    if (name === "setup") renderDogs();
  }
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));

  // ---------- Today ----------
  const installed = !!(navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches);
  let canInstall = false;
  try { canInstall = window.top === window && location.protocol === "https:" && !location.hostname.endsWith("claude.ai") && !location.hostname.endsWith("claudeusercontent.com"); } catch {}
  $("install-close").addEventListener("click", () => { store.set("installLater", true); $("install").hidden = true; });

  function renderToday() {
    $("install").hidden = !(canInstall && !installed && !store.get("installLater", false));
    $("today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if (!dog) { // first run: no dog yet
      $("today-title").textContent = "Today";
      ["dogswitch", "hardweek", "pup-passport", "pup-potty", "last"].forEach((i) => ($(i).hidden = true));
      $("profile-ask").hidden = false; $("profile-ask-title").textContent = "Set up your dog";
      $("places").replaceChildren(); $("plan").replaceChildren(); $("week").replaceChildren(); $("places-label").hidden = true;
      return;
    }
    $("today-title").textContent = dog.name ? `Today with ${dog.name}` : "Today";
    // Dog switcher
    const sw = $("dogswitch"); sw.replaceChildren(); sw.hidden = dogs.length < 2;
    for (const d of dogs) {
      const b = el("button", "pchip", d.name || "Unnamed");
      b.type = "button"; b.setAttribute("aria-checked", d.id === dog.id); b.setAttribute("role", "radio");
      b.addEventListener("click", () => { loadDog(d.id); renderToday(); });
      sw.append(b);
    }
    $("profile-ask").hidden = !dog.legacy && !!dog.birth;
    $("profile-ask-title").textContent = `Finish ${dog.name || "your dog"}'s profile`;
    $("places-label").hidden = false;
    // Where are you?
    const pl = $("places"); pl.replaceChildren();
    for (const p of PLACES) {
      const b = el("button", "pchip", p.name);
      b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", st.place === p.id);
      b.addEventListener("click", () => { st.place = p.id; saveSt(); renderToday(); });
      pl.append(b);
    }
    const hw = hardWeek();
    $("hardweek").hidden = !hw;
    $("hardweek").textContent = `${dog.name || "Your dog"} is having a hard week, which is normal (especially for teenagers). Easier plan until reviews pass again.`;
    renderPlan();
    renderPuppy();
    renderWeek();
    renderLast();
  }

  function renderPlan() {
    const p = plan(), box = $("plan"); box.replaceChildren();
    if (!p.blocks.length) {
      const d = el("div", "plandone");
      d.append(el("b", "", "Nothing to train here right now."), el("p", "muted", "Try another place, or pick any skill under Train something else."));
      box.append(d); return;
    }
    if (p.done) {
      const d = el("div", "plandone");
      d.append(el("b", "", "Today's session is done."), el("p", "muted", "Rest helps it stick. Another short session later is fine if your dog is keen."));
      const again = el("button", "btn", "Another short session"); again.type = "button";
      again.addEventListener("click", () => { plan(true, { short: true, avoid: p.blocks.map((b) => b.id) }); renderToday(); });
      d.append(again); box.append(d); return;
    }
    const card = el("div", "plancard");
    const mins = p.blocks.reduce((a, b) => a + (b.kind === "charge" ? 2 : b.kind === "learn" ? 3 : 2), 0);
    card.append(el("span", "eyebrow", p.rest ? `Rest day · optional review · about ${mins} min` : p.offDay ? `Not a planned day · optional · about ${mins} min` : `Next session · about ${mins} minutes`));
    const ol = el("ol");
    for (const b of p.blocks) {
      const li = el("li");
      li.append(el("span", "", b.kind === "charge" ? "First" : ROLE[b.role] || "Skill"), el("b", "", getSkill(b.id).name), el("small", "", blockLine(b)));
      ol.append(li);
    }
    card.append(ol);
    const go = el("button", "go", "Start"); go.type = "button";
    go.addEventListener("click", () => startPlan());
    card.append(go);
    if (p.blocks[0].kind !== "charge") {
      const links = el("div", "links");
      const sh = el("button", "", "Shorter"), df = el("button", "", "Something different");
      sh.type = df.type = "button";
      sh.addEventListener("click", () => { plan(true, { short: true }); renderToday(); });
      df.addEventListener("click", () => { plan(true, { avoid: p.blocks.map((b) => b.id) }); renderToday(); });
      links.append(sh, df); card.append(links);
    }
    box.append(card);
  }

  function renderWeek() {
    const w = $("week"); w.replaceChildren();
    const now = new Date(), dow = (now.getDay() + 6) % 7; // Monday first
    const monday = addDays(today(), -dow), names = ["M", "T", "W", "T", "F", "S", "S"];
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i), js = (i + 1) % 7;
      const c = el("i", "", names[i]);
      if ((dog.days || []).includes(js)) c.classList.add("plan");
      if (st.days.includes(day)) { c.classList.add("done"); done++; }
      if (day === today()) c.classList.add("today");
      w.append(c);
    }
    w.append(el("span", "num", `${done} of ${(dog.days || []).length || 7} days`));
  }

  function renderLast() {
    const s = st.last;
    $("last").hidden = !s;
    if (!s) return;
    $("last-title").textContent = `Last session · ${s.title}`;
    $("last-time").textContent = fmt(s.secs);
    $("last-marks").textContent = s.marks;
    $("last-rate").textContent = s.rate ?? "–";
    $("last-rate-wrap").classList.toggle("slow", s.rate != null && s.rate < 8);
    const notes = [s.round, s.treats];
    if (s.rate != null && s.rate < 8) notes.push("Under 8 rewards a minute: make the next session easier so your dog wins more often");
    $("last-note").textContent = notes.filter(Boolean).join(". ") + ".";
    $("last-review").hidden = !(s.video && rec.has);
  }
  $("last-close").addEventListener("click", () => { st.last = null; saveSt(); renderLast(); });
  $("last-review").addEventListener("click", () => openReview());
  $("pick-other").addEventListener("click", () => show("skills"));
  $("profile-ask-go").addEventListener("click", () => openOnboarding(dog ? dog.id : null));

  // ---------- Puppy: passport and potty plan ----------
  const ppCount = () => Object.values(st.passport).filter((r) => r.r === "happy").length;
  const ppTotal = PASSPORT.reduce((a, g) => a + g.items.length, 0);
  function renderPuppy() {
    const w = ageWeeks(), pup = w != null && w < 20 || (dog.goals || []).includes("puppy");
    $("pup-passport").hidden = !pup;
    if (pup) {
      const n = ppCount(), newToday = Object.values(st.passport).filter((r) => r.day === today()).length;
      $("pup-passport-n").textContent = `${n} of ${ppTotal}`;
      $("pup-passport-sub").textContent = w != null && w < 16
        ? `The best window for this closes around 16 weeks. Aim for 3 new good experiences a day (${newToday} today).`
        : `Keep adding good experiences, about 3 a day (${newToday} today).`;
    }
    if (st.potty.on === null && w != null && w < 26) st.potty.on = true;
    $("pup-potty").hidden = !st.potty.on;
    if (st.potty.on) $("potty-next").textContent = pottyText();
  }
  function pottyMinutes() {
    const months = (ageWeeks() || 26) / 4.35;
    return Math.max(60, Math.min(480, Math.round((months + 1) * 60) + st.potty.offset));
  }
  function pottyText() {
    if (!st.potty.last) return `Take them out after waking, eating and play, and every ${Math.round(pottyMinutes() / 6) / 10} hours.`;
    const due = st.potty.last + pottyMinutes() * 60000, mins = Math.round((due - Date.now()) / 60000);
    const at = new Date(due).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return mins <= 0 ? `Potty trip due now (was ${at}). Also after waking, eating and play.` : `Next trip by ${at} (in ${mins} min). Also after waking, eating and play.`;
  }
  $("potty-ok").addEventListener("click", () => {
    st.potty.log.push({ t: Date.now(), ok: true }); st.potty.log = st.potty.log.slice(-40); st.potty.last = Date.now();
    // Five clean trips in a row stretch the interval a little.
    if (st.potty.log.slice(-5).length === 5 && st.potty.log.slice(-5).every((x) => x.ok)) st.potty.offset = Math.min(120, st.potty.offset + 10);
    saveSt(); renderPuppy(); toast("Logged. Praise and a treat outside, right as they finish.");
  });
  $("potty-acc").addEventListener("click", () => {
    st.potty.log.push({ t: Date.now(), ok: false }); st.potty.last = Date.now(); st.potty.offset = Math.max(-60, st.potty.offset - 15);
    saveSt(); renderPuppy(); toast("No scolding. Clean with an enzyme cleaner; trips come a little sooner now.", 3600);
  });
  $("potty-off").addEventListener("click", () => { st.potty.on = false; saveSt(); renderPuppy(); });

  const PP_NEXT = { undefined: "happy", happy: "unsure", unsure: "scared", scared: undefined };
  const PP_WORD = { happy: "Happy", unsure: "Unsure: repeat easier", scared: "Scared: go much easier" };
  function renderPassport() {
    const box = $("pp-groups"); box.replaceChildren();
    for (const g of PASSPORT) {
      const sec = el("div", "ppgroup"), items = el("div", "ppitems");
      sec.append(el("h2", "", `${g.name} · ${g.items.filter((i) => (st.passport[g.id + ":" + i] || {}).r === "happy").length} of ${g.items.length}`));
      for (const it of g.items) {
        const key = g.id + ":" + it, r = (st.passport[key] || {}).r;
        const b = el("button", "ppitem" + (r ? " " + r : "")); b.type = "button";
        b.append(el("span", "", it), el("small", "", r ? PP_WORD[r] : "Not yet"));
        b.addEventListener("click", () => {
          const nx = PP_NEXT[r];
          if (nx) st.passport[key] = { r: nx, day: today() }; else delete st.passport[key];
          saveSt(); renderPassport();
        });
        items.append(b);
      }
      sec.append(items); box.append(sec);
    }
  }
  $("pup-passport-go").addEventListener("click", () => { renderPassport(); $("passport").hidden = false; $("passport").scrollTop = 0; });
  $("pp-close").addEventListener("click", () => { $("passport").hidden = true; renderToday(); });

  // ---------- Skills map ----------
  function renderSkills() {
    const box = $("modules"); box.replaceChildren();
    if (!dog) { box.append(el("p", "muted", "Set up your dog on Today first.")); return; }
    for (const t of TRACKS) {
      const sec = el("div", "track");
      sec.append(el("h2", "", t.name), el("p", "muted", t.blurb));
      for (const s of SKILLS.filter((x) => x.track === t.id)) sec.append(skillRow(s.id));
      box.append(sec);
    }
    const free = el("div", "track"); free.append(el("h2", "", "Tools"));
    const fb = el("button", "skrow"); fb.type = "button";
    fb.append(el("b", "", "Free clicker"), el("span", "", "Just the marker pad, no plan."));
    fb.style.gridTemplateColumns = "1fr";
    fb.addEventListener("click", () => startSingle("free"));
    free.append(fb); box.append(free);
    const charged = st.charged;
    $("go-charge").classList.toggle("todo", !charged);
    $("charge-tile-title").textContent = charged ? "Yes is charged" : "Charge Yes";
    $("charge-tile-sub").textContent = charged ? "Done. Repeat a round any time Yes seems to lose its meaning." : "Do this first: 2 minutes so your dog learns Yes means food.";
  }
  function skillRow(id) {
    const s = getSkill(id), open = isOpen(id), lv = level(id);
    const b = el("button", "skrow" + (open ? "" : " locked")); b.type = "button";
    const sub = !open ? lockText(id) : lv === 0 ? (started(id) ? `Learning · step ${prog(id).step + 1} of ${s.steps.length}` : "Not started") : LEVELS[lv] + (peek(id).reviewDue && peek(id).reviewDue <= today() ? " · review due" : "");
    b.append(ring(id), el("b", "", s.name), el("span", "", sub));
    b.addEventListener("click", () => openSkill(id));
    return b;
  }

  let sheetSkill = null;
  function openSkill(id) {
    sheetSkill = id;
    const s = getSkill(id), p = peek(id) || { step: 0 }, lv = level(id), open = isOpen(id);
    $("sk-track").textContent = (TRACKS.find((t) => t.id === s.track) || {}).name || "";
    $("sk-ring").replaceChildren(ring(id, 64));
    $("sk-name").textContent = s.name;
    $("sk-goal").textContent = s.goal;
    $("sk-next").textContent = (open ? LEVELS[lv] + ". " : "") + nextText(id);
    $("sk-train").hidden = !open;
    const ol = $("sk-steps"); ol.replaceChildren();
    s.steps.forEach((step, i) => {
      const li = el("li", lv >= 1 || i < p.step ? "done" : i === p.step && started(id) ? "now" : "", `${step.t}: ${step.mark}`);
      ol.append(li);
    });
    const pw = $("sk-proof"); pw.replaceChildren();
    $("sk-proof-wrap").hidden = !dims(s).length;
    for (const d of dims(s)) {
      const row = el("div"), b = best(id, d);
      row.append(el("span", "muted", `${{ dur: "Duration", dist: "Distance", dis: "Distraction" }[d]}: ${lv >= 1 ? dimLabel(s, d, b) : "after Fluent"} (goal: ${dimLabel(s, d, top(s, d))})`));
      const bar = el("i"); bar.style.setProperty("--p", (lv >= 1 ? (b / top(s, d)) * 100 : 0) + "%"); row.append(bar);
      pw.append(row);
    }
    const places = Object.keys((p.places) || {});
    $("sk-places-wrap").hidden = lv < 2;
    $("sk-places").textContent = places.length ? places.map((x) => PLACES.find((q) => q.id === x).name).join(", ") : "None yet. Practice it somewhere new.";
    $("sk-reset").hidden = !started(id);
    $("skill").hidden = false; $("skill").scrollTop = 0;
  }
  $("sk-close").addEventListener("click", () => { $("skill").hidden = true; });
  $("sk-train").addEventListener("click", () => { $("skill").hidden = true; startSingle(sheetSkill); });
  function resetSkill(id) {
    if (!id || !confirm(`Start ${getSkill(id).name} over from step 1?`)) return false;
    st.progress[id] = { step: 0, reps: [], done: false }; saveSt();
    return true;
  }
  $("sk-reset").addEventListener("click", () => { if (resetSkill(sheetSkill)) { openSkill(sheetSkill); renderSkills(); } });

  // ---------- Dog profile wizard ----------
  const AGES = [["Under 4 months", 10], ["4 to 6 months", 21], ["6 to 18 months", 52], ["1.5 to 7 years", 200], ["8 years or older", 450]];
  const SIZES = [["s", "Small", "under 10 kg"], ["m", "Medium", "10-25 kg"], ["l", "Large", "25-45 kg"], ["g", "Giant", "over 45 kg"]];
  const GOALS = [["foundations", "Good manners"], ["puppy", "Puppy basics"], ["life", "Vet, grooming, car, guests"],
    ["waterfowl", "Duck and goose hunting"], ["upland", "Upland birds and quail"], ["hog", "Hog bay dog"], ["tracking", "Blood tracking"],
    ["shed", "Shed antlers"], ["nosework", "Nose work"], ["tricks", "Tricks"]];
  const SOON = new Set(["waterfowl", "upland", "hog", "tracking", "shed", "nosework", "tricks"]);
  const REWARDS = [["food", "Food"], ["toy", "Toys"], ["tug", "Tug"], ["ball", "Ball"], ["praise", "Praise"]];
  const QUIZ = [["retrieve", "Carries things around"], ["herd", "Chases things that move"], ["scent", "Tracks with the nose down"], ["point", "Freezes and stares at birds"]];
  const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
  const QS = ["name", "age", "breed", "size", "goals", "reward", "days"];
  let draft = null, qi = 0;

  function choiceSet(boxId, items, multi, isOn, onPick) {
    const box = $(boxId); box.replaceChildren();
    for (const [val, label, sub] of items) {
      const b = el("button", "choice", label + (sub ? ` (${sub})` : "")); b.type = "button";
      b.setAttribute("aria-pressed", !!isOn(val));
      b.addEventListener("click", () => { onPick(val); choiceSet(boxId, items, multi, isOn, onPick); });
      box.append(b);
    }
  }
  function openOnboarding(id) {
    const existing = dogs.find((d) => d.id === id);
    draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: newId(), name: "", goals: ["foundations"], days: [1, 2, 4, 6], reward: "food" };
    draft.goals ||= ["foundations"]; draft.days ||= [1, 2, 4, 6];
    qi = 0;
    $("onb-name").value = draft.name || "";
    $("onb-birth").value = draft.birth || "";
    $("onb-breed").value = draft.breed || "";
    $("onb-quiz").hidden = true;
    $("onb-delete").hidden = !existing || dogs.length < 1;
    const dl = $("breedlist"); dl.replaceChildren(...BREEDS.map((b) => { const o = document.createElement("option"); o.value = b[0]; return o; }));
    renderOnb();
    $("onb").hidden = false; $("onb").scrollTop = 0;
  }
  function driveNote() {
    const d = DRIVES[draft.drive];
    $("onb-drive").textContent = d ? `${d.name}. Works best: ${d.reward}. Watch for: ${d.watch}.` : "";
  }
  function renderOnb() {
    document.querySelectorAll(".onbstep").forEach((s) => s.classList.toggle("on", s.dataset.q === QS[qi]));
    $("onb-count").textContent = `${qi + 1} of ${QS.length}`;
    $("onb-back").disabled = qi === 0;
    $("onb-next").textContent = qi === QS.length - 1 ? "Save" : "Next";
    const nm = draft.name || "your dog";
    $("onb-age-h").textContent = `How old is ${nm}?`;
    choiceSet("onb-age", AGES.map(([l, w]) => [w, l]), false, (w) => draft.birth && Math.abs(daysBetween(draft.birth, today()) / 7 - w) < 1,
      (w) => { draft.birth = addDays(today(), -w * 7); $("onb-birth").value = draft.birth; });
    choiceSet("onb-size", SIZES.map(([v, l, s]) => [v, l, s]), false, (v) => draft.size === v, (v) => (draft.size = v));
    choiceSet("onb-goals", GOALS.map(([v, l]) => [v, l + (SOON.has(v) ? " (coming soon)" : "")]), true, (v) => draft.goals.includes(v),
      (v) => { draft.goals = draft.goals.includes(v) ? draft.goals.filter((g) => g !== v) : [...draft.goals, v]; });
    choiceSet("onb-reward", REWARDS, false, (v) => draft.reward === v, (v) => (draft.reward = v));
    choiceSet("onb-days", DAYS, true, (v) => draft.days.includes(v), (v) => { draft.days = draft.days.includes(v) ? draft.days.filter((x) => x !== v) : [...draft.days, v]; });
    choiceSet("onb-quiz-q", QUIZ, true, (v) => draft.drive === v, (v) => { draft.drive = v; driveNote(); });
    driveNote();
  }
  $("onb-birth").addEventListener("change", (e) => { draft.birth = e.target.value || null; renderOnb(); });
  $("onb-breed").addEventListener("change", (e) => {
    draft.breed = e.target.value.trim();
    const row = breedRow(draft.breed);
    if (row) { draft.drive = row[1]; draft.size ||= row[2]; draft.flat = !!row[3]; $("onb-quiz").hidden = true; }
    driveNote();
  });
  $("onb-unsure").addEventListener("click", () => { draft.breed = ""; $("onb-breed").value = ""; $("onb-quiz").hidden = false; });
  $("onb-back").addEventListener("click", () => { if (qi > 0) { qi--; renderOnb(); } });
  $("onb-next").addEventListener("click", () => {
    if (QS[qi] === "name") {
      draft.name = $("onb-name").value.trim();
      if (!draft.name) { toast("Add a name first."); return; }
    }
    if (QS[qi] === "breed") $("onb-breed").dispatchEvent(new Event("change"));
    if (qi < QS.length - 1) { qi++; renderOnb(); $("onb").scrollTop = 0; return; }
    delete draft.legacy;
    const i = dogs.findIndex((d) => d.id === draft.id);
    if (i >= 0) dogs[i] = draft; else { dogs.push(draft); store.set("d." + draft.id, freshState()); }
    saveDogs(); loadDog(draft.id);
    st.plan = null; saveSt();
    $("onb").hidden = true;
    show(lastTab === "setup" ? "setup" : "today");
    if (!store.get("guideSeen", false)) openGuide();
  });
  $("onb-close").addEventListener("click", () => { $("onb").hidden = true; });
  $("onb-delete").addEventListener("click", () => {
    if (!confirm(`Remove ${draft.name || "this dog"} and all their progress? This can't be undone.`)) return;
    dogs = dogs.filter((d) => d.id !== draft.id); store.del("d." + draft.id); saveDogs();
    loadDog(dogs[0] ? dogs[0].id : null);
    $("onb").hidden = true; show("setup");
  });

  function renderDogs() {
    const box = $("doglist"); box.replaceChildren();
    if (!dogs.length) box.append(el("p", "muted", "No dog yet."));
    for (const d of dogs) {
      const row = el("div");
      const who = el("span", "", (d.name || "Unnamed") + (d.breed ? ` · ${d.breed}` : "") + (dog && d.id === dog.id ? " · active" : ""));
      const edit = el("button", "linkbtn", "Edit"); edit.type = "button";
      edit.addEventListener("click", () => openOnboarding(d.id));
      row.append(who, edit); box.append(row);
    }
    renderHistory();
  }
  $("dog-add").addEventListener("click", () => openOnboarding(null));

  // ---------- Training session: a short playlist of blocks ----------
  // block: { id, kind: learn | proof | review | practice | free | charge, role, reps: [], target, lv, raise, before }
  let run = null, ticker = null, lock = null, hold = null, undoSnap = null;
  const block = () => (run ? run.blocks[run.i] : null);
  const targetFor = (b) => (b.kind === "free" ? Infinity : b.kind === "learn" ? (stage() === "puppy" ? 5 : 10) : 5);

  function startPlan() {
    const p = plan();
    if (p.blocks[0].kind === "charge") { show("charge"); return; }
    beginRun(p.blocks.map((b) => ({ ...b })), true);
  }
  function startSingle(id) {
    if (!st.charged && id !== "free") { toast("Charge Yes first: 2 minutes so Yes means food."); show("charge"); return; }
    beginRun([{ id, kind: id === "free" ? "free" : kindFor(id), role: "only" }], false);
  }
  function beginRun(blocks, fromPlan) {
    run = { blocks, i: 0, fromPlan, start: 0, marks: 0, counts: { yes: 0, catch: 0, keep: 0, free: 0, miss: 0 } };
    blocks.forEach((b) => { b.reps = []; b.before = b.id === "free" ? 0 : level(b.id); });
    store.set("running", true);
    show("run");
    enterBlock();
    renderClock();
  }
  function enterBlock() {
    const b = block();
    cancelHold(); coachOff(); undoSnap = null; $("undo").hidden = true;
    b.target = targetFor(b);
    if (b.kind === "proof") { const t = proofTarget(b.id); b.lv = t.lv; b.raise = t.raise; if (!t.raise) b.kind = "practice"; }
    if (b.kind === "review" || b.kind === "practice") b.lv = bestLevels(b.id);
    renderBlock();
    if (b.kind === "learn") stepHowto(b.id);
  }
  function renderBlock() {
    const b = block(), s = getSkill(b.id), guided = s.steps.length > 0;
    const n = run.blocks.length;
    $("run-name").textContent = s.name;
    $("stepcard").hidden = !guided;
    $("reps").style.visibility = guided ? "visible" : "hidden";
    $("block-skip").hidden = !(run.i < n - 1);
    if (!guided) { $("run-step-n").textContent = s.goal; setMarkers(true); $("hold").hidden = true; return; }
    const p = prog(b.id), learn = b.kind === "learn";
    const step = learn ? s.steps[p.step] : s.steps.find((x) => x.hold) || s.steps[s.steps.length - 1];
    const label = { learn: `Step ${p.step + 1} of ${s.steps.length} · ${step.t}`, proof: "Proofing", review: "Review", practice: LEVELS[level(b.id)] }[b.kind];
    $("run-step-n").textContent = (n > 1 ? `${run.i + 1} of ${n} · ` : "") + label;
    const mk = learn ? step.mark : s.proofMark || s.steps[s.steps.length - 1].mark;
    const markText = mk.charAt(0).toUpperCase() + mk.slice(1);
    $("run-mark").textContent = markText;
    $("run-proof").hidden = learn || !dims(s).length;
    if (!learn && dims(s).length) $("run-proof").textContent = (b.kind === "proof" ? "Today's level: " : "At: ") + describeLv(s, b.lv);
    $("step-prev").hidden = $("step-next").hidden = !learn;
    $("step-prev").disabled = p.step === 0;
    $("step-next").disabled = p.step === s.steps.length - 1;
    $("howto-title").textContent = `${s.name}: ${step.t}`;
    $("howto-mark").textContent = markText;
    $("howto-setup").textContent = step.setup;
    $("howto-reward").textContent = step.reward;
    $("howto-cue").textContent = s.cue;
    const h = holdRange(b);
    setMarkers(!!(step.keep || h || (!learn && s.proof && s.proof.dur)));
    $("hold").hidden = !h;
    cancelHold();
    renderReps();
  }
  // A hold step uses its own range while learning; once proofing, the duration level sets it.
  function holdRange(b) {
    const s = getSkill(b.id), learn = b.kind === "learn";
    const step = learn ? s.steps[prog(b.id).step] : s.steps.find((x) => x.hold);
    if (!step || !step.hold) return null;
    if (!learn && s.proof && s.proof.dur && b.lv) { const v = dimValue(s, "dur", b.lv.dur); return [v, Math.round(v * 1.3)]; }
    return step.hold;
  }
  function setMarkers(withKeep) { $("mk-keep").hidden = !withKeep; }
  function renderReps() {
    const b = block(), r = (b.kind === "learn" ? prog(b.id).reps : b.reps).slice(-5), box = $("reps");
    box.replaceChildren();
    for (let i = 0; i < 5; i++) { const d = el("i"); if (i < r.length) d.className = r[i] ? "y" : "n"; box.append(d); }
  }
  function setStep(n) {
    const b = block(), s = getSkill(b.id), p = prog(b.id);
    p.step = Math.max(0, Math.min(s.steps.length - 1, n)); p.reps = [];
    saveSt(); renderBlock(); stepHowto(b.id);
  }
  $("step-prev").addEventListener("click", () => setStep(prog(block().id).step - 1));
  $("step-next").addEventListener("click", () => setStep(prog(block().id).step + 1));
  $("block-skip").addEventListener("click", () => nextBlock());

  function coach(text, actions) {
    $("coach-text").textContent = text;
    const row = $("coach-actions"); row.replaceChildren();
    actions.forEach(([label, fn, solid]) => {
      const b = el("button", "btn" + (solid ? " solid" : ""), label); b.type = "button";
      b.addEventListener("click", () => { coachOff(); fn(); });
      row.append(b);
    });
    $("stepcard").classList.add("coaching");
  }
  const coachOff = () => $("stepcard").classList.remove("coaching");

  // Every 5 tries: 4-5 right = harder, 3 = stay, 0-2 = easier. Applied automatically; Easier/Harder can override.
  function logRep(ok) {
    const b = block(); if (!b || b.kind === "free") return;
    const s = getSkill(b.id), p = prog(b.id);
    b.reps.push(ok);
    if (b.kind === "learn") p.reps.push(ok);
    saveSt(); renderReps();
    const r = b.reps;
    if (!ok && r.length >= 2 && !r[r.length - 2] && r.length % 5) {
      coach("Two misses in a row. Make it easier for a few reps: closer, shorter, quieter.", [["OK", () => {}, true]]);
    }
    if (r.length % 5) return;
    const hits = r.slice(-5).filter(Boolean).length;
    const msg = roundResult(b, s, p, hits);
    const end = r.length >= b.target;
    if (!end) { coach(msg, [["OK", () => {}, true]]); return; }
    const nxt = run.blocks[run.i + 1];
    coach(msg, [
      [nxt ? `Next: ${getSkill(nxt.id).name}` : "Finish session", () => nextBlock(), true],
      ["One more round", () => { b.target += 5; }],
    ]);
  }
  // A new step brings new setup, so its how-to opens the first time it is reached.
  function stepHowto(id) {
    const key = id + ":" + prog(id).step;
    if (!st.seen[key]) { st.seen[key] = true; saveSt(); openHowto(); }
  }
  function roundResult(b, s, p, hits) {
    const up = hits >= 4, down = hits <= 2, name = dogName();
    if (b.kind === "learn") {
      const last = p.step === s.steps.length - 1;
      if (up && last) {
        if (!p.passDays) p.passDays = [];
        if (!p.passDays.includes(today())) p.passDays.push(today());
        const was = p.done; p.done = p.passDays.length >= 2; p.reps = []; saveSt();
        if (p.done && !was) {
          b.kind = proofTarget(b.id) && proofTarget(b.id).raise ? "proof" : "practice"; b.reps = []; b.target = 5;
          if (b.kind === "proof") { const t = proofTarget(b.id); b.lv = t.lv; b.raise = t.raise; } else b.lv = bestLevels(b.id);
          renderBlock();
          return `${hits} of 5 on the last step, on ${p.passDays.length} different days: ${s.name} is Fluent! Next it gets proofed: ${dims(s).length ? "longer, farther, busier, one at a time." : "practice in new places."}`;
        }
        return `${hits} of 5 on the last step. Pass it again on another day, ideally somewhere new, to make it Fluent.`;
      }
      if (up) { p.step++; p.reps = []; saveSt(); renderBlock(); stepHowto(b.id); return `${hits} of 5. ${name} has this step. On to step ${p.step + 1}: ${s.steps[p.step].t}.`; }
      if (hits === 3) return "3 of 5. Same step for another round.";
      if (p.step > 0) { p.step--; p.reps = []; saveSt(); renderBlock(); stepHowto(b.id); return `${hits} of 5. Too hard right now, so back to step ${p.step + 1} to build it up again.`; }
      return `${hits} of 5. Make it easier: quieter room, closer, better treats. Is Yes charged?`;
    }
    let extra = "";
    if (b.kind === "proof") {
      if (up) {
        p.best ||= {};
        for (const d of dims(s)) p.best[d] = Math.max(p.best[d] || 0, b.lv[d]);
        const lv = level(b.id);
        extra = lv >= 2 ? `${s.name} is Proofed! Now pass it in 3 kinds of place.` : `Passed at ${describeLv(s, b.lv)}. Next time: ${describeLv(s, proofTarget(b.id).lv)}.`;
      } else extra = down ? "Too big a jump. Next time eases off, then builds back." : "Same level next time.";
      if (up && level(b.id) >= 2) logPlace(b.id);
    } else if (b.kind === "review") {
      const r = reviewResult(b.id, up);
      extra = r === "pass" ? `Still solid. Next review in ${p.interval} days.` : r === "drop" ? "Two reviews missed in a row, so it goes back to Proofed for some practice in different places." : "Rusty: it comes back sooner for practice.";
      b.kind = "practice";
    } else if (up && level(b.id) >= 2) {
      if (logPlace(b.id)) extra = `${s.name} is Reliable! It goes on a review schedule now so it never fades.`;
      else extra = level(b.id) === 2 ? nextText(b.id) : "";
    }
    if (!extra && up) extra = b.role === "warm" ? "Good warm-up." : b.role === "finish" ? "Calm finish. Session done." : "Solid.";
    if (!extra) extra = hits === 3 ? "Close. Keep it easy and go again." : "Make it easier next round: closer, shorter, quieter.";
    saveSt();
    return `${hits} of 5. ${extra}`.trim();
  }

  function nextBlock() {
    cancelHold();
    const b = block();
    if (b && b.reps.length) { prog(b.id).last = today(); saveSt(); }
    if (run.i < run.blocks.length - 1) { run.i++; enterBlock(); return; }
    closeRun();
  }

  // Hold timer: a random target inside the range so the dog can't predict the end, then marks Yes.
  function startHold() {
    const [lo, hi] = holdRange(block());
    const secs = Math.round(lo + Math.random() * (hi - lo));
    hold = { end: Date.now() + secs * 1000 };
    $("hold").classList.add("running");
    const tickHold = () => {
      const left = Math.ceil((hold.end - Date.now()) / 1000);
      if (left <= 0) { cancelHold(); mark("yes", null, $("pad")); return; }
      $("hold").textContent = `Holding… ${left} s  (tap to cancel)`;
      hold.timer = setTimeout(tickHold, 200);
    };
    tickHold();
  }
  function cancelHold() {
    if (hold) clearTimeout(hold.timer);
    hold = null;
    $("hold").classList.remove("running");
    const b = block();
    const h = b && getSkill(b.id).steps.length ? holdRange(b) : null;
    if (h) $("hold").textContent = h[0] === h[1] ? `Start hold (${h[0]} s)` : `Start hold (${h[0]} to ${h[1]} s)`;
  }
  $("hold").addEventListener("click", () => { initAudio(); hold ? cancelHold() : startHold(); });

  // ---------- Marks ----------
  const treatsToday = () => { if (st.treats.day !== today()) { st.treats.day = today(); st.treats.used = 0; } return st.treats; };
  function lockScreen() {
    if (!run || lock) return;
    try { navigator.wakeLock?.request("screen").then((l) => { if (run) { lock = l; l.addEventListener?.("release", () => (lock = null)); } else l.release(); }).catch(() => {}); } catch {}
  }
  // The live session is saved on every mark: iOS can close a backgrounded app without warning.
  const saveLive = () => { if (run && run.start) { st.live = { start: run.start, at: Date.now(), marks: run.marks, blocks: run.blocks.map((b) => b.id) }; saveSt(); } };

  function mark(name, e, node) {
    if (!run) return;
    if (name !== "miss") play(name);
    feedback(node);
    if (rec.recorder && rec.recorder.state === "recording") rec.marks.push({ t: ((e && e.timeStamp > 0 ? e.timeStamp : performance.now()) - rec.startAt) / 1000, kind: name });
    // One step of undo: a mis-tap is the most common error outdoors.
    undoSnap = { st: JSON.stringify(st), run: JSON.stringify({ ...run }), rec: rec.marks.length };
    $("undo").hidden = false;
    if (!run.start) { run.start = Date.now(); ticker = setInterval(renderClock, 500); lockScreen(); $("pad-sub").textContent = "Tap, then treat."; }
    run.counts[name] = (run.counts[name] || 0) + 1;
    if (name === "miss") { cancelHold(); logRep(false); }
    else if (name === "yes" || name === "catch") { cancelHold(); run.marks++; treatsToday().used++; logRep(true); }
    else if (name === "free") cancelHold();
    saveLive();
    renderClock();
  }
  function undo() {
    if (!undoSnap || !run) return;
    const i = run.i;
    st = JSON.parse(undoSnap.st);
    const r = JSON.parse(undoSnap.run); Object.assign(run, r);
    rec.marks.length = Math.min(rec.marks.length, undoSnap.rec - 1 < 0 ? 0 : undoSnap.rec - 1);
    undoSnap = null; $("undo").hidden = true;
    saveSt(); coachOff();
    if (run.i !== i) enterBlock(); else renderBlock();
    renderClock(); toast("Last mark undone.");
  }
  $("undo").addEventListener("click", undo);

  function renderClock() {
    const secs = run && run.start ? Math.floor((Date.now() - run.start) / 1000) : 0;
    $("run-clock").textContent = fmt(secs);
    const rate = run && run.start && secs >= 10 ? Math.round(run.marks / (secs / 60)) : null;
    $("run-rate").textContent = !run || !run.start ? "tap to start" : rate === null ? `${run.marks} marks` : `${rate} a minute`;
    // Under ~8 rewards a minute, beginners lose interest; past 3 minutes a block, end while the dog still wants more.
    $("run-meta").classList.toggle("slow", rate !== null && secs >= 30 && rate < 8);
    $("run-meta").classList.toggle("long", secs >= (run ? 60 * (2 + 3 * run.blocks.length) : 180));
  }

  // ---------- Ending a session ----------
  function fileSession(blocksIds, start, secs, marks, video, blocks) {
    st.history.unshift({ at: new Date(start + secs * 1000).toISOString(), secs, marks, blocks: blocksIds });
    st.history = st.history.slice(0, 100);
    if (!st.days.includes(today())) st.days.push(today());
    st.days = st.days.slice(-120);
    const names = blocksIds.map((id) => getSkill(id).name);
    const hits = blocks ? blocks.reduce((a, b) => a + b.reps.filter(Boolean).length, 0) : 0;
    const tries = blocks ? blocks.reduce((a, b) => a + b.reps.length, 0) : 0;
    st.last = {
      title: names.length > 2 ? `${names[0]} + ${names.length - 1} more` : names.join(" + "), secs, marks,
      rate: secs >= 20 ? Math.round(marks / (secs / 60)) : null,
      round: tries ? `${hits} of ${tries} tries right` : "",
      treats: `${treatsToday().used} of ${settings.budget} treats used today`, video,
    };
  }
  function recoverLive() {
    const s = st && st.live;
    if (!s) return;
    st.live = null;
    if (s.marks > 0) fileSession(s.blocks || ["free"], s.start, Math.max(1, Math.round(((s.at || s.start) - s.start) / 1000)), s.marks, false);
    saveSt();
  }
  function closeRun() {
    if (!run) return;
    cancelHold(); coachOff();
    const recorded = !!rec.recorder || rec.fresh;
    if (rec.recorder) stopRecording(true);
    rec.fresh = false;
    clearInterval(ticker);
    try { lock && lock.release(); } catch {} lock = null;
    store.del("running");
    const r = run; run = null; undoSnap = null;
    $("pad-sub").textContent = "Tap the moment it happens. Then treat.";
    const worked = r.blocks.filter((b) => b.reps && b.reps.length || b.kind === "free" && r.marks);
    if (r.start && r.marks > 0) {
      const secs = Math.round((Date.now() - r.start) / 1000);
      worked.forEach((b) => { if (b.id !== "free") prog(b.id).last = today(); });
      fileSession(worked.map((b) => b.id), r.start, secs, r.marks, recorded, worked);
      if (r.fromPlan && r.marks >= 5 && st.plan) st.plan.done = true;
      st.live = null; saveSt();
      showSummary(r, secs, worked);
    } else { st.live = null; saveSt(); }
    show(lastTab);
  }
  $("run-back").addEventListener("click", () => closeRun());

  function showSummary(r, secs, worked) {
    $("sum-time").textContent = fmt(secs);
    $("sum-marks").textContent = r.marks;
    const rate = secs >= 20 ? Math.round(r.marks / (secs / 60)) : null;
    $("sum-rate").textContent = rate ?? "–";
    $("sum-rate-wrap").classList.toggle("slow", rate != null && rate < 8);
    const box = $("sum-blocks"); box.replaceChildren();
    for (const b of worked) {
      if (b.id === "free") continue;
      const row = el("div"), after = level(b.id), hits = b.reps.filter(Boolean).length;
      const name = el("b", after > b.before ? "up" : "", getSkill(b.id).name + (after > b.before ? ` · now ${LEVELS[after]}` : ""));
      row.append(ring(b.id), name, el("span", "", `${hits} of ${b.reps.length} right. ${nextText(b.id)}`));
      box.append(row);
    }
    document.querySelectorAll("#sum-rate-dog .choice").forEach((c) => c.setAttribute("aria-pressed", "false"));
    $("summary").hidden = false; $("summary").scrollTop = 0;
  }
  document.querySelectorAll("#sum-rate-dog .choice").forEach((c) => c.addEventListener("click", () => {
    document.querySelectorAll("#sum-rate-dog .choice").forEach((x) => x.setAttribute("aria-pressed", x === c));
    st.ratings.push(c.dataset.r); st.ratings = st.ratings.slice(-10);
    if (st.history[0]) st.history[0].rating = c.dataset.r;
    saveSt();
  }));
  $("sum-done").addEventListener("click", () => { $("summary").hidden = true; show("today"); });

  function renderHistory() {
    const el2 = $("history"); el2.replaceChildren();
    const h = st ? st.history : [];
    if (!h.length) { el2.append(el("p", "muted", "Finished sessions show up here.")); return; }
    for (const s of h.slice(0, 12)) {
      const d = new Date(s.at), row = el("div");
      const names = (s.blocks || [s.module]).map((id) => getSkill(id).name);
      row.append(el("span", "", d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + (names.length > 2 ? `${names[0]} + ${names.length - 1}` : names.join(", "))),
        el("span", "", s.marks + " marks"), el("span", "", fmt(s.secs)));
      el2.append(row);
    }
  }

  // Marks fire on touch-down, not on release: release adds 100+ ms.
  const onDown = (node, fn) => node.addEventListener("pointerdown", (e) => { if (e.button > 0) return; e.preventDefault(); fn(e); });
  onDown($("pad"), (e) => mark("yes", e, $("pad")));
  document.querySelectorAll(".mk").forEach((b) => onDown(b, (e) => mark(b.dataset.sound, e, b)));

  // ---------- Recall: one press from anywhere ----------
  function recall(node) {
    play("recall"); feedback(node);
    toast("Recall played. Jackpot when they arrive!");
  }
  onDown($("fab"), () => recall($("fab")));
  onDown($("run-recall"), () => recall(null));

  // ---------- Sheets ----------
  const guide = $("guide"), howto = $("howto");
  const openGuide = () => { guide.hidden = false; guide.scrollTop = 0; store.set("guideSeen", true); };
  $("open-guide").addEventListener("click", openGuide);
  for (const id of ["close-guide", "close-guide-2"]) $(id).addEventListener("click", () => (guide.hidden = true));
  $("go-charge").addEventListener("click", () => { if (dog) show("charge"); else openOnboarding(null); });
  function openHowto() { howto.hidden = false; howto.scrollTop = 0; }
  $("open-howto").addEventListener("click", openHowto);
  for (const id of ["close-howto", "close-howto-2"]) $(id).addEventListener("click", () => (howto.hidden = true));
  $("skill-reset").addEventListener("click", () => {
    const b = block(); if (!b || !resetSkill(b.id)) return;
    howto.hidden = true; b.kind = "learn"; b.reps = []; enterBlock();
  });

  // ---------- Recording and review ----------
  // Hold the phone at your chest: the screen faces you, the back camera faces the dog.
  const rec = { stream: null, recorder: null, chunks: [], marks: [], startAt: 0, duration: 0, blob: null, url: "", has: false, fresh: false, cap: 0 };
  const canRecord = !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  $("rec").hidden = !canRecord;

  async function startRecording() {
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } }, audio: false });
    } catch {
      toast("Camera not available. Allow camera access for this app in your phone's settings.", 4000);
      return;
    }
    const cam = $("cam"); cam.srcObject = rec.stream; cam.hidden = false; cam.play().catch(() => {});
    const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
    rec.recorder = new MediaRecorder(rec.stream, mime ? { mimeType: mime } : undefined);
    rec.chunks = []; rec.marks = [];
    rec.recorder.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
    rec.recorder.onstart = () => { rec.startAt = performance.now(); }; // closest available clock to the first frame
    rec.recorder.onstop = () => {
      rec.blob = new Blob(rec.chunks, { type: rec.recorder?.mimeType || mime || "video/mp4" });
      if (rec.url) URL.revokeObjectURL(rec.url);
      rec.url = URL.createObjectURL(rec.blob); rec.has = true; rec.recorder = null;
      renderLast();
    };
    rec.startAt = performance.now();
    rec.recorder.start(1000);
    rec.fresh = true;
    // A long video fills the phone's memory; 10 minutes is far longer than a good session.
    rec.cap = setTimeout(() => { stopRecording(); toast("Recording stopped at 10 minutes. Sessions work best short.", 4000); }, 10 * 60 * 1000);
    rec.stream.getVideoTracks()[0]?.addEventListener("ended", () => stopRecording());
    $("rec").classList.add("on"); $("rec").textContent = "Recording";
  }
  function stopRecording(quiet) {
    if (!rec.recorder) return;
    clearTimeout(rec.cap);
    rec.duration = (performance.now() - rec.startAt) / 1000;
    try { rec.recorder.stop(); } catch {}
    rec.stream?.getTracks().forEach((t) => t.stop());
    rec.stream = null;
    $("cam").hidden = true; $("cam").srcObject = null;
    $("rec").classList.remove("on"); $("rec").textContent = "Record";
    if (!quiet) toast(run ? "Recording stopped. Review it from Today when the session ends." : "Recording stopped.");
  }
  $("rec").addEventListener("click", () => (rec.recorder ? stopRecording() : startRecording()));


  const rv = { i: -1, lags: {} };
  const video = $("rv-video");
  const rvDur = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : rec.duration || 1);
  function openReview() {
    if (!rec.has) return;
    $("review").hidden = false;
    video.src = rec.url; video.playbackRate = 1; rv.i = -1; rv.lags = {};
    $("rv-save").hidden = !(navigator.canShare && navigator.canShare({ files: [new File([rec.blob], "session.mp4", { type: rec.blob.type })] }));
    drawLine(); rvSummary();
    $("rv-info").textContent = rec.marks.length
      ? `${rec.marks.length} marks. Jump to one, step frame by frame to the moment it really happened (rump on the floor, nose on the palm), then tap Here.`
      : "No marks in this video. Tap Yes while recording to see your timing here.";
  }
  function drawLine() {
    const line = $("rv-line");
    line.querySelectorAll("i").forEach((n) => n.remove());
    rec.marks.forEach((m, i) => {
      const n = document.createElement("i");
      n.className = (m.kind === "miss" ? "miss" : "") + (i === rv.i ? " sel" : "");
      n.style.left = Math.min(100, (m.t / rvDur()) * 100) + "%";
      line.append(n);
    });
  }
  function goMark(i) {
    if (!rec.marks.length) return;
    rv.i = Math.max(0, Math.min(rec.marks.length - 1, i));
    video.pause();
    video.currentTime = Math.max(0, rec.marks[rv.i].t);
    drawLine();
    const m = rec.marks[rv.i];
    $("rv-info").textContent = `Mark ${rv.i + 1} of ${rec.marks.length} (${m.kind === "miss" ? "Miss" : m.kind === "yes" ? "Yes" : m.kind}). This frame is when you tapped. Step back to find the real moment, then tap Here.`;
  }
  video.addEventListener("timeupdate", () => {
    $("rv-head").style.left = Math.min(100, (video.currentTime / rvDur()) * 100) + "%";
    const near = rec.marks.find((m) => Math.abs(m.t - video.currentTime) < 0.07);
    $("rv-flash").hidden = !near;
    if (near) { $("rv-flash").textContent = near.kind === "miss" ? "Miss" : "Yes"; $("rv-flash").classList.toggle("miss", near.kind === "miss"); }
  });
  $("rv-prev").addEventListener("click", () => goMark(rv.i < 0 ? 0 : rv.i - 1));
  $("rv-next").addEventListener("click", () => goMark(rv.i + 1));
  $("rv-play").addEventListener("click", () => {
    if (!video.paused) { video.pause(); $("rv-play").textContent = "Play slow"; return; }
    // Slow motion from a second before the current point shows what led up to the mark.
    if (rv.i >= 0) video.currentTime = Math.max(0, rec.marks[rv.i].t - 1);
    video.playbackRate = 0.25; video.play().catch(() => {});
    $("rv-play").textContent = "Pause";
  });
  video.addEventListener("pause", () => ($("rv-play").textContent = "Play slow"));
  const step = (d) => { video.pause(); video.currentTime = Math.max(0, Math.min(rvDur(), video.currentTime + d)); };
  $("rv-back1").addEventListener("click", () => step(-1 / 30));
  $("rv-fwd1").addEventListener("click", () => step(1 / 30));
  $("rv-moment").addEventListener("click", () => {
    if (rv.i < 0) { $("rv-info").textContent = "Jump to a mark first, then find the real moment."; return; }
    const lag = Math.round((rec.marks[rv.i].t - video.currentTime) * 1000);
    rv.lags[rv.i] = lag;
    $("rv-info").textContent = lag >= 0
      ? `You tapped ${lag} ms after the real moment. ${lag <= 200 ? "Sharp." : lag <= 350 ? "Good." : "Late: watch for the start of the movement you want and tap as it completes."}`
      : `You tapped ${-lag} ms before it happened: that marks the movement on its way, not the result. Wait for the finish.`;
    rvSummary();
  });
  function rvSummary() {
    const v = Object.values(rv.lags).sort((a, b) => a - b);
    $("rv-summary").textContent = v.length ? `Checked ${v.length} mark${v.length > 1 ? "s" : ""}: typical ${v[Math.floor(v.length / 2)] >= 0 ? "+" : ""}${v[Math.floor(v.length / 2)]} ms. Within ±50 ms is camera timing noise.` : "";
  }
  $("rv-line").addEventListener("pointerdown", (e) => {
    const r = $("rv-line").getBoundingClientRect();
    video.pause(); video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * rvDur();
  });
  $("rv-close").addEventListener("click", () => { video.pause(); $("review").hidden = true; });
  $("rv-save").addEventListener("click", () => {
    const ext = rec.blob.type.includes("webm") ? "webm" : "mp4";
    navigator.share({ files: [new File([rec.blob], `training-${today()}.${ext}`, { type: rec.blob.type })] }).catch(() => {});
  });

  // ---------- Charge the marker ----------
  const REPS = 20;
  let charge = { done: 0, running: false, timer: null };
  const dots = $("dots");
  for (let i = 0; i < REPS; i++) dots.append(document.createElement("i"));
  function renderCharge(big, sub, treat) {
    $("charge-big").textContent = big; $("charge-sub").textContent = sub;
    $("charge-face").classList.toggle("treat", !!treat);
    [...dots.children].forEach((d, i) => d.classList.toggle("on", i < charge.done));
    $("charge-go").textContent = charge.running ? "Pause" : charge.done ? "Resume" : "Start";
  }
  function chargeStep() {
    if (!charge.running) return;
    if (charge.done >= REPS) {
      charge.running = false; st.charged = true;
      if (!st.days.includes(today())) st.days.push(today());
      st.plan = null; saveSt();
      renderCharge("Charged", "Do one more round tomorrow. Your first skills are on Today now.", false);
      return;
    }
    const wait = 2000 + Math.random() * 3500;
    renderCharge("Wait", "Hands still. Don't reach for a treat yet.", false);
    charge.timer = setTimeout(() => {
      if (!charge.running) return;
      play("yes"); feedback(null); charge.done++;
      renderCharge("Treat", `Rep ${charge.done} of ${REPS}. Hand it over now.`, true);
      charge.timer = setTimeout(chargeStep, 1800);
    }, wait);
  }
  $("charge-go").addEventListener("click", () => {
    initAudio();
    if (charge.running) { charge.running = false; clearTimeout(charge.timer); renderCharge("Paused", `${charge.done} of ${REPS} done.`, false); return; }
    if (charge.done >= REPS) charge.done = 0;
    charge.running = true; chargeStep();
    try { navigator.wakeLock && navigator.wakeLock.request("screen").catch(() => {}); } catch {}
  });
  $("charge-reset").addEventListener("click", () => { charge.running = false; clearTimeout(charge.timer); charge.done = 0; renderCharge("Ready", "Have 20 small treats in hand.", false); });
  $("charge-back").addEventListener("click", () => { charge.running = false; clearTimeout(charge.timer); show(lastTab); });

  // ---------- Settings ----------
  document.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => play(b.dataset.try)));
  const vol = $("vol");
  vol.value = settings.volume;
  const renderVol = () => { $("vol-out").textContent = Math.round(settings.volume * 100) + "%"; $("vol-warn").hidden = settings.volume <= 0.85; };
  vol.addEventListener("input", () => { settings.volume = +vol.value; if (gain) gain.gain.value = settings.volume; renderVol(); saveSettings(); });
  vol.addEventListener("change", () => play("yes"));
  $("opt-haptic").checked = settings.haptic;
  $("opt-flash").checked = settings.flash;
  $("opt-budget").value = settings.budget;
  $("opt-haptic").addEventListener("change", (e) => { settings.haptic = e.target.checked; saveSettings(); });
  $("opt-flash").addEventListener("change", (e) => { settings.flash = e.target.checked; saveSettings(); });
  $("opt-budget").addEventListener("change", (e) => { settings.budget = Math.max(0, parseInt(e.target.value, 10) || 0); saveSettings(); });

  // Decode a recording, cut the silence before the first sound, cap at 1.2 s, fade the tail.
  async function loadCustom(dataUrl) {
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const src = await new Promise((res, rej) => ctx.decodeAudioData(bytes.buffer, res, rej));
    const d = src.getChannelData(0), sr = src.sampleRate;
    let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak < 0.01) throw new Error("silent");
    let start = 0; while (start < d.length && Math.abs(d[start]) < peak * 0.08) start++;
    start = Math.max(0, start - Math.round(sr * 0.003));
    const n = Math.min(d.length - start, Math.round(sr * 1.2)), fade = Math.round(sr * 0.02);
    const out = ctx.createBuffer(1, n, sr), o = out.getChannelData(0);
    for (let i = 0; i < n; i++) o[i] = (d[start + i] / peak) * 0.95 * Math.min(1, (n - i) / fade);
    customBuf = out;
    $("custom-status").textContent = `Using your recording for Yes (${Math.round((start / sr) * 1000)} ms of silence trimmed).`;
    $("custom-clear").hidden = false;
  }
  $("custom-file").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    initAudio();
    if (file.size > 600_000) { $("custom-status").textContent = "That file is too long. Keep the recording to a second or two."; e.target.value = ""; return; }
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(""); r.readAsDataURL(file); });
    try {
      await loadCustom(dataUrl);
      settings.custom = dataUrl;
      if (!store.set("settings", settings)) {
        // Too big for the phone's app storage: use it now, but don't keep it.
        settings.custom = null; saveSettings();
        $("custom-status").textContent = "Using your recording for now, but it's too large to keep after the app closes. Try a shorter clip.";
      }
      play("yes");
    } catch {
      $("custom-status").textContent = "Couldn't read that recording. Try an .m4a from Voice Memos or a .wav.";
    }
    e.target.value = "";
  });
  $("custom-clear").addEventListener("click", () => {
    customBuf = null; settings.custom = null; saveSettings();
    $("custom-status").textContent = "Using the built-in click for Yes."; $("custom-clear").hidden = true;
  });

  // ---------- Your data: backup, restore, erase ----------
  $("backup-save").addEventListener("click", async () => {
    const data = { app: "pocket-trainer", saved: new Date().toISOString(), keys: {} };
    for (const k of store.keys()) data.keys[k] = localStorage.getItem(k);
    const file = new File([JSON.stringify(data)], `pocket-trainer-backup-${today()}.json`, { type: "application/json" });
    // iPhone: the share sheet offers Save to Files. Elsewhere: a normal download.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch {}
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $("backup-file").addEventListener("change", async (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    let data = null;
    try { data = JSON.parse(await file.text()); } catch {}
    if (!data || data.app !== "pocket-trainer" || typeof data.keys !== "object") { toast("That file isn't a Pocket Trainer backup.", 4000); return; }
    if (!confirm(`Replace everything on this phone with the backup from ${new Date(data.saved).toLocaleDateString()}?`)) return;
    try {
      for (const k of store.keys()) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(data.keys)) if (k.startsWith("pt.") && typeof v === "string") localStorage.setItem(k, v);
    } catch { toast("Couldn't restore: the phone's storage is full.", 4000); return; }
    location.reload();
  });
  $("erase-all").addEventListener("click", () => {
    if (!confirm("Erase every dog, all progress and settings? This can't be undone.")) return;
    try { for (const k of store.keys()) localStorage.removeItem(k); } catch {}
    location.reload();
  });
  // Ask the browser not to clear this app's data when the phone runs low on space.
  const persist = () => { try { navigator.storage?.persist?.().catch(() => {}); } catch {} };
  // The offline cache's name carries the build version: handy to tell which version is running.
  (async () => {
    let v = "";
    try { v = ((await caches.keys()).find((k) => k.startsWith("pocket-trainer-")) || "").replace("pocket-trainer-", ""); } catch {}
    $("version").textContent = v ? `Version ${v}${installed ? " · installed" : ""}` : "";
  })();


  // ---------- Keys (keyboards and Bluetooth remotes) ----------
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input") || e.metaKey || e.ctrlKey || e.altKey) return;
    // A focused button would also "click" on Space/Enter; drop focus so one key press is one mark.
    if (e.target.matches("button")) e.target.blur();
    if (e.repeat) return;
    if (e.key === "r") { e.preventDefault(); recall(null); return; }
    if (e.key === "u" && run) { e.preventDefault(); undo(); return; }
    if ($("s-run").hidden || !guide.hidden || !howto.hidden || !$("review").hidden) return;
    const map = { " ": "yes", Enter: "yes", c: "catch", k: "keep", f: "free", m: "miss" };
    const s = map[e.key]; if (!s) return;
    e.preventDefault();
    mark(s, e, s === "yes" ? $("pad") : document.querySelector(`.mk[data-sound="${s}"]`));
  });

  $("unlock-btn").addEventListener("click", () => {
    initAudio(); ctx.resume().catch(() => {}); $("unlock").hidden = true; persist();
    if (!dog) openOnboarding(null);
    else if (!store.get("guideSeen", false)) openGuide();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // iOS cuts the camera when the app leaves the screen; close the file cleanly so the video is still reviewable.
      if (rec.recorder) stopRecording(true);
      return;
    }
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
    lockScreen();
    if (!run && $("s-today") && !$("s-today").hidden) renderToday();
  });
  // A bug should never leave the app silently stuck: say how to recover.
  window.addEventListener("error", () => toast("Something went wrong. If a button stops working, close the app and open it again.", 5000));

  if (st) recoverLive();
  store.del("running");
  renderVol(); renderCharge("Ready", "Have 20 small treats in hand.", false);
  show(["today", "skills", "setup"].includes(store.get("tab", "today")) ? store.get("tab", "today") : "today");
})();
