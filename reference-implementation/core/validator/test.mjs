// Tests for validate.mjs: the valid fixture is clean, and each mutation is caught with the
// expected code. Run: node test.mjs
import assert from "node:assert/strict";
import { validate } from "./validate.mjs";
import base from "./fixtures/minimal.animation.js";

const clone = () => structuredClone(base);
const codes = (d, o) => validate(d, o).map((f) => `${f.level}:${f.code}`);
const cases = [];
const t = (name, mutate, expect, opts) => cases.push({ name, mutate, expect, opts });

t("baseline is clean", () => {}, []);
t("not data-only", (d) => { d.nodes[0].fn = () => 1; }, ["error:data-only"]);
t("undefined value", (d) => { d.nodes[0].label = undefined; }, ["error:data-only"]);
t("unknown top-level key", (d) => { d.extra = 1; }, ["warning:unknown-key"]);
t("duplicate node name", (d) => { d.nodes.push({ ...d.nodes[0] }); }, ["error:duplicate"]);
t("channel endpoint is not a node", (d) => { d.channels[0].a = "nope"; }, ["error:unresolved"]);
t("undefined named duration", (d) => { d.sequences[0].rules[0].do[1].move.duration = "@nope"; }, ["error:unresolved"]);
t("link to a missing channel", (d) => { d.durations.leg = { link: "channel:nope" }; }, ["error:unresolved"]);
t("fidelity missing", (d) => { delete d.sequences[0].fidelity; }, ["error:fidelity"]);
t("faithful without source", (d) => { delete d.sequences[0].source; }, ["error:fidelity"]);
t("adapted without adaptation", (d) => { delete d.sequences[1].adaptation; }, ["error:fidelity"]);
t("metaphor without explains", (d) => { d.sequences[0].fidelity = "metaphor"; delete d.sequences[0].source; }, ["error:fidelity"]);
t("lane without subject", (d) => { delete d.lanes[0].subject; }, ["error:lane"]);
t("open-ended phase that is not last", (d) => { d.lanes[0].phases.unshift({ name: "x", timebox: "open-ended" }); }, ["error:lane", "error:lane"]);
t("event-bounded without exit", (d) => { delete d.lanes[1].phases[0].exit; }, ["error:lane"]);
t("gesture node that no phase arms", (d) => { d.lanes[0].phases[0].arms = []; }, ["error:lane", "error:gesture", "error:gesture"]);
t("gesture rule in a phase that does not arm it", (d) => { d.lanes[1].phases[0].arms = []; d.sequences[1].rules[0].on = { gesture: "client" }; }, ["error:gesture"]);
t("arrival nothing sends", (d) => { d.sequences[0].rules[1].on.arrival.asset = "natsConnectRequest"; }, ["error:dead-trigger"]);
t("arrival fed only by another lane", (d) => { d.sequences[1].rules.push({ on: { arrival: { channel: "server-client", direction: "forward", asset: "natsOk" } }, do: [{ narrate: "x" }] }); }, ["error:dead-trigger"]);
t("datum with no consequence and no marker (escalation)", (d) => { delete d.datums[2].terminal; }, ["escalation:terminal"]);
t("terminal datum that something reacts to", (d) => { d.datums[1].terminal = true; }, ["error:terminal"]);
t("two sequences share a channel in one lane and phase", (d) => { d.sequences.push({ name: "dup", lane: "client", phase: "connect", fidelity: "faithful", source: "s", rules: [{ on: { datum: "started" }, do: [{ move: { asset: "natsOk", channel: "server-client", direction: "return" } }] }] }); }, ["error:shared-channel"]);

// different assets from two lanes on one channel: an escalation until an overlay answers it
// lane "other" sends a payload on the client's channel, fed by its own earlier arrival
const shared = (d) => { d.sequences[1].rules.push({ on: { arrival: { channel: "server-other", direction: "return", asset: "payload" } }, do: [{ move: { asset: "payload", channel: "server-client", direction: "return" } }] }); };
t("different assets from two lanes on one channel (escalation)", shared, ["escalation:overlay"]);
t("unresolved overlay needs draft: true", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; }, ["escalation:overlay", "error:draft"]);
t("unresolved overlay in a draft is an open escalation", (d) => { shared(d); d.draft = true; d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; }, ["escalation:overlay"]);
t("resolved overlay is clean", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: ["client", "other"] }]; }, []);
t("overlay that ranks too few lanes", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: ["client"] }]; }, ["error:overlay"]);
t("stale overlay entry", (d) => { d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: ["client", "other"] }]; }, ["error:overlay"]);
t("identical assets from two lanes are exempt", (d) => {
  d.channels.push({ name: "x", element: "dg-line-x", a: "server", b: "other", duration: 900, visibility: "hidden" });
  d.sequences.push({ name: "cx", lane: "client", phase: "steady", fidelity: "faithful", source: "s", rules: [{ on: { datum: "started" }, do: [{ move: { asset: "payload", channel: "x", direction: "forward" } }] }] });
  d.sequences[1].rules.push({ on: { datum: "started" }, do: [{ move: { asset: "payload", channel: "x", direction: "forward" } }] });
}, []);

// identical assets starting together on different paths
const fork = (d) => { d.channels.push({ name: "server-third", element: "dg-line-third", a: "server", b: "other", duration: 1000, visibility: "hidden" }); d.sequences[1].rules[0].do.push({ move: { asset: "payload", channel: "server-third", direction: "return" } }); };
const same = { startpoints: { "server-other": { return: "10,10" }, "server-third": { return: "10,10" } } };
const apart = { startpoints: { "server-other": { return: "10,10" }, "server-third": { return: "80,10" } } };
t("identical asset from the same startpoint without a divergence", fork, ["error:undeclared-divergence"], same);
t("identical asset from different startpoints is just two rules on one trigger", fork, [], apart);
t("startpoints unknown: the fork check is skipped, with a warning", fork, ["warning:startpoint-unknown"]);
const declare = (d) => { fork(d); d.sequences[1].rules[0].do.splice(1, 2, { divergence: { asset: "payload", origin: "other", branches: [{ channel: "server-other", direction: "return" }, { channel: "server-third", direction: "return" }] } }); };
t("declared divergence from one startpoint is accepted", declare, [], same);
t("declared divergence whose branches start at different points", declare, ["error:divergence"], apart);
t("divergence branch does not start at the origin", (d) => { fork(d); d.sequences[1].rules[0].do.splice(1, 2, { divergence: { asset: "payload", origin: "server", branches: [{ channel: "server-other", direction: "return" }, { channel: "server-third", direction: "return" }] } }); }, ["error:divergence", "error:divergence"], same);
t("same arrival in two lanes is not one trigger", (d) => {
  d.lanes.push({ name: "third", subject: "s", entry: { datum: "started" }, phases: [{ name: "p", timebox: "open-ended" }] });
  d.sequences.push({ name: "third-seq", lane: "third", phase: "p", fidelity: "faithful", source: "s", rules: [
    { on: { datum: "started" }, do: [{ move: { asset: "natsInfoRequest", channel: "server-client", direction: "forward" } }] },
    { on: { arrival: { channel: "server-client", direction: "forward", asset: "natsInfoRequest" } }, do: [{ move: { asset: "natsOk", channel: "server-client", direction: "forward" } }] } ] });
}, ["escalation:overlay"]); // no undeclared-divergence: the same arrival in two lanes is not one trigger
t("convergent lanes with different durations (warning)", (d) => {
  d.lanes[1].entry = { datum: "started" }; d.sequences[1].rules[0].on = { datum: "started" };
  d.sequences[0].rules[0] = { on: { datum: "started" }, do: [{ move: { asset: "natsInfoRequest", channel: "server-client", direction: "forward", duration: "@leg" } }] };
  d.sequences[1].rules[0].do = [{ move: { asset: "payload", channel: "server-other", direction: "return", duration: 300 } }];
  d.lanes[0].phases[0] = { name: "connect", timebox: "event-bounded", exit: "client-connected" }; d.lanes[0].phases[1] = { name: "steady", timebox: "open-ended" };
  d.nodes[1].gesture = false;
}, ["warning:convergence"]);
const modes = (o) => ({ default: "user-driven", toggle: true, simulated: { delay: 800, acknowledge: { color: "#1e88e5", duration: 400 } }, ...o });
t("valid modes", (d) => { d.modes = modes(); }, []);
t("modes omitted is user-driven only", () => {}, []);
t("bad default mode", (d) => { d.modes = modes({ default: "auto" }); }, ["error:modes"]);
t("toggle allows automated but simulated is missing", (d) => { d.modes = modes({ simulated: undefined }); delete d.modes.simulated; }, ["error:modes"]);
t("automated by default needs the acknowledgement", (d) => { d.modes = { default: "automated", toggle: false }; }, ["error:modes"]);
t("user-driven and no toggle needs no acknowledgement", (d) => { d.modes = { default: "user-driven", toggle: false }; }, []);
t("simulated acknowledgement without a color", (d) => { d.modes = modes(); delete d.modes.simulated.acknowledge.color; }, ["error:modes"]);
t("negative simulated delay", (d) => { d.modes = modes(); d.modes.simulated.delay = -1; }, ["error:modes"]);
t("toggle with no gesture node (warning)", (d) => { d.modes = modes(); d.nodes[1].gesture = false; d.lanes[0].phases[0] = { name: "connect", timebox: "event-bounded", exit: "client-connected" }; d.sequences[0].rules[0].on = { datum: "started" }; }, ["warning:modes"]);
t("markup key: a relative path is accepted", (d) => { d.markup = "example.diagram.html"; }, []);
t("markup key: must be a non-empty string", (d) => { d.markup = ""; }, ["error:markup"]);
t("markup key: an absolute path is an error", (d) => { d.markup = "/etc/passwd"; }, ["error:markup"]);
t("markup key: the file must exist when the descriptor's folder is known", (d) => { d.markup = "no-such-file.html"; }, ["error:markup"], { baseDir: import.meta.dirname });
t("markup key: an existing file passes", (d) => { d.markup = "fixtures/minimal.animation.js"; }, [], { baseDir: import.meta.dirname });
t("diagramLabel must be id-safe", (d) => { d.diagramLabel = "Login Flow"; }, ["error:shape"]);
t("diagramLabel: lowercase, digits and hyphens is fine", (d) => { d.diagramLabel = "login-flow-2"; }, []);
t("a REPLACE placeholder left in source, adaptation or explains is a warning", (d) => { d.sequences[0].source = "REPLACE: cite the code"; }, ["warning:placeholder"]);
t("pace: a positive number is accepted", (d) => { d.pace = 1.5; }, []);
t("pace: must be a positive number", (d) => { d.pace = 0; }, ["error:pace"]);
t("pace: a negative number is an error", (d) => { d.pace = -1; }, ["error:pace"]);
t("pace: a string is an error", (d) => { d.pace = "2"; }, ["error:pace"]);
t("pace: more than ten times off is a warning", (d) => { d.pace = 50; }, ["warning:pace"]);
t("pace: less than a tenth is a warning", (d) => { d.pace = 0.05; }, ["warning:pace"]);
t("unknown asset (with an iconography)", () => {}, Array(6).fill("error:unknown-asset"), { assets: ["nothing"] });
t("element missing from the markup", () => {}, ["error:markup", "error:markup", "error:markup", "error:markup", "error:markup"], { markup: "<svg></svg>" });
t("unknown action", (d) => { d.sequences[0].rules[0].do.push({ explode: true }); }, ["error:shape"]);
t("narrate must be static", (d) => { d.sequences[0].rules[0].do.push({ narrate: 3 }); }, ["error:shape"]);

let failed = 0;
for (const c of cases) {
  const d = clone(); c.mutate(d);
  const got = codes(d, c.opts).sort(), want = [...c.expect].sort();
  try { assert.deepEqual(got, want); console.log("ok   " + c.name); }
  catch { failed++; console.log(`FAIL ${c.name}\n     expected ${JSON.stringify(want)}\n     got      ${JSON.stringify(got)}`); }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
