// Writes ios/PocketTrainer/Catalog.json from src/catalog.js, so the web and iPhone apps teach exactly the same skills.
// Proof values are normalized to { v, t } (v = seconds for durations, the index otherwise) and breeds to objects,
// so the Swift side can decode everything with plain Codable types.
// Run: node tools/gen_catalog.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/catalog.js"), "utf8");
const C = new Function(src + "; return { TRACKS, PLACES, LEVELS, SKILLS, SOUNDS, SEASONS, PASSPORT, DRIVES, BREEDS };")();

const proof = (p) => {
  if (!p) return undefined;
  const out = {};
  for (const [d, vals] of Object.entries(p)) out[d] = vals.map((v, i) => (Array.isArray(v) ? { v: v[0], t: v[1] } : { v: i, t: v }));
  return out;
};
const data = {
  tracks: C.TRACKS, places: C.PLACES, levels: C.LEVELS, sounds: C.SOUNDS, seasons: C.SEASONS,
  passport: C.PASSPORT, drives: C.DRIVES,
  breeds: C.BREEDS.map(([name, drive, size, flat]) => ({ name, drive, size, flat: !!flat })),
  skills: C.SKILLS.map((s) => ({ ...s, proof: proof(s.proof) })),
};
fs.writeFileSync(path.join(root, "ios/PocketTrainer/Catalog.json"), JSON.stringify(data, null, 1) + "\n");
console.log(`${data.skills.length} skills, ${data.skills.reduce((n, s) => n + s.steps.length, 0)} steps, ${data.breeds.length} breeds`);
