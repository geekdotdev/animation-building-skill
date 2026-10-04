// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Tests for init-project.sh: it runs the real script into temp folders (no network: a stand-in anime.js is passed
// with --anime, so npm is never used) and then the export.sh it generated. Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INIT = path.join(HERE, "init-project.sh");
const REAL_SKILL = fs.realpathSync(path.join(HERE, "../../../.."));
// realpath: the script records resolved paths, and os.tmpdir() is a symlink on macOS
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "init-project-test-")));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

// A stand-in anime.js laid out like an npm install, since the exporter reads the version from the package.json
// two folders above lib/anime.es.js.
const animePkg = path.join(tmp, "anime/node_modules/animejs");
fs.mkdirSync(path.join(animePkg, "lib"), { recursive: true });
fs.writeFileSync(path.join(animePkg, "package.json"), '{ "name": "animejs", "version": "3.2.2" }\n');
fs.writeFileSync(path.join(animePkg, "lib/anime.es.js"), "function anime() {}\nexport default anime;\n");
const ANIME = path.join(animePkg, "lib/anime.es.js");

const run = (cmd, args, cwd = tmp) => spawnSync(cmd, args, { encoding: "utf8", cwd });
const init = (args, script = INIT) => run("bash", [script, ...args]);
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");
const ignored = (proj, file) => run("git", ["check-ignore", "-q", file], proj).status === 0;

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

// A project name with a space, to cover quoting.
const PROJ = path.join(tmp, "my animations");

t("creates a git repo, a renamed first diagram, a module package.json and a .gitignore that ignores only node_modules", () => {
  const r = init([PROJ, "--diagram", "login-flow", "--no-install", "--anime", ANIME]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(PROJ, ".git")));
  assert.equal(JSON.parse(read(PROJ, "package.json")).type, "module");
  const html = read(PROJ, "login-flow/diagram.html");
  assert.ok(!/id="[^"]*skeleton/.test(html), "an id still says skeleton");
  assert.ok(html.includes('id="diagram-login-flow"') && html.includes('id="diagram-login-flow-log"'));
  assert.ok(read(PROJ, "login-flow/diagram.animation.js").includes("diagramLabel: 'login-flow'"));
  const rules = read(PROJ, ".gitignore").split("\n").filter((l) => l && !l.startsWith("#"));
  assert.deepEqual(rules, ["node_modules"]);
  assert.ok(ignored(PROJ, "node_modules/x"), "node_modules should be ignored");
  assert.ok(!ignored(PROJ, "export.sh"), "export.sh must not be ignored");
  assert.ok(!ignored(PROJ, "export/login-flow-ghost-html-card.html"), "exports must not be ignored");
});

t("the generated export.sh creates export/ if it is missing and writes the export, with --check and --profile working", () => {
  const exportDir = path.join(PROJ, "export");
  assert.ok(!fs.existsSync(exportDir), "init should not have created export/");
  const r = run("bash", ["export.sh"], PROJ);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = path.join(exportDir, "login-flow-ghost-html-card.html");
  assert.ok(fs.statSync(out).size > 0);
  const check = run("bash", ["export.sh", "--check"], PROJ);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(check.stdout, /up to date/);
  const page = run("bash", ["export.sh", "--profile", "standalone-page"], PROJ);
  assert.equal(page.status, 0, page.stdout + page.stderr);
  assert.ok(fs.existsSync(path.join(exportDir, "login-flow-standalone-page.html")));
  assert.ok(!ignored(PROJ, "export/login-flow-standalone-page.html"));
});

t("export.sh recreates export/ after it is deleted", () => {
  fs.rmSync(path.join(PROJ, "export"), { recursive: true });
  const r = run("bash", ["export.sh"], PROJ);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(PROJ, "export/login-flow-ghost-html-card.html")));
});

t("refuses a folder that already has files", () => {
  const r = init([PROJ, "--no-install", "--anime", ANIME]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists and isn't an empty folder/);
});

t("rejects a bad diagram label", () => {
  const r = init([path.join(tmp, "bad-label"), "--diagram", "Bad_Label", "--no-install", "--anime", ANIME]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /lowercase letters, digits and hyphens/);
  assert.ok(!fs.existsSync(path.join(tmp, "bad-label")), "nothing should be created for a rejected label");
});

t("the label defaults to the project folder's name", () => {
  const r = init([path.join(tmp, "Checkout Flow"), "--no-install", "--anime", ANIME]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(tmp, "Checkout Flow/checkout-flow/diagram.html")));
});

t("warns when --css is given without --helpers", () => {
  const css = path.join(tmp, "host.css");
  fs.copyFileSync(path.join(HERE, "../reference/diagram.css"), css);
  const r = init([path.join(tmp, "css-only"), "--css", css, "--no-install", "--anime", ANIME]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /--css without --helpers/);
  assert.ok(read(tmp, "css-only/export.sh").includes(`CSS="\${CSS:-${css}}"`), "the css path should be recorded");
});

t("recorded paths follow --css and --helpers into export.sh", () => {
  const css = path.join(tmp, "host2.css"), helpers = path.join(tmp, "host2-helpers.js");
  fs.copyFileSync(path.join(HERE, "../reference/diagram.css"), css);
  fs.copyFileSync(path.join(HERE, "../reference/helpers.js"), helpers);
  const r = init([path.join(tmp, "both"), "--css", css, "--helpers", helpers, "--no-install", "--anime", ANIME]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const script = read(tmp, "both/export.sh");
  assert.ok(script.includes(`CSS="\${CSS:-${css}}"`) && script.includes(`HELPERS="\${HELPERS:-${helpers}}"`));
  assert.ok(!r.stderr.includes("without"), "no warning when both are given");
  const e = run("bash", ["export.sh"], path.join(tmp, "both"));
  assert.equal(e.status, 0, e.stdout + e.stderr);
});

t("reached through a symlink, it records the skill's real folder", () => {
  const link = path.join(tmp, "linked-init");
  fs.symlinkSync(HERE, link);
  const r = init([path.join(tmp, "via-link"), "--no-install", "--anime", ANIME], path.join(link, "init-project.sh"));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(read(tmp, "via-link/export.sh").includes(`SKILL_REPO="\${SKILL_REPO:-${REAL_SKILL}}"`));
});

t("the skill's top-level init-project.sh forwards here, also through a symlinked skill folder", () => {
  const link = path.join(tmp, "linked-skill");
  fs.symlinkSync(REAL_SKILL, link);
  const r = init([path.join(tmp, "via-entry"), "--diagram", "entry", "--no-install", "--anime", ANIME], path.join(link, "init-project.sh"));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(tmp, "via-entry/entry/diagram.html")));
  assert.ok(read(tmp, "via-entry/export.sh").includes(`SKILL_REPO="\${SKILL_REPO:-${REAL_SKILL}}"`));
  const help = init(["-h"], path.join(REAL_SKILL, "init-project.sh"));
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: init-project.sh <project-dir>/);
});

let failed = 0;
for (const c of cases) {
  try { c.fn(); console.log("ok   " + c.name); }
  catch (e) { failed++; console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
