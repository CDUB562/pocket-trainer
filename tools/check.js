// Sanity check: every step has an animation, and nothing said aloud depends on the dog's name. Run: node tools/check.js
const fs = require("fs"), path = require("path"), r = (f) => fs.readFileSync(path.join(__dirname, "../src", f + ".js"), "utf8");
global.window = {}; global.matchMedia = () => ({ matches: false });
const C = new Function(["catalog", "voice", "anim", "anim-steps", "anim-more"].map(r).join("\n") + "; return { SKILLS, HELPERS, PTSteps, PTVoice };")();
let bad = 0; const lines = new Set();
const one = (id, n) => {
  if ((C.PTSteps.M[id] || []).length !== n) { bad++; console.log("map length", id); }
  for (let i = 0; i < n; i++) {
    let a, spec = (C.PTSteps.M[id] || [])[i];
    try { a = C.PTSteps.T[spec.t](spec, "Rex"); } catch (e) { bad++; console.log("throws", id, i, e.message); continue; }
    for (const k of a.keys) for (const [f, v] of Object.entries(k)) if (typeof v === "number" && !Number.isFinite(v)) { bad++; console.log("NaN", id, i, f); }
    const ms = C.PTSteps.moments(a), L = C.PTVoice.lines(id, i);
    if (!ms.length) { bad++; console.log("no moments", id, i); }
    if (ms.some((m) => /Rex/.test(m.text))) { bad++; console.log("name in caption", id, i); }
    if (!id.startsWith("help:") && !ms.some((m) => m.mark)) { bad++; console.log("no mark", id, i); }
    for (const x of [...L.before, ...ms.map((m) => C.PTVoice.spoken(m.text)), ...L.after]) if (x) lines.add(x);
  }
};
C.SKILLS.forEach((s) => one(s.id, s.steps.length)); C.HELPERS.forEach((h) => one("help:" + h.id, h.steps.length));
module.exports = { lines: [...lines], key: C.PTVoice.key, VOICE: C.PTVoice.VOICE, SPEED: C.PTVoice.SPEED };
if (require.main === module) { console.log(`${lines.size} spoken lines, ${[...lines].join("").length} characters, ${bad} problems`); if (bad) process.exit(1); }
