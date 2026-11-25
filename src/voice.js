// The voice guide: recorded clips (Kokoro "Heart", made by tools/voice/prerender.mjs) that talk through one step
// in time with its animation. Clips are named by a hash of the spoken text, so any wording change needs a rerun.
const PTVoice = (() => {
  const VOICE = "af_heart", SPEED = 0.95;
  // What is said for a written line: no shorthand, no capitals shouted.
  const UNITS = [[/(\d)\s*cm\b/g, "$1 centimeters"], [/\b1 m\b/g, "1 meter"], [/(\d)\s*m\b/g, "$1 meters"], [/\b1 yd\b/g, "1 yard"], [/(\d)\s*yd\b/g, "$1 yards"],
    [/\b1 s\b/g, "1 second"], [/(\d)\s*s\b/g, "$1 seconds"], [/\b1 h\b/g, "1 hour"], [/(\d)\s*h\b/g, "$1 hours"], [/(\d)\s*min\b/g, "$1 minutes"], [/(\d)\s*oz\b/g, "$1 ounces"], [/(\d)\s*ft\b/g, "$1 feet"], [/(\d)-(\d)/g, "$1 to $2"]];
  function spoken(text) {
    let s = String(text).replace(/: YES\b/g, ". Tap Yes").replace(/\bYES\b/g, "Yes").replace(/\bOTHER\b/g, "other").replace(/\.\.\./g, ", ").replace(/ · /g, ", ");
    for (const [a, b] of UNITS) s = s.replace(a, b);
    s = s.replace(/["“”]/g, "").replace(/\s+/g, " ").replace(/^[, ]+|[, ]+$/g, "").trim();
    if (!s) return "";
    s = s[0].toUpperCase() + s.slice(1);
    return /[.!?]$/.test(s) ? s : s + ".";
  }
  // cyrb53 over the voice, the speed and the words
  function key(text) {
    const s = VOICE + "|" + SPEED + "|" + text;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return "v" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  /** The lines around one step's animation: before it (setup, what to mark) and after it (the reward). */
  function lines(skillId, i) {
    if (skillId.startsWith("help:")) {
      const h = HELPERS.find((x) => "help:" + x.id === skillId), s = h && h.steps[i];
      return s ? { before: [spoken(s.do)], after: [] } : null;
    }
    const sk = SKILLS.find((x) => x.id === skillId), s = sk && sk.steps[i];
    if (!s) return null;
    // Field goals are sometimes a thing ("a clean retrieve") rather than something the dog does.
    const goal = (sk.rep === "outcome" ? "Count it when " : "Tap Yes when ") + (/^an? /.test(s.mark) ? "you get " : "") + s.mark;
    const pay = /is the reward/.test(s.reward) ? s.reward : "The reward: " + s.reward[0].toLowerCase() + s.reward.slice(1);
    return { before: [spoken(s.setup.replace(/^Same\./, "Same setup as before.")), spoken(goal)], after: [spoken(pay)] };
  }

  // ---------- playback ----------
  const native = () => { try { return window.webkit.messageHandlers.voice; } catch (e) { return null; } };
  const LIVE = "https://cdub562.github.io/pocket-trainer/";
  const base = () => (typeof location !== "undefined" && /^(https?:)$/.test(location.protocol) && (/localhost|127\.0\.0\.1|^192\.168\./.test(location.hostname) || location.hostname.endsWith("github.io")) ? "voice/" : LIVE + "voice/");
  const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  let el = null, pending = null;
  /** Call inside a tap: phones only let sound start from one. */
  function prime() { if (native()) return; el ||= new Audio(); try { el.src = SILENT; const p = el.play(); p && p.catch(() => {}); } catch (e) {} }
  function finish(v) { const p = pending; pending = null; if (p) p(v); }
  function stop() {
    const n = native();
    if (n) n.postMessage({ stop: true }); else if (el) { el.onended = el.onerror = null; el.pause(); }
    finish(false);
  }
  /** Says one line; resolves true when it was heard to the end, false when it was stopped or has no clip. */
  async function say(text) {
    stop();
    if (!text) return true;
    const k = key(text), n = native();
    const done = new Promise((res) => (pending = res)), mine = pending;
    if (n) { n.postMessage({ play: k }); return done; }
    try {
      const r = await fetch(base() + k + ".m4a");
      if (!r.ok) throw new Error("missing");
      // A blob, not the URL: Safari asks for byte ranges, which a service worker cache can't answer.
      const url = URL.createObjectURL(await r.blob());
      if (pending !== mine) { URL.revokeObjectURL(url); return done; }
      el ||= new Audio();
      el.onended = () => { URL.revokeObjectURL(url); finish(true); };
      el.onerror = () => { URL.revokeObjectURL(url); finish(false); };
      el.src = url; await el.play();
    } catch (e) { if (pending === mine) finish(false); }
    return done;
  }
  /** Fetches clips into the offline store (the service worker keeps them). Calls back with the count done. */
  async function save(list, tick) {
    if (native()) return 0;
    const todo = list.slice(); let ok = 0, n = 0;
    const work = async () => { while (todo.length) { const x = todo.shift(); try { if ((await fetch(url(x))).ok) ok++; } catch (e) {} n++; tick && tick(n, list.length); } };
    await Promise.all([work(), work(), work(), work()]);
    return ok;
  }
  const url = (text) => base() + key(text) + ".m4a";
  return { VOICE, SPEED, spoken, key, lines, say, stop, save, prime, url, base, _done: finish };
})();
