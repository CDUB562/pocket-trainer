// Step animations: motion templates and the map from every skill step to one of them.
// A template takes a few params and returns { keys, scene, T, outcome }: keyframes for PTAnim to play.
// Conventions: the handler stands at x = 80 facing right; the dog usually faces the handler (df = -1).
// Every loop shows the setup, the moment to mark (a YES flash, or an outcome badge for field reps), then the reward.

const PTSteps = (() => {
  const { human, dogPart, P } = PTAnim;
  const hum = (s) => human(s.px, s.pf, s.pk, s.pl);
  const nose = (s, x) => dogPart({ ...s, ...(x || {}) }, "snout");
  const part = (s, p, x) => dogPart({ ...s, ...(x || {}) }, p);

  // Keyframe builder: at(dt, fields) moves time on and sets fields; ev(fields) adds events at the current time.
  function B(init, scene) {
    const st = { ...PTAnim.BASE, ...init };
    if (init.ax === undefined) { const r = hum(st).rest; st.ax = r.x; st.ay = r.y; }
    const keys = [{ t: 0, ...init, ax: st.ax, ay: st.ay }];
    let t = 0, lastYes = -9;
    // A hand hanging at rest stays at rest when the body moves.
    const follow = (o) => {
      if ("ax" in o || !("px" in o || "pf" in o || "pk" in o || "pl" in o)) return o;
      const r = hum(st).rest; if (Math.hypot(st.ax - r.x, st.ay - r.y) > 3) return o;
      const q = hum({ ...st, ...o }).rest; return { ...o, ax: q.x, ay: q.y };
    };
    const b = {
      keys, scene: scene || { props: [] }, st,
      at(dt, o = {}) {
        // Something appearing (a treat, an item, a bird) starts where it appears instead of sliding in from elsewhere.
        for (const [on, x, y] of [["ton", "tx", "ty"], ["ion", "ix", "iy"], ["i2on", "i2x", "i2y"], ["bon", "bx", "by"]])
          if (o[on] && !st[on] && (x in o || y in o)) keys.push({ t, [x]: o[x] ?? st[x], [y]: o[y] ?? st[y] });
        o = follow(o);
        // Captions and hand shapes belong to the start of the move; the YES caption gets a moment on screen first.
        const { cap, hs, oh, ...mv } = o, early = {};
        if (hs !== undefined) early.hs = hs; if (oh !== undefined) early.oh = oh;
        if (Object.keys(early).length) keys.push({ t, ...early });
        if (cap !== undefined) keys.push({ t: Math.max(t, lastYes + 0.7), cap });
        t += dt; Object.assign(st, o); keys.push({ t, ...mv }); return b;
      },
      ev(o) { o = follow(o); if (o.yes || o.badge) lastYes = t; keys.push({ t, ...o }); if (o) for (const k of Object.keys(o)) if (k in PTAnim.BASE) st[k] = o[k]; return b; },
      get t() { return t; },
      done(outcome) {
        keys.sort((a, c) => a.t - c.t);
        // Close-up work with the handler kneeling throughout: move the camera in.
        const ks = keys.filter((k) => "pk" in k);
        if (!b.scene.view && ks.length && ks.every((k) => k.pk >= 1) && !keys.some((k) => k.dx > 235 || k.wx > 0))
          { b.scene.view = [45, 245]; b.scene.tall = keys.some((k) => k.say) ? 180 : 155; }
        return { keys, scene: b.scene, T: t + 0.3, outcome: !!outcome };
      },
    };
    return b;
  }
  const rest = (st, x) => hum({ ...st, ...(x || {}) }).rest;
  const handAt = (p) => ({ ax: p.x, ay: p.y });

  // The reward: a treat from the hand (or the pouch, or a toss) to the mouth or the floor, then a little chew.
  function give(b, to = "mouth", from = "hand", cap) {
    const st = b.st, h = hum(st);
    const src = from === "pouch" ? P(h.hip.x + st.pf * 12, h.hip.y) : P(st.ax, st.ay);
    const dst = to === "mouth" ? nose(st) : to === "floor" ? P(part(st, "fp").x + st.df * 8, -3 - (st.dup || 0)) : to;
    // let the YES caption be read first; the treat still lands within a second of the mark
    b.at(0.3).ev({ cap: cap || (to === "mouth" ? "Then the treat, right away" : "Treat between the paws") });
    b.at(0.2, { ton: 1, tx: src.x, ty: src.y, oh: from === "pouch" ? "pouch" : st.oh });
    const near = from === "hand" && Math.abs(dst.x - st.px) < 95;   // close enough to hand it over; farther is a toss
    b.at(0.45, { tx: dst.x, ty: dst.y, ...(near ? { ax: dst.x - st.pf * 4, ay: dst.y, hs: "open" } : {}) });
    const dh = st.dh;
    b.at(0.12, { ton: 0, dh: to === "mouth" ? dh - 8 : -40 }).at(0.22, { dh: dh + 3 }).at(0.22, { dh });
    const r = rest(st); b.at(0.3, { ax: r.x, ay: r.y, hs: "open", oh: "side" });
    return b;
  }
  const yes = (b, cap) => b.ev({ yes: true, cap });
  const badge = (b, txt, cap) => b.ev({ badge: txt, cap });
  const say = (b, text, cap) => b.ev({ say: text, cap });
  const POSES = { stand: { dr: 0, dfr: 0 }, sit: { dr: 1, dfr: 0 }, down: { dr: 1, dfr: 1 } };
  const outdoor = (b, x0 = 0, x1 = 320) => b.scene.props.push({ k: "grass", x0, x1 });
  const yd = (n) => 120 + n * 3.2;   // yards to world x for field work, with the handler at 70

  const T = {};

  // Eyes on you: wait for the look, or say the name once.
  T.look = (p, name) => {
    const far = p.stage === "far";
    const b = B({ px: 80, dx: far ? 250 : 165, dh: -32, oh: "chest" });
    if (p.stage === "distract") b.scene.props.push({ k: "mat", x: 200, w: 0 }), b.ev({ ion: 1, item: "toy", ix: 205, iy: -5 });
    if (p.stage === "outside") outdoor(b), b.ev({ leash: 12 });
    b.at(0.6, { cap: p.stage === "free" ? "Say nothing. Just wait." : "Wait until they look away" });
    if (p.stage !== "free") say(b, name, "Their name, once");
    b.at(0.6, { dh: 30, cap: "" });
    yes(b, "Eyes on your face: YES");
    if (far) give(b, "mouth", "hand", "Toss the treat to them");
    else { const c = hum(b.st).chest; b.at(0.3, { ax: c.x, ay: c.y, hs: "treat" }); give(b, "mouth", "hand", "Treat from your chest, so their eyes come up"); }
    return b.done();
  };

  // Hand target: a flat palm near the nose; the nose bumps it.
  T.touch = (p) => {
    const come = p.stage === "come" || p.stage === "real";
    const b = B({ px: 80, pk: 1, dx: come ? 215 : 150, dh: 0, oh: "pouch" });
    const behind = P(hum(b.st).hip.x - 14, hum(b.st).hip.y - 6);
    b.ev(handAt(behind));
    b.at(0.4, {});
    if (p.stage === "word" || p.stage === "come" || p.stage === "real") say(b, "Touch", 'Say "Touch" first');
    const dh = p.stage === "move" ? 22 : 0, target = { dx: 150, dh, dre: 0.5 };
    const palm = nose(b.st, target);
    b.at(0.5, { ...handAt(P(palm.x - 2, palm.y)), hs: "palm", cap: p.stage === "move" ? "Palm in a new spot each rep" : "Flat palm, 5 cm from the nose" });
    b.at(come ? 0.9 : 0.5, target);
    yes(b, "Nose touches the palm: YES");
    b.at(0.25, { ...handAt(behind), hs: "open", dre: 0 });
    give(b, "mouth", "pouch", "Treat from the OTHER hand");
    return b.done();
  };

  // Lure, empty hand, small signal, word then signal, word only: into sit or down.
  T.lure = (p) => {
    const sit = p.to === "sit", mode = p.mode || "lure", close = mode === "lure" || mode === "empty";
    const b = B({ px: 80, pk: close ? 1 : 0, dx: close ? 150 : 170, ...(sit ? POSES.stand : POSES.sit), dh: 8, oh: mode === "lure" ? "side" : "pouch" });
    if (mode === "new") outdoor(b);
    const end = sit ? { dr: 1, dfr: 0, dh: 22 } : { dr: 1, dfr: 1, dh: 0 };
    if (mode === "word" || mode === "word-only" || mode === "new") { b.at(0.4); say(b, p.word, `"${p.word}" once`); b.at(mode === "word" ? 0.5 : 0.7); }
    if (close) {
      const n0 = nose(b.st);
      b.at(0.5, { ...handAt(P(n0.x - 3, n0.y)), hs: mode === "lure" ? "treat" : "open", cap: mode === "lure" ? "Treat at the nose" : "The same motion, empty hand" });
      if (sit) {
        const up = nose(b.st, { dr: 0.6, dh: 45 });
        b.at(0.8, { ...handAt(P(up.x + 8, up.y - 10)), dh: 45, cap: "Up and back over the head" });
        b.at(0.55, { dr: 1, dh: 35 });
      } else {
        const fl = part(b.st, "fp");
        b.at(0.8, { ...handAt(P(fl.x - 4, -6)), dh: -45, cap: "Straight down between the paws" });
        b.at(0.7, { dfr: 1, dh: -12 });
      }
    } else if (mode === "small" || mode === "word") {
      const h = hum(b.st);
      b.at(0.45, { ...handAt(P(h.sh.x + 24, sit ? h.sh.y + 40 : h.sh.y + 48)), hs: sit ? "palm" : "point", cap: sit ? "A small upward flick" : "Point at the floor" });
      b.at(0.3, { ay: sit ? h.sh.y + 22 : h.sh.y + 58 });
      b.at(0.6, end);
    } else b.at(0.7, { ...end, cap: mode === "new" ? "Somewhere new: one cue, hands still" : "Hands still: the word alone" });
    yes(b, sit ? "Rear touches the floor: YES" : "Elbows touch the floor: YES");
    give(b, sit ? "mouth" : "floor", mode === "lure" ? "hand" : "pouch", sit ? "Treat while they're still sitting" : "Treat between the paws");
    return b.done();
  };

  // Holding a position: stay, whoa, place, mat. Away = the handler steps back and returns.
  T.hold = (p) => {
    const pose = POSES[p.pose || "sit"], prop = p.prop;
    const b = B({ px: 80, dx: 175, ...pose, dh: 14, dup: prop === "board" ? 14 : prop === "stand" ? 26 : 0 });
    if (prop) b.scene.props.push({ k: prop, x: 178, w: 30 });
    if (p.outside) outdoor(b);
    b.at(0.3); say(b, p.word || "Stay", `"${p.word || "Stay"}", then start the hold`);
    const dur = p.away ? 2.6 : 2.2;
    b.ev({ timer: 1, timerLabel: p.secs || "" }); const tk = b.keys[b.keys.length - 1];
    if (p.away) {
      const back = 80 - Math.min(60, p.away * 16);
      b.at(0.9, { px: back, ...handAt(rest(b.st, { px: back })), cap: `Step back ${p.away > 4 ? "across the room" : p.away + (p.away > 1 ? " steps" : " step")}` });
      b.at(0.6).at(0.9, { px: 80, ...handAt(rest(b.st, { px: 80 })), cap: "Come back to their side" });
    } else b.at(dur * 0.4, { cap: p.distract ? "" : "Hands still, quiet" });
    if (p.distract === "drop") { const h = rest(b.st); b.at(0.2, { ion: 1, item: "toy", ix: h.x, iy: h.y, cap: "Drop a toy: they stay put" }).at(0.4, { ix: h.x + 14, iy: -5 }).at(0.5); }
    if (p.distract === "walker") b.ev({ wx: 380, wf: -1, cap: "Someone walks by" }), b.at(1.4, { wx: 120 }).at(0.01, { wx: -999 });
    if (p.distract === "toy") b.ev({ ion: 1, item: "toy", ix: 330, iy: -5, cap: "A toy rolls past" }), b.at(1.0, { ix: 230 }).at(0.01, { ion: 0 });
    if (p.distract === "shift") b.at(0.4, { pl: 18, cap: "Shift your weight" }).at(0.4, { pl: 0 });
    if (p.distract === "bird") b.scene.props.push({ k: "launcher", x: 250 }), b.ev({ cap: "A bird in the launcher nearby" });
    if (!p.away && !p.distract) b.at(dur * 0.6);
    tk.timer = b.t - tk.t;
    yes(b, "Still in position when the timer ends: YES");
    b.at(0.05, { ton: 0 });
    give(b, p.pose === "down" ? "floor" : "mouth", "hand", "Yes releases them. Treat right away.");
    return b.done();
  };

  // Recall: call once, step back, front feet arrive, treat at the knees (and a collar touch).
  T.recall = (p, name) => {
    const longl = p.stage === "longline" || p.stage === "sniff" || p.stage === "far";
    const startX = p.stage === "room" ? 290 : longl ? 470 : 230;
    const b = B({ px: 80, dx: startX, df: 1, dh: -38, dtail: 0.5 }, { props: [], view: longl ? [0, 520] : [0, 320] });
    if (p.stage === "room") b.scene.props.push({ k: "door", x: 250, dir: 1 }), b.ev({ door: 1 });
    if (longl) outdoor(b, 200, 520), b.ev({ leash: 30 });
    if (p.stage === "sniff") b.ev({ cap: "Busy sniffing" });
    b.at(0.6); say(b, `${name}, come!`, "Call once, take a step back");
    b.at(0.3, { px: 66, ...handAt(rest(b.st, { px: 66 })) });
    b.at(0.3, { df: -1, dh: 8 });
    b.at(longl ? 2.0 : 1.2, { dx: 116, dtail: 0.7, dwag: 0.9, leash: longl ? 18 : 0 });
    if (p.stage === "collar") { b.at(0.4, { ...handAt(P(114, -46)), cap: "Gently take the collar" }).at(0.5); }
    yes(b, p.stage === "collar" ? "You hold the collar, they stay: YES" : "Front feet reach you: YES");
    give(b, "mouth", "hand", p.stage === "longline" || p.stage === "sniff" ? "Jackpot: several treats" : "Treat at your knees");
    return b.done();
  };

  // Leave it: the fist, the open palm, the floor, walking past.
  T.leave = (p) => {
    const walk = p.where === "walk" || p.where === "real";
    if (walk) {
      const b = B({ px: 40, dx: 58, df: 1, leash: 12, ...handAt(P(52, -86)), dh: 0 });
      b.ev({ ion: 1, item: "treat", ix: 170, iy: -3, cap: "Walk past at a distance they can manage" });
      if (p.where === "real") outdoor(b);
      if (p.word) { b.at(0.5); say(b, "Leave it", "Cue early, before they lunge"); }
      b.at(1.4, { px: 150, dx: 168, ...handAt(P(162, -86)), dh: -20, cap: "They glance and keep walking" });
      b.at(0.5, { px: 200, dx: 218, ...handAt(P(212, -86)), dh: 18 });
      yes(b, "Walked past without lunging: YES");
      b.at(0.2, { ...handAt(P(206, -84)) });
      give(b, "mouth", "pouch", "Treat at your side as you pass");
      return b.done();
    }
    const floor = p.where === "floor";
    const b = B({ px: 80, pk: floor ? 0 : 1, dx: floor ? 175 : 150, dh: 0, oh: "pouch" });
    if (floor) {
      b.ev({ ion: 1, item: "treat", ix: 132, iy: -3, cap: "A treat on the floor, your foot ready" });
      if (p.word !== false) { b.at(0.4); say(b, "Leave it"); }
      b.at(0.6, { dh: -40, dre: 0.2, cap: "They look at it..." }).at(0.6, { dh: 28, dre: 0, cap: "...then away, or at you" });
      yes(b, "Looks away from the treat: YES");
      give(b, "mouth", "pouch", "Treat from your hand, never the one on the floor");
      return b.done();
    }
    const n = nose(b.st, { dre: 0.6 });
    if (p.word) { b.at(0.3); say(b, "Leave it", '"Leave it", once'); }
    b.at(0.4, { ...handAt(P(n.x - 4, n.y + 2)), hs: p.where === "palm" ? "treat" : "fist", cap: p.where === "palm" ? "Treat on an open palm" : "Treat in a closed fist. Say nothing." });
    b.at(0.5, { dre: 0.6, dh: -6, cap: p.where === "palm" ? "If they dive in, close the hand" : "Let them lick and nudge" });
    if (p.where === "palm") b.at(0.15, { hs: "fist" }).at(0.5, { dre: 0.1 }).at(0.2, { hs: "treat" });
    else b.at(0.35, { dh: 4 }).at(0.35, { dh: -8 });
    b.at(0.5, { dre: 0, dh: 20, cap: "The nose moves away" });
    yes(b, "Nose pulls back: YES");
    give(b, "mouth", "pouch", "Treat from the OTHER hand");
    return b.done();
  };

  // Drop it: trade the toy for a treat, then give the toy back.
  T.trade = (p) => {
    const b = B({ px: 80, pk: 1, dx: 152, dh: 6, dcar: p.item || "toy", oh: p.hidden ? "pouch" : "side" });
    if (p.word) { b.at(0.4); say(b, "Drop", '"Drop", then show the treat'); }
    const n = nose(b.st);
    if (!p.hidden) b.at(0.5, { ...handAt(P(n.x - 6, n.y + 2)), hs: "treat", cap: "A great treat at the nose" });
    else b.at(0.6, { cap: "Treat out of sight" });
    b.at(0.4, { dcar: "", ion: 1, item: p.item || "toy", ix: n.x, iy: n.y });
    b.at(0.35, { iy: -4 });
    yes(b, "The toy leaves their mouth: YES");
    give(b, "mouth", p.hidden ? "pouch" : "hand", "Treat, then give the toy back");
    b.at(0.3, { ion: 0, dcar: p.item || "toy", cap: "Getting it back is the secret" });
    return b.done();
  };

  // Walking: loose leash, heel, turns, stop on tight, check-ins.
  T.walk = (p) => {
    const heel = p.mode && (p.mode.startsWith("heel") || p.mode === "off"), off = p.mode === "off" || p.mode === "checkin-off";
    const b = B({ px: 40, dx: heel ? 52 : 80, df: 1, leash: off ? 0 : 14, dh: 0, ...handAt(P(50, -86)) });
    if (p.outside || p.mode === "sidewalk" || p.mode === "checkin-dist") outdoor(b);
    if (p.mode === "checkin-dist") b.ev({ o2x: 300, o2f: -1, cap: "A dog 20 m away" });
    const go = (x, dt, extra = {}) => b.at(dt, { px: x, dx: x + (heel ? 12 : 40), ...handAt(P(x + 10, -86)), ...extra });
    if (p.mode === "checkin-off") {
      b.ev({ px: 80, dx: 270, dh: -38, ...handAt(rest(b.st, { px: 80 })) }); outdoor(b, 200, 320);
      b.at(1.0, { cap: "Stand still and wait. Don't call." }).at(0.3, { df: -1, dh: 10 }).at(1.2, { dx: 120, dh: 25, cap: "They come back on their own" });
      yes(b, "They checked in: YES"); give(b, "mouth", "hand", "Treat, then send them off to sniff");
      return b.done();
    }
    if (p.mode === "still") {
      b.at(0.9, { cap: "Stand still. Wait for slack, or a glance." }).at(0.3, { dh: 35 });
      yes(b, "A slack leash, or a glance up: YES");
    } else if (p.mode === "stop") {
      go(120, 1.0, { cap: "Walking..." });
      b.at(0.5, { dx: 170, leash: -1, dh: 0, cap: "Tight leash: freeze" });
      b.at(0.7, { dx: 150, leash: 12, dh: 25, cap: "Wait for slack" });
      yes(b, "Slack again: YES, then walk on");
    } else if (p.mode === "turn" || p.mode === "heel-turns") {
      go(150, 1.2, { cap: "Walking together" });
      b.at(0.2, { pf: -1, cap: "Turn and walk the other way" }).at(0.2, { df: -1 });
      b.at(0.9, { px: 100, dx: heel ? 88 : 78, ...handAt(P(90, -86)), dh: 25 });
      yes(b, "They catch up to your side: YES");
    } else if (p.mode === "heel-find") {
      b.at(0.6, { ...handAt(P(60, -60)), hs: "treat", cap: "Lure into place at your left leg" }).at(0.5, { dx: 54, dh: 25 });
      yes(b, "Shoulder at your knee: YES");
    } else {
      const steps = p.mode === "step" || p.mode === "heel1" ? 0.6 : 1.6;
      go(40 + steps * 110, steps * 1.4, { ...(p.mode === "checkin-dist" ? { o2x: 260 + steps * 110 } : {}), cap: p.mode === "pace" ? "Slower, then faster" : p.mode === "glance" || p.mode === "checkin" || p.mode === "checkin-off" || p.mode === "checkin-dist" ? "Say nothing, keep walking" : heel ? "Shoulder at your left knee" : "Loose leash" });
      b.at(0.3, { dh: 32 });
      yes(b, p.mode && p.mode.startsWith("checkin") ? "They look back at you: YES" : heel ? "Still in position: YES" : "Still slack after the steps: YES");
    }
    const s = rest(b.st);
    b.at(0.2, { ...handAt(P(b.st.px + b.st.pf * 12, -60)), hs: "treat" });
    give(b, "mouth", "hand", heel ? "Treat at your left seam" : "Treat at your pant seam");
    return b.done();
  };

  // Onto something: a mat, a board, a dog stand, the crate, the car, the scale.
  T.onto = (p, name) => {
    const prop = p.prop || "mat", up = { board: 14, stand: 26, car: 34, scale: 3, table: 40 }[prop] || 0;
    const px0 = 175, b = B({ px: 70, dx: 270, df: -1, dh: 0 });
    b.scene.props.push({ k: prop === "table" ? "etable" : prop, x: px0, w: 30, label: prop === "scale" ? "Scale" : prop === "table" ? "Exam table" : "" });
    if (p.stage === "send") { b.ev({ dx: 110, df: 1, cap: "Point and cue from a distance" }); b.at(0.4); say(b, p.word || "Mat"); b.at(0.3, { hs: "point", ...handAt(P(128, -116)) }); }
    if (p.stage === "look") {
      b.at(0.8, { dx: 232, dh: -38, cap: "Wait. Don't lure." });
      yes(b, "They look at or sniff it: YES");
      give(b, P(px0 + 6, -3 - up), "hand", "Toss the treat onto it");
      return b.done();
    }
    if (p.stage === "paw") {
      b.at(1.0, { dx: px0 + 14, dh: up ? 0 : -18, dtilt: up ? 16 : 0, cap: up ? "Wait for the front paws" : "Wait for a paw" }); yes(b, up ? "Front paws on it: YES" : "One paw touches it: YES");
      give(b, P(px0, -3 - up), "hand", "Toss the treat onto it"); return b.done();
    }
    const dst = p.stage === "send" ? { dx: px0 + 8, df: 1 } : { dx: px0 - 4 };
    b.at(1.0, { ...dst, dup: up, dh: 0, cap: up ? "They step up" : "All four paws on" });
    if (p.stage === "down" || p.stage === "send" && p.lie !== false) { b.at(0.5, { dr: 1, dfr: 1, cap: p.stage === "down" ? "Then down, on it" : "" }); }
    if (p.stage === "sit") b.at(0.4, { dr: 1 });
    yes(b, p.stage === "down" || p.stage === "send" ? "Lying down on it: YES" : up ? "Up and standing on it: YES" : "All four paws on it: YES");
    give(b, P(b.st.dx + b.st.df * 18, -3 - up), "hand", "Treat on it, between the paws");
    return b.done();
  };

  // Doors, the car door, the food bowl: wait until released.
  T.door = (p) => {
    const b = B({ px: 150, pf: 1, dx: 120, df: 1, ...POSES.sit, dh: 12, leash: p.stage === "car" ? 0 : 10, ...handAt(P(190, -96)) });
    if (p.stage === "bowl") {
      b.scene.props = []; b.ev({ px: 170, pf: -1, dx: 100, df: 1, ...handAt(P(150, -100)), leash: 0, ion: 1, item: "bowl", ix: 150, iy: -100 });
      b.at(0.5); say(b, "Wait");
      b.at(0.9, { ...handAt(P(140, -12)), iy: -6, ix: 140, cap: "Set the bowl down" });
      yes(b, "Still waiting as it lands: YES");
      b.at(0.4); say(b, "OK", '"OK" releases them: the meal is the reward');
      b.at(0.5, { dr: 0, dx: 124, dh: -50 });
      return b.done();
    }
    if (p.stage === "car") { b.scene.props.push({ k: "car", x: 160 }); b.ev({ dup: 34, dx: 140, df: 1, px: 240, pf: -1, ...handAt(P(210, -100)) }); }
    else b.scene.props.push({ k: "door", x: 200, dir: 1 });
    b.at(0.4); say(b, "Wait");
    const open = p.stage === "crack" ? 0.15 : 1;
    b.at(0.7, { door: open, cap: p.stage === "crack" ? "Open it a crack" : "Door open" });
    b.at(p.stage === "crack" ? 0.5 : 1.0);
    yes(b, "Still waiting: YES");
    if (p.stage === "release" || p.stage === "car") {
      b.at(0.3); say(b, "OK", '"OK", then go through together');
      if (p.stage === "car") b.at(0.6, { dx: 110, dup: 0, df: -1, dr: 0 });
      else b.at(1.0, { px: 260, dx: 280, dr: 0, ...handAt(P(270, -96)) });
      return b.done();
    }
    b.at(0.5, { door: 0 });
    give(b, "mouth", "hand", "Treat back from the door");
    return b.done();
  };

  // Handling, nails, teeth, chin rest: touch, then treat, while they stay relaxed.
  T.handle = (p) => {
    const b = B({ px: 110, pk: 1, dx: 168, ...POSES.sit, dh: 6, oh: "pouch" });
    if (p.towel) b.scene.props.push({ k: "towel", x: 132 });
    if (p.vet) b.scene.props.push({ k: "building", x: 260, label: "Vet" });
    if (p.stranger) {
      b.ev({ px: 96, wx: 218, wf: -1, wk: 1, ...handAt(rest(b.st, { px: 96 })), cap: "The friend kneels beside them" });
      b.at(0.7, { wax: 178, way: -14, cap: p.cap }).at(0.7);
      yes(b, "Relaxed through the touch: YES"); give(b, "mouth", "hand", "Your treat, right after the touch");
      return b.done();
    }
    if (p.chin) {
      const n = nose(b.st, { dh: -10, dre: 0.2 });
      if (p.word !== false) { b.at(0.3); say(b, "Chin"); }
      b.at(0.5, { ...handAt(P(n.x - 2, n.y + 9)), hs: "flat", cap: p.towel ? "A folded towel on your knee" : "A flat palm under the chin" });
      b.at(0.6, { dh: -10, dre: 0.2, cap: "They rest their chin" });
      if (p.ear) b.at(0.5, { oh: "up", cap: "Your other hand lifts an ear" });
      if (p.timer) b.ev({ timer: 1.6, timerLabel: p.timer }), b.at(1.6);
      yes(b, "Chin down on your hand: YES");
      b.at(0.2, { oh: "pouch" });
      give(b, "mouth", "pouch");
      return b.done();
    }
    const tgt = p.part === "paw" ? part(b.st, "fp", { dpaw: 1 }) : p.part === "ear" ? part(b.st, "C") : p.part === "mouth" ? nose(b.st) : part(b.st, "S");
    const off = p.part === "paw" ? P(-4, -6) : p.part === "ear" ? P(2, -8) : p.part === "mouth" ? P(-2, 2) : P(-6, -4);
    b.at(0.6, { ...handAt(P(tgt.x + off.x, tgt.y + off.y)), dpaw: p.part === "paw" ? 1 : 0, hs: p.tool ? "tool" : "open", cap: p.cap || "Touch, one second" });
    b.at(p.hold ? 1.6 : 0.6, { cap: p.hold ? "Hold it a moment" : "" });
    if (p.hold) b.ev({ timer: 1.4, timerLabel: p.hold });
    yes(b, p.yescap || "Relaxed through the touch: YES");
    b.at(0.2, { ...handAt(rest(b.st)), hs: "open", dpaw: 0 });
    give(b, "mouth", "pouch", "Treat right after the touch");
    return b.done();
  };

  // Alone time and the crate: step out, come back before any fuss.
  T.away = (p) => {
    const b = B({ px: 120, dx: 210, ...POSES.down, dh: 0, drest: 0.6 });
    b.scene.props.push({ k: p.crate ? "crate" : "mat", x: 208, w: 34 }, { k: "door", x: 40, dir: 1 });
    b.ev({ door: p.crate ? 0 : 0, cap: "A chew first, then step out" });
    b.at(0.3, { door: 1 }).at(0.9, { px: -30, pf: -1, ...handAt(rest(b.st, { px: -30, pf: -1 })) }).at(0.3, { door: 0 });
    b.ev({ timer: 1.6, timerLabel: p.secs, cap: "Calm while you're gone" }).at(1.6);
    b.at(0.3, { door: 1 }).at(0.9, { px: 140, pf: 1, ...handAt(rest(b.st, { px: 140, pf: 1 })) }).at(0.2, { door: 0 });
    yes(b, "Still calm when you're back: YES");
    give(b, "mouth", "hand", "A calm hello and a treat. No big greeting.");
    return b.done();
  };

  T.crate = (p) => {
    const b = B({ px: 80, dx: 290, dh: 0, door: 1 });
    b.scene.props.push({ k: "crate", x: 210 });
    if (p.stage === "toss") { const h = rest(b.st); b.at(0.4, { ton: 1, tx: h.x, ty: h.y, cap: "Toss a treat to the back" }).at(0.45, { tx: 190, ty: -3 }).at(0.6, { dx: 205, dh: -30 }); yes(b, "They step in to get it: YES"); b.at(0.2, { ton: 0 }); return b.done(); }
    b.at(1.0, { dx: 206, cap: "They walk in on their own" });
    if (p.stage === "walk") { yes(b, "Walks in: YES"); give(b, P(196, -3), "hand", "Treat inside the crate"); return b.done(); }
    b.at(0.5, { ...POSES.down, dh: 0 });
    if (p.stage === "lie") { yes(b, "Lies down inside: YES"); give(b, P(190, -3), "hand", "Treat between the paws"); return b.done(); }
    b.at(0.4, { door: 0, cap: p.stage === "nap" ? "Quiet room, a nap" : "Door closed, you right there" }).ev({ timer: 1.6, timerLabel: p.secs || "" }).at(p.stage === "nap" ? 0.8 : 1.6, p.stage === "nap" ? { drest: 1 } : {});
    yes(b, p.stage === "nap" ? "Settled: mark softly" : "Calm with the door closed: YES");
    b.at(0.3, { door: 1 });
    return b.done();
  };

  // Greetings, the doorbell, polite dog meetings.
  T.greet = (p) => {
    if (p.stage === "home") {
      const b = B({ px: 20, dx: 250, dh: 10 }, { props: [{ k: "door", x: 30, dir: -1 }] }); b.ev({ door: 1, cap: "You walk in" });
      b.at(1.4, { px: 120, ...handAt(rest(b.st, { px: 120 })), dx: 190 }).at(0.3, { dh: 25, cap: "Four paws stay on the floor" });
      yes(b, "Four on the floor: YES"); give(b, "floor", "hand", "Toss treats at their feet");
      return b.done();
    }
    const b = B({ px: 60, dx: 150, df: 1, leash: p.stage === "home" ? 0 : 12, dh: 10, ...handAt(P(70, -86)), oh: "chest" });
    b.ev({ wx: 360, wf: -1, cap: p.stage === "home" ? "You walk in" : "A helper walks up" });
    b.at(1.4, { wx: 205 });
    if (p.stage === "greets") b.at(0.6, { wx: 190, wax: 158, way: -62, cap: "Short petting" }).at(0.6);
    b.at(0.3, { dh: 25, cap: "Four paws stay on the floor" });
    yes(b, "Four on the floor: YES");
    give(b, "floor", "hand", "Treats at their feet, not up high");
    return b.done();
  };
  T.bell = (p) => {
    const b = B({ px: 80, dx: 240, df: -1, dh: 10 }, { props: [{ k: "mat", x: 160, w: 30 }, { k: "door", x: 290, dir: -1 }], ringX: 250, ringText: p.stage === "knock" ? "knock knock" : "ding-dong" });
    b.at(0.4).ev({ ring: true, cap: p.stage === "knock" ? "A real knock" : "Doorbell" });
    b.at(0.5); if (p.stage !== "guest") say(b, "Mat");
    b.at(1.0, { dx: 160, ...POSES.down, dh: 0, cap: "To the mat" });
    if (p.stage !== "bell") b.at(0.6, { door: 1, cap: p.stage === "guest" ? "A guest comes in" : "Open the door" });
    if (p.stage === "guest") b.ev({ wx: 310, wf: -1 }), b.at(1.0, { wx: 265 });
    yes(b, "Still on the mat: YES");
    give(b, P(150, -3), "hand", "Treat on the mat");
    return b.done();
  };
  T.meet = (p) => {
    const gap = { 15: 150, 10: 110, 5: 70 }[p.gap] || 150;
    const b = B({ px: 40, dx: 62, df: 1, leash: 14, ...handAt(P(50, -86)), o2x: 62 + gap, o2f: 1, wx: 52 + gap, wf: 1 }, { props: [], view: [0, 340] });
    outdoor(b);
    if (p.gap === "sniff") {
      b.ev({ o2x: 210, o2f: -1, wx: 230, wf: -1 });
      b.at(1.0, { px: 120, dx: 180, ...handAt(P(130, -86)), cap: "A brief sniff: count three" }).at(1.0, { dh: -6 });
      say(b, "Let's go"); b.at(0.6, { px: 80, pf: -1, dx: 110, df: -1, ...handAt(P(70, -86)) });
      yes(b, "They follow you away: YES"); give(b, "mouth", "hand"); return b.done();
    }
    b.at(2.0, { px: 160, dx: 182, ...handAt(P(170, -86)), o2x: 182 + gap, wx: 172 + gap, cap: `Walking calmly ${p.gap || 15} m apart` });
    b.at(0.3, { dh: 30 });
    yes(b, "Calm, attention on you: YES");
    give(b, "mouth", "hand", "Treat at your seam");
    return b.done();
  };

  // Settling: on a mat at home, the park, a café, a store entrance.
  T.settle = (p) => {
    const b = B({ px: 80, pk: 1, dx: 170, ...POSES.down, dh: 6 }, { props: [{ k: "mat", x: 168, w: 34 }] });
    if (p.where === "cafe") b.scene.props.push({ k: "table", x: 110 });
    if (p.where === "park") b.scene.props.push({ k: "bench", x: 70 }), outdoor(b, 200, 320);
    if (p.where === "store") b.scene.props.push({ k: "building", x: 280, label: "Store" });
    b.at(0.8, { cap: "Calm, slow, quiet" }).at(0.9, { drest: 1, cap: "Head down, hips rolled" });
    yes(b, "Relaxed: mark softly");
    give(b, P(186, -3), "hand", "Place a treat between the paws now and then");
    return b.done();
  };

  // Gentle mouth for puppies.
  T.mouth = (p) => {
    const b = B({ px: 90, pk: 1, dx: 150, dh: 4 });
    const n = nose(b.st, { dre: 0.4 });
    if (p.stage === "toy") { b.at(0.5, { ...handAt(P(n.x - 8, n.y)), hs: "fist", ion: 1, item: "toy", ix: n.x - 6, iy: n.y, cap: "Offer the toy before they grab" }).at(0.5, { dre: 0.4, ion: 0, dcar: "toy" }); yes(b, "They take the toy, not your sleeve: YES"); return b.done(); }
    if (p.stage === "settle") { b.at(0.6, { pk: 0, cap: "Play stops. Sit down, say nothing." }).at(0.9, { ...POSES.down, dh: 0 }); yes(b, "Settles within a minute: YES"); give(b, "floor", "hand", "A calm treat between the paws"); return b.done(); }
    if (p.stage === "calm") { const c = part(b.st, "C"); b.at(0.6, { ...handAt(P(c.x - 4, c.y - 4)), cap: "Stroke the face gently" }).at(0.6); yes(b, "Calm while you touch: YES"); give(b, "mouth", "pouch", "Treat from the other hand"); return b.done(); }
    b.at(0.5, { ...handAt(P(n.x - 4, n.y + 2)), cap: "Gentle play" }).at(0.5, { dre: 0.4 }).at(0.3, { dh: -6 });
    yes(b, "Soft teeth: mark, keep playing");
    b.at(0.6, { dre: 0, cap: "A hard bite: quiet \"ouch\", 5 seconds still" });
    return b.done();
  };

  // ---------- field ----------

  // Retrieves: throw (or a helper throws), send on the name, pick up, return, hold, deliver.
  T.retrieve = (p, name) => {
    const dist = p.yd || 8, hall = p.hall, water = p.water, L = hall ? 230 : Math.max(water ? Math.max(water === true ? 150 : water, 120) + 120 : 230, yd(dist)), x1 = Math.max(320, L + 70);
    const b = B({ px: hall ? 60 : 70, pk: hall ? 1 : 0, dx: hall ? 100 : 92, df: 1, ...(hall ? POSES.stand : POSES.sit), dh: 10, dtail: 0.6 }, { props: [], view: [0, x1] });
    if (water) b.scene.water = water === true ? 150 : water;
    if (p.cover) b.scene.props.push({ k: "grass", x0: L - 40, x1: L + 40 });
    if (!hall && !water) outdoor(b, 0, 0);
    if (p.decoys) b.scene.props.push({ k: "decoy", x: L - 110, n: 3 });
    if (p.ruler !== false && !hall) b.scene.ruler = { x0: 92, x1: L, text: `${dist} yd` };
    const item = p.item || (hall ? "toy" : "bumper");
    if (p.helper) b.ev({ hpx: L + 40 });
    // the throw
    if (p.planted) { b.scene.props.push({ k: "flag", x: L + 6 }); b.ev({ ion: 1, item, ix: L, iy: -4, cap: p.pile ? "A pile they can see" : "Planted before they came out" });
      if (p.pile) b.scene.props = b.scene.props.filter((q) => q.k !== "flag");
      if (p.watch) { b.ev({ ion: 0, cap: "They watch you place it" }); b.at(1.3, { px: L - 24, ...handAt(rest(b.st, { px: L - 24 })) }).at(0.3, { ion: 1, ix: L, iy: -4 }).at(0.1, { pf: -1 }).at(1.3, { px: 70, ...handAt(rest(b.st, { px: 70, pf: -1 })) }).at(0.1, { pf: 1, ...handAt(rest(b.st, { px: 70, pf: 1 })) }); }
      b.at(0.6); }
    else {
      const from = p.helper ? P(L + 30, -150) : P(b.st.px + 10, -160), mid = P((from.x + L) / 2, -200);
      if (!p.helper) b.at(0.4, { ...handAt(P(b.st.px - 6, -170)), cap: hall ? "Roll it down the hallway" : p.cap || "Throw" });
      b.at(0.25, { ion: 1, item, ix: from.x, iy: from.y, ...(p.helper ? {} : handAt(P(b.st.px + 30, -140))), cap: p.helper ? "A helper throws (a shout so they look)" : p.cap || "" });
      b.at(0.35, { ix: mid.x, iy: mid.y }).at(0.35, { ix: L, iy: -4 });
      if (p.helper && p.bang) b.ev({ bang: true, cap: "The shot as it flies" });
      b.at(0.25, { ...handAt(rest(b.st)) });
    }
    if (p.mark === "send" || !hall) {
      if (p.line) { const h = P(b.st.dx + 22, -60); b.at(0.3, { pk: 0.3, pl: 20, ...handAt(h), hs: "flat", cap: "Hand flat beside their head, pointing" }); say(b, "Back"); b.at(0.3, { pl: 0, pk: 0 }); }
      else { b.at(p.mark === "send" ? 0.9 : 0.4, { cap: p.mark === "send" ? "Hold the collar lightly, count two" : "" }); say(b, name, "Send on their name"); }
      if (p.mark === "send") { b.at(0.2, { dr: 0 }); yes(b, "Waited, then went on the name: YES"); }
    }
    if (p.mark === "chase") { b.at(0.3, { dx: b.st.dx + 40 }); yes(b, "They chase it: YES"); }
    // out, pick up, turn, back
    const run = (x, sp = 200) => { const d = Math.abs(x - b.st.dx) / sp; b.at(Math.max(0.3, d), { dx: x, dr: 0, dfr: 0, dswim: water && x > b.scene.water + 10 ? 1 : 0, dh: 0 }); };
    run(L - 18);
    b.at(0.25, { dh: -48, dre: 0.3, cap: "" }).at(0.2, { ion: 0, dcar: item, dh: 6, dre: 0 });
    if (p.mark === "pickup") yes(b, "They pick it up: YES");
    b.at(0.2, { df: -1 });
    if (p.mark === "turn") yes(b, "They turn back carrying it: YES");
    if (water) run(b.scene.water + 4, 140);
    const home = (hall ? b.st.px : b.st.px) + 40;
    run(home, 220);
    b.at(0.15, { dswim: 0 });
    if (p.shake === "early") b.at(0.4, { dh: -10, cap: "No shaking before the delivery" });
    b.at(0.3, { ...POSES.sit, dh: 14 });
    if (p.mark === "hold") { b.ev({ timer: 1.3, timerLabel: "2 s" }); b.at(1.3, { cap: "A calm hold in front of you" }); yes(b, "Still holding when the timer ends: YES"); }
    const sn = nose(b.st);
    b.at(0.4, { ...handAt(P(sn.x - 6, sn.y + 4)), hs: "open", cap: p.mark === "deliver" ? 'Hand open, "Give"' : "" });
    b.at(0.25, { dcar: "", ion: 1, item, ix: sn.x - 4, iy: sn.y + 4 });
    if (p.mark === "deliver" && !p.outcome) yes(b, "Into your hand: YES");
    if (p.outcome) badge(b, p.outcome, "Log it: a clean rep");
    b.at(0.3, { ion: 0 });
    if (p.outcome) b.at(0.5);
    give(b, "mouth", "pouch", p.outcome ? "Treat on delivery" : "Trade for a treat, then throw again");
    return b.done(p.outcome);
  };

  // Wading in together, no throw.
  T.wade = () => {
    const b = B({ px: 60, dx: 85, df: 1, dtail: 0.6 }, { props: [], water: 120 });
    b.at(1.4, { px: 150, dx: 190, ...handAt(rest(b.st, { px: 150 })), cap: "Wade in yourself; let them follow" }).at(0.5, { dx: 205, dswim: 0.6 });
    badge(b, "CLEAN", "In to the chest on their own: log it"); b.at(0.5);
    give(b, "mouth", "hand", "Treats and play in the shallows");
    return b.done(true);
  };
  // Carrying a bumper at heel.
  T.carry = () => {
    const b = B({ px: 40, dx: 70, df: 1, dcar: "bumper", dh: 8 });
    b.at(2.2, { px: 170, dx: 200, ...handAt(rest(b.st, { px: 170 })), cap: "Walk slowly, 10 steps" });
    yes(b, "Still carrying after 10 steps: YES");
    const n = nose(b.st); b.at(0.4, handAt(P(n.x, n.y + 4))).at(0.2, { dcar: "" });
    give(b, "mouth", "pouch", "Trade for a treat");
    return b.done();
  };
  // Two throws: the last one first, then the memory bird.
  T.double = (p, name) => {
    const W = p.water, far = p.yd > 30 ? 330 : 280;
    const first = W ? 180 : far, last = W ? 310 : 190;   // the water bird is thrown last
    const b = B({ px: 70, dx: 92, df: 1, ...POSES.sit, dh: 10, dtail: 0.6, item: "bumper", hpx: 355 }, { props: [], view: [0, 390] });
    if (W) b.scene.water = 240;
    b.scene.ruler = { x0: 92, x1: far, text: `${p.yd} yd` };
    b.at(0.3, { cap: "First throw" }).at(0.2, { ion: 1, ix: 340, iy: -150 }).at(0.5, { ix: first, iy: -4 });
    b.at(0.5, { cap: p.angle || "Second throw, wide apart" }).at(0.2, { i2on: 1, i2x: 340, i2y: -150 }).at(0.5, { i2x: last, i2y: -4 });
    const fetch = (x, off) => {
      b.at(0.3); say(b, name); b.at(0.2, { dr: 0 });
      b.at(Math.abs(x - 92) / 190, { dx: x - 18, ...(W && x > 240 ? { dswim: 1 } : {}) }).at(0.2, { dh: -45 }).at(0.2, { ...off, dcar: "bumper", dh: 6 }).at(0.2, { df: -1 });
      b.at(Math.abs(x - 110) / 200, { dx: 112, dswim: 0 }).at(0.3, { ...POSES.sit, dh: 14 });
      const n = nose(b.st); b.at(0.3, handAt(P(n.x, n.y + 4))).at(0.2, { dcar: "" }).at(0.2, handAt(rest(b.st)));
    };
    b.at(0.2, { cap: "The last one thrown comes first" }); fetch(last, { i2on: 0 });
    b.at(0.3, { df: 1, dx: 92, cap: p.pause ? "Pause, then line them up" : "Line them up on the memory bird" }); if (p.pause) b.at(0.6);
    b.at(0.3); fetch(first, { ion: 0 });
    badge(b, "CLEAN", "Both birds, both delivered: log it"); b.at(0.5);
    give(b, "mouth", "pouch", "Treat on each delivery");
    return b.done(true);
  };

  // Steadiness: sit at heel while things fall and fly; sometimes sent, sometimes not.
  T.steady = (p, name) => {
    const b = B({ px: 70, dx: 92, df: 1, ...POSES.sit, dh: 12, leash: p.what === "drop" ? 10 : 0 }, { props: [], view: [0, 360] });
    outdoor(b, 160, 360);
    const throwTo = (x, cap) => { const h = P(b.st.px + 10, -160); b.at(0.3, { ...handAt(P(64, -170)) }).at(0.2, { ion: 1, item: "bumper", ix: h.x, iy: h.y, ...handAt(P(100, -140)), cap }).at(0.3, { ix: (h.x + x) / 2, iy: -190 }).at(0.3, { ix: x, iy: -4 }).at(0.2, { ...handAt(rest(b.st)) }); };
    if (p.what === "drop") { const h = rest(b.st); b.at(0.4, { ion: 1, item: "bumper", ix: h.x, iy: h.y, cap: "Drop a bumper at your feet" }).at(0.35, { iy: -4, ix: h.x + 6 }); }
    else if (p.what === "toss") throwTo(150, "A short toss");
    else if (p.what === "honor") { b.ev({ o2x: 40, o2f: 1, o2r: 1 }); throwTo(260, "Throw for the other dog"); b.at(0.2, { o2r: 0 }).at(1.0, { o2x: 240 }).at(0.3, { ion: 0, o2f: -1 }).at(1.0, { o2x: 40 }); }
    else { if (p.bang) b.ev({ hpx: 330 }); throwTo(260, "A 20-yard throw"); if (p.bang) b.ev({ bang: true, cap: "And a shot" }); if (p.what === "two") b.at(0.3).at(0.2, { i2on: 1, i2x: 100, i2y: -140, ...handAt(P(100, -140)), cap: "A second throw, wide apart" }).at(0.5, { i2x: 180, i2y: -4 }).at(0.2, handAt(rest(b.st))); }
    b.at(0.6, { cap: "They stay sitting" });
    yes(b, "Still sitting: YES");
    give(b, "mouth", "pouch", p.what === "honor" ? "Treat, then their own turn" : "Treat to them while they sit. Send only some of the time.");
    return b.done();
  };

  // Gun conditioning: a far-off shot while the dog is happily chasing.
  T.gun = (p) => {
    const far = { 100: 470, 50: 330, 30: 270, 20: 240, 75: 400 }[p.yd] || 470;
    const b = B({ px: 70, dx: 92, df: 1, ...POSES.sit, dh: 10, dtail: 0.6, hpx: p.mine ? -999 : far }, { props: [], view: [0, Math.max(340, far + 50)] });
    outdoor(b, 140, far + 50);
    if (!p.mine) b.scene.ruler = { x0: 92, x1: far, text: `${p.yd} yd${p.shotgun ? " · shotgun" : " · blank pistol"}` };
    const h = P(80, -160);
    b.at(0.3, { ...handAt(P(64, -170)), cap: "Throw a fun retrieve" }).at(0.2, { ion: 1, item: "bumper", ix: h.x, iy: h.y, ...handAt(P(100, -140)) }).at(0.35, { ix: 150, iy: -180 }).at(0.35, { ix: 210, iy: -4 }).at(0.2, { ...handAt(rest(b.st)) });
    b.at(0.3, { dr: 0 }).at(0.4, { dx: 150, dtail: 0.8, dwag: 0.9 });
    b.ev({ bang: p.mine ? "p" : true, cap: p.mine ? "Your shot, gun pointed well away" : "The shot goes off while they chase" });
    b.at(0.5, { dx: 192 }).at(0.25, { dh: -45, dre: 0.3 }).at(0.2, { ion: 0, dcar: "bumper", dh: 6, dre: 0 });
    badge(b, "HAPPY", "Still happy: log it. Worried means stop.");
    b.at(0.6);
    return b.done(true);
  };

  // Whistle signals: one blast = sit, a trill = come, two pips = turn.
  T.whistle = (p, name) => {
    const far = p.stage === "20m";
    const b = B({ px: 70, dx: p.kind === "sit" && !far ? 96 : far ? 300 : 230, df: p.kind === "come" ? 1 : p.kind === "turn" ? 1 : 1, dh: p.kind === "come" ? -35 : 6, oh: "side" }, { props: [], view: [0, far ? 420 : 320] });
    outdoor(b, 120, 420);
    if (p.kind === "turn") b.ev({ dx: 150 }), b.at(1.0, { px: 120, dx: 210, ...handAt(rest(b.st, { px: 120 })), cap: "They trot ahead of you" });
    b.at(0.4, { oh: "mouth" }).ev({ whistle: p.kind, cap: p.kind === "sit" ? "One blast" : p.kind === "come" ? "A trill" : "Two pips as you turn" });
    if (p.helpCue) { b.at(0.5); say(b, "Sit", "Then your usual cue"); }
    b.at(0.4, { oh: "side" });
    if (p.kind === "sit") b.at(0.5, { ...POSES.sit, dh: 14 });
    if (p.kind === "come") b.at(0.3, { df: -1, dh: 6 }).at(1.2, { dx: 116 });
    if (p.kind === "turn") b.at(0.2, { pf: -1 }).at(0.2, { df: -1 }).at(0.9, { px: 90, dx: 120, ...handAt(rest(b.st, { px: 90, pf: -1 })) });
    yes(b, p.kind === "sit" ? "Sits as the blast ends: YES" : p.kind === "come" ? "They run in on the trill: YES" : "They turn on the pips: YES");
    if (far) { b.at(0.6, { px: 260, ...handAt(rest(b.st, { px: 260 })), cap: "Walk out and treat while they sit" }); }
    give(b, "mouth", "hand");
    return b.done();
  };

  // Lining and blinds: a hand line, "Back", straight out.
  T.lining = (p, name) => T.retrieve({ ...p, line: true, planted: true, outcome: "CLEAN" }, name);
  T.pile = (p, name) => {
    const r = T.retrieve({ ...p, line: true, planted: true, pile: true, outcome: "CLEAN" }, name);
    r.scene.props.push({ k: "pile", x: Math.max(230, yd(p.yd)) + 4 });
    return r;
  };

  // Handling casts: stop on the whistle, then go where the arm sends them.
  T.casts = (p) => {
    const b = B({ px: 70, dx: 92, df: 1, ...POSES.sit, dh: 8 }, { props: [{ k: "pile", x: 330 }, { k: "base", x: 220 }], view: [0, 380] });
    outdoor(b, 120, 380);
    b.scene.ruler = { x0: 92, x1: 220, text: p.yd ? `${p.yd} yd` : "" };
    if (p.stage === "over") {
      // seen from behind the handler, so "over" really goes sideways
      const o = B({ px: 110, dx: 190, df: -1, ...POSES.sit, dh: 12 }, { props: [{ k: "pile", x: 300 }, { k: "pile", x: 24 }] });
      o.ev({ cap: "Seen from behind you: they sit facing you" });
      if (p.yd) { o.at(0.3, { oh: "mouth" }).ev({ whistle: "sit", cap: "One blast: they stop and sit" }).at(0.6, { oh: "side" }); }
      o.at(0.8, { ...handAt(P(168, -150)), hs: "flat", cap: '"Over": arm straight out to the side' }); say(o, "Over");
      o.at(0.4, { dr: 0, df: 1 }).at(0.9, { dx: 280, ...handAt(rest(o.st)) }).at(0.2, { dh: -45 }).at(0.2, { dcar: "bumper", dh: 6 });
      badge(o, "CLEAN", "Took the arm you gave: log it"); o.at(0.5);
      return o.done(true);
    }
    if (p.stage === "blind") {
      b.scene.props = [{ k: "grass", x0: 290, x1: 350 }];
      b.at(0.4, { cap: "Planted off a natural line" }); say(b, "Back"); b.at(0.2, { dr: 0 }).at(0.8, { dx: 220 }).at(0.1, { oh: "mouth" }).ev({ whistle: "sit", cap: "One stop..." }).at(0.4, { oh: "side", df: -1, ...POSES.sit, dh: 14 })
        .at(0.6, { oh: "up", cap: "...and one cast" }); say(b, "Back");
      b.at(0.3, { dr: 0, df: 1 }).at(0.7, { dx: 308, oh: "side" }).at(0.3, { dh: -45 }).at(0.2, { dcar: "bumper", dh: 6 });
      badge(b, "CLEAN", "Found it with one handle: log it"); b.at(0.5);
      return b.done(true);
    }
    if (p.stage === "stop") {
      b.at(0.4); say(b, "Back"); b.at(0.2, { dr: 0 }).at(0.8, { dx: 220 });
      b.at(0.1, { oh: "mouth" }).ev({ whistle: "sit", cap: "One blast halfway" }).at(0.4, { oh: "side", df: -1, ...POSES.sit, dh: 14 });
      badge(b, "CLEAN", "Stopped and sat, facing you: log it");
      return b.done(true);
    }
    b.ev({ dx: 220, df: -1, cap: "Sitting on the mound, facing you" });
    const over = p.stage === "over";
    b.at(0.7, { oh: over ? "side" : "up", ...(over ? handAt(P(150, -128)) : {}), hs: over ? "flat" : "open", cap: over ? '"Over": arm straight out to the side' : '"Back": arm straight up' });
    say(b, over ? "Over" : "Back");
    b.at(0.3, { dr: 0, df: 1 }).at(0.7, { dx: 312, oh: "side", ...handAt(rest(b.st)) });
    b.at(0.25, { dh: -45 }).at(0.2, { dcar: "bumper", dh: 6 });
    badge(b, "CLEAN", "The right cast: log it");
    return b.done(true);
  };

  // Hunt dead: an area search in cover on "Dead bird".
  T.hunt = (p) => {
    const b = B({ px: 70, dx: 92, df: 1, ...POSES.sit, dh: 8, ion: 1, item: p.item || "bumper", ix: 250, iy: -3 }, { props: [{ k: "grass", x0: 150, x1: 320 }], view: [0, 340] });
    if (p.wait) b.at(0.6, { cap: "Hidden two minutes ago" });
    b.at(0.4); say(b, "Dead bird"); b.at(0.2, { dr: 0 });
    b.at(0.7, { dx: 200, dh: -40, cap: "They search the area, nose down" }).at(0.5, { df: -1 }).at(0.5, { dx: 170 }).at(0.3, { df: 1 }).at(0.8, { dx: 232 });
    b.at(0.2, { ion: 0, dcar: p.item || "bumper", dh: 6 });
    badge(b, "CLEAN", "Found and picked up: log it");
    return b.done(true);
  };

  // Blind and boat manners: still on a stand while calls blow and you move.
  T.blindm = (p) => {
    const dec = p.stage === "decoys";
    if (dec) {
      const b = B({ px: 40, dx: 58, df: 1, leash: 12, ...handAt(P(50, -86)) }, { props: [{ k: "decoy", x: 140, n: 3 }] });
      b.at(1.8, { px: 230, dx: 248, ...handAt(P(240, -86)), cap: "Walk past the decoys" });
      yes(b, "Walked past, left them alone: YES"); give(b, "mouth", "pouch"); return b.done();
    }
    const b = B({ px: 80, dx: 180, df: -1, ...POSES.sit, dup: 26, dh: 10 }, { props: [{ k: "stand", x: 178 }] });
    if (p.stage === "blind") b.scene.props.push({ k: "grass", x0: 120, x1: 240 });
    b.ev({ timer: 2.4, timerLabel: p.secs || "" });
    if (p.stage === "calls") b.at(0.5, { oh: "mouth" }).ev({ say: "quack-quack", cap: "Duck calls blow" }).at(1.0, { oh: "side" });
    if (p.stage === "motion") b.at(0.6, { pk: 1, cap: "You sit, stand, shoulder an empty gun" }).at(0.6, { pk: 0 }).at(0.4, { ...handAt(P(110, -150)), hs: "flat" }).at(0.4, { ...handAt(rest(b.st)) });
    b.at(p.stage === "stand" ? 2.4 : 0.6, { cap: p.stage === "blind" ? "Quiet and still in the blind" : "Still on the stand" });
    yes(b, "Still on their spot: YES");
    give(b, "mouth", "hand", "Treat on the stand");
    return b.done();
  };

  // Pointing: the flirt-pole wing, the freeze, holds, the launcher.
  T.point = (p) => {
    if (p.walk || p.kick) p = { ...p, bird: true };
    const pole = !p.bird;
    const b = B({ px: 70, dx: 230, df: -1, dh: -10, pole: pole ? 1 : 0, ion: pole ? 1 : 0, item: "wing", ix: 160, iy: -4, dtail: 0.6 }, { props: [], view: [0, 340] });
    outdoor(b, 120, 340);
    if (p.bird) b.scene.props.push({ k: "launcher", x: 150 }), b.ev({ bon: 0, bx: 150, by: -10, df: -1, dx: 220 });
    if (p.stage === "chase") {
      b.at(0.9, { ix: 250, iy: -4, dx: 270, df: 1, cap: "Drag the wing in circles" }).at(0.9, { ix: 150, dx: 180, df: -1 }).at(0.4, { dre: 0.3 });
      yes(b, "They chase it: YES"); b.at(0.6, { ix: 120, cap: "Let them catch it now and then" }); return b.done();
    }
    if (pole) b.at(0.8, { ix: 160, dx: 214, cap: "Stop the wing dead" });
    b.at(0.5, { dpaw: 1, dtail: 1, dwag: 0, dh: -4, dre: 0.2, cap: p.walk ? "" : "The freeze" });
    if (p.secs) b.ev({ timer: p.hold || 1.4, timerLabel: p.secs }).at(p.hold || 1.4);
    if (p.walk) b.at(1.2, { px: 260, ...handAt(rest(b.st, { px: 260 })), cap: "Walk past their nose" }).ev({ cap: "Keep going: they hold" });
    if (p.kick) b.ev({ px: 170 }), b.at(0.6, { pl: 20, cap: "Kick the cover for the bird" }).at(0.5, { pl: 0 });
    yes(b, p.secs ? "Still on point when the timer ends: YES" : "They freeze, staring: YES");
    if (p.bird) b.at(0.3, { bon: 1 }).at(0.8, { bx: 300, by: -150, cap: "Release: the flight is the reward" });
    else b.at(0.4, { ix: 100, iy: -30, dpaw: 0, cap: "Flick the wing away: chase is the reward" });
    return b.done();
  };

  // Whoa: stand still, taught on a board with rewards.
  T.whoa = (p, name) => {
    const board = p.stage === "board" || p.stage === "boardHold";
    if (p.stage === "walk" || p.stage === "10" || p.stage === "30") {
      const far = p.stage !== "walk";
      const b = B({ px: 40, dx: far ? 120 : 58, df: 1, leash: 14, ...handAt(P(50, -86)), dh: 0 }, { props: [], view: [0, far ? 420 : 320] });
      outdoor(b);
      b.at(far ? 1.0 : 0.9, { px: far ? 80 : 120, dx: far ? (p.stage === "30" ? 330 : 220) : 138, ...handAt(P(far ? 90 : 130, -86)), leash: far ? 30 : 14, cap: far ? "Check cord on, they move out ahead" : "Walking" });
      say(b, "Whoa"); b.at(0.4, { dh: 4, cap: "They stop and stand. Not a sit." });
      yes(b, "Standing still: YES");
      if (far) b.at(0.8, { px: b.st.dx - 40, ...handAt(rest(b.st, { px: b.st.dx - 40 })), cap: "Walk up and treat while they stand" });
      give(b, "mouth", "hand"); return b.done();
    }
    const b = B({ px: 105, dx: 152, df: -1, dh: 6, dup: board ? 14 : 0 }, { props: [{ k: "board", x: board ? 172 : 250 }] });
    if (p.stage === "board") { const u = part(b.st, "S"); b.at(0.5, { ...handAt(P(u.x + 14, u.y + 18)), cap: "A hand under the belly at first" }).at(0.8); yes(b, "Standing still on the board: YES"); give(b, "mouth", "pouch"); return b.done(); }
    b.at(0.3); say(b, "Whoa"); b.ev({ timer: 1.6, timerLabel: "" }).at(1.6, { cap: "Tap Miss if they sit or step" });
    yes(b, "Still standing: YES");
    give(b, "mouth", "hand", "Treat while they stand, then release");
    return b.done();
  };

  // Steady to wing, shot and fall: on point while the bird flies.
  T.steadyb = (p, name) => {
    const b = B({ px: 80, dx: 190, df: 1, dpaw: 1, dtail: 1, dwag: 0, dh: -4, dre: 0.2, bon: 1, bx: 250, by: -8, hpx: p.helper ? 330 : -999 }, { props: [{ k: "launcher", x: 250 }], view: [0, 360] });
    outdoor(b, 0, 360);
    b.at(0.6, { cap: "On point, check cord on" });
    b.at(0.3, { by: -40 }).at(0.6, { bx: 330, by: -150, cap: p.what === "two" ? "The first bird flies" : "The bird flies" });
    if (p.what === "two") b.at(0.01, { bon: 0 }).at(0.4, { bx: 270, by: -8 }).at(0.1, { bon: 1 }).at(0.3, { by: -40 }).at(0.6, { bx: 350, by: -150, cap: "And a second bird" });
    if (p.bang) b.ev({ bang: p.bang === "p" ? "p" : true, cap: "The shot" });
    if (p.fall) b.at(0.6, { bx: 300, by: -4, cap: "It falls" }).at(0.01, { bon: 0, ion: 1, item: "bird", ix: 300, iy: -4 });
    b.at(0.5);
    if (p.name) { say(b, name, "Released by name"); b.at(0.3, { dpaw: 0 }).at(0.6, { dx: 282 }).at(0.2, { ion: 0, dcar: "bird" }); }
    badge(b, "STEADY", p.name ? "Went only on their name: log it" : "Stayed put: log it");
    b.at(0.5);
    return b.done(true);
  };

  T.backing = (p) => {
    const real = p.target === "dog";
    const b = B({ px: 40, dx: 60, df: 1, dh: 0, dtail: 0.6, ...(real ? { o2x: 300, o2f: 1, o2paw: 1, o2tail: 1 } : {}) }, { props: real ? [{ k: "launcher", x: 350 }] : [{ k: "cutout", x: 260, f: 1 }], view: [0, real ? 400 : 340] });
    outdoor(b, 160, 400);
    if (p.cover) b.scene.props.push({ k: "grass", x0: 200, x1: 300 });
    b.at(1.2, { dx: real ? 300 - p.gap * 2.4 : 200, cap: "Walk them up" }).at(0.3, { dpaw: 1, dtail: 1, dwag: 0 });
    badge(b, "BACKED", "Stopped on sight of the pointing dog");
    b.at(0.6);
    return b.done(true);
  };

  T.covey = (p) => {
    const b = B({ px: 60, dx: 140, df: 1, dh: -6, dtail: 0.8, bon: 1, bx: 250, by: -6 }, { props: [{ k: "grass", x0: 180, x1: 340 }], view: [0, 360] });
    if (p.stage === "singles") b.at(1.2, { dx: 210, dh: -20, cap: "Work slowly where the birds landed" });
    b.at(0.4, { dpaw: 1, dtail: 1, dwag: 0, cap: "On point" });
    if (p.stage !== "point") b.at(0.4, { by: -60 }).at(0.6, { bx: 340, by: -160, cap: "The covey flushes" });
    badge(b, "CLEAN", p.stage === "rise" ? "Steady through the rise" : "Pointed: log it");
    b.at(0.5);
    return b.done(true);
  };

  T.range = (p) => {
    const b = B({ px: 70, dx: 420, df: 1, dh: 0, dtail: 0.7 }, { props: [], view: [0, 560] });
    outdoor(b, 120, 560);
    b.scene.ruler = { x0: 70, x1: 420, text: p.stage === "recall" ? "100 yd" : "50 yd" };
    if (p.stage === "checkin") b.at(0.5, { df: -1 }).at(1.2, { dx: 200, cap: "Hunting out front" }).at(0.3, { df: 1 }).at(0.8, { dx: 330 });
    else { b.at(0.5, { oh: "mouth" }).ev({ whistle: p.stage === "turn" ? "turn" : "come", cap: p.stage === "turn" ? "Two pips" : "A trill" }).at(0.3, { oh: "side", df: -1 }).at(p.stage === "turn" ? 0.8 : 1.6, { dx: p.stage === "turn" ? 340 : 110 }); }
    badge(b, p.stage === "checkin" ? "CHECK-IN" : "CLEAN", "Log it");
    b.at(0.5);
    return b.done(true);
  };

  // Car manners, vet visits, emergency down, the field-day sound ladder: smaller one-offs.
  T.car = (p) => {
    const b = B({ px: 90, dx: 200, df: -1, dh: 6 }, { props: [{ k: "car", x: 230 }] });
    if (p.stage === "hop") { b.ev({ dx: 140, df: 1 }); b.at(0.3); say(b, "Load up"); b.at(0.6, { dx: 220, dup: 34 }); yes(b, "In the car: YES"); give(b, "mouth", "hand", "Treat in the car"); return b.done(); }
    b.ev({ dup: 34, dx: 225 });
    if (p.stage === "settle" || p.stage === "ride") { b.at(0.7, { ...POSES.down, cap: p.stage === "ride" ? "A short ride: settled" : "They lie down inside" }); if (p.stage === "ride") b.ev({ timer: 1.4, timerLabel: "5 min" }).at(1.4); yes(b, "Settled: YES"); give(b, "floor", "hand"); return b.done(); }
    b.ev({ dx: 200, df: -1, ...POSES.sit }); b.at(0.4); say(b, "Wait"); b.at(1.0, { cap: "The door open, leash on" });
    yes(b, "Waiting at the open door: YES"); b.at(0.4); say(b, "OK"); b.at(0.6, { dx: 150, dup: 0, dr: 0 });
    return b.done();
  };
  T.vet = (p) => {
    const b = B({ px: 90, dx: 170, df: -1, dh: 6, oh: "pouch" }, { props: [{ k: "building", x: 250, label: "Vet" }] });
    if (p.stage === "lot") b.scene.props = [{ k: "car", x: 270 }];
    if (p.stage === "room") return T.handle({ chin: true, vet: true });
    if (p.stage === "scale") return T.onto({ prop: "scale", stage: "four" });
    if (p.stage === "table") return T.onto({ prop: "table", stage: "four" });
    b.at(0.8, { cap: p.stage === "lot" ? "Just visit. A few treats, then leave." : p.stage === "room" ? "A chin rest in the exam room" : "Treats in the lobby" });
    yes(b, "Calm, taking treats: YES");
    give(b, "mouth", "pouch", "Great treats");
    return b.done();
  };
  T.edown = (p) => {
    const run = p.stage === "run", far = p.stage === "10" || run;
    const b = B({ px: 80, dx: run ? 330 : far ? 300 : p.stage === "2" ? 160 : 110, df: -1, dh: 8, ...(p.stage === "walk" ? { px: 40, dx: 58, df: 1 } : {}) }, { props: [], view: [0, far ? 380 : 320] });
    if (p.stage === "walk") b.at(1.0, { px: 130, dx: 148, ...handAt(rest(b.st, { px: 130 })), cap: "Walking together" });
    if (run) b.at(0.8, { dx: 210, cap: "Trotting toward you" });
    b.at(0.2, { oh: "up" }); say(b, "Down!", "Sharp cue, or one hand straight up");
    b.at(0.3, { ...POSES.down, dh: 0 });
    if (p.stage === "walk") b.at(0.3, { px: 150, ...handAt(rest(b.st, { px: 150 })) });
    yes(b, "Elbows hit the floor: YES");
    b.at(0.1, { oh: "side" });
    const fl = P(b.st.dx + b.st.df * 22, -3);
    give(b, fl, "hand", far ? "Throw the treat to them, so staying down pays" : "Toss the treat between the paws");
    return b.done();
  };

  // ---------- the map: every step of every skill ----------

  const M = {
    name: [{ t: "look", stage: "free" }, { t: "look", stage: "name" }, { t: "look", stage: "distract" }, { t: "look", stage: "far" }, { t: "look", stage: "outside" }],
    touch: [{ t: "touch", stage: "bump" }, { t: "touch", stage: "move" }, { t: "touch", stage: "word" }, { t: "touch", stage: "come" }, { t: "touch", stage: "real" }],
    sit: [{ t: "lure", to: "sit" }, { t: "lure", to: "sit", mode: "empty" }, { t: "lure", to: "sit", mode: "small" }, { t: "lure", to: "sit", mode: "word", word: "Sit" },
      { t: "lure", to: "sit", mode: "word-only", word: "Sit" }, { t: "hold", pose: "sit", word: "Sit", secs: "2-6 s" }, { t: "lure", to: "sit", mode: "new", word: "Sit" }],
    down: [{ t: "lure", to: "down" }, { t: "lure", to: "down", mode: "empty" }, { t: "lure", to: "down", mode: "small" }, { t: "lure", to: "down", mode: "word", word: "Down" },
      { t: "lure", to: "down", mode: "word-only", word: "Down" }, { t: "lure", to: "down", mode: "new", word: "Down" }],
    stay: [{ t: "hold", pose: "sit", secs: "1-3 s" }, { t: "hold", pose: "sit", secs: "3-10 s" }, { t: "hold", pose: "sit", away: 1 }, { t: "hold", pose: "sit", away: 4 },
      { t: "hold", pose: "sit", distract: "drop" }, { t: "hold", pose: "sit", outside: true, secs: "2-6 s" }],
    come: [{ t: "recall", stage: "pingpong" }, { t: "recall", stage: "collar" }, { t: "recall", stage: "room" }, { t: "recall", stage: "longline" }, { t: "recall", stage: "sniff" }],
    leave: [{ t: "leave", where: "fist" }, { t: "leave", where: "palm" }, { t: "leave", where: "fist", word: true }, { t: "leave", where: "floor" }, { t: "leave", where: "walk" }, { t: "leave", where: "real", word: true }],
    drop: [{ t: "trade" }, { t: "trade", word: true }, { t: "trade", word: true, hidden: true }, { t: "trade", word: true, hidden: true }, { t: "trade", item: "sock", word: true, hidden: true }],
    leash: [{ t: "walk", mode: "still" }, { t: "walk", mode: "step" }, { t: "walk", mode: "steps" }, { t: "walk", mode: "stop" }, { t: "walk", mode: "turn" }, { t: "walk", mode: "steps", outside: true }],
    mat: [{ t: "onto", stage: "look" }, { t: "onto", stage: "paw" }, { t: "onto", stage: "four" }, { t: "onto", stage: "down" }, { t: "hold", pose: "down", prop: "mat", word: "Mat", secs: "5-30 s" },
      { t: "onto", stage: "send", word: "Mat" }, { t: "settle" }],
    place: [{ t: "onto", prop: "board", stage: "paw" }, { t: "onto", prop: "board", stage: "four" }, { t: "onto", prop: "board", stage: "down" }, { t: "hold", pose: "down", prop: "board", word: "Place", secs: "5-30 s" }, { t: "onto", prop: "board", stage: "send", word: "Place" }],
    wait: [{ t: "door", stage: "crack" }, { t: "door", stage: "open" }, { t: "door", stage: "release" }, { t: "door", stage: "car" }, { t: "door", stage: "bowl" }],
    checkin: [{ t: "walk", mode: "checkin" }, { t: "walk", mode: "checkin" }, { t: "walk", mode: "turn" }, { t: "walk", mode: "checkin-dist" }, { t: "walk", mode: "checkin-off" }],
    heel: [{ t: "walk", mode: "heel-find" }, { t: "walk", mode: "heel1" }, { t: "walk", mode: "heel5" }, { t: "walk", mode: "heel-turns" }, { t: "walk", mode: "heel-pace" }, { t: "walk", mode: "off" }],
    edown: [{ t: "edown", stage: "side" }, { t: "edown", stage: "2" }, { t: "edown", stage: "walk" }, { t: "edown", stage: "10" }, { t: "edown", stage: "run" }],
    crate: [{ t: "crate", stage: "toss" }, { t: "crate", stage: "walk" }, { t: "crate", stage: "lie" }, { t: "crate", stage: "door", secs: "5-30 s" }, { t: "away", crate: true, secs: "30 s" }, { t: "crate", stage: "nap" }],
    mouth: [{ t: "mouth", stage: "soft" }, { t: "mouth", stage: "toy" }, { t: "mouth", stage: "calm" }, { t: "mouth", stage: "settle" }],
    handling: [{ t: "handle", part: "paw" }, { t: "handle", part: "ear", cap: "Lift an ear, one second" }, { t: "handle", part: "collar", cap: "Take the collar from the side" },
      { t: "handle", part: "paw", hold: "2 s" }, { t: "handle", part: "body", tool: true, cap: "A few brush strokes" }, { t: "handle", part: "paw", stranger: true, cap: "The friend touches; you treat" }],
    alone: [{ t: "away", secs: "10 s" }, { t: "away", secs: "1 min" }, { t: "away", secs: "5 min" }, { t: "away", secs: "15 min" }, { t: "away", secs: "30 min" }],
    hallret: [{ t: "retrieve", hall: true, mark: "chase" }, { t: "retrieve", hall: true, mark: "pickup" }, { t: "retrieve", hall: true, mark: "turn" }, { t: "retrieve", hall: true, mark: "deliver" }, { t: "retrieve", hall: true, mark: "hold" }],
    chin: [{ t: "handle", chin: true }, { t: "handle", chin: true, timer: "3-6 s" }, { t: "handle", chin: true, towel: true }, { t: "handle", chin: true, ear: true }, { t: "handle", chin: true, vet: true }],
    nails: [{ t: "handle", part: "paw", hold: "2 s", cap: "Hold a paw" }, { t: "handle", part: "paw", tool: true, cap: "The clipper touches a nail" }, { t: "handle", part: "paw", tool: true, cap: "Trim one tiny tip", yescap: "One nail, calm: jackpot" },
      { t: "handle", part: "paw", tool: true, hold: "a paw", cap: "Treat after each nail" }, { t: "handle", part: "paw", tool: true, hold: "all", cap: "All four paws, over days if needed" }],
    teeth: [{ t: "handle", part: "mouth", cap: "Lift a lip" }, { t: "handle", part: "mouth", cap: "A finger on the teeth" }, { t: "handle", part: "mouth", tool: true, cap: "The brush touches the teeth" },
      { t: "handle", part: "mouth", tool: true, hold: "5 s", cap: "Small circles on the front teeth" }, { t: "handle", part: "mouth", tool: true, hold: "all", cap: "All the outer surfaces" }],
    vet: [{ t: "vet", stage: "lot" }, { t: "vet", stage: "lobby" }, { t: "vet", stage: "scale" }, { t: "vet", stage: "room" }, { t: "vet", stage: "table" }],
    car: [{ t: "car", stage: "hop" }, { t: "car", stage: "settle" }, { t: "car", stage: "ride" }, { t: "car", stage: "exit" }],
    floor: [{ t: "greet", stage: "home" }, { t: "greet", stage: "helper" }, { t: "greet", stage: "greets" }, { t: "greet", stage: "stranger" }],
    doorbell: [{ t: "bell", stage: "bell" }, { t: "bell", stage: "door" }, { t: "bell", stage: "knock" }, { t: "bell", stage: "guest" }],
    public: [{ t: "settle", where: "park" }, { t: "settle", where: "cafe" }, { t: "settle", where: "store" }, { t: "settle", where: "park" }],
    dogmeet: [{ t: "meet", gap: 15 }, { t: "meet", gap: 10 }, { t: "meet", gap: 5 }, { t: "meet", gap: "sniff" }],

    whistle: [{ t: "whistle", kind: "sit", helpCue: true }, { t: "whistle", kind: "sit" }, { t: "whistle", kind: "come" }, { t: "whistle", kind: "turn" }, { t: "whistle", kind: "sit", stage: "20m" }],
    retrieve: [{ t: "retrieve", yd: 3, mark: "pickup", ruler: false }, { t: "retrieve", yd: 4, mark: "turn", ruler: false }, { t: "retrieve", yd: 3, mark: "hold", ruler: false },
      { t: "carry" }, { t: "retrieve", yd: 4, mark: "deliver", ruler: false }, { t: "retrieve", yd: 6, mark: "send", ruler: false }],
    birds: [{ t: "retrieve", yd: 5, item: "soft", mark: "deliver", ruler: false }, { t: "retrieve", yd: 6, item: "bumper", mark: "deliver", ruler: false }, { t: "retrieve", yd: 6, item: "wing", mark: "deliver", ruler: false },
      { t: "retrieve", yd: 5, item: "bird", mark: "deliver", ruler: false }, { t: "retrieve", yd: 15, item: "bird", mark: "deliver", helper: true, bang: true }],
    gun: [{ t: "gun", yd: 100 }, { t: "gun", yd: 50 }, { t: "gun", yd: 30 }, { t: "gun", yd: 20 }, { t: "gun", yd: 75, shotgun: true }, { t: "gun", mine: true }],
    steady: [{ t: "steady", what: "drop" }, { t: "steady", what: "toss" }, { t: "steady", what: "throw" }, { t: "steady", what: "throw", bang: true }, { t: "steady", what: "two" }, { t: "steady", what: "honor" }],
    marks: [{ t: "retrieve", yd: 10, helper: true, outcome: "CLEAN" }, { t: "retrieve", yd: 25, helper: true, outcome: "CLEAN" }, { t: "retrieve", yd: 50, helper: true, outcome: "CLEAN" },
      { t: "retrieve", yd: 75, helper: true, outcome: "CLEAN" }, { t: "retrieve", yd: 100, helper: true, outcome: "CLEAN" }, { t: "retrieve", yd: 50, helper: true, cover: true, outcome: "CLEAN" }, { t: "retrieve", yd: 40, helper: true, cover: true, outcome: "CLEAN" }],
    waterentry: [{ t: "wade" }, { t: "retrieve", yd: 6, water: 120, outcome: "CLEAN", ruler: false }, { t: "retrieve", yd: 10, water: 110, outcome: "CLEAN", cap: "Throw parallel to the shore at first" },
      { t: "retrieve", yd: 25, water: 110, outcome: "CLEAN" }, { t: "retrieve", yd: 50, water: 110, outcome: "CLEAN" }, { t: "retrieve", yd: 25, water: 110, outcome: "CLEAN", cap: "Throw at an angle to the shore" }, { t: "retrieve", yd: 30, water: 110, decoys: true, outcome: "CLEAN" }],
    waterdelivery: [{ t: "retrieve", yd: 12, water: 120, outcome: "CLEAN", ruler: false }, { t: "retrieve", yd: 12, water: 120, outcome: "CLEAN", ruler: false }, { t: "retrieve", yd: 12, water: 120, mark: "deliver", outcome: "CLEAN", ruler: false }],
    doubles: [{ t: "double", yd: 25 }, { t: "double", yd: 25, pause: true }, { t: "double", yd: 25, angle: "Second throw, closer together" }, { t: "double", yd: 25, water: true, angle: "Water bird thrown last" }, { t: "double", yd: 50 }],
    lining: [{ t: "pile", yd: 10 }, { t: "pile", yd: 25 }, { t: "pile", yd: 50 }, { t: "lining", yd: 50, watch: true }, { t: "lining", yd: 75 }],
    casts: [{ t: "casts", stage: "stop", yd: 10 }, { t: "casts", stage: "over" }, { t: "casts", stage: "back" }, { t: "casts", stage: "back", yd: 30 }, { t: "casts", stage: "over", yd: 50 }],
    blinds: [{ t: "lining", yd: 25 }, { t: "lining", yd: 50 }, { t: "lining", yd: 100 }, { t: "casts", stage: "blind" }, { t: "lining", yd: 30, water: 160 }],
    huntdead: [{ t: "hunt" }, { t: "hunt" }, { t: "hunt", item: "bird", wait: true }],
    blindmanners: [{ t: "blindm", stage: "stand", secs: "10-60 s" }, { t: "blindm", stage: "calls" }, { t: "blindm", stage: "motion" }, { t: "blindm", stage: "blind", secs: "10 min" }, { t: "blindm", stage: "decoys" }],

    birdintro: [{ t: "point", stage: "chase" }, { t: "point", stage: "freeze" }, { t: "point", secs: "3 s", hold: 1.2 }, { t: "point", secs: "10 s", hold: 1.8 }, { t: "point", bird: true }, { t: "point", bird: true }],
    whoa: [{ t: "whoa", stage: "board" }, { t: "whoa", stage: "boardHold" }, { t: "whoa", stage: "ground" }, { t: "whoa", stage: "walk" }, { t: "whoa", stage: "10" }, { t: "whoa", stage: "30" }],
    pointdur: [{ t: "point", secs: "3 s", hold: 1.2 }, { t: "point", secs: "10 s", hold: 1.8 }, { t: "point", secs: "30 s", hold: 2.4 }, { t: "point", walk: true }, { t: "point", kick: true }],
    steadywing: [{ t: "steadyb" }, { t: "steadyb" }, { t: "steadyb", what: "two" }],
    steadyshot: [{ t: "steadyb", bang: true, helper: true }, { t: "steadyb", bang: true, helper: true }, { t: "steadyb", bang: "p" }],
    steadyfall: [{ t: "steadyb", bang: true, helper: true, fall: true }, { t: "steadyb", bang: true, helper: true, fall: true, name: true }],
    backing: [{ t: "backing" }, { t: "backing", cover: true }, { t: "backing", target: "dog", gap: 20 }, { t: "backing", target: "dog", gap: 50 }],
    covey: [{ t: "covey", stage: "point" }, { t: "covey", stage: "rise" }, { t: "covey", stage: "singles" }],
    range: [{ t: "range", stage: "checkin" }, { t: "range", stage: "turn" }, { t: "range", stage: "recall" }],
  };

  /** The animation for one step, or null when there is none. */
  function forStep(skillId, i, dogName) {
    const spec = (M[skillId] || [])[i];
    if (!spec || !T[spec.t]) return null;
    try { return T[spec.t](spec, dogName || "Name"); } catch (e) { return null; }
  }
  /** The moments of one animation, in order: what to do, when to mark, what to give. */
  function moments(a) {
    const out = [];
    for (const k of a.keys) if (k.cap && (!out.length || out[out.length - 1].text !== k.cap)) {
      const m = a.keys.some((q) => (q.yes || q.badge) && q.cap === k.cap);
      if (!out.some((x) => x.text === k.cap)) out.push({ t: k.t, text: k.cap, mark: m });
    }
    return out;
  }
  /** Builds the player (picture, controls, numbered moments) inside `box`. Returns false when the step has no animation. */
  function player(box, skillId, i, dogName, skillLabel) {
    box.replaceChildren();
    const a = forStep(skillId, i, dogName); box.hidden = !a; if (!a) return false;
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    const ms = moments(a), cv = mk("canvas", "anim-cv");
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Animation. " + ms.map((m) => m.text).join(". "));
    const ol = mk("ol", "anim-steps"), btns = ms.map((m, n) => {
      const li = mk("li"), b = mk("button", m.mark ? "mark" : ""); b.type = "button";
      b.append(mk("b", "", String(n + 1)), mk("span", "", m.text)); li.append(b); ol.append(li); return b;
    });
    const bar = mk("div", "anim-bar"), pause = mk("button", "", "Pause"), slow = mk("button", "", "Slow");
    for (const b of [pause, slow]) { b.type = "button"; bar.append(b); }
    box.append(cv, bar, ol);
    const light = (cap) => btns.forEach((b, n) => b.classList.toggle("on", ms[n].text === cap));
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pl = PTAnim.mount(cv, a, { onCaption: light }), running = !still, spd = 0.8; pl.setSpeed(spd);
    if (still) pause.textContent = "Play";
    const go = () => { if (still && !running) { pl.destroy(); pl = PTAnim.mount(cv, a, { onCaption: light, force: true }); pl.setSpeed(spd); } running = true; pause.textContent = "Pause"; };
    const flip = () => { if (still && !running) return go(); running = pl.toggle(); pause.textContent = running ? "Pause" : "Play"; };
    pause.addEventListener("click", flip); cv.addEventListener("click", flip);
    slow.addEventListener("click", () => { spd = spd === 0.8 ? 0.4 : 0.8; pl.setSpeed(spd); slow.classList.toggle("on", spd === 0.4); slow.setAttribute("aria-pressed", spd === 0.4); });
    btns.forEach((b, n) => b.addEventListener("click", () => { go(); pl.seek(ms[n].t); }));
    return true;
  }
  return { forStep, moments, player, M, T };
})();
