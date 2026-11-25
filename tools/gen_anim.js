// Writes ios/PocketTrainer/anim.html: the step animations as one offline page (?skill=&step=&dog=).
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const page = read("src/page.html").replace(/\r\n/g, "\n");
const vars = page.match(/:root \{[\s\S]*?\n\}/)[0];
const dark = page.match(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/)[0];
const css = page.match(/\/\* Step animations \*\/[\s\S]*?(?=\.ladder \{)/)[0];
fs.writeFileSync(path.join(root, "ios/PocketTrainer/anim.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
${vars}
${dark}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: transparent; color: var(--fg); font-family: -apple-system, sans-serif; -webkit-user-select: none; user-select: none; }
:root { --font-body: -apple-system, sans-serif; }
${css}</style></head><body><div id="box"></div><script>
${read("src/catalog.js")}
${read("src/voice.js")}
${read("src/anim.js")}
${read("src/anim-steps.js")}
${read("src/anim-more.js")}
const q = new URLSearchParams(location.search), box = document.getElementById("box");
PTSteps.player(box, q.get("skill"), Number(q.get("step")), q.get("dog") || "Name", { auto: q.get("auto") === "1" });
const tell = () => { try { webkit.messageHandlers.height.postMessage(Math.ceil(box.getBoundingClientRect().height)); } catch (e) {} };
new ResizeObserver(tell).observe(box); tell();
</script></body></html>
`);
