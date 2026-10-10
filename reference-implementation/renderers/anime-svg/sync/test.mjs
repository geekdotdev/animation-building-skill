// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Tests for sync-to-app.sh: the two meanings of DIAGRAM_SOURCE, its exit codes, and that init-project.sh sets it. Each test
// builds a throwaway project with init-project.sh and a throwaway application laid out like the example project.
// Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANIME_SVG = path.join(HERE, "..");
const INIT = path.join(ANIME_SVG, "init/init-project.sh");
const TEMPLATE = path.join(HERE, "sync-to-app.sh");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
const run = (cmd, args, cwd, env = {}) => spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

// An application like the example project: the reference stylesheet and helpers stand in for its own.
function makeApp(name) {
  const app = path.join(fs.realpathSync(tmp), name), pub = path.join(app, "spa-server/public");
  fs.mkdirSync(path.join(pub, "gateways"), { recursive: true });
  fs.copyFileSync(path.join(ANIME_SVG, "reference/diagram.css"), path.join(pub, "shared.css"));
  fs.copyFileSync(path.join(ANIME_SVG, "reference/helpers.js"), path.join(pub, "diagram-shared.js"));
  return { app, pub, page: path.join(pub, "gateways/flow-gateway.html") };
}
function makeProject(name, app) {
  const proj = path.join(tmp, name);
  const r = run("bash", [INIT, proj, "--diagram", "flow", "--app", app, "--no-install", "--anime", path.join(ANIME_SVG, "reference/helpers.js")], tmp);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return proj;
}
const sync = (proj, args = [], env = {}) => run("bash", [path.join(proj, "sync-to-app.sh"), ...args], proj, env);
const block = (proj) => { const h = read(proj, "flow/diagram.html"); return h.slice(h.indexOf('<div class="diagram"')).trim(); };
const pageWith = (inner) => `<h1>Lab</h1>\n<p>prose that must survive</p>\n${inner}\n<button class="continue-btn">Continue</button>\n`;

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

t("init copies the skill's sync script, sets DIAGRAM_SOURCE=local, the diagram, the skill and the app, and drops the license notice", () => {
  const { app } = makeApp("app1"), proj = makeProject("proj1", app);
  const s = read(proj, "sync-to-app.sh");
  assert.ok(fs.statSync(path.join(proj, "sync-to-app.sh")).mode & 0o100, "executable");
  assert.match(s, /^DIAGRAM_SOURCE="\$\{DIAGRAM_SOURCE:-local\}"/m);
  assert.match(s, /^DIAGRAM="\$\{DIAGRAM:-flow\}"/m);
  assert.match(s, new RegExp(`^APP_REPO="\\$\\{APP_REPO:-${app.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}"`, "m"));
  assert.match(s, /^SKILL_REPO="\$\{SKILL_REPO:-\//m);
  assert.doesNotMatch(s, /SPDX-License-Identifier|Copyright \(c\)/);
  // only the four values differ from the skill's template
  const diff = (a, b) => a.split("\n").map((l, i) => (l !== b.split("\n")[i] ? i : -1)).filter((i) => i >= 0);
  assert.ok(read(TEMPLATE).includes("SPDX-License-Identifier: MIT"), "the template keeps its notice");
  assert.ok(diff(read(TEMPLATE).split("\n").filter((l) => !/^# (Copyright|SPDX)/.test(l)).join("\n"), s).length <= 4);
});

t("local: a page with no diagram block, then a different one, exit 3; --update-block fixes it and keeps the prose", () => {
  const { app, pub, page } = makeApp("app2"), proj = makeProject("proj2", app);
  let r = sync(proj);
  assert.equal(r.status, 3, "no page yet");
  assert.match(r.stderr, /no gateway page/);
  fs.writeFileSync(page, pageWith('<div class="diagram" id="diagram-flow">old</div>'));
  r = sync(proj);
  assert.equal(r.status, 3, "a different block");
  assert.match(r.stderr, /DIFFERS from diagram\.html/);
  assert.match(read(page), /old/, "nothing rewritten without --update-block");
  r = sync(proj, ["--update-block"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /replaced the app's block/);
  const after = read(page);
  assert.ok(after.includes(block(proj)) && after.includes("prose that must survive") && after.includes('class="continue-btn"') && !after.includes(">old<"));
  r = sync(proj);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /current/);
  // a page with a Continue button but no block at all gets one inserted before the button
  fs.writeFileSync(page, pageWith(""));
  r = sync(proj);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /has no diagram block: run .* --update-block/);
  r = sync(proj, ["--update-block"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /inserted diagram\.html's before its Continue button/);
  assert.ok(read(page).indexOf(block(proj).slice(0, 40)) < read(page).indexOf("continue-btn"));
  assert.equal(read(pub, "gateways/flow.descriptor.js"), read(proj, "flow/diagram.animation.js"), "descriptor copied");
  assert.equal(read(pub, "interpreter.js"), read(ANIME_SVG, "interpreter.js"), "interpreter copied");
});

t("local: changing the drawing makes the next run exit 3 again", () => {
  const { app, page } = makeApp("app3"), proj = makeProject("proj3", app);
  fs.writeFileSync(page, pageWith(""));
  assert.equal(sync(proj, ["--update-block"]).status, 0);
  fs.writeFileSync(path.join(proj, "flow/diagram.html"), read(proj, "flow/diagram.html").replace('x="380" y="60" width="150"', 'x="380" y="60" width="152"'));
  assert.equal(sync(proj).status, 3);
});

t("app: the app's page is the source: it is checked, never compared or rewritten, and --update-block is refused", () => {
  const { app, pub, page } = makeApp("app4"), proj = makeProject("proj4", app);
  // the app's page is the drawing (a copy of the skeleton's, renamed), plus its prose and button
  const drawing = block(proj);
  fs.writeFileSync(page, pageWith(drawing));
  const before = read(page);
  // make the local drawing differ from the app's: in "app" mode that must not matter, and the local file is not even read
  fs.writeFileSync(path.join(proj, "flow/diagram.html"), "<p>stale local copy</p>");
  let r = sync(proj, [], { DIAGRAM_SOURCE: "app" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /DIAGRAM_SOURCE=app/);
  assert.equal(read(page), before, "the app's page is untouched");
  assert.equal(read(pub, "gateways/flow.descriptor.js"), read(proj, "flow/diagram.animation.js"));
  r = sync(proj, ["--update-block"], { DIAGRAM_SOURCE: "app" });
  assert.equal(r.status, 64);
  assert.match(r.stderr, /app's page is the source/);
  assert.equal(read(page), before);
});

t("app: a missing page is a missing drawing (exit 2), and the checks run against the app's page, so a broken one fails (exit 1)", () => {
  const { app, page } = makeApp("app5"), proj = makeProject("proj5", app);
  let r = sync(proj, [], { DIAGRAM_SOURCE: "app" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /missing the drawing/);
  fs.writeFileSync(page, pageWith('<div class="diagram" id="diagram-flow"><svg viewBox="0 0 10 10"></svg></div>'));
  r = sync(proj, [], { DIAGRAM_SOURCE: "app" });
  assert.equal(r.status, 1, "the validator finds the elements the descriptor names missing from the app's page");
});

t("DIAGRAM_SOURCE must be local or app, and a missing APP_REPO is said plainly", () => {
  const { app } = makeApp("app6"), proj = makeProject("proj6", app);
  let r = sync(proj, [], { DIAGRAM_SOURCE: "both" });
  assert.equal(r.status, 64);
  assert.match(r.stderr, /must be "local" or "app"/);
  const bare = path.join(tmp, "proj7");
  r = run("bash", [INIT, bare, "--diagram", "flow", "--no-install", "--anime", path.join(ANIME_SVG, "reference/helpers.js")], tmp);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  r = sync(bare);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /set APP_REPO/);
});

t("--help prints the header, and an unknown argument is a usage error", () => {
  const { app } = makeApp("app8"), proj = makeProject("proj8", app);
  const h = sync(proj, ["--help"]);
  assert.equal(h.status, 0);
  assert.match(h.stdout, /DIAGRAM_SOURCE=local/);
  assert.equal(sync(proj, ["--nope"]).status, 64);
});

let failed = 0;
for (const c of cases) {
  try { c.fn(); console.log(`ok   ${c.name}`); } catch (e) { failed++; console.log(`FAIL ${c.name}\n     ${String(e.message).split("\n").join("\n     ")}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
