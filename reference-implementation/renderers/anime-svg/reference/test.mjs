// Tests that the reference stylesheet and helpers keep meeting the markup contract, and stay in step with the
// skeleton that uses them. Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkStylesheet, checkHelpers, checkMarkup, REQUIRED_CLASSES } from "../markup/check.mjs";
import skeleton from "../skeleton/diagram.animation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(HERE, "diagram.css"), "utf8");
const helpers = fs.readFileSync(path.join(HERE, "helpers.js"), "utf8");
const skeletonHtml = fs.readFileSync(path.join(HERE, "../skeleton/diagram.html"), "utf8");
const cases = [];
const t = (name, fn) => cases.push({ name, fn });
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
// the same pattern the descriptor validator uses to read asset names (`--assets`)
const assetNames = [...helpers.matchAll(/^  (\w+): \{ shape:/gm)].map((m) => m[1]);

t("the stylesheet defines every class the contract requires, and the volume rule", () => assert.deepEqual(checkStylesheet(css, skeleton), []));
t("the helpers export the three functions the interpreter is given", () => assert.deepEqual(checkHelpers(helpers), []));
t(".diagram-line-static comes after .diagram-line (equal specificity: order decides)", () => {
  const rules = bare.split("}").map((r) => r.trim());
  const at = (sel) => rules.findIndex((r) => r.startsWith(sel + " {"));
  assert.ok(at(".diagram-line") >= 0 && at(".diagram-line-static") > at(".diagram-line"));
});
t("the hidden-until-drawn rules hold: lines, labels and crawlers start at opacity 0, and static lines at 1", () => {
  const rule = (sel) => new RegExp(`(?:^|\\})\\s*${sel.replace(/[.[\]^$*+?()|{}\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m").exec(bare)?.[1] ?? "";
  for (const sel of [".diagram-line", ".diagram-line-label", ".diagram-crawler"]) assert.match(rule(sel), /opacity:\s*0\b/, sel);
  assert.match(rule(".diagram-line-static"), /opacity:\s*1\b/);
  assert.match(rule('[id^="dg-vol-"]'), /transform-origin:\s*center/);
});
t("every diagram-* class the skeleton's markup uses is defined by the stylesheet", () => {
  const used = new Set([...skeletonHtml.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith("diagram")));
  for (const c of used) assert.ok(new RegExp(`\\.${c}(?![\\w-])`).test(bare), `.${c} is used by the skeleton but not styled`);
});
t("the skeleton's assets are all in the reference iconography", () => {
  const used = new Set();
  const walk = (o) => { if (o && typeof o === "object") { if (typeof o.asset === "string") used.add(o.asset); Object.values(o).forEach(walk); } };
  walk(skeleton);
  assert.ok(used.size >= 2);
  for (const a of used) assert.ok(assetNames.includes(a), `asset "${a}" is not in ICONOGRAPHY (${assetNames.join(", ")})`);
});
t("every iconography entry is drawable: a known shape, text where the shape is text, and a fill or a stroke", () => {
  const entries = [...helpers.matchAll(/^  (\w+): \{ ([^}]*) \}/gm)];
  assert.equal(entries.length, assetNames.length);
  for (const [, name, body] of entries) {
    const shape = /shape:\s*'(\w+)'/.exec(body)?.[1];
    assert.ok(["circle", "square", "triangle", "x", "text"].includes(shape), `${name}: shape ${shape}`);
    if (shape === "text") assert.match(body, /text:\s*'/, `${name} is text and needs text`);
    assert.match(body, /\b(fill|stroke):/, `${name} needs a fill or a stroke`);
  }
});
t("the skeleton diagram, stylesheet and helpers pass the whole markup contract together", () => {
  assert.deepEqual(checkMarkup(skeleton, skeletonHtml), []);
});
t("the helpers keep their one-line import of anime.js, which the test-page builder and exporter rely on", () => {
  assert.equal((helpers.match(/^import\b/gm) || []).length, 1);
  assert.match(helpers, /^import anime from '\/vendor\/animejs\/anime\.es\.js';$/m);
});

let failed = 0;
for (const c of cases) {
  try { c.fn(); console.log("ok   " + c.name); }
  catch (e) { failed++; console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").slice(0, 4).join("\n     ")}`); }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
