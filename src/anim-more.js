// Step animations for the phase 3 tracks and the behavior helpers. Extends PTSteps (anim-steps.js); same conventions.
(() => {
  const { B, give, yes, badge, say, handAt, rest, nose, part, hum, POSES, outdoor, yd, P } = PTSteps.kit, T = PTSteps.T;
  const M = PTSteps.M;
  const woof = (b, cap) => b.ev({ say: "Woof!", who: "d", cap });
  const follow = (b, dt, px, o = {}) => b.at(dt, { px, ...handAt(P(px + 12, -86)), ...o });

  // ---------- upland flushing ----------
  // Zigzag in front: the dog crosses out and back while the handler walks on.
  T.zig = (p) => {
    const b = B({ px: 50, dx: 120, df: 1, dh: -14, dtail: 0.7, dwag: 0.9 }, { props: [], view: [0, 420] });
    outdoor(b, 100, 420);
    if (p.yd) b.scene.ruler = { x0: 110, x1: 330, text: `${p.yd} yd` };
    if (p.wind) b.scene.props.push({ k: "wind", x: p.wind === "face" ? 400 : 210, dir: -1, label: "" });
    if (p.treats) for (const x of [180, 250, 320]) b.scene.props.push({ k: "treats", x });
    follow(b, 1.0, 80, { dx: 250, cap: p.treats ? "Walk toward a hidden treat" : p.wind === "face" ? "Walk into the wind" : p.wind ? "Wind on your cheek" : "Walk slowly; they work out to one side" });
    if (p.pips) b.at(0.2, { oh: "mouth" }).ev({ whistle: "turn", cap: "Two pips, and turn your body" });
    b.at(0.3, { df: -1, oh: "side" });
    follow(b, 0.9, 100, { dx: 160, cap: p.treats ? "They find it and cross to the next" : "They cross back in front of you" });
    b.at(0.3, { df: 1 });
    follow(b, 0.9, 120, { dx: 280, dh: -30, cap: "And across again, inside gun range" });
    if (p.find) b.at(0.4, { dh: -45, cap: "The find, then a short retrieve" });
    badge(b, "CLEAN", "A tidy pattern: log it"); b.at(0.6);
    return b.done(true);
  };
  // Sit the moment something flies.
  T.hup = (p) => {
    const b = B({ px: 70, dx: p.what === "drop" ? 112 : 170, df: 1, dh: 4, dtail: 0.7, leash: p.what === "toss" ? 0 : 24 }, { props: [], view: [0, 380] });
    outdoor(b, 140, 380);
    const fly = p.what === "launch" || p.what === "bird";
    if (fly) b.scene.props.push({ k: "launcher", x: 290 });
    b.at(0.6, { dx: b.st.dx + 12, cap: p.what === "bird" ? "With a mentor, long line on" : fly ? "Long line on, launcher 20 yards off" : p.what === "drop" ? "On leash, close to you" : "They move ahead of you" });
    if (p.what === "drop") { const h = rest(b.st); b.at(0.2, { ion: 1, item: "bumper", ix: h.x, iy: h.y }).at(0.35, { ix: h.x + 10, iy: -4 }); }
    else if (p.what === "toss") b.at(0.3, handAt(P(64, -170))).at(0.2, { ion: 1, item: "bumper", ix: 100, iy: -150, ...handAt(P(100, -140)) }).at(0.4, { ix: 200, iy: -170 }).at(0.4, { ix: 290, iy: -4 });
    else if (p.what === "launch") b.at(0.1, { ion: 1, item: "bumper", ix: 290, iy: -10 }).at(0.4, { ix: 310, iy: -150 }).at(0.4, { ix: 340, iy: -4 });
    else b.at(0.1, { bon: 1, bx: 290, by: -10 }).at(0.5, { bx: 350, by: -120 });
    b.at(0.1, { oh: "mouth" }).ev({ whistle: "sit", cap: "One blast as it goes" }).at(0.3, { ...POSES.sit, dh: 16, oh: "side" });
    if (p.what === "bird") b.at(0.3, { bx: 420, by: -190 });
    badge(b, "SAT", "Rear down as it flew: log it"); b.at(0.5);
    if (b.st.px + 60 < b.st.dx) b.at(0.5, { px: b.st.dx - 50, ...handAt(rest(b.st, { px: b.st.dx - 50 })) });
    give(b, "mouth", "pouch", p.what === "bird" ? "Treat while they sit, then hunt on" : "Treat while they sit. Pick it up yourself.");
    return b.done(true);
  };
  T.flushshot = (p, name) => {
    const b = B({ px: 70, dx: 170, df: 1, dh: 0, dtail: 0.8, hpx: p.mine ? -999 : p.yd === 10 ? 230 : 360, bon: 1, bx: 270, by: -8 }, { props: [{ k: "launcher", x: 270 }], view: [0, 400] });
    outdoor(b, 140, 400);
    if (!p.mine) b.scene.ruler = { x0: 170, x1: b.st.hpx, text: `${p.yd} yd · blank pistol` };
    b.at(0.5, { dx: 190, dh: -10, cap: "They work in to the bird" }).at(0.3, { by: -50, cap: "The flush" }).at(0.3, { ...POSES.sit, dh: 18 });
    b.at(0.4, { bx: 350, by: -150 }).ev({ bang: p.mine ? "p" : true, cap: p.mine ? "Your shot, in a safe direction" : "The shot" }).at(0.6);
    badge(b, "STEADY", "Still sitting: log it"); b.at(0.6);
    if (p.mine) { say(b, name, "Send by name, or hunt on"); b.at(0.4, { dr: 0 }).at(0.6, { dx: 280 }); }
    else { b.at(0.6, { px: 140, ...handAt(rest(b.st, { px: 140 })) }); give(b, "mouth", "pouch", "Treat while they sit"); }
    return b.done(true);
  };
  T.frange = (p) => {
    const far = p.stage === "scent" ? 340 : 270;
    const b = B({ px: 70, dx: 150, df: 1, dh: -10, dtail: 0.7 }, { props: [], view: [0, 420] });
    outdoor(b, 120, 420);
    b.scene.ruler = { x0: 70, x1: far, text: `${p.yd} yd` };
    b.at(1.1, { dx: far, cap: p.stage === "scent" ? "Working hot scent" : p.stage === "turn" ? "Walk on and say nothing" : "Stand still and wait" });
    if (p.stage === "scent") b.at(0.5, { dh: -40 }).at(0.2, { oh: "mouth" }).ev({ whistle: "come", cap: "One trill" }).at(0.4, { oh: "side" });
    b.at(0.3, { df: -1, dh: 10, cap: p.stage === "turn" ? "They turn by themselves" : p.stage === "scent" ? "They leave the scent" : "They look back or swing in" }).at(1.3, { dx: p.stage === "turn" ? 190 : 116 });
    badge(b, "CLEAN", "Stayed in range: log it"); b.at(0.5);
    if (p.stage !== "turn") give(b, "mouth", "hand", p.stage === "scent" ? "Jackpot, then back to the scent" : "Treat at your side, then send them on");
    return b.done(true);
  };

  // ---------- hog, tracking: gear and trails ----------
  T.gear = (p) => {
    if (p.stage === "vest" || p.stage === "collar") {
      const b = B({ px: 120, pk: 1, dx: 180, dh: 8, oh: "pouch" }), s = part(b.st, "S");
      if (p.stage === "vest") b.at(0.6, { cap: "Let them sniff it first" });
      b.at(0.7, { ...handAt(P(s.x + 12, s.y - 12)), hs: "tool", cap: p.stage === "vest" ? "Over the back, one strap at a time" : "Collar on, two fingers of slack" });
      b.at(0.4, p.stage === "vest" ? { dvest: 1 } : { dgps: 1 }).at(0.4, { hs: "open", ...handAt(rest(b.st)) });
      yes(b, "Relaxed while it goes on: YES");
      give(b, "mouth", "pouch", p.stage === "vest" ? "A treat for every strap" : "Treats and a short walk");
      return b.done();
    }
    if (p.stage === "truck") {
      const b = B({ px: 90, dx: 140, df: 1, dvest: 1, dgps: 1 }, { props: [{ k: "car", x: 230 }] });
      b.at(0.3); say(b, "Load up"); b.at(0.6, { dx: 222, dup: 34, cap: "Gear on, into the truck" }).at(0.5, { ...POSES.down, df: -1 }).ev({ timer: 1.3, timerLabel: "ride" }).at(1.3, { cap: "A short ride" });
      yes(b, "Riding calmly: YES"); give(b, "floor", "hand", "Treats in the truck, then a fun stop");
      return b.done();
    }
    const b = B({ px: 40, dx: 80, df: 1, leash: 14, dvest: 1, ...handAt(P(52, -86)) });
    outdoor(b);
    if (p.stage === "play") { b.ev({ leash: 0 }); b.at(0.3, { ion: 1, item: "toy", ix: 90, iy: -60 }).at(0.4, { ix: 200, iy: -5, cap: "Play a game in the vest" }).at(0.7, { dx: 182 }).at(0.2, { ion: 0, dcar: "toy" }).at(0.2, { df: -1 }).at(0.6, { dx: 110 }); }
    else follow(b, 2.0, 180, { dx: 220, cap: "A walk, then check under the arms" });
    yes(b, "Moving normally: YES"); if (p.stage === "play") b.at(0.2, { dcar: "" });
    give(b, "mouth", "pouch", p.stage === "play" ? "More play, or dinner in the vest" : "Treats along the walk");
    return b.done();
  };
  // Following a laid line, the handler behind on a slack long line. turn / gap / three add a loss to work out.
  T.trail = (p) => {
    const L = 470, b = B({ px: 40, dx: 100, df: 1, dh: -42, leash: 22, dharn: 1, dtail: 0.5, ...handAt(P(52, -86)) }, { props: [], view: [0, 540] });
    b.scene.props.push({ k: "trail", x0: 110, x1: L, blood: p.blood, gap: p.gap ? [270, 350] : null }, { k: p.end || "rag", x: L + 12 }, { k: "flag", x: 104 });
    b.scene.ruler = { x0: 104, x1: L, text: p.label };
    const go = (dx, dt, cap) => follow(b, dt, dx - (p.lag || 70), { dx, dh: -42, ...(cap ? { cap } : {}) });
    b.at(0.5); say(b, "Track", p.startCap || "Point at the start, then say nothing");
    const focus = p.focus;
    go(220, 1.1, focus === "pace" ? "Follow at their pace; never steer" : focus === "slack" ? "Let the line run through your hands, slack" : "Nose down on the line");
    const loss = (cap1, cap2) => { b.at(0.6, { dx: b.st.dx + 60, dh: -10, cap: cap1 }).at(0.2, { df: -1 }).at(0.6, { dx: b.st.dx - 80, dh: -42, cap: cap2 }).at(0.2, { df: 1 }); };
    if (p.turn) loss("They overshoot: stand still", "They circle back and find it");
    if (p.gap) { go(276, 0.5); loss("The blood stops for 10 yards", "Let them circle; don't help"); }
    if (focus === "loss") { b.at(0.5, { dx: 300, dh: 10, cap: "They lose it: stop" }).at(0.2, { df: -1 }).at(0.8, { dx: 190, px: 120, ...handAt(P(132, -86)), cap: "Back to the last blood you flagged" }).at(0.2, { df: 1 }).at(0.3, { dh: -42 }).at(0.6, { cap: "Two quiet minutes: they restart" }); }
    if (p.turns === 3) { go(300, 0.6); loss("Another turn", "They work it out"); }
    go(340, 0.8, p.turn || p.gap || focus === "loss" ? "And on along the line" : undefined);
    if (p.stay) {
      b.at(0.8, { dx: L - 8, dh: -35, cap: "They reach the find; you stay back" }).at(0.3, { dh: 6, dr: p.stay === "wait" ? 0 : 1 });
      b.ev({ timer: 1.8, timerLabel: "" }); b.at(1.8, { px: L - 70, ...handAt(P(L - 58, -86)), cap: "Walk in, no hurry, no calling" });
    } else go(L - 10, 1.1);
    badge(b, p.badge || "FOUND", p.badgeCap || "To the end of the line: log it"); b.at(0.6);
    if (b.st.px < b.st.dx - 60) b.at(0.4, { px: b.st.dx - 48, ...handAt(rest(b.st, { px: b.st.dx - 48 })) });
    give(b, P(L + 8, -4), "pouch", p.pay || "Jackpot on the ground at the end");
    return b.done(true);
  };
  T.harness = (p) => {
    if (p.stage === "treats") {
      const b = B({ px: 60, dx: 100, df: 1, dh: -35, leash: 20, dharn: 1, ...handAt(P(72, -86)) }, { props: [{ k: "trail", x0: 120, x1: 300, blood: true }, { k: "treats", x: 160 }, { k: "treats", x: 220 }, { k: "treats", x: 290 }], view: [0, 360] });
      b.at(0.3); say(b, "Track"); follow(b, 1.0, 100, { dx: 180, dh: -42, cap: "A drop every step, a treat every third" }); follow(b, 1.0, 180, { dx: 270, cap: "Nose down, step by step" });
      yes(b, "They follow it to the end: YES"); b.at(0.4, { px: 235, ...handAt(rest(b.st, { px: 235 })) }); give(b, P(300, -4), "pouch", "Jackpot at the end");
      return b.done();
    }
    if (p.stage === "spot") {
      const b = B({ px: 110, pk: 1, dx: 200, df: -1, dh: 4, dharn: 1 }, { props: [{ k: "trail", x0: 148, x1: 160, blood: true }] });
      b.at(0.6, { ...handAt(P(146, -14)), hs: "point", cap: "Point at a few drops; say nothing" }).at(0.8, { dx: 182, dh: -48, dre: 0.3 });
      yes(b, "Nose on the spot: YES"); b.at(0.2, { hs: "open" }); give(b, P(156, -3), "pouch", "Treat right on the spot");
      return b.done();
    }
    const b = B({ px: 120, pk: 1, dx: 180, dh: 6 }, { props: [{ k: "treats", x: 150 }, { k: "treats", x: 140 }] }), s = part(b.st, "S");
    b.at(0.7, { ...handAt(P(s.x + 10, s.y - 10)), hs: "tool", cap: "Harness on: only ever for tracking" }).at(0.3, { dharn: 1, hs: "open" }).at(0.3, handAt(rest(b.st)));
    say(b, "Track"); b.at(0.7, { dh: -50, dre: 0.3, cap: "Treats scattered in short grass" });
    yes(b, "Nose down within seconds: YES"); b.at(0.6, { cap: "The treats on the ground are the pay" });
    return b.done();
  };
  // Baying a still, scented target from a distance. The dog never reaches it.
  T.bay = (p, name) => {
    const b = B({ px: 90, dx: 170, df: 1, dh: 12, dtail: 0.9, leash: p.off === "far" ? 0 : 6, ...handAt(P(102, -90)), hpx: 372 }, { props: [{ k: "barrel", x: 320 }], view: [0, 400] });
    outdoor(b, 120, 260);
    b.scene.ruler = p.off === "far" ? { x0: 80, x1: 170, text: "50 m" } : { x0: 188, x1: 304, text: "5 m or more" };
    b.at(0.5, { cap: p.off ? "Baying, off the target" : p.rock ? "A helper rocks the target with a rope" : "The long line keeps them 5 m back" });
    if (p.rock) { b.scene.rock = true; }
    woof(b, p.off ? undefined : "They bark and stay back"); b.at(0.3, { dh: 22 }).at(0.2, { dh: 10 }).at(0.4);
    if (p.secs) b.ev({ timer: 1.6, timerLabel: p.secs });
    woof(b); b.at(0.3, { dh: 22 }).at(0.2, { dh: 10 }).at(p.secs ? 1.1 : 0.5);
    if (p.off) {
      if (p.off === "call") say(b, `${name}, come!`, "Call once and back up");
      else b.at(0.2, { oh: "mouth" }).ev({ whistle: "come", cap: "One trill" });
      b.at(0.4, { px: 70, ...handAt(rest(b.st, { px: 70 })), oh: "side", leash: 0 }).at(0.3, { df: -1, dh: 6 }).at(1.0, { dx: 116 });
      badge(b, "FIRST CALL", "Left the bay on one call: log it"); b.at(0.5); give(b, "mouth", "hand", p.off === "far" ? "The best thing you have" : "Jackpot, then send them back to bay");
      return b.done(true);
    }
    badge(b, "HELD OFF", "Barked and never closed in: log it"); b.at(0.5);
    if (p.secs === "30 s" || p.rock) { say(b, `${name}, come!`, "Call them off"); b.at(0.3, { df: -1, leash: 14 }).at(0.6, { dx: 130 }); give(b, "mouth", "hand", "A jackpot away from the target"); }
    else { const h = b.st; b.at(0.2, { ton: 1, tx: h.ax, ty: h.ay, cap: "Toss treats behind them, away from it" }).at(0.5, { tx: 132, ty: -3 }).at(0.2, { df: -1 }).at(0.3, { dh: -40 }).at(0.1, { ton: 0 }).at(0.2); }
    return b.done(true);
  };

  // ---------- searches: sheds and nose work ----------
  T.seek = (p) => {
    const x = p.x || 250, b = B({ px: 60, dx: 100, df: 1, dh: 0, dtail: 0.6 }, { props: [], view: [0, p.wide ? 420 : 330] });
    if (p.where === "house") b.scene.props.push({ k: "bench", x: 250 }, { k: "door", x: 20, dir: -1 });
    else outdoor(b, p.tall ? 160 : 130, p.wide ? 420 : 330);
    if (p.tall) b.scene.props.push({ k: "grass", x0: 200, x1: 300 }, { k: "grass", x0: 203, x1: 303 });
    const X = p.wide ? 340 : x;
    b.ev({ ion: 1, item: "antler", ix: X, iy: -4 });
    if (p.old) b.at(0.7, { cap: "Left out a week, so your scent is gone" });
    b.at(0.4); say(b, "Find the bone", p.cap || "Send them in");
    b.at(0.8, { dx: X - 90, dh: -30, cap: "Nose and eyes working" }).at(0.3, { df: -1 }).at(0.5, { dx: X - 140 }).at(0.2, { df: 1 }).at(0.9, { dx: X - 20, dh: -40, ...(p.wide ? { px: 130, ...handAt(rest(b.st, { px: 130 })) } : {}) });
    if (p.waitBy) { b.at(0.4, { ...POSES.sit, dh: 12, cap: "They stop and wait by it, or bring it" }); }
    else b.at(0.2, { ion: 0, dcar: "antler", dh: 6, dre: 0 });
    badge(b, "FOUND", p.waitBy ? "Found and showed you: log it" : "Found it: log it"); b.at(0.6);
    if (!p.waitBy) b.at(0.2, { df: -1 }).at(1.0, { dx: b.st.px + 46 }).at(0.2, { dcar: "" });
    else b.at(0.6, { px: X - 70, ...handAt(rest(b.st, { px: X - 70 })) });
    give(b, "mouth", "pouch", "Treat and a throw");
    return b.done(true);
  };
  T.odor = (p) => {
    const b = B({ px: 100, pk: 1, dx: 215, df: -1, dh: 4 }, { props: [{ k: "tin", x: 150, label: p.label }] });
    if (p.treat) b.scene.props.push({ k: "treats", x: 150 });
    b.at(0.6, { cap: p.treat ? "Tin on the floor, a treat on top" : `${p.label} in the tin, treats hidden` }).at(0.8, { dx: 182, dh: -46, dre: 0.3 });
    if (p.freeze) {
      b.ev({ timer: p.call ? 1.4 : 1.2, timerLabel: p.freeze, cap: "They freeze on it" });
      if (p.call) { b.at(0.8, { pk: 0, px: 80, ...handAt(rest(b.st, { px: 80, pk: 0 })), cap: "Step back" }); say(b, "Alert!"); b.at(0.6); }
      else b.at(1.2);
    }
    yes(b, p.freeze ? "Nose still on the source: YES" : "Nose on the tin: YES");
    if (p.call) b.at(0.4, { px: 110, pk: 1, ...handAt(rest(b.st, { px: 110, pk: 1 })) });
    give(b, P(156, -5), "pouch", p.call ? "Jackpot at the source" : "Treat right at the tin");
    return b.done();
  };
  T.boxes = (p) => {
    const xs = p.n === 10 ? [130, 165, 200, 235, 270, 305] : [160, 220, 280], hit = p.blank ? null : p.n === 10 ? 235 : 220;
    const b = B({ px: 50, dx: 80, df: 1, dh: -10, leash: 14, ...handAt(P(62, -86)) }, { props: [], view: [0, 350] });
    for (const x of xs) b.scene.props.push({ k: p.bags && x !== 220 ? "bag" : p.bags ? "bin" : "box", x });
    b.at(0.3); say(b, "Search", p.blank ? "No hide this time" : "Walk past; don't point");
    let prev = 80;
    for (const x of xs) {
      if (hit && x > hit) break;
      b.at(0.5 + (x - prev) / 220, { dx: x - 16, dh: -38, px: Math.max(50, x - 90), ...handAt(P(Math.max(62, x - 78), -86)), cap: x === xs[0] ? "They check each one" : undefined }); prev = x;
    }
    if (p.blank) { b.at(0.4, { dh: 10, df: -1, cap: "Nothing there: no alert" }); say(b, "Finish"); b.at(0.5); badge(b, "RIGHT", "Searched and didn't guess: log it"); b.at(0.8, { cap: "Next: one easy search with a hide" }); return b.done(true); }
    b.at(0.6, { dh: -46, cap: "They stop at the right one" });
    badge(b, "RIGHT BOX", "Log it"); b.at(0.5, { px: hit - 60, ...handAt(rest(b.st, { px: hit - 60 })) });
    give(b, P(hit, -14), "pouch", p.bags ? "Treat at the container" : "Treat in the right box");
    return b.done(true);
  };
  T.room = (p) => {
    const b = B({ px: 60, dx: 100, df: 1, dh: -10, leash: p.where === "car" ? 14 : 0, ...handAt(P(72, -86)) }, { props: [], view: [0, 340] }), x = p.where === "car" ? 248 : 270;
    if (p.where === "car") b.scene.props.push({ k: "car", x: 230 });
    else { b.scene.props.push({ k: "bench", x: 180 }, { k: p.where === "high" ? "shelf" : "tin", x: 270 }); if (p.where === "two") b.scene.props.push({ k: "door", x: 225, dir: -1 }), b.ev({ door: 1 }); }
    b.at(0.3); say(b, "Search", p.where === "car" ? "Engine cold, on leash" : "Start them at the door");
    b.at(1.0, { dx: 160, dh: -35, cap: p.where === "two" ? "One room, then the next" : p.where === "car" ? "Along the outside of the car" : "They work the air" });
    b.at(1.0, { dx: x - 26, dh: p.where === "high" ? 35 : -35, px: 150, ...handAt(P(162, -86)), cap: p.where === "high" ? "The scent is above them" : undefined });
    if (p.where === "high") b.at(0.4, { dh: 48, dre: 0.4, cap: "They work out where it is" });
    badge(b, "FOUND", "At the source: log it"); b.at(0.5, { px: x - 86, ...handAt(rest(b.st, { px: x - 86 })) });
    give(b, "mouth", "pouch", p.where === "high" ? "Pay as close to it as they can get" : "Treat at the source");
    return b.done(true);
  };

  // ---------- obedience ----------
  T.front = (p) => {
    const far = p.stage === "both" ? 280 : p.stage === "1m" ? 190 : 150;
    const b = B({ px: 90, dx: p.stage === "finish" ? 126 : far, df: -1, dh: 10, ...(p.stage === "finish" ? POSES.sit : {}) });
    if (p.stage !== "finish") {
      b.at(0.3); if (p.stage !== "lure") say(b, "Front", "Hands at your belt");
      b.at(far > 200 ? 1.2 : 0.7, { dx: 128, ...handAt(P(102, -78)), hs: p.stage === "lure" ? "treat" : "open", cap: p.stage === "lure" ? "Lure them in close" : "Straight in" }).at(0.4, { ...POSES.sit, dh: 32 });
      if (p.stage !== "both") { yes(b, "A straight sit in front: YES"); give(b, "mouth", "hand", "Treat at your belt, above the nose"); return b.done(); }
      b.at(0.8, { cap: "Wait two seconds" });
    }
    b.at(0.3); say(b, "Finish", p.stage === "finish" ? "Lure back along your left leg" : "Then the finish");
    b.at(0.3, { dr: 0 }).at(0.8, { dx: 50, ...handAt(P(66, -70)) }).at(0.3, { df: 1 }).at(0.5, { dx: 96, ...handAt(P(104, -76)), cap: "Around behind, up into heel" }).at(0.4, { ...POSES.sit, dh: 30 });
    yes(b, p.stage === "both" ? "Front and finish: YES" : "Sitting at your left side: YES"); give(b, "mouth", "hand", "Treat at your left seam");
    return b.done();
  };
  T.pheel = (p) => {
    const b = B({ px: 40, dx: 54, df: 1, dh: 34, leash: 14, ...handAt(P(54, -86)) }, { props: p.stage === "eight" ? [{ k: "cone", x: 120 }, { k: "cone", x: 240 }] : [] });
    const go = (x, dt, o) => b.at(dt, { px: x, dx: x + 14 * (b.st.df >= 0 ? 1 : -1), ...handAt(P(x + 12, -86)), ...o });
    go(150, 1.4, { cap: p.stage === "look" ? "Treat held at your left chest" : "Walking in heel", ...(p.stage === "look" ? { oh: "chest" } : {}) });
    if (p.stage === "halt") { go(180, 0.8, { cap: "Slow down over two steps" }); b.at(0.4, { ...POSES.sit, dh: 34, cap: "Halt: they sit by themselves" }); yes(b, "Sat as you stopped: YES"); }
    else if (p.stage === "about" || p.stage === "eight") {
      if (p.stage === "eight") go(262, 1.0, { cap: "Outside of the turn: faster" });
      b.at(0.25, { pf: -1, cap: p.stage === "about" ? "Turn right, small steps" : "Around the marker" }).at(0.25, { df: -1 });
      go(p.stage === "eight" ? 110 : 80, 1.2, { cap: p.stage === "eight" ? "Inside of the turn: slower" : "Back the other way" });
      if (p.stage === "eight") b.at(0.25, { pf: 1 }).at(0.25, { df: 1 }), go(150, 0.6);
      yes(b, "Still at your leg: YES");
    } else { go(220, 0.9); yes(b, "Looking up for five steps: YES"); b.ev({ oh: "side" }); }
    give(b, "mouth", "hand", "Treat at your left seam");
    return b.done();
  };

  // ---------- tricks ----------
  T.spin = (p) => {
    if (p.back) {
      const n = p.back, hall = p.hall, b = B({ px: 90, dx: 140, df: -1, dh: 4, oh: "pouch" });
      if (hall) b.scene.props.push({ k: "door", x: 310, dir: 1 }, { k: "wall", x: 0 });
      b.at(0.4); if (hall) say(b, "Back up", "Say it, then wait");
      const d = n * 24;
      b.at(0.5 + n * 0.25, { dx: 140 + d, ...(hall ? {} : { px: 90 + d * 0.7, ...handAt(P(116 + d * 0.7, -50)) }), cap: hall ? "Straight back down the hallway" : "Step toward them gently, treat low" });
      yes(b, n === 1 ? "One step back: YES" : "Backing up: YES"); give(b, n === 1 ? "mouth" : "floor", "pouch", n === 1 ? "Treat under the chin" : "Toss it between the front paws");
      return b.done();
    }
    const b = B({ px: 100, pk: 0.4, dx: 170, df: -1, dh: 4, oh: p.lure ? "side" : "pouch" });
    b.at(0.3); if (p.word) say(b, "Spin", "Word first");
    const n = nose(b.st);
    b.at(0.4, { ...handAt(P(n.x - 4, n.y)), hs: p.lure ? "treat" : "point", cap: p.lure ? "Treat at the nose, a wide circle" : p.word ? "Hands getting quieter" : "Empty hand, a smaller circle" });
    b.at(0.45, { df: 1, dx: 150, ...handAt(P(n.x + 30, n.y - 8)) }).at(0.45, { df: -1, dx: 170, ...handAt(P(n.x - 4, n.y)) });
    if (p.both) b.at(0.2, { cap: "Then the other way" }).at(0.45, { df: 1, dx: 150, ...handAt(P(n.x + 30, n.y - 8)) }).at(0.45, { df: -1, dx: 170, ...handAt(P(n.x - 4, n.y)) });
    yes(b, "All the way around: YES"); give(b, "mouth", p.lure ? "hand" : "pouch");
    return b.done();
  };
  T.perch = (p) => {
    const b = B({ px: 90, dx: p.stage === "up" ? 205 : 160, df: -1, dh: 10, dtilt: p.stage === "up" ? 0 : 12 }, { props: [{ k: "book", x: 158 }] });
    if (p.stage === "up") { b.at(0.8, { dx: 160, ...handAt(P(130, -70)), hs: "treat", cap: "Lure forward over the book" }).at(0.4, { dtilt: 12 }); yes(b, "Both front paws up: YES"); give(b, "mouth", "hand", "Treat up high so the paws stay on"); return b.done(); }
    b.at(0.5, { px: 110, ...handAt(rest(b.st, { px: 110 })), cap: "Step into their shoulder" });
    if (p.stage === "step") b.at(0.5, { df: -0.8, cap: "A rear foot steps sideways" });
    else if (p.stage === "quarter") b.at(1.0, { df: -0.1, cap: "Keep moving one way" });
    else b.at(0.8, { df: 0.9, px: 190, pf: -1, ...handAt(rest(b.st, { px: 190, pf: -1 })), cap: "All the way around" }).at(0.8, { df: -1, px: 100, pf: 1, ...handAt(rest(b.st, { px: 100, pf: 1 })), cap: "Then the other way" });
    yes(b, p.stage === "step" ? "One rear step: YES" : p.stage === "quarter" ? "A quarter turn: YES" : "A full circle: YES");
    give(b, "mouth", "hand", p.stage === "step" ? "Treat at once, paws still up" : "Treat at your leg");
    return b.done();
  };
  T.shape = (p) => {
    const b = B({ px: 100, pk: 1, dx: 168, df: -1, ...(p.what === "paw" ? POSES.sit : p.what === "bow" ? POSES.stand : POSES.down), dh: 6, oh: "pouch" });
    if (p.word) { b.at(0.3); say(b, p.word, `"${p.word}", then wait`); }
    if (p.what === "paw") { const f = part(b.st, "fp", { dpaw: 1 }); b.at(0.5, { ...handAt(P(f.x - 8, f.y - 4)), hs: p.word ? "flat" : "fist", cap: p.word ? "Then an open hand" : "Closed fist at chest height; wait" }).at(0.6, { dpaw: 1 }); yes(b, "Paw in your hand: YES"); b.at(0.3, { dpaw: 0 }); give(b, "mouth", "pouch", "Treat from the other hand"); return b.done(); }
    if (p.what === "bow") { b.at(0.5, { ...handAt(P(146, -30)), hs: "treat", cap: "Lure between the front legs" }).at(0.7, { ...handAt(P(158, -6)), dbow: 1, dh: -30 }); yes(b, "Elbows down, rear still up: YES"); give(b, P(150, -4), "hand", "Treat low, between the paws"); return b.done(); }
    const n = nose(b.st); b.at(0.5, { ...handAt(P(n.x + 4, n.y)), hs: "treat", cap: "Treat at the nose" }).at(0.8, { ...handAt(P(n.x + 30, n.y - 8)), droll: p.what === "side" ? 0.45 : 0.5, cap: "Around to the shoulder" });
    if (p.what === "over") b.at(0.6, { droll: 1, cap: "Carry it across, at their speed" }).at(0.6, { droll: 2 });
    yes(b, p.what === "side" ? "Onto one side: YES" : "All the way over: YES");
    b.at(0.4, { droll: p.what === "over" ? 2 : 0 }); give(b, p.what === "over" ? "floor" : "floor", "hand", p.what === "over" ? "Jackpot" : "Treat on the floor beside them");
    return b.done();
  };
  T.balance = (p) => {
    if (p.stage === "walk" || p.stage === "trot") {
      const b = B({ px: 40, dx: 80, df: 1, dh: -20, leash: 14, ...handAt(P(52, -86)) }, { props: [130, 175, 220, 265].map((x) => ({ k: "pole", x, h: p.stage === "trot" ? 8 : 2 })), view: [0, 350] });
      follow(b, p.stage === "trot" ? 1.5 : 2.6, 240, { dx: 290, cap: p.stage === "trot" ? "Low poles, an even trot" : "Poles flat, a body length apart" });
      yes(b, "Over every pole, no touch: YES"); give(b, "mouth", "hand", "Treat at the end of the line");
      return b.done();
    }
    const w = p.stage === "wobble", b = B({ px: 90, dx: 240, df: -1, dh: 6 }, { props: [{ k: w ? "disc" : "cushion", x: w ? 152 : 172 }] });
    b.at(0.9, { dx: w ? 158 : 178, dup: w ? 0 : 12, dtilt: w ? 9 : 0, cap: w ? "Front feet on the disc" : "All four feet on the cushion" });
    b.ev({ timer: 1.8, timerLabel: "" }); if (w) b.at(0.45, { dtilt: 13 }).at(0.45, { dtilt: 7 }).at(0.45, { dtilt: 11 }).at(0.45, { dtilt: 9 }); else b.at(1.8, { cap: "Steady for a few seconds" });
    yes(b, "Standing steady: YES"); give(b, "mouth", "hand", w ? "Slow treats while they balance" : "Treat at nose height");
    return b.done();
  };

  // ---------- behavior helpers ----------
  const jumpAt = { dtilt: 42, dx: 118, dh: 20 };
  T.hJump = (p) => {
    if (p.stage === "mat") return T.bell({ stage: "guest" });
    if (p.stage === "mark") return T.greet({ stage: "home" });
    if (p.stage === "visitor") {
      const b = B({ px: 50, dx: 130, df: 1, leash: 10, dh: 10, ...handAt(P(62, -86)), wx: 340, wf: -1 }); b.at(1.0, { wx: 190, cap: "A visitor walks up" }).at(0.3, { dtilt: 30, dx: 140 }).at(0.4, { wf: 1, cap: "A jump: they turn away" }).at(0.5, { dtilt: 0, dx: 130, dh: 20 }).at(0.4, { wf: -1, cap: "Paws down: they come back" });
      yes(b, "Four on the floor: YES"); give(b, "floor", "hand", "Treat at their feet"); return b.done();
    }
    const b = B({ px: 90, dx: 200, df: -1 }); b.at(0.6, { dx: 150 }).at(0.4, { ...jumpAt, cap: "They jump" }).at(0.4, { pf: -1, ...handAt(P(84, -110)), cap: "Turn away, arms folded, no words" }).at(0.6, { dtilt: 0, dx: 150, dh: 10 }).at(0.5, { cap: "Paws down" }).at(0.3, { pf: 1 });
    yes(b, "Four on the floor: YES"); give(b, "floor", "hand", "Now the attention, down low"); return b.done();
  };
  T.hPull = (p) => {
    if (p.stage === "stop") return T.walk({ mode: "stop" });
    if (p.stage === "pay") return T.walk({ mode: "steps", outside: true });
    if (p.stage === "sniff") {
      const b = B({ px: 40, dx: 80, df: 1, leash: 14, ...handAt(P(52, -86)) }, { props: [{ k: "grass", x0: 230, x1: 300 }] });
      follow(b, 1.6, 170, { dx: 210, cap: "Walk over on a loose leash" }); yes(b, "Loose all the way: YES"); say(b, "OK, go sniff", "Sniffing is the pay"); b.at(0.6, { dx: 226, dh: -45 }).at(0.8); return b.done();
    }
    const b = B({ px: 100, pk: 1, dx: 170, dh: 8, oh: "pouch" }), s = part(b.st, "S");
    b.at(0.7, { ...handAt(P(s.x - 4, s.y + 2)), hs: "tool", cap: "A harness with a front ring" }).at(0.3, { dharn: 1 }).at(0.3, { ...handAt(rest(b.st)), hs: "open" }).at(0.5, { leash: 12, cap: "A 2-meter leash, not a retractable" });
    yes(b, "Calm in the harness: YES"); give(b, "mouth", "pouch"); return b.done();
  };
  T.hBark = (p) => {
    if (p.stage === "bell") return T.bell({ stage: "bell" });
    if (p.stage === "guest") return T.bell({ stage: "guest" });
    const b = B({ px: 90, dx: 200, df: 1, dh: 20, dtail: 0.8 }, { props: [{ k: "window", x: 290, film: p.stage === "block" }] });
    if (p.stage === "block") { b.scene.props = [{ k: "window", x: 290, film: true }]; b.at(0.6, { cap: "Film or a curtain: nothing to bark at" }).at(0.6, { df: -1, dh: 0 }).at(0.8, { ...POSES.down, drest: 0.8, dtail: 0.3, cap: "No show to watch, so they settle" }); yes(b, "Settled: mark softly"); give(b, "floor", "hand"); return b.done(); }
    woof(b, "Stand near them and wait"); b.at(0.3, { dh: 30 }).at(0.3, { dh: 20 }); woof(b); b.at(0.8).at(0.6, { cap: "The first pause in the barking" });
    yes(b, "Quiet: YES"); b.at(0.2, { df: -1 }); give(b, "mouth", "hand", "Treat, then wait for a longer pause"); return b.done();
  };
  T.hReact = (p) => {
    const gap = p.stage === "closer" ? 190 : 250;
    const b = B({ px: 50, dx: 80, df: 1, leash: 14, dh: 6, ...handAt(P(62, -86)), o2x: 80 + gap, o2f: -1, wx: 110 + gap, wf: -1 }, { props: [], view: [0, 420] });
    outdoor(b);
    b.scene.ruler = { x0: 98, x1: 60 + gap, text: p.stage === "closer" ? "1 m closer" : "far enough to still eat" };
    b.at(0.8, { dh: 12, cap: p.stage === "find" ? "How far can it be while they still eat?" : "They see the other dog" });
    if (p.stage === "find") { yes(b, "Still taking treats: this is your distance"); give(b, "mouth", "hand", "Write the distance down"); return b.done(); }
    if (p.stage === "look") yes(b, "They look and stay quiet: YES");
    else if (p.stage === "back") { b.at(0.7, { cap: "Wait a second longer" }).at(0.3, { df: -1, dh: 32 }); yes(b, "They look back at you: YES"); }
    else { b.at(0.5).at(0.3, { df: -1, dh: 32, cap: "Two good days, then one meter closer" }); yes(b, "Calm and back to you: YES"); }
    give(b, "mouth", "hand", p.stage === "back" ? "Jackpot" : "Treat right away");
    if (p.stage === "closer") b.at(0.5, { pf: -1, df: -1, px: 20, dx: 50, ...handAt(P(8, -86)), cap: "Any barking: turn and walk away" });
    return b.done();
  };
  T.hGuard = (p) => {
    if (p.stage === "trade") return T.trade({ word: true });
    const b = B({ px: 40, dx: 250, df: -1, dh: -50, dtail: 0.5, ion: 1, item: "bowl", ix: 218, iy: -6 }, { props: [], view: [0, 340] });
    if (p.stage === "safe") { b.scene.props.push({ k: "door", x: 110, dir: 1 }); b.ev({ door: 1 }); b.at(0.6, { cap: "A quiet place to eat" }).at(0.8, { px: 60, pf: -1, ...handAt(rest(b.st, { px: 60, pf: -1 })) }).at(0.4, { door: 0, cap: "Nobody near. Never take food to test them." }).at(1.2); return b.done(true); }
    const x = p.stage === "closer" ? 150 : 100; b.scene.ruler = { x0: x, x1: 206, text: p.stage === "closer" ? "half a meter closer" : "3 m" };
    b.at(1.0, { px: x, ...handAt(rest(b.st, { px: x })), cap: p.stage === "closer" ? "Only after several happy days" : "Walk past while they eat" });
    b.at(0.2, { ton: 1, tx: b.st.ax, ty: b.st.ay, cap: "Toss something better" }).at(0.5, { tx: 212, ty: -8 }).at(0.1, { ton: 0 }).at(0.4, { dh: 14, dwag: 1, dtail: 0.7, cap: "They look up happy, loose body" });
    b.ev({ yes: true, cap: "Happy to see you coming: YES" }); b.at(0.9, { pf: -1, px: x - 60, ...handAt(rest(b.st, { px: x - 60, pf: -1 })), cap: "Keep walking. Stiff or growling: stop, call a professional." });
    return b.done();
  };
  T.hAlone = (p) => {
    if (p.stage === "out") return T.away({ secs: "seconds" });
    if (p.stage === "build") return T.away({ secs: "a little more" });
    if (p.stage === "keys") {
      const b = B({ px: 90, dx: 210, ...POSES.down, dh: 10 }, { props: [{ k: "mat", x: 208, w: 34 }, { k: "bench", x: 60 }] });
      b.at(0.6, { ...handAt(P(120, -110)), hs: "tool", cap: "Pick up the keys, coat on" }).at(0.8, { px: 70, pf: -1, ...handAt(P(60, -90)) }).at(0.8, { px: 70, pk: 0.5, pf: 1, hs: "open", ...handAt(rest(b.st, { px: 70, pk: 0.5, pf: 1 })), cap: "Then sit back down" }).at(0.6, { drest: 0.8, cap: "Again and again, until it means nothing" });
      yes(b, "They don't even look up: YES"); b.at(0.5); return b.done();
    }
    const b = B({ px: 60, dx: 220, ...POSES.down, dh: 4 }, { props: [{ k: "mat", x: 218, w: 34 }, { k: "phone", x: 130 }, { k: "door", x: 30, dir: 1 }] });
    b.at(0.5, { cap: "Set a phone to film" }).at(0.3, { door: 1 }).at(0.7, { px: -30, pf: -1, ...handAt(rest(b.st, { px: -30, pf: -1 })) }).at(0.3, { door: 0 });
    b.at(0.8, { drest: 0.5, cap: "Calm at first" }).at(0.6, { drest: 0, dr: 0, dfr: 0, dh: 20, cap: "Pacing or whining: that's their limit" }).at(0.4, { dx: 180 }).at(0.3, { df: 1 }).at(0.4, { dx: 220 });
    b.at(0.8, { cap: "Every absence stays shorter than that" });
    return b.done(true);
  };

  // ---------- the map ----------
  const tr = (label, o = {}) => ({ t: "trail", label, ...o }), blood = (label, o = {}) => tr(label, { blood: true, end: "hide", startCap: "Show them the first blood", pay: "The hide, and a jackpot", ...o });
  Object.assign(M, {
    quarter: [{ t: "zig", treats: true }, { t: "zig", pips: true }, { t: "zig", pips: true, yd: 25 }, { t: "zig", wind: "face", find: true }, { t: "zig", wind: "side", find: true }],
    hup: [{ t: "hup", what: "drop" }, { t: "hup", what: "toss" }, { t: "hup", what: "launch" }, { t: "hup", what: "bird" }],
    flushshot: [{ t: "flushshot", yd: 30 }, { t: "flushshot", yd: 10 }, { t: "flushshot", mine: true }],
    frange: [{ t: "frange", stage: "look", yd: 20 }, { t: "frange", stage: "scent", yd: 40 }, { t: "frange", stage: "turn", yd: 30 }],
    uplandret: [{ t: "retrieve", yd: 20, helper: true, outcome: "CLEAN", item: "wing" }, { t: "retrieve", yd: 30, helper: true, cover: true, outcome: "CLEAN", item: "wing" }, { t: "hunt", item: "bird", wait: true }, { t: "retrieve", yd: 25, helper: true, cover: true, outcome: "CLEAN", item: "bird" }],
    gearon: [{ t: "gear", stage: "vest" }, { t: "gear", stage: "play" }, { t: "gear", stage: "walk" }, { t: "gear", stage: "collar" }, { t: "gear", stage: "truck" }],
    hogtrail: [tr("50 m · 30 min old"), tr("200 m"), tr("500 m"), tr("200 m · 2 h old"), tr("with turns", { turn: true, turns: 3 })],
    bay: [{ t: "bay" }, { t: "bay", secs: "10 s" }, { t: "bay", secs: "30 s" }, { t: "bay", rock: true }],
    offbay: [{ t: "bay", off: "call" }, { t: "bay", off: "trill" }, { t: "bay", off: "far" }],
    loadup: [{ t: "car", stage: "hop" }, { t: "car", stage: "exit" }, { t: "car", stage: "ride", secs: "10 min" }],
    trackstart: [{ t: "harness", stage: "on" }, { t: "harness", stage: "spot" }, { t: "harness", stage: "treats" }],
    bloodline: [blood("50 yd · 1 h old"), blood("100 yd · 4 h old"), blood("150 yd · one turn", { turn: true }), blood("300 yd · 12 h old"), blood("300 yd · three turns", { turn: true, turns: 3 }), blood("a 10-yard gap", { gap: true }), blood("500 yd · 24 h old", { turn: true })],
    findend: [blood("short and easy", { badge: "STAYED", badgeCap: "Stopped at the hide: log it", pay: "Jackpot beside the hide", lag: 50 }), blood("the last 10 yd", { stay: "wait", badge: "STAYED", badgeCap: "Stayed until you got there: log it", pay: "Jackpot beside the hide" }), blood("30 yd back", { stay: "sit", lag: 110, badge: "STAYED", badgeCap: "Stayed until you got there: log it", pay: "The best thing you have, beside the hide" })],
    linehand: [blood("50 yd", { focus: "slack", badge: "SMOOTH", badgeCap: "A slack line the whole way: log it" }), blood("their pace", { focus: "pace", badge: "SMOOTH", badgeCap: "You followed, they led: log it" }), blood("read a loss", { focus: "loss", badge: "SMOOTH", badgeCap: "You went back and let them solve it: log it" })],
    shedret: [{ t: "retrieve", yd: 4, item: "soft", mark: "pickup", ruler: false }, { t: "retrieve", yd: 4, item: "antler", mark: "pickup", ruler: false }, { t: "retrieve", yd: 4, item: "antler", mark: "deliver", ruler: false }],
    shedsearch: [{ t: "seek", where: "house", cap: "Half in view at first" }, { t: "seek", cap: "Hidden 20 minutes ago, downwind" }, { t: "seek", tall: true }, { t: "seek", wide: true, cap: "Walk into the wind" }, { t: "seek", wide: true, old: true }],
    shedhunt: [{ t: "seek", wide: true, cap: "Walk a zigzag; they work ahead" }, { t: "seek", wide: true, waitBy: true }, { t: "seek", wide: true, tall: true, cap: "Real ground, one planted win" }],
    odor: [{ t: "odor", label: "Birch", treat: true }, { t: "odor", label: "Birch" }, { t: "odor", label: "Anise" }, { t: "odor", label: "Clove" }],
    boxes: [{ t: "boxes", n: 3 }, { t: "boxes", n: 10 }, { t: "boxes", n: 3, bags: true }, { t: "boxes", n: 10, blank: true }],
    searchrooms: [{ t: "room", where: "one" }, { t: "room", where: "two" }, { t: "room", where: "car" }, { t: "room", where: "high" }],
    alert: [{ t: "odor", label: "Birch", freeze: "1 s" }, { t: "odor", label: "Birch", freeze: "3 s" }, { t: "odor", label: "Birch", freeze: "hold", call: true }],
    front: [{ t: "front", stage: "lure" }, { t: "front", stage: "1m" }, { t: "front", stage: "finish" }, { t: "front", stage: "both" }],
    precheel: [{ t: "pheel", stage: "look" }, { t: "pheel", stage: "halt" }, { t: "pheel", stage: "about" }, { t: "pheel", stage: "eight" }],
    spin: [{ t: "spin", lure: true }, { t: "spin", both: true }, { t: "spin", word: true }, { t: "spin", back: 1 }, { t: "spin", back: 3 }, { t: "spin", back: 4, hall: true }],
    perch: [{ t: "perch", stage: "up" }, { t: "perch", stage: "step" }, { t: "perch", stage: "quarter" }, { t: "perch", stage: "full" }],
    shapes: [{ t: "shape", what: "paw" }, { t: "shape", what: "paw", word: "Paw" }, { t: "shape", what: "bow" }, { t: "shape", what: "side" }, { t: "shape", what: "over" }],
    balance: [{ t: "balance", stage: "cushion" }, { t: "balance", stage: "wobble" }, { t: "balance", stage: "walk" }, { t: "balance", stage: "trot" }],
    "help:jump": [{ t: "hJump", stage: "turn" }, { t: "hJump", stage: "mark" }, { t: "hJump", stage: "visitor" }, { t: "hJump", stage: "mat" }],
    "help:pull": [{ t: "hPull", stage: "gear" }, { t: "hPull", stage: "stop" }, { t: "hPull", stage: "pay" }, { t: "hPull", stage: "sniff" }],
    "help:barkdoor": [{ t: "hBark", stage: "block" }, { t: "hBark", stage: "quiet" }, { t: "hBark", stage: "bell" }, { t: "hBark", stage: "guest" }],
    "help:react": [{ t: "hReact", stage: "find" }, { t: "hReact", stage: "look" }, { t: "hReact", stage: "back" }, { t: "hReact", stage: "closer" }],
    "help:guard": [{ t: "hGuard", stage: "safe" }, { t: "hGuard", stage: "pass" }, { t: "hGuard", stage: "closer" }, { t: "hGuard", stage: "trade" }],
    "help:leftalone": [{ t: "hAlone", stage: "watch" }, { t: "hAlone", stage: "keys" }, { t: "hAlone", stage: "out" }, { t: "hAlone", stage: "build" }],
  });
})();
