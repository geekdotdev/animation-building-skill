#!/usr/bin/env node
// Assembles a static test site that runs a descriptor's diagram with the interpreter.
//
//   node build-site.mjs --descriptor <file.animation.js> --out <dir> \
//                       [--css <shared.css> --helpers <diagram-shared.js> --anime <anime.es.js> | --app <repo>] \
//                       [--markup <file>]
//   python3 -m http.server 8765 --directory <dir>   # then open http://localhost:8765/
//
// The descriptor names its own diagram (`markup`, a path relative to the descriptor) and its id suffix
// (`diagramLabel`), so neither is a flag. `--markup` overrides the path. The app's stylesheet, shared helpers and
// anime.js are given with --css, --helpers and --anime, or all at once with `--app <repo>` (the example
// project's layout under spa-server/). Only the diagram is taken from the markup file: the
// `<div class="diagram">` block, which holds the SVG, the event log and the Replay button, whether the file
// is a whole page or just that block. It is written straight into index.html. Any headings, text and
// navigation buttons around it are left out. The page around it is the minimum a browser needs: a doctype,
// charset and viewport, the app's stylesheet, and the two wrappers (`.tab-panel.active > .gateway`) that
// give the diagram the layout it has in the app. The behavior comes from the descriptor: the diagram's own
// script is not used. Nothing in the app is modified.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { extractDiagram, resolveInputs, UsageError } from "../lib.mjs";
import { checkMarkup, checkStylesheet, checkHelpers } from "../markup/check.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const desc = arg("--descriptor"), out = arg("--out");
if (!desc || !out) {
  console.error("usage: build-site.mjs --descriptor <file> --out <dir> [--css <file> --helpers <file> --anime <file> | --app <repo>] [--markup <file>]");
  process.exit(64);
}
const descriptor = (await import(pathToFileURL(path.resolve(desc)).href)).default;
let inputs;
try { inputs = resolveInputs({ descFile: desc, descriptor, markup: arg("--markup"), css: arg("--css"), helpers: arg("--helpers"), anime: arg("--anime"), app: arg("--app") }); }
catch (e) { if (!(e instanceof UsageError)) throw e; console.error(e.message); process.exit(64); }
const label = inputs.label;
const put = (rel, data) => { const p = path.join(out, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
const copy = (from, rel) => put(rel, fs.readFileSync(from));

const markupText = fs.readFileSync(inputs.markup, "utf8");
// the markup contract (renderers/anime-svg/markup-contract.md): errors stop the build, warnings are shown
const found = [...checkMarkup(descriptor, markupText), ...checkStylesheet(fs.readFileSync(inputs.css, "utf8"), descriptor), ...checkHelpers(fs.readFileSync(inputs.helpers, "utf8"))];
for (const f of found) console.error(`${f.level === "error" ? "ERROR  " : "warning"} [${f.code}] ${f.where}: ${f.message}`);
if (found.some((f) => f.level === "error")) { console.error("\nnot built: the diagram does not meet the markup contract."); process.exit(1); }
const diagram = extractDiagram(markupText);

copy(inputs.helpers, "diagram-shared.js");
copy(inputs.css, "shared.css");
copy(inputs.anime, "vendor/animejs/anime.es.js");
copy(path.join(HERE, "../interpreter.js"), "interpreter.js");
copy(path.join(HERE, "driver.js"), "driver.js");
copy(desc, "descriptor.animation.js");

put("index.html", `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/shared.css"><body><div class="tab-panel active"><div class="gateway">
${diagram}
</div></div>
<script type="module">
import anime from '/vendor/animejs/anime.es.js';
import * as shared from '/diagram-shared.js';
import { createInterpreter } from '/interpreter.js';
import { startDriver } from '/driver.js';
import d from '/descriptor.animation.js';
const mode = new URLSearchParams(location.search).get('mode') || undefined;   // automated | user-driven, else the descriptor's default
const pace = Number(new URLSearchParams(location.search).get('pace')) || undefined;   // ?pace=2 is twice as slow, 0.5 twice as fast, else the descriptor's
startDriver(${JSON.stringify(label)}, async (onEvent) => { window.__interp = createInterpreter(d, { anime, ...shared, onEvent, mode, pace }); window.__interp.start(); });
</script>`);
console.log("site written to", out);
