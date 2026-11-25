// Records every spoken line of the voice guide once (Kokoro "Heart", on this computer, free) into voice/<key>.m4a.
// Rerun after any wording change: it records what's missing. `node tools/voice/prerender.mjs 1/6` renders one shard;
// `--prune` deletes clips nothing uses any more. Needs kokoro-js (borrowed from ../imprint/tools/voice) and ffmpeg.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
const here = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const { lines, key, VOICE, SPEED } = require("../check.js");
const dir = join(here, "../../voice"); mkdirSync(dir, { recursive: true });
const arg = process.argv[2] || "", file = (l) => join(dir, key(l) + ".m4a");
if (arg === "--prune") {
  const keep = new Set(lines.map((l) => key(l) + ".m4a")); let n = 0;
  for (const f of readdirSync(dir)) if (!keep.has(f)) { unlinkSync(join(dir, f)); n++; }
  console.log(`removed ${n}, kept ${readdirSync(dir).length} of ${lines.length}`); process.exit(0);
}
// Only the silence at the ends is cut. No compressor, loudness filter or low bitrate: they made the voice sound doubled.
function trim(x, sr) {
  const pad = Math.round(sr * 0.08), loud = (v) => Math.abs(v) > 0.004;
  let a = 0, b = x.length - 1;
  while (a < b && !loud(x[a])) a++;
  while (b > a && !loud(x[b])) b--;
  return x.subarray(Math.max(0, a - pad), Math.min(x.length, b + 2 * pad));
}
function encode(audio, sr, out) {
  audio = trim(audio, sr);
  const pcm = Buffer.alloc(audio.length * 2);
  for (let i = 0; i < audio.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, audio[i])) * 32767), i * 2);
  return new Promise((res, rej) => {
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(sr), "-ac", "1", "-i", "pipe:0",
      "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", out]);
    ff.on("error", rej); ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c)))); ff.stdin.end(pcm);
  });
}
const [shard, of] = arg.includes("/") ? arg.split("/").map(Number) : [1, 1];
const todo = lines.filter((l, i) => i % of === shard - 1 && !existsSync(file(l)));
console.log(`shard ${shard}/${of}: ${todo.length} to record`);
if (todo.length) {
  const req2 = createRequire(join(here, "../../../imprint/tools/voice/package.json"));
  const { KokoroTTS } = await import(pathToFileURL(req2.resolve("kokoro-js")).href);
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
  for (const l of todo) { const r = await tts.generate(l, { voice: VOICE, speed: SPEED }); await encode(r.audio, r.sampling_rate, file(l)); }
}
