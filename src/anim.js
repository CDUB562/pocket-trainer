// Pocket Trainer animations: a dog and a handler drawn from keyframed poses, one short loop per step.
// Same idea as KBY Flow: poses are numbers, the player eases every number between keyframes, and the
// renderer draws the figures from them. Each loop shows the setup, the exact moment to tap YES (or the
// outcome to log, for field skills), and the reward.
//
// World units: the ground is y = 0, up is negative. A standing medium dog is about 60 tall, a person 180.
// Default view: x 0..320. Templates in anim-steps.js build the keyframes; this file draws and plays them.

const PTAnim = (() => {
  const D = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P = (x, y) => ({ x, y });
  const mix = (a, b, t) => P(lerp(a.x, b.x, t), lerp(a.y, b.y, t));

  // Every animated number and its default. Anything not set by a keyframe stays at its default.
  //   handler: px position, pf facing (1 = right), pk kneel 0..1, pl lean (deg), ax/ay hand target, hs hand shape,
  //            oh other hand (side | pouch | chest | mouth), leash sag (0 none, >0 slack, <0 tight), pole (flirt pole on)
  //   dog:     dx, df facing, dr rear down, dfr front down, dh head angle (+ up), dre neck reach, dpaw point paw,
  //            dtail (0 low .. 1 high), dwag, dswim, dcar (carried item), drest (head resting), dup (standing on something this high)
  //   treat:   tx ty ton   item: ix iy ion item   bird: bx by bon   door: door 0..1 open
  //   second dog o2*, walker wx wf, helper hpx
  const BASE = {
    px: 80, pf: 1, pk: 0, pl: 0, ax: NaN, ay: NaN, hs: "open", oh: "side", leash: 0, pole: 0,
    dx: 170, df: -1, dr: 0, dfr: 0, dh: 0, dre: 0, dpaw: 0, dtail: 0.3, dwag: 0.35, dswim: 0, dcar: "", drest: 0, dup: 0,
    tx: 0, ty: 0, ton: 0, ix: 0, iy: 0, ion: 0, item: "bumper", bx: 0, by: 0, bon: 0, door: 0,
    o2x: -999, o2f: 1, o2r: 0, o2fr: 0, o2h: 0, o2paw: 0, o2tail: 0.3, wx: -999, wf: -1, wk: 0, wax: NaN, way: NaN, hpx: -999, i2x: 0, i2y: 0, i2on: 0, dtilt: 0,
  };
  const DISCRETE = new Set(["hs", "oh", "dcar", "item"]);

  // ---------- figures: joint positions shared by the renderer and the step templates ----------

  // The handler, facing +x in local space. Kneel lowers the hips onto one knee; lean tips the torso forward.
  function human(px, pf, pk, pl) {
    const hipY = lerp(-92, -50, pk), hip = P(px, hipY);
    const lr = pl * D, sh = P(px + pf * Math.sin(lr) * 62, hipY - Math.cos(lr) * 62);
    const head = P(sh.x + pf * Math.sin(lr) * 20, sh.y - Math.cos(lr) * 20 - 4);
    return { hip, sh, head, rest: P(sh.x + pf * 5, sh.y + 56), seam: P(px + pf * 10, hipY + 6), chest: P(sh.x + pf * 18, sh.y + 18) };
  }

  // The dog: three canonical poses (stand, sit, down) blended by rear (dr) and front (dfr), in local space facing +x.
  const POSE = {
    stand: { S: P(0, -38), H: P(-42, -38), fe: P(2, -19), fp: P(2, 0), rk: P(-36, -20), rh: P(-47, -9), rp: P(-44, 0) },
    sit: { S: P(3, -44), H: P(-30, -11), fe: P(5, -22), fp: P(5, 0), rk: P(-16, -8), rh: P(-30, -2), rp: P(-12, 0) },
    down: { S: P(5, -17), H: P(-38, -12), fe: P(10, -6), fp: P(24, 0), rk: P(-24, -6), rh: P(-36, -3), rp: P(-22, 0) },
  };
  function dogLocal(s) {
    const ws = 1 - s.dr, wsit = s.dr * (1 - s.dfr), wd = s.dr * s.dfr, J = {};
    for (const k of Object.keys(POSE.stand)) J[k] = P(
      POSE.stand[k].x * ws + POSE.sit[k].x * wsit + POSE.down[k].x * wd,
      POSE.stand[k].y * ws + POSE.sit[k].y * wsit + POSE.down[k].y * wd);
    // Point: the near front paw lifts and folds.
    if (s.dpaw) { J.fe = mix(J.fe, P(9, -25), s.dpaw); J.fp = mix(J.fp, P(13, -15), s.dpaw); }
    const N = P(J.S.x + 5, J.S.y - 6);
    const th = (48 + s.dh * 0.75) * D;
    const C = P(N.x + Math.cos(th) * 15 + s.dre * 14, N.y - Math.sin(th) * 15);
    if (s.drest) { const R = P(J.fp.x + 2, -7); C.x = lerp(C.x, R.x, s.drest); C.y = lerp(C.y, R.y, s.drest); }
    const sa = clamp(s.dh * 0.55, -70, 40) * D * (1 - s.drest);
    const snout = P(C.x + Math.cos(sa) * 12, C.y - Math.sin(sa) * 12);
    return { ...J, N, C, sa, snout };
  }
  // World position of a dog part, for templates (where the nose is, where the paws are).
  function dogPart(s, part) {
    const L = dogLocal({ ...BASE, ...s }), f = s.df === undefined ? -1 : s.df, dy = (s.dswim || 0) * 16 - (s.dup || 0);
    const w = (p) => P((s.dx === undefined ? BASE.dx : s.dx) + f * p.x, p.y + dy);
    return w(L[part] || L.snout);
  }

  // ---------- the player ----------

  function sample(keys, t) {
    const st = {};
    for (const f of Object.keys(BASE)) {
      let a = null, b = null, prevT = 0;
      for (const k of keys) {
        if (!(f in k)) { if (k.t <= t) prevT = k.t; continue; }
        if (k.t <= t) { a = k; prevT = k.t; } else { b = k; break; }
      }
      const av = a ? a[f] : BASE[f];
      if (!b || DISCRETE.has(f) || typeof av !== "number" || typeof b[f] !== "number") { st[f] = av; continue; }
      // A keyframe's change happens over its own step: from the key just before it, not from the field's last key.
      if (t < b.t) for (const k of keys) { if (k.t < b.t && k.t > prevT) prevT = k.t; if (k.t >= b.t) break; }
      const t0 = Math.max(a ? a.t : 0, prevT), u = clamp((t - t0) / Math.max(0.001, b.t - t0), 0, 1);
      st[f] = Number.isNaN(av) || Number.isNaN(b[f]) ? (u < 1 ? av : b[f]) : lerp(av, b[f], ease(u));
    }
    return st;
  }
  // Events that last a moment: YES, outcome badges, speech, whistles, the doorbell, a shot.
  function events(keys, t) {
    const ev = { cap: "" };
    for (const k of keys) {
      if (k.cap !== undefined && k.t <= t) ev.cap = k.cap;
      if (k.yes && t >= k.t && t < k.t + 0.8) ev.yes = (t - k.t) / 0.8;
      if (k.badge && t >= k.t && t < k.t + 1.4) { ev.badge = k.badge; ev.badgeU = (t - k.t) / 1.4; }
      if (k.say && t >= k.t && t < k.t + 1.3) { ev.say = k.say; ev.sayWho = k.who || "p"; }
      if (k.whistle && t >= k.t && t < k.t + 1.0) { ev.whistle = k.whistle; ev.wU = (t - k.t) / 1.0; }
      if (k.bang && t >= k.t && t < k.t + 0.7) { ev.bang = (t - k.t) / 0.7; ev.bangX = k.bang === true ? null : k.bang; }
      if ((k.yes || k.badge) && t >= k.t) { delete ev.timer; delete ev.say; }
      if (k.ring && t >= k.t && t < k.t + 1.0) ev.ring = (t - k.t) / 1.0;
      if (k.timer && t >= k.t && t < k.t + k.timer) { ev.timer = (t - k.t) / k.timer; ev.timerLabel = k.timerLabel || ""; }
    }
    return ev;
  }

  // ---------- drawing ----------

  function colors() {
    const cs = getComputedStyle(document.documentElement), v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    const dark = matchMedia && matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
    return {
      bg: v("--surface", "#fff"), fg: v("--fg", "#17201b"), muted: v("--muted", "#59645d"), line: v("--line", "#d3d8cf"),
      accent: v("--accent", "#e0561a"), ink: v("--accent-ink", "#fff"), keep: v("--keep", "#3f6b52"), toss: v("--catch", "#2463b8"),
      warn: v("--warn", "#a35a00"), miss: v("--miss", "#a3302a"),
      dog: dark ? "#c99a6b" : "#8e6239", dogFar: dark ? "#a37a52" : "#6f4b2b", person: dark ? "#aab4ad" : "#4f5b54",
      water: dark ? "rgba(91,149,230,.35)" : "rgba(36,99,184,.22)", grass: dark ? "#6fa784" : "#3f6b52",
    };
  }

  const seg = (ctx, a, b, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  const dot = (ctx, p, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI); ctx.fill(); };
  const poly = (ctx, pts, col, stroke) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); if (stroke) { ctx.strokeStyle = col; ctx.lineWidth = stroke; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };

  // Two-bone arm: the elbow bends down and back.
  function ik(sh, tg, l1, l2, pf) {
    const d = Math.min(Math.hypot(tg.x - sh.x, tg.y - sh.y), l1 + l2 - 0.5), a = Math.atan2(tg.y - sh.y, tg.x - sh.x);
    const t = P(sh.x + Math.cos(a) * d, sh.y + Math.sin(a) * d);
    const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), b = Math.acos(c) * (pf > 0 ? 1 : -1);
    return { elb: P(sh.x + Math.cos(a + b) * l1, sh.y + Math.sin(a + b) * l1), hand: t };
  }

  function drawHuman(ctx, C, x, pf, pk, pl, hand, hs, oh, ph, amp, col, extras) {
    // Bend to reach: when the hand target is too far, lean (and crouch a little) until the arm gets there.
    if (!Number.isNaN(hand.x)) for (let i = 0; i < 40; i++) {
      const d = (q) => Math.hypot(hand.x - q.sh.x, hand.y - q.sh.y), d0 = d(human(x, pf, pk, pl)), top = pk >= 1 ? 1.5 : 0.5;
      if (d0 <= 60) break;
      const L2 = pl < 58 ? d(human(x, pf, pk, pl + 3)) : 1e9, K2 = pk + 0.04 <= top ? d(human(x, pf, pk + 0.04, pl)) : 1e9;
      if (Math.min(L2, K2) > d0 - 0.2) break;
      if (L2 <= K2) pl += 3; else pk += 0.04;
    }
    const J = human(x, pf, pk, pl), sw = Math.sin(ph) * 14 * amp;
    // legs
    if (pk > 0.5) {
      seg(ctx, J.hip, P(x - pf * 18, -3), 13, col); seg(ctx, P(x - pf * 18, -3), P(x - pf * 40, -3), 11, col);
      seg(ctx, J.hip, P(x + pf * 22, -40), 13, col); seg(ctx, P(x + pf * 22, -40), P(x + pf * 24, -2), 11, col);
    } else {
      const k1 = P(x + sw * 0.6 + pf * 4, lerp(-46, -30, pk)), k2 = P(x - sw * 0.6 + pf * 4, lerp(-46, -30, pk));
      seg(ctx, J.hip, k2, 13, col); seg(ctx, k2, P(x - sw, -2), 11, col);
      seg(ctx, J.hip, k1, 13, col); seg(ctx, k1, P(x + sw, -2), 11, col);
    }
    seg(ctx, J.hip, J.sh, 22, col);
    dot(ctx, J.head, 12, col);
    // the other arm: at the side, at the pouch, at the chest, or up at the mouth for a whistle
    const ot = oh === "pouch" ? P(J.hip.x + pf * 12, J.hip.y - 2) : oh === "chest" ? J.chest : oh === "mouth" ? P(J.head.x + pf * 10, J.head.y + 6)
      : oh === "up" ? P(J.sh.x - pf * 4, J.sh.y - 50) : P(J.sh.x - pf * 2 - Math.sin(ph) * 8 * amp, J.sh.y + 56);
    const oa = ik(J.sh, ot, 30, 30, pf); seg(ctx, J.sh, oa.elb, 9, col); seg(ctx, oa.elb, oa.hand, 8, col);
    if (oh === "mouth") { dot(ctx, oa.hand, 4.5, col); seg(ctx, P(J.head.x + pf * 9, J.head.y + 4), P(J.head.x + pf * 19, J.head.y + 3), 4, C.fg); }
    // the near arm and hand
    const tg = Number.isNaN(hand.x) ? J.rest : hand, a = ik(J.sh, tg, 30, 31, pf);
    // a thin outline in the background colour keeps the near arm readable in front of the body
    seg(ctx, J.sh, a.elb, 12, C.bg); seg(ctx, a.elb, a.hand, 11, C.bg); dot(ctx, a.hand, 7, C.bg);
    seg(ctx, J.sh, a.elb, 9, col); seg(ctx, a.elb, a.hand, 8, col);
    const hp = a.hand;
    if (hs === "fist") dot(ctx, hp, 6, col);
    else if (hs === "palm") { seg(ctx, P(hp.x, hp.y - 7), P(hp.x, hp.y + 6), 6, col); }
    else if (hs === "point") { dot(ctx, hp, 4.5, col); seg(ctx, hp, P(hp.x + pf * 12, hp.y + 1), 3.5, col); }
    else if (hs === "flat") { seg(ctx, hp, P(hp.x + pf * 14, hp.y), 5, col); }
    else dot(ctx, hp, 5, col);
    if (hs === "treat" || hs === "fist" && extras.fistTreat) dot(ctx, P(hp.x + pf * 3, hp.y - 2), 3.2, C.accent);
    if (hs === "tool") { seg(ctx, hp, P(hp.x + pf * 12, hp.y - 4), 4, C.toss); }
    return { J, hand: hp };
  }

  function drawDog(ctx, C, s, ph, amp, col, t, opts = {}) {
    // a turn squashes through a narrow profile instead of flattening to nothing
    const L = dogLocal(s), f = (s.df >= 0 ? 1 : -1) * Math.max(0.55, Math.abs(s.df)), dy = s.dswim * 16 - (s.dup || 0);
    ctx.save(); ctx.translate(s.dx, dy); ctx.scale(f, 1);
    if (s.dtilt) { ctx.translate(-44, 0); ctx.rotate(-s.dtilt * D); ctx.translate(44, 0); }
    const far = opts.far || C.dogFar, sw = Math.sin(ph) * 9 * amp, lift = (q) => -Math.max(0, Math.sin(ph + q)) * 6 * amp;
    const paddle = s.dswim ? Math.sin(t * 9) * 6 : 0;
    // far legs first, darker
    const legF = (e, p, w, c, q) => { seg(ctx, L.S, P(e.x - sw * (q ? -1 : 1) * 0.4, e.y), w, c); seg(ctx, P(e.x - sw * (q ? -1 : 1) * 0.4, e.y), P(p.x - (q ? -sw : sw) + paddle, p.y + (q ? lift(Math.PI) : lift(0))), w - 1, c); };
    const legR = (k, h, p, w, c, q) => { const o = q ? -sw : sw; seg(ctx, L.H, P(k.x + o * 0.4, k.y), w + 1, c); seg(ctx, P(k.x + o * 0.4, k.y), P(h.x + o * 0.7, h.y), w - 1, c); seg(ctx, P(h.x + o * 0.7, h.y), P(p.x + o - paddle, p.y + (q ? lift(0) : lift(Math.PI))), w - 1.5, c); };
    legF(P(L.fe.x - 3, L.fe.y), P(s.dpaw ? 2 : L.fp.x - 3, s.dpaw ? 0 : L.fp.y), 6.5, far, true);
    legR(P(L.rk.x - 3, L.rk.y), P(L.rh.x - 3, L.rh.y), P(L.rp.x - 3, L.rp.y), 6.5, far, true);
    // tail
    // Canvas angles (y down): 140 deg = back and low, 235 deg = back and high. A happy dog wags.
    const ta = lerp(140, 235, s.dtail) * D + Math.sin(t * 13) * 0.3 * s.dwag;
    const tb = P(L.H.x - 6, L.H.y - 3), te = P(tb.x + Math.cos(ta) * 22, tb.y + Math.sin(ta) * 22);
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(tb.x, tb.y);
    ctx.quadraticCurveTo(tb.x + Math.cos(ta - 0.3) * 13, tb.y + Math.sin(ta - 0.3) * 13, te.x, te.y); ctx.stroke();
    // body
    seg(ctx, L.H, L.S, 24, col); dot(ctx, L.S, 13, col); dot(ctx, P(L.H.x - 2, L.H.y + 1), 12.5, col);
    // near legs
    legR(L.rk, L.rh, L.rp, 7.5, col, false);
    legF(L.fe, L.fp, 7.5, col, false);
    // neck, head, snout, ear, eye, nose
    seg(ctx, P(L.S.x + 2, L.S.y - 2), L.C, 13, col);
    dot(ctx, L.C, 9.5, col);
    seg(ctx, L.C, L.snout, 8.5, col);
    dot(ctx, L.snout, 2.6, C.fg);
    dot(ctx, P(L.C.x + Math.cos(L.sa) * 3 + 1, L.C.y - Math.sin(L.sa) * 3 - 3), 1.6, C.fg);
    const ea = L.sa + Math.PI * 0.85;
    poly(ctx, [P(L.C.x - 2, L.C.y - 6), P(L.C.x + Math.cos(ea) * 13 - 2, L.C.y - Math.sin(ea) * 13 + 4), P(L.C.x - 7, L.C.y + 2)], far);
    // collar
    const cm = mix(L.S, L.C, 0.38); seg(ctx, P(cm.x - 2, cm.y - 6), P(cm.x + 3, cm.y + 5), 3.5, C.toss);
    ctx.restore();
    const w = (p) => P(s.dx + f * p.x, p.y + dy);
    return { snout: w(L.snout), collar: w(cm), head: w(L.C), S: w(L.S), H: w(L.H) };
  }

  function drawItem(ctx, C, kind, p, ang = 0) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    if (kind === "bumper" || kind === "soft") { seg(ctx, P(-8, 0), P(8, 0), 7, kind === "soft" ? C.accent : "#f2f2ee"); seg(ctx, P(-8, 0), P(8, 0), 1, C.muted); }
    else if (kind === "wing" || kind === "bird") { poly(ctx, [P(-8, 2), P(0, -6), P(9, 1), P(0, 4)], kind === "bird" ? "#7b6a55" : "#9d8a70"); }
    else if (kind === "toy") dot(ctx, P(0, 0), 5.5, C.toss);
    else if (kind === "antler") { ctx.strokeStyle = "#d9c7a5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-9, 2); ctx.quadraticCurveTo(0, -2, 9, -6); ctx.moveTo(0, -1); ctx.lineTo(3, -9); ctx.stroke(); }
    else if (kind === "sock") seg(ctx, P(-6, 0), P(6, 2), 5, C.miss);
    else if (kind === "treat") dot(ctx, P(0, 0), 3.6, C.accent);
    else if (kind === "bowl") { poly(ctx, [P(-12, -4), P(12, -4), P(8, 4), P(-8, 4)], C.muted); dot(ctx, P(-3, -5), 2.5, C.warn); dot(ctx, P(3, -5), 2.5, C.warn); }
    ctx.restore();
  }

  function drawProps(ctx, C, scene, s) {
    for (const p of scene.props || []) {
      const x = p.x;
      if (p.k === "mat") { seg(ctx, P(x - (p.w || 26), -1.5), P(x + (p.w || 26), -1.5), 4, C.toss); }
      else if (p.k === "board") { seg(ctx, P(x - 30, -14), P(x + 30, -14), 5, C.muted); seg(ctx, P(x - 24, -14), P(x - 24, 0), 3, C.muted); seg(ctx, P(x + 24, -14), P(x + 24, 0), 3, C.muted); }
      else if (p.k === "stand") { seg(ctx, P(x - 22, -26), P(x + 22, -26), 5, C.muted); seg(ctx, P(x - 16, -26), P(x - 20, 0), 3, C.muted); seg(ctx, P(x + 16, -26), P(x + 20, 0), 3, C.muted); }
      else if (p.k === "crate") {
        ctx.strokeStyle = C.muted; ctx.lineWidth = 2.5; ctx.strokeRect(x - 42, -58, 84, 58);
        for (let i = 1; i < 6; i++) seg(ctx, P(x - 42 + i * 14, -58), P(x - 42 + i * 14, -56), 1.5, C.muted);
        const dop = s.door; seg(ctx, P(x + 42, -58), P(x + 42 + dop * 30, -58 + dop * 4), 3, C.muted); seg(ctx, P(x + 42, 0), P(x + 42 + dop * 30, -2), 3, C.muted);
        if (dop < 0.5) for (let i = 1; i < 5; i++) seg(ctx, P(x + 42, -58 + i * 11.6), P(x + 42 + dop * 30, -58 + i * 11.6 + dop * 2), 1.5, C.muted);
      }
      else if (p.k === "door") { seg(ctx, P(x, -150), P(x, 0), 4, C.muted); seg(ctx, P(x, -150), P(x + (p.dir || 1) * 50 * (1 - s.door), -150 + s.door * 6), 4, C.muted);
        seg(ctx, P(x + (p.dir || 1) * 50 * (1 - s.door), -150 + s.door * 6), P(x + (p.dir || 1) * 50 * (1 - s.door), -2), 4, C.muted); seg(ctx, P(x + (p.dir || 1) * 50, -150), P(x + (p.dir || 1) * 50, 0), 2, C.line); }
      else if (p.k === "car") { ctx.strokeStyle = C.muted; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 70, -14); ctx.lineTo(x - 70, -54); ctx.lineTo(x - 40, -84); ctx.lineTo(x + 50, -84); ctx.lineTo(x + 70, -54); ctx.lineTo(x + 70, -14); ctx.closePath(); ctx.stroke();
        dot(ctx, P(x - 44, -10), 10, C.muted); dot(ctx, P(x + 44, -10), 10, C.muted); }
      else if (p.k === "bowl") poly(ctx, [P(x - 12, -8), P(x + 12, -8), P(x + 8, 0), P(x - 8, 0)], C.muted);
      else if (p.k === "table") { seg(ctx, P(x - 26, -70), P(x + 26, -70), 5, C.muted); seg(ctx, P(x, -70), P(x, 0), 4, C.muted); seg(ctx, P(x - 14, 0), P(x + 14, 0), 4, C.muted); }
      else if (p.k === "bench") { seg(ctx, P(x - 34, -46), P(x + 34, -46), 6, C.muted); seg(ctx, P(x - 26, -46), P(x - 26, 0), 4, C.muted); seg(ctx, P(x + 26, -46), P(x + 26, 0), 4, C.muted); }
      else if (p.k === "etable") { seg(ctx, P(x - 46, -37), P(x + 46, -37), 5, C.muted); seg(ctx, P(x - 36, -37), P(x - 36, 0), 4, C.muted); seg(ctx, P(x + 36, -37), P(x + 36, 0), 4, C.muted); }
      else if (p.k === "scale") seg(ctx, P(x - 28, -3), P(x + 28, -3), 6, C.muted);
      else if (p.k === "pile") for (let i = 0; i < 4; i++) drawItem(ctx, C, "bumper", P(x - 9 + i * 6, -4 - (i % 2) * 5), (i - 1.5) * 0.25);
      else if (p.k === "decoy") for (let i = 0; i < (p.n || 3); i++) { const dx2 = x + i * 26; poly(ctx, [P(dx2 - 9, -2), P(dx2 + 8, -2), P(dx2 + 6, -8), P(dx2 - 7, -7)], "#6b5a46"); dot(ctx, P(dx2 + 7, -10), 3.5, "#2f5d3a"); }
      else if (p.k === "launcher") { ctx.strokeStyle = C.muted; ctx.lineWidth = 2.5; ctx.strokeRect(x - 12, -12, 24, 12); }
      else if (p.k === "cutout") { const sc = { ...BASE, dx: x, df: p.f || 1, dpaw: 1, dtail: 1, dwag: 0, dh: -5 }; ctx.globalAlpha = 0.8; drawDog(ctx, { ...C, fg: C.line }, sc, 0, 0, C.line, 0, { far: C.line }); ctx.globalAlpha = 1; }
      else if (p.k === "grass") { ctx.strokeStyle = C.grass; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; for (let gx = p.x0; gx < p.x1; gx += 9) { const h = 10 + ((gx * 7) % 9); ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx - 3, -h); ctx.moveTo(gx + 2, 0); ctx.lineTo(gx + 5, -h * 0.8); ctx.stroke(); } ctx.globalAlpha = 1; }
      else if (p.k === "flag") { seg(ctx, P(x, 0), P(x, -34), 2, C.muted); poly(ctx, [P(x, -34), P(x + 14, -29), P(x, -24)], C.warn); }
      else if (p.k === "building") { ctx.strokeStyle = C.line; ctx.lineWidth = 2.5; ctx.strokeRect(x - 60, -120, 120, 120); }
      else if (p.k === "towel") seg(ctx, P(x - 12, -1.5), P(x + 12, -1.5), 4, C.toss);
      else if (p.k === "base") { poly(ctx, [P(x - 7, -1), P(x, -5), P(x + 7, -1), P(x, 3)], C.muted); }
      if (p.label) { ctx.fillStyle = C.muted; ctx.font = "600 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(p.label, x, p.k === "building" ? -100 : 16); }
    }
  }

  function bubble(ctx, C, at, text, u, top, x0, x1) {
    ctx.font = `700 ${12 * u}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 14 * u, h = 20 * u, x = clamp(at.x - w / 2, x0 + 2 * u, x1 - w - 2 * u), y = Math.max(top + 3 * u, at.y - h - 9 * u);
    ctx.fillStyle = C.fg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 7 * u) : ctx.rect(x, y, w, h); ctx.fill();
    poly(ctx, [P(at.x - 5 * u, y + h), P(at.x + 5 * u, y + h), P(at.x, y + h + 6 * u)], C.fg);
    ctx.fillStyle = C.bg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + w / 2, y + h / 2 + 0.5); ctx.textBaseline = "alphabetic";
  }

  // ---------- one frame ----------

  function render(cv, anim, t, ph, C, opts) {
    const ctx = cv.getContext("2d"), dpr = cv._dpr || 1, W = cv.width / dpr, H = cv.height / dpr;
    const s = sample(anim.keys, t), ev = events(anim.keys, t), sc = anim.scene;
    const [x0, x1] = sc.view || [0, 320], k = Math.min(W / (x1 - x0), (H - 30) / (sc.tall || 205));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const ox = (W - (x1 - x0) * k) / 2 - x0 * k, padL = (W - 70 - ox) / k;
    ctx.save(); ctx.translate(ox, H - 22); ctx.scale(k, k);
    // ground, water, distance ruler
    seg(ctx, P(x0 - 20, 1.5), P(x1 + 20, 1.5), 2, C.line);
    if (sc.ruler) { const r = sc.ruler; seg(ctx, P(r.x0, 10), P(r.x1, 10), 1.5, C.muted); seg(ctx, P(r.x0, 6), P(r.x0, 14), 1.5, C.muted); seg(ctx, P(r.x1, 6), P(r.x1, 14), 1.5, C.muted);
      ctx.fillStyle = C.muted; ctx.font = `700 ${11 / k}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(r.text, (r.x0 + r.x1) / 2, 10 + 12 / k); }
    drawProps(ctx, C, sc, s);
    // second dog, walker, helper behind the main figures
    if (s.o2x > -900) drawDog(ctx, C, { ...BASE, dx: s.o2x, df: s.o2f, dr: s.o2r, dfr: s.o2fr, dh: s.o2h, dpaw: s.o2paw, dtail: s.o2tail, dwag: 0.3 }, ph.o2, ph.o2a, C.muted, t, { far: C.line });
    if (s.wx > -900) drawHuman(ctx, C, s.wx, s.wf, s.wk, 0, P(s.wax, s.way), "open", "side", ph.w, ph.wa, C.line, {});
    if (s.hpx > -900) {
      const hj = drawHuman(ctx, C, s.hpx, -1, 0, 0, P(NaN, NaN), "open", "side", 0, 0, C.line, {});
      if (ev.bang !== undefined) { const bp = P(hj.J.head.x - 16, hj.J.head.y - 10); ctx.strokeStyle = C.warn; ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r1 = 6 + ev.bang * 6, r2 = 12 + ev.bang * 14; seg(ctx, P(bp.x + Math.cos(a) * r1, bp.y + Math.sin(a) * r1), P(bp.x + Math.cos(a) * r2, bp.y + Math.sin(a) * r2), 2.5, C.warn); }
        ctx.fillStyle = C.warn; ctx.font = `800 ${15 / k}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("BANG", bp.x, Math.max(-(H - 22) / k + 16 / k, bp.y - 24 / k)); }
    }
    // the handler and the dog
    const hu = drawHuman(ctx, C, s.px, s.pf >= 0 ? 1 : -1, s.pk, s.pl, P(s.ax, s.ay), s.hs, s.oh, ph.p, ph.pa, C.person, { fistTreat: opts.fistTreat });
    if (s.ion && !s.dcar && !s.pole) drawItem(ctx, C, s.item, P(s.ix, s.iy), 0);
    if (s.i2on) drawItem(ctx, C, s.item, P(s.i2x, s.i2y), 0);
    const dg = drawDog(ctx, C, s, ph.d, ph.da, C.dog, t);
    if (s.dcar) drawItem(ctx, C, s.dcar, P(dg.snout.x + s.df * 3, dg.snout.y + 2), 0);
    if (s.pole) { seg(ctx, hu.hand, P(hu.hand.x + s.pf * 30, hu.hand.y - 20), 2.5, C.muted); ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hu.hand.x + s.pf * 30, hu.hand.y - 20); ctx.lineTo(s.ix, s.iy); ctx.stroke(); drawItem(ctx, C, "wing", P(s.ix, s.iy), 0); }
    if (s.leash) { const a = hu.hand, b = dg.collar, m = P((a.x + b.x) / 2, Math.max(a.y, b.y) + Math.max(0, s.leash)); ctx.strokeStyle = C.toss; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke(); }
    if (s.ton) dot(ctx, P(s.tx, s.ty), 3.4, C.accent);
    if (s.bon) { const fl = Math.sin(t * 20) * 5; poly(ctx, [P(s.bx - 9, s.by + fl), P(s.bx, s.by - 2), P(s.bx + 9, s.by - fl), P(s.bx, s.by + 3)], "#7b6a55"); }
    if (sc.water) { ctx.fillStyle = C.water; ctx.fillRect(sc.water, -11, x1 + 40 - sc.water, 13); seg(ctx, P(sc.water, -11), P(x1 + 40, -11), 1.5, C.toss); }
    // effects
    const u = 1.15 / k, top = -(H - 22) / k;
    if (ev.timer !== undefined) { const c = P(dg.head.x, dg.head.y - 26 * u); ctx.strokeStyle = C.line; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(c.x, c.y, 10 * u, 0, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = C.keep; ctx.beginPath(); ctx.arc(c.x, c.y, 10 * u, -Math.PI / 2, -Math.PI / 2 + ev.timer * 2 * Math.PI); ctx.stroke();
      if (ev.timerLabel) { ctx.fillStyle = C.keep; ctx.font = `700 ${10 * u}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(ev.timerLabel, c.x, c.y - 14 * u); } }
    if (ev.say) bubble(ctx, C, ev.sayWho === "h" && s.hpx > -900 ? P(s.hpx, -200) : P(hu.J.head.x, hu.J.head.y - 14), ev.say, u, top, x0, anim.outcome ? x1 : Math.min(x1, padL));
    if (ev.whistle) { const o = P(hu.J.head.x + s.pf * 22, hu.J.head.y + 2); ctx.strokeStyle = C.toss; ctx.lineWidth = 2;
      const n = ev.whistle === "come" ? 4 : ev.whistle === "turn" ? 2 : 3;
      for (let i = 0; i < n; i++) { const r = 6 + i * 7 + ev.wU * 8; ctx.globalAlpha = 1 - ev.wU * 0.7; ctx.beginPath(); ctx.arc(o.x, o.y, r, s.pf > 0 ? -0.6 : Math.PI - 0.6, s.pf > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = C.toss; ctx.font = `700 ${11 * u}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillText(ev.whistle === "sit" ? "one blast" : ev.whistle === "come" ? "trill" : "two pips", o.x + s.pf * 30 * u, Math.max(top + 14 * u, o.y - 16 * u)); }
    if (ev.bang !== undefined && ev.bangX === "p") { const bp = P(hu.J.head.x + s.pf * 34, hu.J.head.y + 6);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r1 = 5 + ev.bang * 6, r2 = 10 + ev.bang * 14; seg(ctx, P(bp.x + Math.cos(a) * r1, bp.y + Math.sin(a) * r1), P(bp.x + Math.cos(a) * r2, bp.y + Math.sin(a) * r2), 2.5, C.warn); }
      ctx.fillStyle = C.warn; ctx.font = `800 ${15 * u}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("BANG", bp.x + 10, Math.max(top + 16 * u, bp.y - 24 * u)); }
    if (ev.ring !== undefined) { const bp = P((sc.ringX || 300), -150); ctx.fillStyle = C.warn; ctx.font = `800 ${14 * u}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(sc.ringText || "ding-dong", clamp(bp.x, x0 + 40 * u, x1 - 40 * u), Math.max(top + 50 * u, bp.y)); }
    if (ev.yes !== undefined) {
      const c = dg.head, r = (10 + ev.yes * 30) * u; ctx.strokeStyle = C.accent; ctx.globalAlpha = 1 - ev.yes; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
      const sz = (17 + (ev.yes < 0.25 ? ev.yes * 24 : 6 - (ev.yes - 0.25) * 4)) * u; ctx.font = `800 ${sz}px system-ui, sans-serif`; ctx.fillStyle = C.accent; ctx.textAlign = "center";
      ctx.fillText("YES", clamp(c.x, x0 + 30 * u, Math.min(x1, padL) - 22 * u), c.y - 30 * u);
    }
    if (ev.badge) { const c = P(dg.head.x, dg.head.y - 40 * u), txt = ev.badge; ctx.font = `800 ${15 * u}px system-ui, sans-serif`; const w = ctx.measureText(txt).width + 18 * u;
      ctx.globalAlpha = ev.badgeU > 0.8 ? (1 - ev.badgeU) * 5 : 1; ctx.fillStyle = C.keep; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(clamp(c.x - w / 2, x0 + 4, x1 - w - 4), c.y - 13 * u, w, 24 * u, 12 * u) : ctx.rect(c.x - w / 2, c.y - 13 * u, w, 24 * u); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, clamp(c.x, x0 + 4 + w / 2, x1 - 4 - w / 2), c.y - 1 * u); ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1; }
    ctx.restore();
    // the mini YES pad: lights up at the exact moment to tap
    if (!anim.outcome) {
      const on = ev.yes !== undefined && ev.yes < 0.6, pw = 52, phh = 26, px2 = W - pw - 8, py2 = 8;
      ctx.fillStyle = on ? C.accent : "transparent"; ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px2, py2, pw, phh, 8) : ctx.rect(px2, py2, pw, phh); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? C.ink : C.accent; ctx.font = "800 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(on ? "TAP!" : "YES", px2 + pw / 2, py2 + phh / 2 + 0.5); ctx.textBaseline = "alphabetic";
    }
    return ev;
  }

  // ---------- the player: loops one animation on a canvas ----------

  function mount(cv, anim, opts = {}) {
    let C = colors(), raf = 0, t = 0, last = 0, speed = 1, playing = true, cap = null;
    const loopT = anim.T + 1.1;
    const ph = { p: 0, pa: 0, d: 0, da: 0, o2: 0, o2a: 0, w: 0, wa: 0 }, prev = { px: null, dx: null, o2x: null, wx: null };
    const reduce = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function size() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      cv._dpr = dpr; cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    }
    function gait(key, phk, ampk, x, dt) {
      if (prev[key] !== null && dt > 0) { const v = Math.abs(x - prev[key]) / dt; ph[phk] += v * dt * 0.11; ph[ampk] = lerp(ph[ampk], clamp(v / 45, 0, 1), 0.25); }
      prev[key] = x;
    }
    function frame(now) {
      if (!cv.isConnected) return;                       // removed from the page: stop for good
      raf = requestAnimationFrame(frame);
      if (!cv.offsetParent) { last = 0; return; }        // its sheet is closed: rest
      if (cv.width < 2) size();
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (playing) t += dt * speed;
      if (t >= loopT) { t = 0; for (const k in prev) prev[k] = null; }
      const tt = Math.min(t, anim.T), s = sample(anim.keys, tt);
      gait("px", "p", "pa", s.px, dt * speed); gait("dx", "d", "da", s.dx, dt * speed); gait("o2x", "o2", "o2a", s.o2x, dt * speed); gait("wx", "w", "wa", s.wx, dt * speed);
      const ev = render(cv, anim, tt, ph, C, opts);
      if (ev.cap !== cap) { cap = ev.cap; opts.onCaption && opts.onCaption(cap); }
    }
    size();
    if (reduce && !opts.force) {
      // Reduced motion: one still frame at the moment that matters (YES or the outcome), no looping.
      const k = anim.keys.find((x) => x.yes || x.badge); const tt = k ? k.t + 0.1 : anim.T;
      const ev = render(cv, anim, tt, ph, C, opts); opts.onCaption && opts.onCaption(ev.cap);
    } else raf = requestAnimationFrame(frame);
    const onResize = () => size(); window.addEventListener("resize", onResize);
    const mq = matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null, onScheme = () => (C = colors());
    mq && mq.addEventListener && mq.addEventListener("change", onScheme);
    return {
      replay() { t = 0; for (const k in prev) prev[k] = null; playing = true; },
      seek(v) { t = v; for (const k in prev) prev[k] = null; playing = true; },
      setSpeed(v) { speed = v; },
      toggle() { playing = !playing; return playing; },
      destroy() { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); mq && mq.removeEventListener && mq.removeEventListener("change", onScheme); },
    };
  }

  /** One still frame at time t (gallery, tests, thumbnails). */
  function still(cv, anim, t, opts = {}) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv._dpr = dpr; cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    return render(cv, anim, Math.min(t, anim.T), { p: 0, pa: 0, d: 0, da: 0, o2: 0, o2a: 0, w: 0, wa: 0 }, colors(), opts);
  }

  return { BASE, human, dogPart, mount, still, sample, P };
})();
