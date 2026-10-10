// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Tests for the markup parser and the markup checks. The skeleton (../skeleton/) is the valid baseline, and
// each test breaks it one way and expects the check for that to fire. Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseMarkup } from "./parse.mjs";
import { checkMarkup, checkStylesheet, checkHelpers, REQUIRED_CLASSES } from "./check.mjs";
import { ICON_LAYOUT, planBoxIcons, planVolumeIcons } from "../interpreter.js";
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
const cssAll = REQUIRED_CLASSES.map((c) => `.${c} { x: 1; }`).join("\n") + '\n[id^="dg-vol-"] { transform-origin: center; }\n.diagram-crawler-box { x: 1; }\n.diagram-watermark-text { x: 1; }\n@media (max-width: 600px) { .diagram-log { x: 1; } }';
t("checkStylesheet: a complete stylesheet is clean; a missing class or volume rule is a warning; comments don't count", () => {
  assert.deepEqual(checkStylesheet(cssAll, baseDescriptor), []);
  assert.deepEqual(codes(checkStylesheet(cssAll.replace(".diagram-glow", ".diagram-blaze"), baseDescriptor)), ["warning:stylesheet"]);
  assert.deepEqual(codes(checkStylesheet(cssAll.replace('[id^="dg-vol-"]', ".nope"), baseDescriptor)), ["warning:stylesheet"]);
  assert.deepEqual(codes(checkStylesheet(cssAll.replace(".diagram-glow { x: 1; }", "/* .diagram-glow { x: 1; } */"), baseDescriptor)), ["warning:stylesheet"]);
  assert.deepEqual(checkStylesheet(cssAll.replace('[id^="dg-vol-"]', ".nope"), { ...baseDescriptor, volumes: [] }), []);
});
t("checkStylesheet: a composite crawler's box needs .diagram-crawler-box, only when box: true is actually used", () => {
  // the skeleton itself uses a composite crawler with box: true (client-server, request+credential)
  const noBox = structuredClone(baseDescriptor);
  for (const s of noBox.sequences) for (const r of s.rules) for (const a of r.do) if (a.move?.box) delete a.move.box;
  assert.deepEqual(checkStylesheet(cssAll, noBox), []); // no box used: no warning
  assert.ok(codes(checkStylesheet(cssAll.replace("\n.diagram-crawler-box { x: 1; }", ""), baseDescriptor)).includes("warning:stylesheet"));
  assert.deepEqual(checkStylesheet(cssAll, baseDescriptor), []); // cssAll already defines it
});

t("checkHelpers: each required export must be present", () => {
  const ok = "export function createCrawlerElement() {}\nexport function logDiagramTransition() {}\nexport function playVolumeDocking() {}\n";
  assert.deepEqual(checkHelpers(ok), []);
  assert.deepEqual(codes(checkHelpers(ok.replace("logDiagramTransition", "log"))), ["error:helpers"]);
});

// ---- icons on a box (core/descriptor.md section 3.5) ----
const withIcons = (node, icons) => (d) => { d.nodes.find((n) => n.name === node).icons = icons; };
t("planBoxIcons: one icon is centered along the inside top edge, and the label moves down to clear it", () => {
  const plan = planBoxIcons({ x: 330, y: 27, width: 140, height: 60 }, [24], [{ y: 61, fontSize: 13 }]);
  assert.deepEqual(plan.icons, [{ cx: 400, cy: 27 + ICON_LAYOUT.padTop + 12 }]);
  assert.ok(Math.abs(plan.shift - (27 + 6 + 24 + 4 - (61 - 0.8 * 13))) < 1e-9);
  assert.ok(plan.fits && plan.bottomPadding >= ICON_LAYOUT.padBottom);
});
t("planBoxIcons: a row of icons is centered as a whole, with the gap between them", () => {
  const plan = planBoxIcons({ x: 330, y: 27, width: 140, height: 60 }, [24, 24], [{ y: 61, fontSize: 13 }]);
  assert.deepEqual(plan.icons.map((i) => i.cx), [385, 415]);
  assert.equal(plan.rowWidth, 54);
});
t("planBoxIcons: a label already low enough doesn't move, and a box with no text just takes the icons", () => {
  assert.equal(planBoxIcons({ x: 0, y: 0, width: 150, height: 90 }, [24], [{ y: 70, fontSize: 13 }]).shift, 0);
  const bare = planBoxIcons({ x: 0, y: 0, width: 150, height: 60 }, [24], []);
  assert.deepEqual([bare.shift, bare.fits], [0, true]);
});
t("icons: a box with room for them and the label is clean", () => assert.deepEqual(check((h) => h, withIcons("server", ["credential"])), []));
t("icons: a box too short to keep padding under the moved label is an error", () => {
  assert.deepEqual(codes(check(replaceOnce('x="380" y="60" width="150" height="60"', 'x="380" y="60" width="150" height="46"'), withIcons("server", ["credential"]))), ["error:icons"]);
});
t("icons: a gesture node's hint moves with the label, so a 60-high box with a hint is too short", () => {
  assert.deepEqual(codes(check((h) => h, withIcons("client", ["credential"]))), ["error:icons"]);
});
t("icons: a row wider than the box is an error", () => {
  assert.deepEqual(codes(check((h) => h, withIcons("server", ["credential", "credential", "credential", "credential", "credential"]))), ["error:icons"]);
});
t("icons: a box with no label inside is a warning, not an error", () => {
  const noLabel = replaceOnce('<text class="diagram-label" x="455" y="94" text-anchor="middle">Server</text>', "");
  assert.deepEqual(codes(check(noLabel, withIcons("server", ["credential"]))), ["warning:icons"]);
});
// ---- icons on a volume ----
const volIcons = (icons) => (d) => { d.volumes[0].icons = icons; };
t("planVolumeIcons: the icon and the label are one group, a few units apart, centered in the box", () => {
  const plan = planVolumeIcons({ x: 100, y: 200, width: 172, height: 22 }, [12.5], { chars: 24, fontSize: 8.5 });
  const textWidth = 24 * 8.5 * 0.54, group = 12.5 + 3 + textWidth, start = 100 + (172 - group) / 2;
  assert.equal(plan.size, 16);
  assert.ok(Math.abs(plan.icons[0].cx - (start + 6.25)) < 1e-9 && plan.icons[0].cy === 211);
  assert.ok(Math.abs(plan.textX - (start + 12.5 + 3 + textWidth / 2)) < 1e-9);
  assert.equal(Math.round(plan.textX - plan.textWidth / 2 - (plan.icons[0].cx + 6.25)), 3, "3 units between the icon and the label");
  assert.ok(plan.fits);
});
t("icons: a volume wide enough for its icon and label is clean", () => {
  const widen = (h) => h.replace('x="35" y="105" width="110" height="22"', 'x="35" y="105" width="170" height="22"');
  assert.deepEqual(check(widen, (d) => { volIcons(["credential"])(d); d.volumes[0].label = "server config"; }), []);
});
t("icons: a volume too narrow for its icon and label is an error", () => {
  assert.deepEqual(codes(check((h) => h, (d) => { volIcons(["credential"])(d); d.volumes[0].label = "a much longer volume label than fits"; })), ["error:icons"]);
});
t("checkHelpers: createIconElement is required only when a node declares icons", () => {
  const ok = "export function createCrawlerElement() {}\nexport function logDiagramTransition() {}\nexport function playVolumeDocking() {}\n";
  assert.deepEqual(checkHelpers(ok, baseDescriptor), []);
  assert.deepEqual(codes(checkHelpers(ok, { nodes: [{ name: "n", icons: ["x"] }] })), ["error:helpers"]);
  assert.deepEqual(checkHelpers(ok + "export function createIconElement() {}\n", { nodes: [{ name: "n", icons: ["x"] }] }), []);
});

// The documented install is a link at ~/.claude/skills/diagram-animation. A main-guard comparing an unresolved
// argv[1] with import.meta.url made the CLI exit 0 in silence when reached through one.
t("the CLI runs when reached through a symlink", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "markup-link-"));
  try {
    const root = path.join(dir, "linked"); // the anime-svg folder, so ../skeleton and ../reference sit beside it
    fs.symlinkSync(path.join(HERE, ".."), root);
    const r = spawnSync(process.execPath, [
      path.join(root, "markup/check.mjs"), path.join(root, "skeleton/diagram.animation.js"),
      "--css", path.join(root, "reference/diagram.css"), "--helpers", path.join(root, "reference/helpers.js"),
    ], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\d+ errors/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

let failed = 0;
for (const c of cases) {
  try { c.fn(); console.log("ok   " + c.name); }
  catch (e) { failed++; console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").slice(0, 6).join("\n     ")}`); }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
