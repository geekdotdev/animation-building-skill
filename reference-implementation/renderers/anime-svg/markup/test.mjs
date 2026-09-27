// Tests for the markup parser and the markup checks. The skeleton (../skeleton/) is the valid baseline, and
// each test breaks it one way and expects the check for that to fire. Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMarkup } from "./parse.mjs";
import { checkMarkup, checkStylesheet, checkHelpers, REQUIRED_CLASSES } from "./check.mjs";
import baseDescriptor from "../skeleton/diagram.animation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const baseHtml = fs.readFileSync(path.join(HERE, "../skeleton/diagram.html"), "utf8");
const cases = [];
const t = (name, fn) => cases.push({ name, fn });
const codes = (fs_, level) => [...new Set(fs_.filter((f) => !level || f.level === level).map((f) => `${f.level}:${f.code}`))].sort();
const check = (mutHtml = (h) => h, mutDesc = () => {}) => {
  const d = structuredClone(baseDescriptor); mutDesc(d);
  const html = mutHtml(baseHtml); return checkMarkup(d, html);
};
const replaceOnce = (a, b) => (h) => { assert.ok(h.includes(a), `baseline has no "${a}"`); return h.replace(a, b); };

// ---- parser ----
t("parseMarkup builds the tree, ignores comments, and handles self-closing and void tags", () => {
  const doc = parseMarkup('<!-- <div id="ghost"> --><div id="a"><svg viewBox="0 0 1 1"><path id="p" d="M0,0"/></svg><br><input id="i"></div>');
  assert.equal(doc.roots.length, 1);
  assert.ok(!doc.byId.has("ghost"));
  assert.deepEqual(doc.roots[0].children.map((c) => c.tag), ["svg", "br", "input"]);
  assert.equal(doc.byId.get("p").parent.tag, "svg");
  assert.deepEqual(doc.errors, []);
});
t("parseMarkup: a quoted > in an attribute doesn't end the tag, and single or unquoted values work", () => {
  const doc = parseMarkup(`<div id="a" data-x="1>2" class='k' tabindex=0></div>`);
  assert.deepEqual([doc.roots[0].attrs["data-x"], doc.roots[0].attrs.class, doc.roots[0].attrs.tabindex], ["1>2", "k", "0"]);
});
t("parseMarkup reports duplicate ids, unmatched end tags and unclosed tags", () => {
  assert.deepEqual(parseMarkup('<div id="a"></div><div id="a"></div>').duplicates, ["a"]);
  assert.match(parseMarkup("<div></span></div>").errors.join(), /unmatched <\/span>|unmatched <\/span>/);
  assert.match(parseMarkup("<div><g></div>").errors.join(), /never closed/);
});

// ---- the baseline ----
t("the skeleton is clean", () => assert.deepEqual(check(), []));
t("a whole page around the diagram works: only the diagram block is checked", () => {
  const page = "<h1>Title</h1><p>text</p>" + baseHtml + '<button class="continue-btn">Continue</button>';
  assert.deepEqual(checkMarkup(structuredClone(baseDescriptor), page), []);
});

// ---- root, svg, log, footer ----
t("no diagram block, a wrong root id, or a missing label", () => {
  assert.deepEqual(codes(checkMarkup(baseDescriptor, "<p>nothing</p>")), ["error:root"]);
  assert.deepEqual(codes(check(replaceOnce('id="diagram-skeleton"', 'id="diagram-other"'))), ["error:root"]);
  assert.deepEqual(codes(check((h) => h, (d) => delete d.diagramLabel)), ["error:root"]);
});
t("viewBox: missing, negative origin, malformed", () => {
  assert.deepEqual(codes(check(replaceOnce('viewBox="0 0 600 330"', ""))), ["error:viewbox"]);
  assert.deepEqual(codes(check(replaceOnce('viewBox="0 0 600 330"', 'viewBox="0 -70 600 330"'))), ["error:viewbox"]);
  assert.deepEqual(codes(check(replaceOnce('viewBox="0 0 600 330"', 'viewBox="0 0 600"'))), ["error:viewbox"]);
});
t("the svg must be exactly one direct child of the root", () => {
  assert.deepEqual(codes(check((h) => h.replace("<svg ", '<div class="wrap"><svg ').replace("</svg>", "</svg></div>"))), ["error:svg"]);
  assert.deepEqual(codes(check((h) => h.replace("</svg>", "</svg><svg viewBox='0 0 1 1'></svg>"))), ["error:svg"]);
});
t("the log: missing, wrong class, not a direct child", () => {
  assert.deepEqual(codes(check(replaceOnce('<div class="diagram-log" id="diagram-skeleton-log"></div>', ""))), ["error:log"]);
  assert.deepEqual(codes(check(replaceOnce('class="diagram-log" id="diagram-skeleton-log"', 'class="x" id="diagram-skeleton-log"'))), ["error:log"]);
  assert.deepEqual(codes(check((h) => h.replace('<div class="diagram-log" id="diagram-skeleton-log"></div>', "").replace('<div class="diagram-footer">', '<div class="diagram-footer"><div class="diagram-log" id="diagram-skeleton-log"></div>'))), ["error:log"]);
});
t("the footer and Replay: footer missing, Replay missing, Replay outside the footer, toggle needs the footer", () => {
  assert.deepEqual(codes(check(replaceOnce('<div class="diagram-footer">', '<div class="other">'))), ["error:footer"]); // Replay is judged against the footer, so only one finding
  assert.deepEqual(codes(check(replaceOnce('<button class="diagram-replay" type="button" id="diagram-skeleton-replay">&#9654; Replay</button>', ""))), ["error:replay"]);
  assert.deepEqual(codes(check(replaceOnce('<div class="diagram-footer">', '<div class="diagram-footer"></div><div class="wrong">'))), ["error:replay"]);
});

// ---- elements the descriptor names ----
t("a named element that is missing, outside the svg, or duplicated", () => {
  assert.deepEqual(codes(check(replaceOnce('id="dg-box-server-skeleton"', 'id="dg-box-srv-skeleton"'))), ["error:element"]);
  assert.deepEqual(codes(check((h) => h.replace('id="dg-box-server-skeleton"', 'id="x"').replace("</svg>", '</svg><i id="dg-box-server-skeleton"></i>'))), ["error:element"]);
  assert.deepEqual(codes(check(replaceOnce('id="dg-box-server-skeleton"', 'id="dg-init-source-skeleton"'))), ["error:duplicate-id", "error:element"]);
});
t("an element with no `element` in the descriptor is a warning", () => assert.deepEqual(codes(check((h) => h, (d) => delete d.nodes[1].element)), ["warning:element"]));
t("channels: must be one <path> with d, class diagram-line, and the right visibility class", () => {
  assert.deepEqual(codes(check(replaceOnce('<path id="dg-line-client-server-skeleton" class="diagram-line diagram-line-mtls" d="M515,230 L515,120"></path>', '<line id="dg-line-client-server-skeleton" class="diagram-line diagram-line-mtls" x1="1" y1="1" x2="2" y2="2"></line>'))), ["error:channel-path"]);
  assert.deepEqual(codes(check(replaceOnce('d="M515,230 L515,120"', 'd=""'))), ["error:channel-path"]);
  assert.deepEqual(codes(check(replaceOnce('d="M515,230 L515,120"', 'd="M515,230 L515,120 M1,1 L2,2"'))), ["warning:channel-path"]);
  assert.deepEqual(codes(check(replaceOnce('class="diagram-line diagram-line-mtls"', 'class="diagram-line-mtls"'))), ["error:channel-class"]);
  assert.deepEqual(codes(check(replaceOnce('class="diagram-line diagram-line-static"', 'class="diagram-line"'))), ["error:channel-class"]);
  assert.deepEqual(codes(check(replaceOnce('class="diagram-line diagram-line-mtls"', 'class="diagram-line diagram-line-static diagram-line-mtls"'))), ["warning:channel-class"]);
  assert.deepEqual(codes(check(replaceOnce('class="diagram-line diagram-line-mtls"', 'class="diagram-line"'))), ["warning:channel-class"]);
  assert.deepEqual(codes(check(replaceOnce('class="diagram-line-label"', 'class="x"'))), ["warning:channel-class"]);
});
t("a gesture node needs a hint element, and should have tabindex and role", () => {
  assert.deepEqual(codes(check(replaceOnce('<text class="diagram-hint" x="455" y="274" text-anchor="middle"></text>', ""))), ["error:hint"]);
  assert.deepEqual(codes(check(replaceOnce(' tabindex="0" role="button"', ""))), ["warning:accessibility"]);
});
t("a node that glows must be a shape, not a group; a group node not being a <g> warns", () => {
  assert.deepEqual(codes(check((h) => h, (d) => d.datums[0].acknowledge.targets.push("config-source"))), ["error:glow-target"]);
  assert.deepEqual(codes(check((h) => h, (d) => d.sequences[1].rules[0].do.push({ acknowledge: { targets: ["client"], duration: 100 } }))), ["error:glow-target"]);
  assert.deepEqual(codes(check((h) => h.replace('<g id="dg-init-source-skeleton">', '<rect id="dg-init-source-skeleton"></rect><g>'))), ["warning:element"]);
});
t("a volume must be a <g> whose id starts with dg-vol-", () => {
  assert.deepEqual(codes(check((h) => h.replace('<g id="dg-vol-config-skeleton">', '<rect id="dg-vol-config-skeleton"></rect><g>'))), ["error:volume"]);
  assert.deepEqual(codes(check(replaceOnce('id="dg-vol-config-skeleton"', 'id="vol-config-skeleton"'), (d) => { d.volumes[0].element = "vol-config"; })), ["error:volume"]);
});
t("a zone that isn't a <rect> is a warning", () =>
  assert.deepEqual(codes(check(replaceOnce('<rect id="dg-zone-trusted-skeleton" class="diagram-zone" x="360" y="25" width="200" height="150" rx="10"></rect>', '<g id="dg-zone-trusted-skeleton"></g>'))), ["warning:element"]));

t("an unclosed tag in the diagram is reported as a parse error", () => {
  const found = check((h) => h.replace('<g id="dg-init-source-skeleton">', '<g id="dg-init-source-skeleton"><g>'));
  assert.ok(codes(found).includes("error:parse"), codes(found).join());
});

// ---- stylesheet and helpers ----
const cssAll = REQUIRED_CLASSES.map((c) => `.${c} { x: 1; }`).join("\n") + '\n[id^="dg-vol-"] { transform-origin: center; }';
t("checkStylesheet: a complete stylesheet is clean; a missing class or volume rule is a warning; comments don't count", () => {
  assert.deepEqual(checkStylesheet(cssAll, baseDescriptor), []);
  assert.deepEqual(codes(checkStylesheet(cssAll.replace(".diagram-glow", ".diagram-blaze"), baseDescriptor)), ["warning:stylesheet"]);
  assert.deepEqual(codes(checkStylesheet(cssAll.replace('[id^="dg-vol-"]', ".nope"), baseDescriptor)), ["warning:stylesheet"]);
  assert.deepEqual(codes(checkStylesheet(cssAll.replace(".diagram-glow { x: 1; }", "/* .diagram-glow { x: 1; } */"), baseDescriptor)), ["warning:stylesheet"]);
  assert.deepEqual(checkStylesheet(cssAll.replace('[id^="dg-vol-"]', ".nope"), { ...baseDescriptor, volumes: [] }), []);
});
t("checkHelpers: each required export must be present", () => {
  const ok = "export function createCrawlerElement() {}\nexport function logDiagramTransition() {}\nexport function playVolumeDocking() {}\n";
  assert.deepEqual(checkHelpers(ok), []);
  assert.deepEqual(codes(checkHelpers(ok.replace("logDiagramTransition", "log"))), ["error:helpers"]);
});

let failed = 0;
for (const c of cases) {
  try { c.fn(); console.log("ok   " + c.name); }
  catch (e) { failed++; console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").slice(0, 6).join("\n     ")}`); }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
