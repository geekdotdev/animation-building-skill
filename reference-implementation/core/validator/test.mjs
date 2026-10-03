// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Tests for validate.mjs: the valid fixture is clean, and each mutation is caught with the
// expected code. Run: node test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
t("element missing from the markup", () => {}, ["error:markup", "error:markup", "error:markup", "error:markup", "error:markup", "error:markup", "error:markup"], { markup: "<svg></svg>" });
t("unknown action", (d) => { d.sequences[0].rules[0].do.push({ explode: true }); }, ["error:shape"]);
t("narrate must be static", (d) => { d.sequences[0].rules[0].do.push({ narrate: 3 }); }, ["error:shape"]);

// ---- strict mode: local shape storage (core/ontology.md "Local storage", core/descriptor.md section 3.2) ----
// A fresh, self-contained descriptor rather than the shared fixture: strict mode checks EVERY move's
// origin, and the shared fixture's moves were never designed with stores, so reusing it would mean
// retrofitting stores onto tests that have nothing to do with this feature.
const strictBase = () => ({
  version: 1, diagramLabel: "strict-mini", title: "Strict test",
  nodes: [{ name: "a", element: "dg-a" }, { name: "b", element: "dg-b" }],
  channels: [{ name: "a-b", element: "dg-line", a: "a", b: "b", duration: 500, visibility: "hidden" }],
  zones: [], volumes: [], eventLog: { element: "log" }, durations: {},
  datums: [{ name: "started", label: "Started", when: { start: true }, terminal: true }],
  lanes: [{ name: "main", subject: "s", entry: { start: true }, phases: [{ name: "p", timebox: "open-ended" }] }],
  sequences: [{ name: "seq", lane: "main", phase: "p", fidelity: "faithful", source: "s", rules: [
    { on: { start: true }, do: [
      { store: { at: "a", asset: "token" } },       // "created itself"
      { move: { asset: "token", channel: "a-b", direction: "forward" } },
    ] },
  ] }],
  overlays: [],
});
// The harness always clones the shared fixture into `d` and calls mutate(d); here mutate replaces `d`'s
// contents in place with the strict-mode descriptor, then applies `customize`.
const strict = (d, customize = () => {}) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, strictBase()); d.strict = true; customize(d); };

t("strict mode: a stored asset may be sent (created itself)", (d) => strict(d), []);
t("strict mode: nothing stores it first is an error", (d) => strict(d, (d) => { d.sequences[0].rules[0].do.shift(); }), ["error:strict"]);
t("strict mode: an asset that simply arrives needs no store (received from another channel)", (d) => strict(d, (d) => {
  d.nodes.push({ name: "c", element: "dg-c" });
  d.channels.push({ name: "b-c", element: "dg-line2", a: "b", b: "c", duration: 500, visibility: "hidden" });
  // "a" stores 'token' (unchanged) and sends it to "b"; "b" holds it purely from having received it, and
  // re-sends the SAME token onward to "c" with no store of its own needed.
  d.sequences[0].rules.push({ on: { arrival: { channel: "a-b", direction: "forward", asset: "token" } }, do: [
    { move: { asset: "token", channel: "b-c", direction: "forward" } } ] });
}), []);
t("strict mode: a docked volume's asset, given by a store on its completion, may be sent", (d) => strict(d, (d) => {
  d.volumes = [{ name: "vol", element: "dg-vol", label: "v", consumer: "a", offset: { x: 10, y: 0 } }];
  d.sequences[0].rules[0].do = [
    { dock: ["vol"], duration: 300, name: "dock-vol" },
    { store: { at: "a", asset: "token" } }, // "received from a docked volume": the store is the very next action once the dock completes
    { move: { asset: "token", channel: "a-b", direction: "forward" } },
  ];
}), []);
t("strict mode: store at an unknown node", (d) => strict(d, (d) => { d.sequences[0].rules[0].do[0].store.at = "nope"; }), ["error:strict", "error:unresolved"]);
t("strict mode: store needs exactly one of asset or assets", (d) => strict(d, (d) => { d.sequences[0].rules[0].do[0].store.assets = ["x", "y"]; }), ["error:shape", "error:strict"]);
t("strict mode: store's asset must be in the iconography", (d) => strict(d), Array(2).fill("error:unknown-asset"), { assets: ["nothing"] }); // once for the store, once for the move: the store still registers regardless of iconography membership
t("strict mode must be a boolean", (d) => strict(d, (d) => { d.strict = "yes"; }), ["error:shape"]);
t("store actions are tracked even with strict not set (no warning): tracking and enforcement are independent", (d) => { strict(d); delete d.strict; }, []);
t("strict mode is off by default: an unstored send is not an error", (d) => strict(d, (d) => { d.sequences[0].rules[0].do.shift(); delete d.strict; }), []);

// ---- showLocalStorage (display, independent of strict): core/descriptor.md section 3.2 ----
t("showLocalStorage: overlay is accepted with no offset", (d) => { d.nodes[0].showLocalStorage = { position: "overlay" }; }, []);
t("showLocalStorage: adjacent needs an offset", (d) => { d.nodes[0].showLocalStorage = { position: "overlay", offset: { x: 1, y: 1 } }; }, ["error:shape"]);
t("showLocalStorage: adjacent with a valid offset is accepted", (d) => { d.nodes[0].showLocalStorage = { position: "adjacent", offset: { x: 10, y: -10 } }; }, []);
t("showLocalStorage: adjacent without an offset is an error", (d) => { d.nodes[0].showLocalStorage = { position: "adjacent" }; }, ["error:shape"]);
t("showLocalStorage: an unknown position is an error", (d) => { d.nodes[0].showLocalStorage = { position: "beside" }; }, ["error:shape"]);
t("showLocalStorage: must be an object", (d) => { d.nodes[0].showLocalStorage = "overlay"; }, ["error:shape"]);

// ---- watermark (core/ontology.md "Watermark", core/descriptor.md section 3.3): attribution to the skill and the developer ----
const withCreditsZone = (d) => { d.zones.push({ name: "credits", element: "dg-watermark", label: "Credits", members: { nodes: [], volumes: [] }, padding: { left: 6, top: 6, right: 6, bottom: 6 } }); };
t("watermark: a minimal one (just a zone) is accepted", (d) => { withCreditsZone(d); d.watermark = { zone: "credits" }; }, []);
t("watermark: repo, author, website and fade all set is accepted", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", repo: true, author: "Jane Doe", website: "https://example.com", fade: 8 }; }, []);
t("watermark: fade false (permanent) is accepted", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", fade: false }; }, []);
t("watermark: zone is required", (d) => { withCreditsZone(d); d.watermark = {}; }, ["error:shape", "warning:zone"]); // the now-orphaned credits zone still warns: it isn't referenced by name
t("watermark: zone must resolve", (d) => { withCreditsZone(d); d.watermark = { zone: "nope" }; }, ["error:unresolved", "warning:zone"]);
t("watermark: its zone must have no members", (d) => {
  d.zones.push({ name: "credits", element: "dg-watermark", label: "Credits", members: { nodes: ["server"], volumes: [] }, padding: { left: 0, top: 0, right: 0, bottom: 0 } });
  d.watermark = { zone: "credits" };
}, ["error:shape"]);
t("watermark: repo must be a boolean", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", repo: "yes" }; }, ["error:shape"]);
t("watermark: author must be a non-empty string", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", author: "" }; }, ["error:shape"]);
t("watermark: website must be a non-empty string", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", website: "" }; }, ["error:shape"]);
t("watermark: a website with no http(s) prefix is a warning, not an error", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", website: "example.com" }; }, ["warning:shape"]);
t("watermark: fade must be false or a positive number, not 0", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", fade: 0 }; }, ["error:shape"]);
t("watermark: fade must be false or a positive number, not negative", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", fade: -1 }; }, ["error:shape"]);
t("watermark: fade must be false or a positive number, not a string", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", fade: "8" }; }, ["error:shape"]);
t("watermark: must be an object", (d) => { withCreditsZone(d); d.watermark = "credits"; }, ["error:shape", "warning:zone"]);
t("watermark: an unknown key is a warning", (d) => { withCreditsZone(d); d.watermark = { zone: "credits", color: "red" }; }, ["warning:unknown-key"]);
t("a watermark zone's own no-members warning is suppressed, but an unrelated empty zone still warns", (d) => {
  withCreditsZone(d); d.watermark = { zone: "credits" };
  d.zones.push({ name: "other-empty", element: "dg-other-zone", label: "x", members: { nodes: [], volumes: [] }, padding: { left: 0, top: 0, right: 0, bottom: 0 } });
}, ["warning:zone"]);

// ---- composite crawlers (core/ontology.md "Composite crawler", core/descriptor.md section 3.1) ----
// An isolated composite move (no consumer rule), on a channel no other lane touches, for shape checks.
const withCompositeMove = (d, extra = {}) => {
  d.sequences[1].rules.push({ on: { arrival: { channel: "server-other", direction: "return", asset: "payload" } }, do: [
    { move: { assets: ["payload", "natsOk"], channel: "server-other", direction: "forward", ...extra } } ] });
};
t("composite move: a valid composite with a box is accepted", (d) => withCompositeMove(d, { box: true }), []);
t("composite move: asset and assets can't both be set", (d) => withCompositeMove(d, { asset: "natsOk" }), ["error:shape"]);
t("composite move: assets needs at least two names", (d) => withCompositeMove(d, { assets: ["payload"] }), ["error:shape"]);
t("composite move: unknown asset in the list", (d) => withCompositeMove(d, { assets: ["payload", "mystery"] }), ["error:unknown-asset"], { assets: ["natsInfoRequest", "natsOk", "payload"] });
t("composite move: box is an error on a single asset", (d) => { d.sequences[0].rules[0].do[1].move.box = true; }, ["error:shape"]);
t("composite move: box must be true or false", (d) => withCompositeMove(d, { box: "yes" }), ["error:shape"]);
t("composite move: a valid spacing is accepted", (d) => withCompositeMove(d, { spacing: 20 }), []);
t("composite move: spacing is an error on a single asset", (d) => { d.sequences[0].rules[0].do[1].move.spacing = 20; }, ["error:shape"]);
t("composite move: spacing must be a non-negative number", (d) => withCompositeMove(d, { spacing: -1 }), ["error:shape"]);
t("composite move: spacing of 0 is allowed (fully overlapping)", (d) => withCompositeMove(d, { spacing: 0 }), []);
t("composite move: spacing must be a number, not a string", (d) => withCompositeMove(d, { spacing: "20" }), ["error:shape"]);

// a full chain: the move, and a rule waiting for its arrival
const withCompositeChain = (d, consumerAssets) => {
  d.sequences[1].rules.push(
    { on: { arrival: { channel: "server-other", direction: "return", asset: "payload" } }, do: [
        { move: { assets: ["payload", "natsOk"], channel: "server-other", direction: "forward" } } ] },
    { on: { arrival: { channel: "server-other", direction: "forward", assets: consumerAssets } }, do: [{ narrate: "x" }] },
  );
};
t("composite arrival matches the exact ordered list", (d) => withCompositeChain(d, ["payload", "natsOk"]), []);
t("composite arrival with a different order is a dead trigger: order is part of its identity", (d) => withCompositeChain(d, ["natsOk", "payload"]), ["error:dead-trigger"]);
t("composite arrival condition also needs at least two names", (d) => withCompositeChain(d, ["payload"]), ["error:shape", "error:dead-trigger"]);

// two lanes on one channel: identical composites (same order) are exempt, anything else is an escalation
const withTwoLaneComposite = (d, listA, listB) => {
  d.sequences[1].rules[0].do[1] = { move: { assets: listB, channel: "server-other", direction: "return" } };
  d.datums[2].when = { arrival: { channel: "server-other", direction: "return", assets: listB } };
  d.sequences.push({ name: "compA", lane: "client", phase: "steady", fidelity: "faithful", source: "s", rules: [
    { on: { datum: "client-connected" }, do: [{ move: { assets: listA, channel: "server-other", direction: "return" } }] }] });
};
t("shared channel: two lanes with the identical composite, same order, are exempt", (d) => withTwoLaneComposite(d, ["payload", "natsOk"], ["payload", "natsOk"]), []);
t("shared channel: the same elements in a different order still conflict: order is part of identity", (d) => withTwoLaneComposite(d, ["payload", "natsOk"], ["natsOk", "payload"]), ["escalation:overlay"]);
t("shared channel: two different composites conflict", (d) => withTwoLaneComposite(d, ["payload", "natsOk"], ["natsInfoRequest", "natsOk"]), ["escalation:overlay"]);

// identical composites starting together at the same startpoint need a declared divergence, same as one asset
const forkComposite = (d) => { d.channels.push({ name: "server-third", element: "dg-line-third", a: "server", b: "other", duration: 1000, visibility: "hidden" }); d.sequences[1].rules[0].do.push({ move: { assets: ["payload", "natsOk"], channel: "server-third", direction: "return" } }); d.sequences[1].rules[0].do[1] = { move: { assets: ["payload", "natsOk"], channel: "server-other", direction: "return" } }; d.datums[2].when = { arrival: { channel: "server-other", direction: "return", assets: ["payload", "natsOk"] } }; };
t("composite: identical lists from the same startpoint without a divergence", forkComposite, ["error:undeclared-divergence"], same);
t("composite: identical lists from different startpoints is just two rules on one trigger", forkComposite, [], apart);
const declareComposite = (d) => { forkComposite(d); d.sequences[1].rules[0].do.splice(1, 2, { divergence: { assets: ["payload", "natsOk"], origin: "other", box: true, branches: [{ channel: "server-other", direction: "return" }, { channel: "server-third", direction: "return" }] } }); };
t("composite divergence from one startpoint, with a box, is accepted", declareComposite, [], same);
t("composite divergence whose branches start at different points", declareComposite, ["error:divergence"], apart);
t("divergence: box is an error without assets (a plain single-asset divergence)", (d) => { fork(d); d.sequences[1].rules[0].do.splice(1, 2, { divergence: { asset: "payload", origin: "other", box: true, branches: [{ channel: "server-other", direction: "return" }, { channel: "server-third", direction: "return" }] } }); }, ["error:shape"], same);

// channel authentication (core/ontology.md, Channel): a declared, tracked state — like visibility, starts
// false, set true by a datum's acknowledge (glow). Doesn't gate anything by itself.
t("channel authenticated: valid, with authenticatedBy acknowledging it", (d) => { d.channels[0].authenticated = false; d.channels[0].authenticatedBy = "client-connected"; }, []);
t("channel authenticated: must be true or false", (d) => { d.channels[0].authenticated = "yes"; d.channels[0].authenticatedBy = "client-connected"; }, ["error:shape"]);
t("channel authenticated: needs authenticatedBy", (d) => { d.channels[0].authenticated = false; }, ["error:shape"]);
t("channel authenticatedBy: needs authenticated", (d) => { d.channels[0].authenticatedBy = "client-connected"; }, ["error:shape"]);
t("channel authenticatedBy: must be a string", (d) => { d.channels[0].authenticated = false; d.channels[0].authenticatedBy = 123; }, ["error:shape"]);
t("channel authenticatedBy: names an undefined datum", (d) => { d.channels[0].authenticated = false; d.channels[0].authenticatedBy = "nope"; }, ["error:unresolved"]);
t("channel authenticatedBy: datum does not acknowledge this channel", (d) => { d.channels[0].authenticated = false; d.channels[0].authenticatedBy = "other-published"; }, ["error:shape"]);

// the { channel, authenticated: true } condition, so a datum can react to the state directly
t("channel-authenticated condition: valid", (d) => {
  d.channels[0].authenticated = false; d.channels[0].authenticatedBy = "client-connected";
  d.datums.push({ name: "x", label: "X", terminal: true, when: { channel: "server-client", authenticated: true } });
}, []);
t("channel-authenticated condition: channel not defined", (d) => { d.datums.push({ name: "x", label: "X", terminal: true, when: { channel: "nope", authenticated: true } }); }, ["error:unresolved"]);
t("channel-authenticated condition: channel does not declare authenticated", (d) => { d.datums.push({ name: "x", label: "X", terminal: true, when: { channel: "server-client", authenticated: true } }); }, ["error:unresolved"]);
t("channel-authenticated condition: authenticated must be true", (d) => {
  d.channels[0].authenticated = false; d.channels[0].authenticatedBy = "client-connected";
  d.datums.push({ name: "x", label: "X", terminal: true, when: { channel: "server-client", authenticated: false } });
}, ["error:shape"]);

// validatorExceptions (core/ontology.md, Validator exception): suppresses one already-found overlay
// escalation once the user has verified it can't actually happen, without changing what conflicts() finds.
t("validatorExceptions: suppresses the overlay escalation", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = [{ check: "overlay", channel: "server-client", reason: "temporallySeparated" }]; }, []);
t("validatorExceptions: also drops the draft-required rule", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = [{ check: "overlay", channel: "server-client", reason: "temporallySeparated" }]; d.draft = true; }, ["warning:draft"]);
t("validatorExceptions: entry not an object", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = ["nope"]; }, ["error:shape", "escalation:overlay", "error:draft"]);
t("validatorExceptions: unknown check", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = [{ check: "nope", channel: "server-client", reason: "temporallySeparated" }]; }, ["error:shape", "escalation:overlay", "error:draft"]);
t("validatorExceptions: channel not defined", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = [{ check: "overlay", channel: "nope", reason: "temporallySeparated" }]; }, ["error:unresolved", "escalation:overlay", "error:draft"]);
t("validatorExceptions: reason must be a non-empty string", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = [{ check: "overlay", channel: "server-client", reason: "" }]; }, ["error:shape", "escalation:overlay", "error:draft"]);
t("validatorExceptions: unrecognized reason value still exempts, with a warning", (d) => { shared(d); d.overlays = [{ channel: "server-client", lanes: ["client", "other"], precedence: "unresolved" }]; d.validatorExceptions = [{ check: "overlay", channel: "server-client", reason: "becauseISaidSo" }]; }, ["warning:validator-exception"]);
t("validatorExceptions: stale (no conflict on that channel)", (d) => { d.validatorExceptions = [{ check: "overlay", channel: "server-other", reason: "temporallySeparated" }]; }, ["warning:validator-exception"]);
t("validatorExceptions: exempted but no overlays entry documents it", (d) => { shared(d); d.validatorExceptions = [{ check: "overlay", channel: "server-client", reason: "temporallySeparated" }]; }, ["warning:overlay"]);

// eventLog (core/descriptor.md §2, ontology rule 27): declared explicitly, required, checked
// against the markup's fixed diagram-<label>-log id / diagram-log class convention.
t("eventLog: missing is an error", (d) => { delete d.eventLog; }, ["error:shape"]);
t("eventLog: must be an object", (d) => { d.eventLog = "log"; }, ["error:shape"]);
t("eventLog: element must be a non-empty string", (d) => { d.eventLog.element = ""; }, ["error:shape"]);
t("eventLog: element must be a string, not a number", (d) => { d.eventLog.element = 1; }, ["error:shape"]);
const fullMarkup = (log) => `
  <rect id="dg-box-server-mini"></rect>
  <g id="dg-node-client-mini"></g>
  <rect id="dg-box-other-mini"></rect>
  <path id="dg-line-client-mini"></path>
  <path id="dg-line-other-mini"></path>
  ${log}
`;
t("eventLog: resolves against the markup", (d) => {}, [], { markup: fullMarkup('<div id="diagram-mini-log" class="diagram-log"></div>') });
t("eventLog: id missing from the markup", (d) => {}, ["error:markup"], { markup: fullMarkup('<div class="diagram-log"></div>') });
t("eventLog: class missing from the markup", (d) => {}, ["error:markup"], { markup: fullMarkup('<div id="diagram-mini-log"></div>') });

let failed = 0;
for (const c of cases) {
  const d = clone(); c.mutate(d);
  const got = codes(d, c.opts).sort(), want = [...c.expect].sort();
  try { assert.deepEqual(got, want); console.log("ok   " + c.name); }
  catch { failed++; console.log(`FAIL ${c.name}\n     expected ${JSON.stringify(want)}\n     got      ${JSON.stringify(got)}`); }
}
// The CLI has to run when reached through a symlink: the documented install is a link at
// ~/.claude/skills/diagram-animation. A main-guard comparing an unresolved argv[1] with
// import.meta.url made it exit 0 in silence there, so a broken descriptor looked clean.
const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "validator-link-"));
fs.symlinkSync(path.dirname(fileURLToPath(import.meta.url)), path.join(linkDir, "linked"));
const viaLink = spawnSync(process.execPath, [path.join(linkDir, "linked/validate.mjs"), path.join(linkDir, "linked/fixtures/minimal.animation.js")], { encoding: "utf8" });
fs.rmSync(linkDir, { recursive: true, force: true });
const linkName = "the CLI runs when reached through a symlink";
if (viaLink.status === 0 && /\d+ errors/.test(viaLink.stdout + viaLink.stderr)) console.log("ok   " + linkName);
else { failed++; console.log(`FAIL ${linkName}\n     exit ${viaLink.status}, output ${JSON.stringify(viaLink.stdout + viaLink.stderr)}`); }
console.log(`\n${cases.length + 1 - failed}/${cases.length + 1} passed`);
process.exit(failed ? 1 : 0);
