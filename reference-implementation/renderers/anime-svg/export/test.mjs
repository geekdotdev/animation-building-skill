// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Tests for export.mjs: pure functions and a build from synthetic inputs (no app repo, no browser).
// Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  splitRules, diagramCss, presentationCss, stripModule, animeBody, jsonForScript, fillTemplate,
  checkProfile, assembleScript, buildExport, ExportError, applyBehavior,
} from "./export.mjs";
import fixture from "../../../core/validator/fixtures/minimal.animation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const interpreterSrc = fs.readFileSync(path.join(HERE, "../interpreter.js"), "utf8");
const templates = { fragment: fs.readFileSync(path.join(HERE, "templates/fragment.html"), "utf8"), page: fs.readFileSync(path.join(HERE, "templates/page.html"), "utf8") };
const cases = [];
const t = (name, fn) => cases.push({ name, fn });
const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.message));

// ---- CSS ----
t("splitRules: comments (even with braces) are dropped, at-rules are one rule, braces in strings are text", () => {
  const r = splitRules("/* a { b } */ .a { x: 1; } @media (min-width: 1px) { .b { y: 2; } } .c::before { content: '}'; }");
  assert.equal(r.length, 3);
  assert.ok(r[1].startsWith("@media") && r[1].includes(".b"));
  assert.ok(r[2].includes("content: '}'"));
});
t("splitRules: unbalanced and stray text are errors", () => {
  throwsMsg(() => splitRules(".a { x: 1;"), /unclosed/);
  throwsMsg(() => splitRules(".a { x: 1; } }"), /unmatched/);
  throwsMsg(() => splitRules(".a { x: 1; } stray"), /outside a rule/);
});
t("diagramCss keeps diagram rules and drops the rest", () => {
  const css = ".hidden { display: none; } .diagram { w: 1; } .diagram-log p { m: 0; } body { m: 0; } .tab-btn { c: 1; }";
  const out = diagramCss(css, "mini");
  assert.ok(out.includes(".diagram {") && out.includes(".diagram-log p"));
  assert.ok(!out.includes(".hidden") && !out.includes("body") && !out.includes(".tab-btn"));
});
t("diagramCss keeps this diagram's id rules, drops other diagrams', and trims a mixed selector list", () => {
  const css = "#diagram-mini-log { color: #000; } #diagram-other-log { color: red; } #diagram-mini-log, #diagram-other-log, .keep-me { z: 1; } #dg-box-other-x { s: 1; }";
  const out = diagramCss(css, "mini");
  assert.ok(out.includes("#diagram-mini-log"));
  assert.ok(!out.includes("other"), out);
  assert.ok(!out.includes(".keep-me"));
});
t("diagramCss keeps an attribute selector on a diagram id (the volumes' transform-origin)", () => {
  assert.ok(diagramCss('[id^="dg-vol-"] { transform-origin: center; }', "mini").includes('[id^="dg-vol-"]'));
});
t("presentationCss: only the set parameters, as custom properties read by their rules", () => {
  const css = presentationCss("mini", { "log-width": "640px", "toggle-font-size": "1.1rem" });
  assert.ok(css.includes("#diagram-mini {\n  --log-width: 640px;\n  --toggle-font-size: 1.1rem;\n}"));
  assert.ok(css.includes("#diagram-mini .diagram-log { width: var(--log-width); }"));
  assert.ok(css.includes(".diagram-mode-toggle { font-size: var(--toggle-font-size) !important; }"));
  assert.ok(!css.includes("--replay-padding") && !css.includes("--diagram-width"));
});
t("presentationCss: log-color also sets the paragraphs and their opacity; replay:false hides Replay; nothing set gives nothing", () => {
  const css = presentationCss("mini", { "log-color": "#000" }, { replay: false });
  assert.ok(css.includes(".diagram-log p { color: var(--log-color); }") && css.includes(".diagram-log p { opacity: 1; }"));
  assert.ok(css.includes(".diagram-replay { display: none; }"));
  assert.equal(presentationCss("mini"), "");
});

// ---- script ----
t("stripModule removes single-line imports and export keywords, and lists the exported names", () => {
  const { code, names } = stripModule("import a from '/x.js';\nexport const A = 1;\nexport function f() {}\n// export not this\nconst z = 2;", "m.js");
  assert.deepEqual(names, ["A", "f"]);
  assert.ok(!/^import|^export/m.test(code));
  assert.ok(code.includes("const A = 1;") && code.includes("function f() {}") && code.includes("// export not this"));
});
t("stripModule refuses forms it can't rewrite", () => {
  throwsMsg(() => stripModule("import {\n a,\n} from 'x';", "m.js"), /unsupported import/);
  throwsMsg(() => stripModule("const a = 1;\nexport { a };", "m.js"), /unsupported export/);
  throwsMsg(() => stripModule("export default 1;", "m.js"), /unsupported export/);
});
t("animeBody turns the one default export into a return, and rejects zero or two", () => {
  assert.equal(animeBody("function anime(){}\nexport default anime;\n"), "function anime(){}\nreturn anime;\n");
  throwsMsg(() => animeBody("function anime(){}"), /exactly one/);
  throwsMsg(() => animeBody("export default anime;\nexport default anime;"), /exactly one/);
});
t("jsonForScript can't close the script tag or contain a line separator", () => {
  const out = jsonForScript({ a: "</script><!-- x", b: `p${String.fromCharCode(0x2028)}q` });
  assert.ok(!out.includes("</script") && !out.includes("<!--") && !out.includes(String.fromCharCode(0x2028)));
  assert.deepEqual(JSON.parse(out).a, "</script><!-- x");
});
const parts = { sharedJs: "import anime from '/vendor/a.js';\nexport const A = 1;\nexport function f() { return anime; }\n", animeSrc: "function anime() {}\nexport default anime;\n", interpreterSrc, descriptor: { diagramLabel: "mini" } };
t("assembleScript (inline): no import or export left, and it parses", () => {
  const s = assembleScript({ ...parts, assets: { anime: "inline" } });
  assert.ok(!/^import|^export/m.test(s));
  new Function(s); // syntax only: it is never run
  assert.match(s.trimEnd(), /createInterpreter\(descriptor, \{ anime, \.\.\.shared \}\)\.start\(\);$/);
});
t("assembleScript (cdn): exactly one import, the CDN one", () => {
  const s = assembleScript({ ...parts, assets: { anime: "cdn" }, animeUrl: "https://cdn.example/anime.js" });
  assert.equal((s.match(/^import\b/gm) || []).length, 1);
  assert.ok(s.startsWith('import anime from "https://cdn.example/anime.js";'));
  new Function(s.split("\n").slice(1).join("\n"));
});
t("assembleScript refuses an inlined source that could close the script tag", () => {
  throwsMsg(() => assembleScript({ ...parts, sharedJs: "export const A = '</script>';", assets: { anime: "inline" } }), /can't be inlined/);
});

// ---- template ----
t("fillTemplate fills slots in one pass: a value that looks like a slot or a replacement pattern is kept as text", () => {
  const out = fillTemplate("<a>{{style}}</a>{{diagram}}<b>{{script}}</b>", { style: "{{diagram}} $& $1", diagram: "D", script: "S" });
  assert.equal(out, "<a>{{diagram}} $& $1</a>D<b>S</b>");
});
t("fillTemplate rejects an unknown slot and a template that drops a required one", () => {
  throwsMsg(() => fillTemplate("{{style}}{{diagram}}{{script}}{{nope}}", {}), /unknown slot/);
  throwsMsg(() => fillTemplate("{{style}}{{script}}", {}), /no \{\{diagram\}\} slot/);
});

// ---- profile ----
const good = { target: "x", packaging: "fragment", assets: { anime: "cdn" }, gestures: "live", behavior: {}, presentation: {}, reasons: {} };
const defined = 'class="diagram" diagram-log diagram-replay diagram-mode-toggle';
const withModes = { ...fixture, modes: { default: "user-driven", toggle: true, simulated: { delay: 800, acknowledge: { color: "#1e88e5", duration: 400 } } } };
const prof = (o) => ({ ...good, ...o });
const msgs = (p, d = fixture, def = defined) => { const r = checkProfile(p, d, def); return [...r.errors, ...r.escalations].join("\n"); };
t("checkProfile: a good profile is clean", () => assert.equal(msgs(good), ""));
t("checkProfile: unknown key, missing target, bad packaging, bad assets, bad gestures", () => {
  assert.match(msgs(prof({ colour: 1 })), /unknown key "colour"/);
  assert.match(msgs(prof({ target: "" })), /target/);
  assert.match(msgs(prof({ packaging: "zip" })), /packaging/);
  assert.match(msgs(prof({ assets: { anime: "url" } })), /assets\.anime/);
  assert.match(msgs(prof({ gestures: "maybe" })), /gestures/);
});
t("checkProfile: presentation parameter must be known, plain, reasoned and present in the diagram", () => {
  assert.match(msgs(prof({ presentation: { "log-colour": "red" }, reasons: { "log-colour": "x" } })), /unknown presentation parameter/);
  assert.match(msgs(prof({ presentation: { "log-width": "1px; x:y" }, reasons: { "log-width": "r" } })), /plain CSS value/);
  assert.match(msgs(prof({ presentation: { "log-width": "1px" }, reasons: {} })), /needs a reason/);
  assert.match(msgs(prof({ presentation: {}, reasons: { "log-width": "r" } })), /no matching presentation parameter/);
  assert.match(msgs(prof({ presentation: { "log-width": "1px" }, reasons: { "log-width": "r" } }), fixture, "class=diagram"), /does not contain/);
  assert.equal(msgs(prof({ presentation: { "log-width": "1px" }, reasons: { "log-width": "r" } })), "");
});
t("checkProfile: unknown behavior parameter and wrong types", () => {
  assert.match(msgs(prof({ behavior: { speed: 2 } })), /unknown behavior parameter/);
  assert.match(msgs(prof({ behavior: { mode: "auto" } })), /behavior\.mode/);
  assert.match(msgs(prof({ behavior: { toggle: "yes" } })), /behavior\.toggle/);
});
t("checkProfile: behavior.pace must be a positive number", () => {
  assert.match(msgs(prof({ behavior: { pace: 0 } })), /behavior\.pace/);
  assert.match(msgs(prof({ behavior: { pace: -2 } })), /behavior\.pace/);
  assert.match(msgs(prof({ behavior: { pace: "slow" } })), /behavior\.pace/);
  assert.equal(msgs(prof({ behavior: { pace: 1.5 } })), "");
});
t("checkProfile: a target that can't take clicks escalates unless it runs automated with no toggle", () => {
  assert.match(msgs(prof({ gestures: "none" })), /escalation.*can't take clicks/);
  assert.equal(msgs(prof({ gestures: "none", behavior: { mode: "automated", toggle: false } }), withModes), "");
  assert.match(msgs(prof({ gestures: "none", behavior: { mode: "automated", toggle: true } }), withModes), /can't take clicks/);
});
t("checkProfile: automated mode needs the descriptor's simulated-gesture acknowledgement", () => {
  assert.match(msgs(prof({ behavior: { mode: "automated", toggle: false } })), /modes\.simulated/);
});
t("applyBehavior overrides the descriptor's mode and toggle without changing the original", () => {
  const d = applyBehavior(withModes, { mode: "automated", toggle: false });
  assert.deepEqual([d.modes.default, d.modes.toggle], ["automated", false]);
  assert.equal(withModes.modes.default, "user-driven");
});

// ---- build ----
const labHtml = '<h1>Title</h1><p>text</p><div class="diagram" id="diagram-mini"><svg></svg><div class="diagram-log" id="diagram-mini-log"></div><div class="diagram-footer"><button class="diagram-replay" id="diagram-mini-replay">R</button></div></div><button class="continue-btn">Continue</button>';
const sharedCss = "* { box-sizing: border-box; } body { margin: 0; } .diagram { width: 150%; } .diagram-log { width: 500px; } .diagram-log p { margin: 0; } .diagram-footer .diagram-replay { padding: 0; } .hidden { display: none; }";
const input = (o = {}) => ({ markup: labHtml, sharedCss, sharedJs: parts.sharedJs, animeSrc: parts.animeSrc, animeVersion: "3.2.2", interpreterSrc, descriptor: withModes, templates, profile: good, ...o });
const build = (o, opts) => buildExport(input(o), { skipValidate: true, ...opts });
t("buildExport (fragment, cdn): only the diagram, its CSS, the header and one script", () => {
  const { html } = build({ profile: prof({ presentation: { "log-width": "640px" }, reasons: { "log-width": "wider" } }) });
  assert.ok(html.startsWith("<!-- diagram-animation export."));
  assert.equal((html.match(/id="diagram-mini"/g) || []).length, 1);
  for (const gone of ["Title", "Continue", "continue-btn", "<h1", ".hidden", "body {"]) assert.ok(!html.includes(gone), gone);
  assert.ok(html.includes("#diagram-mini, #diagram-mini * { box-sizing: border-box; }"));
  assert.ok(html.includes("--log-width: 640px;") && html.includes("https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.es.js"));
  assert.ok(!/\{\{\s*(header|style|diagram|script|asset-url)/.test(html));
});
t("buildExport (page, inline): a full page with no import at all", () => {
  const { html } = build({ profile: prof({ packaging: "page", assets: { anime: "inline" } }) });
  assert.ok(html.startsWith("<!doctype html>") && !/^import\b/m.test(html));
});
t("buildExport is deterministic: the same inputs give the same bytes", () => assert.equal(build().html, build().html));
t("buildExport records what it was built from, and a changed source changes the header", () => {
  const a = build().html, b = build({ sharedCss: sharedCss + " .diagram { x: 1; }" }).html;
  assert.notEqual(a.split("\n")[2], b.split("\n")[2]);
});
t("buildExport throws an ExportError listing every problem, and writes nothing", () => {
  try { build({ profile: prof({ presentation: { nope: "1" }, reasons: {} , target: "" }) }); assert.fail("should throw"); }
  catch (e) { assert.ok(e instanceof ExportError); assert.ok(e.errors.length >= 2); }
});
t("buildExport validates the descriptor: an error stops it, and an open escalation stops it unless allowed", () => {
  const broken = structuredClone(skeletonDescriptor); delete broken.sequences[0].fidelity;
  assert.throws(() => buildExport(full({ descriptor: broken }), {}), (e) => e instanceof ExportError && /fidelity/.test(e.message));
  const open = structuredClone(skeletonDescriptor); delete open.datums[1].terminal; // a datum that leads nowhere: an escalation
  assert.throws(() => buildExport(full({ descriptor: open }), {}), (e) => e instanceof ExportError && e.errors.length === 0 && e.escalations.length > 0);
  assert.ok(buildExport(full({ descriptor: open }), { allowOpen: true }).html.length > 0);
});
t("buildExport takes the diagram's id suffix from the descriptor, not from a flag", () => {
  assert.ok(build().html.includes("#diagram-mini"));
  throwsMsg(() => build({ descriptor: { ...withModes, diagramLabel: "zzz" } }), /id="diagram-zzz"/); // the markup has no such diagram
  const noLab = structuredClone(withModes); delete noLab.diagramLabel;
  throwsMsg(() => build({ descriptor: noLab }), /`diagramLabel`/);
});
t("buildExport keeps the descriptor's local `markup` path out of the exported file", () => {
  const withPath = { ...withModes, markup: "../secret/local/path/diagram.html" };
  const { html } = build({ descriptor: withPath });
  assert.ok(!html.includes("secret/local/path") && !html.includes('"markup"'));
  assert.equal(build({ descriptor: withPath }).html, build().html); // and it doesn't change the output at all
});
t("buildExport: a file that is just the diagram works as well as a whole page", () => {
  const bare = labHtml.slice(labHtml.indexOf('<div class="diagram"'), labHtml.lastIndexOf("</div>") + 6);
  const body = (h) => h.slice(h.indexOf("<style>")); // the header records a hash of the file, which differs
  assert.equal(body(build({ markup: bare }).html), body(build().html));
});
t("buildExport: a profile's pace is set on the embedded descriptor, replaces the descriptor's own, and leaves the original alone", () => {
  const embedded = (html) => JSON.parse(/const descriptor = (\{.*\});/.exec(html)[1]);
  assert.equal(embedded(build({ profile: prof({ behavior: { pace: 2 } }) }).html).pace, 2);
  assert.equal(embedded(build({ descriptor: { ...withModes, pace: 3 }, profile: prof({ behavior: { pace: 2 } }) }).html).pace, 2);
  assert.equal(embedded(build({ descriptor: { ...withModes, pace: 3 } }).html).pace, 3); // no profile pace: the descriptor's stays
  assert.equal(embedded(build().html).pace, undefined);
  assert.equal(withModes.pace, undefined);
});
t("buildExport: replay:false hides Replay, and a custom template is honored", () => {
  const { html } = build({ profile: prof({ behavior: { replay: false } }) });
  assert.ok(html.includes(".diagram-replay { display: none; }"));
  const custom = build({ profile: prof({ template: "mine" }), templates: { ...templates, mine: "<b>{{header}}</b>{{style}}{{diagram}}<script type=module>{{script}}</script>" } });
  assert.ok(custom.html.startsWith("<b>"));
});

// ---- the markup contract, checked as part of an export (with the skeleton as a real diagram) ----
import skeletonDescriptor from "../skeleton/diagram.animation.js";
import { REQUIRED_CLASSES } from "../markup/check.mjs";
const skeletonHtml = fs.readFileSync(path.join(HERE, "../skeleton/diagram.html"), "utf8");
const contractCss = REQUIRED_CLASSES.map((c) => `.${c} { x: 1; }`).join("\n") + '\n[id^="dg-vol-"] { transform-origin: center; }\n.diagram-crawler-box { x: 1; }\n.diagram-watermark-text { x: 1; }\n@media (max-width: 600px) { .diagram-log { x: 1; } }';
const contractJs = "import anime from '/vendor/a.js';\nexport function createCrawlerElement() {}\nexport function logDiagramTransition() {}\nexport function playVolumeDocking() { return anime; }\n";
const full = (o = {}) => ({ markup: skeletonHtml, sharedCss: contractCss, sharedJs: contractJs, animeSrc: parts.animeSrc, animeVersion: "3.2.2", interpreterSrc, descriptor: skeletonDescriptor, templates, profile: good, ...o });
t("buildExport with every check on: the skeleton exports, with only the placeholder warnings", () => {
  const r = buildExport(full(), {});
  assert.ok(r.html.includes('id="diagram-skeleton"'));
  assert.deepEqual([...new Set(r.findings.map((f) => f.code))], ["placeholder"]);
});
t("buildExport stops when the diagram breaks the markup contract, and names the check", () => {
  const broken = skeletonHtml.replace('viewBox="0 0 600 330"', 'viewBox="0 -70 600 330"');
  assert.throws(() => buildExport(full({ markup: broken }), {}), (e) => e instanceof ExportError && e.errors.some((m) => /markup \[viewbox\]/.test(m)));
});
t("buildExport stops when the helpers lack a required export; a stylesheet gap is only a warning", () => {
  assert.throws(() => buildExport(full({ sharedJs: contractJs.replace("logDiagramTransition", "log") }), {}), (e) => e.errors.some((m) => /markup \[helpers\]/.test(m)));
  const r = buildExport(full({ sharedCss: contractCss.replace(".diagram-glow", ".diagram-blaze") }), {});
  assert.ok(r.findings.some((f) => f.code === "stylesheet"));
});

// The documented install is a link at ~/.claude/skills/diagram-animation. A main-guard comparing an unresolved
// argv[1] with import.meta.url made the CLI exit 0 in silence when reached through one; with no arguments it
// must print its usage and exit 64.
t("the CLI runs when reached through a symlink", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "export-link-"));
  try {
    const root = path.join(dir, "linked"); // the anime-svg folder
    fs.symlinkSync(path.join(HERE, ".."), root);
    const r = spawnSync(process.execPath, [path.join(root, "export/export.mjs")], { encoding: "utf8" });
    assert.equal(r.status, 64, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /usage: export\.mjs/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

let failed = 0;
for (const c of cases) {
  try { c.fn(); console.log("ok   " + c.name); }
  catch (e) { failed++; console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").slice(0, 4).join("\n     ")}`); }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
