#!/usr/bin/env node
// Animation descriptor validator: the checks of core/descriptor.md section 8.
// No dependencies. Node 18+.
//
//   node validate.mjs <descriptor.animation.js> [--markup diagram.html] [--assets iconography.js|.json] [--json]
//   The markup checked is the descriptor's own `markup` (a path relative to the descriptor) unless --markup overrides it.
//
// Exit code: 0 clean (warnings allowed), 1 errors, 2 no errors but open escalations.
//
// Options: { markup: string, baseDir: string (the descriptor's folder, to check that its `markup` file exists), assets: string[], startpoints: { <channel>: { forward: 'x,y', return: 'x,y' } } }
//   startpoints overrides what would be read from the markup.
//
// Levels:
//   error       the descriptor is wrong: the agent fixes it.
//   escalation  the agent must stop and ask the user (core/ontology.md).
//   warning     probably wrong, or worth a second look.
//
// NOT covered (needs a browser, or a judgement this file can't make): zone geometry
// measured from the rendered SVG, lane/phase reset behaviour, and whether a `source:` is true.
//
// A move, divergence, or arrival names an `asset` (one) or `assets` (a composite crawler, >= 2 names;
// core/descriptor.md section 3.1). `box` is valid only alongside `assets`.
//
// The format extensions proposed in the worked example's FINDINGS.md (F1 `element`, F3 `delay`,
// F6 `hide`, F9 rule-level `when` guard, F10 `dock` and `completed`, F15 derived consequences)
// are accepted, and are marked "proposed" below so they can be removed if the user rejects them.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIDELITY = ["faithful", "adapted", "metaphor"];
const TIMEBOX = ["timed", "event-bounded", "user-paced", "open-ended"];
const DIRECTIONS = ["forward", "return"];
const TOP_KEYS = ["version", "draft", "diagramLabel", "title", "nodes", "channels", "zones", "volumes", "durations", "datums", "lanes", "sequences", "overlays", "modes", "markup", "pace", "strict", "watermark"];
const ACTIONS = ["move", "reveal", "hide", /* proposed F6 */ "acknowledge", "narrate", "hint", "repeat", "divergence", "dock" /* proposed F10 */, "store" /* strict mode: core/descriptor.md section 3.2 */];
const ACTION_MODIFIERS = ["after", "duration", "name"]; // `duration` and `name` are used by `dock` and `hide` (proposed)

export function validate(d, opts = {}) {
  const out = [];
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  const err = (c, w, m) => add("error", c, w, m);
  const esc = (c, w, m) => add("escalation", c, w, m);
  const warn = (c, w, m) => add("warning", c, w, m);
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const arr = (x) => (Array.isArray(x) ? x : []);

  // ---- 0. shape and data-only -------------------------------------------------
  if (!isObj(d)) { err("shape", "descriptor", "the default export is not an object"); return out; }
  // JSON.stringify silently drops functions and undefined on both sides of a round trip, so walk the values
  const impure = (v, p) => {
    if (typeof v === "function" || typeof v === "undefined" || typeof v === "symbol" || typeof v === "bigint" || (typeof v === "number" && !Number.isFinite(v))) return p;
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) { const r = impure(x, `${p}.${k}`); if (r) return r; } }
    return null;
  };
  const bad = impure(d, "descriptor");
  if (bad) { err("data-only", bad, "not data-only: functions, undefined, symbols, bigint and non-finite numbers are not allowed"); return out; }
  for (const k of Object.keys(d)) if (!TOP_KEYS.includes(k)) warn("unknown-key", k, `unknown top-level key "${k}"`);
  if (d.version !== 1) err("version", "version", `unsupported version ${JSON.stringify(d.version)}`);
  if (typeof d.diagramLabel !== "string" || !d.diagramLabel) err("shape", "diagramLabel", "diagramLabel (the diagram's id suffix, e.g. 'login-flow') is required");
  if (typeof d.diagramLabel === "string" && d.diagramLabel && !/^[a-z][a-z0-9-]*$/.test(d.diagramLabel))
    err("shape", "diagramLabel", `diagramLabel "${d.diagramLabel}" must be lowercase letters, digits and hyphens, starting with a letter: it is the suffix of every element id`);
  // `pace`: one factor on every duration and delay (2 is twice as slow, 0.5 twice as fast)
  if (d.pace !== undefined) {
    if (typeof d.pace !== "number" || !Number.isFinite(d.pace) || d.pace <= 0) err("pace", "pace", "pace must be a positive number: 1 is the authored speed, 2 is twice as slow, 0.5 twice as fast");
    else if (d.pace < 0.1 || d.pace > 10) warn("pace", "pace", `pace ${d.pace} is more than ten times faster or slower than authored: is that intended?`);
  }
  // `markup`: where the diagram's SVG lives (the descriptor holds no geometry). A path relative to the descriptor.
  if (d.markup !== undefined) {
    if (typeof d.markup !== "string" || !d.markup.trim()) err("markup", "markup", "markup must be a non-empty path, relative to the descriptor");
    else if (path.isAbsolute(d.markup)) err("markup", "markup", "markup must be a path relative to the descriptor, not an absolute one");
    else if (opts.baseDir !== undefined && !fs.existsSync(path.resolve(opts.baseDir, d.markup))) err("markup", "markup", `markup file not found: ${path.resolve(opts.baseDir, d.markup)}`);
  }
  if (d.strict !== undefined && typeof d.strict !== "boolean") err("shape", "strict", "strict must be true or false");
  for (const k of ["nodes", "channels", "datums", "lanes", "sequences"]) if (!Array.isArray(d[k])) err("shape", k, `${k} must be an array`);
  if (out.some((f) => f.level === "error" && f.code === "shape")) return out;
  d = { zones: [], volumes: [], durations: {}, overlays: [], ...d };

  // ---- 1. names, uniqueness, references ---------------------------------------
  const dupes = (list, what) => { const seen = new Set(); for (const x of list) { if (!x || typeof x.name !== "string") { err("shape", what, "an entry has no name"); continue; } if (seen.has(x.name)) err("duplicate", `${what} ${x.name}`, "duplicate name"); seen.add(x.name); } return seen; };
  const nodes = dupes(d.nodes, "node"), chans = dupes(d.channels, "channel"), vols = dupes(d.volumes, "volume"), datums = dupes(d.datums, "datum"), lanes = dupes(d.lanes, "lane");
  const chanObj = new Map(d.channels.map((c) => [c.name, c]));
  dupes(d.sequences, "sequence");
  const durs = new Set(Object.keys(d.durations));
  const both = [...nodes].filter((n) => chans.has(n)); // reveal/acknowledge targets are looked up across kinds
  if (both.length) warn("ambiguous-name", both.join(", "), "a node and a channel share a name, so `reveal` and `acknowledge` targets are ambiguous");
  const targets = new Set([...nodes, ...chans]);
  const gestureNodes = new Set(d.nodes.filter((n) => n.gesture).map((n) => n.name));
  const assets = opts.assets ? new Set(opts.assets) : null;

  // A move, divergence or arrival names what it carries as `asset` (one) or `assets` (a composite of two
  // or more, travelling together as one crawler — core/ontology.md, Composite crawler). Exactly one.
  const carriedOf = (x, where) => {
    if ((x.asset !== undefined) === (x.assets !== undefined)) { err("shape", where, "needs exactly one of asset or assets"); return null; }
    if (x.asset !== undefined) return [x.asset];
    if (!Array.isArray(x.assets) || x.assets.length < 2) { err("shape", where, "assets must be an array of at least two asset names (a single one is `asset`)"); return null; }
    return x.assets;
  };
  const checkBox = (x, where, list) => {
    if (x.box === undefined) return;
    if (list && list.length < 2) err("shape", where, "box only applies to a composite crawler (assets)");
    else if (typeof x.box !== "boolean") err("shape", where, "box must be true or false");
  };
  const checkSpacing = (x, where, list) => {
    if (x.spacing === undefined) return;
    if (list && list.length < 2) err("shape", where, "spacing only applies to a composite crawler (assets)");
    else if (typeof x.spacing !== "number" || !Number.isFinite(x.spacing) || x.spacing < 0) err("shape", where, "spacing must be a non-negative number (diagram units between each shape's centre)");
  };

  for (const c of d.channels) {
    if (!nodes.has(c.a) || !nodes.has(c.b)) err("unresolved", `channel ${c.name}`, `endpoint ${!nodes.has(c.a) ? c.a : c.b} is not a node`);
    if (!Number.isFinite(c.duration) || c.duration <= 0) err("duration", `channel ${c.name}`, "duration must be a positive number of milliseconds");
    if (!["static", "hidden"].includes(c.visibility)) err("shape", `channel ${c.name}`, "visibility must be static or hidden");
  }
  for (const z of d.zones) {
    const m = isObj(z.members) ? z.members : { nodes: arr(z.members), volumes: [] };
    arr(m.nodes).forEach((n) => nodes.has(n) || err("unresolved", `zone ${z.name}`, `member ${n} is not a node`));
    arr(m.volumes).forEach((v) => vols.has(v) || err("unresolved", `zone ${z.name}`, `member ${v} is not a volume`));
    // a watermark's zone is expected to have no members (it's an attribution box, not a trust boundary)
    if (arr(m.nodes).length < 1 && d.watermark?.zone !== z.name) warn("zone", `zone ${z.name}`, "a zone with no member nodes");
    // a volume docked at a member node belongs in the zone (core/ontology.md), so check it is listed
    for (const v of d.volumes) if (arr(m.nodes).includes(v.consumer) && !arr(m.volumes).includes(v.name)) warn("zone", `zone ${z.name}`, `volume ${v.name} docks at member ${v.consumer} but is not a member of the zone`);
  }
  for (const v of d.volumes) nodes.has(v.consumer) || err("unresolved", `volume ${v.name}`, `consumer ${v.consumer} is not a node`);

  // durations: a number, or { link: 'channel:<name>' }
  for (const [k, v] of Object.entries(d.durations)) {
    if (typeof v === "number") { if (!(v >= 0)) err("duration", `duration ${k}`, "must be a non-negative number"); }
    else if (isObj(v) && typeof v.link === "string") { const m = /^channel:(.+)$/.exec(v.link); if (!m || !chans.has(m[1])) err("unresolved", `duration ${k}`, `link ${v.link} does not name a channel`); }
    else err("duration", `duration ${k}`, "must be a number or { link: 'channel:<name>' }");
  }
  const checkDur = (v, where) => {
    if (v === undefined) return;
    if (typeof v === "number") { if (!(v >= 0)) err("duration", where, "negative duration"); }
    else if (typeof v === "string" && v.startsWith("@")) { durs.has(v.slice(1)) || err("unresolved", where, `duration ${v} is not defined in durations`); }
    else err("duration", where, `bad duration ${JSON.stringify(v)}`);
  };
  const resolveDur = (v, chan) => (v === undefined ? `channel:${chan}` : typeof v === "string" ? v : `ms:${v}`);

  // ---- 2. datum conditions ----------------------------------------------------
  const dockNames = new Set(d.sequences.flatMap((s) => arr(s.rules).flatMap((r) => arr(r.do).filter((a) => a && a.dock && a.name).map((a) => a.name))));
  const walk = (c, where, fn) => { if (!c) return; if (c.all) arr(c.all).forEach((x) => walk(x, where, fn)); else if (c.any) arr(c.any).forEach((x) => walk(x, where, fn)); else fn(c); };
  const checkCond = (c, where) => walk(c, where, (x) => {
    const keys = Object.keys(x);
    if (x.datum !== undefined) datums.has(x.datum) || err("unresolved", where, `datum ${x.datum} is not defined`);
    else if (x.arrival) {
      chans.has(x.arrival.channel) || err("unresolved", where, `arrival channel ${x.arrival.channel} is not defined`);
      DIRECTIONS.includes(x.arrival.direction) || err("shape", where, `arrival direction must be forward or return`);
      const list = carriedOf(x.arrival, `${where} arrival`);
      if (list && assets) list.forEach((a) => assets.has(a) || err("unknown-asset", where, `asset ${a} is not in the iconography`));
    } else if (x.gesture !== undefined) gestureNodes.has(x.gesture) || err("unresolved", where, `gesture on ${x.gesture}, which is not a node with gesture: true`);
    else if (x.completed !== undefined) dockNames.has(x.completed) || err("unresolved", where, `completed ${x.completed} names no dock action`); // proposed F10
    else if (x.delay !== undefined) { if (!(x.delay >= 0)) err("duration", where, "delay must be a non-negative number"); } // proposed F3
    else if (x.start === true) { /* ok */ }
    else err("shape", where, `unknown condition ${JSON.stringify(keys)}`);
  });
  for (const x of d.datums) {
    checkCond(x.when, `datum ${x.name} when`);
    if (!x.when) err("shape", `datum ${x.name}`, "a datum needs a `when` condition");
    for (const t of arr(x.acknowledge?.targets)) targets.has(t) || err("unresolved", `datum ${x.name}`, `acknowledge target ${t} is not a node or channel`);
    if (x.acknowledge) checkDur(x.acknowledge.duration, `datum ${x.name} acknowledge`);
    if (x.narrate !== undefined && typeof x.narrate !== "string") err("shape", `datum ${x.name}`, "narrate must be a string");
  }

  // ---- 3. sequences, rules, actions -------------------------------------------
  const moves = [];        // { lane, phase, seq, channel, direction, assets, origin, destination, dur, trigger }
  const stores = [];       // { at, assets } — strict mode: core/descriptor.md section 3.2
  // A channel move's two ends, named by what a `forward`/`return` transition means for each (core/ontology.md).
  const endpoints = (chName, direction) => { const c = chanObj.get(chName); if (!c) return {}; return direction === "forward" ? { origin: c.a, destination: c.b } : { origin: c.b, destination: c.a }; };
  const arrivalRules = []; // { lane, seq, ... }
  const used = new Set();  // datums that something reacts to (derived consequences, proposed F15)
  const useCond = (c) => walk(c, "", (x) => { if (x.datum !== undefined) used.add(x.datum); });
  const gestureRules = []; // { seq, lane, phase, node }

  for (const s of d.sequences) {
    const here = `sequence ${s.name}`;
    const L = d.lanes.find((l) => l.name === s.lane);
    if (!L) { err("unresolved", here, `lane ${s.lane} is not defined`); continue; }
    if (!arr(L.phases).some((p) => p.name === s.phase)) err("unresolved", here, `phase ${s.phase} is not a phase of lane ${s.lane}`);
    if (!FIDELITY.includes(s.fidelity)) err("fidelity", here, `fidelity must be one of ${FIDELITY.join(", ")}`);
    else {
      if (s.fidelity !== "metaphor" && !s.source) err("fidelity", here, `${s.fidelity} needs a source`);
      if (s.fidelity === "adapted" && !s.adaptation) err("fidelity", here, "adapted needs an adaptation (why it differs)");
      if (s.fidelity === "metaphor" && !s.explains) err("fidelity", here, "metaphor needs explains (the concept it conveys)");
    }
    for (const k of ["source", "adaptation", "explains"]) if (typeof s[k] === "string" && /\bREPLACE\b/.test(s[k])) warn("placeholder", here, `${k} still holds a placeholder ("${s[k].slice(0, 40)}"): replace it with the real one`);
    if (!Array.isArray(s.rules) || !s.rules.length) { err("shape", here, "a sequence needs rules"); continue; }
    for (const [i, r] of s.rules.entries()) {
      const rw = `${here} rule ${i + 1}`;
      if (!isObj(r.on) || !Array.isArray(r.do)) { err("shape", rw, "a rule is { on, do: [...] }"); continue; }
      checkCond(r.on, `${rw} on`); checkCond(r.when, `${rw} when`); // rule-level guard: proposed F9
      useCond(r.on); useCond(r.when);
      if (r.on.arrival) arrivalRules.push({ lane: s.lane, seq: s.name, rule: rw, ...r.on.arrival });
      if (r.on.gesture !== undefined) gestureRules.push({ where: rw, lane: s.lane, phase: s.phase, node: r.on.gesture });
      // an arrival trigger fires only for moves in its own lane, so the same arrival in two lanes is two triggers
      const trigger = JSON.stringify(r.on) + (r.on.arrival ? "@" + s.lane : "") + (r.when ? "|" + JSON.stringify(r.when) : "");
      const each = (acts, inRepeat) => {
        for (const a of acts) {
          if (!isObj(a)) { err("shape", rw, "an action must be an object"); continue; }
          const kinds = Object.keys(a).filter((k) => !ACTION_MODIFIERS.includes(k));
          const kind = kinds.find((k) => ACTIONS.includes(k));
          if (!kind || kinds.length !== 1) { err("shape", rw, `unknown or ambiguous action ${JSON.stringify(Object.keys(a))}`); continue; }
          checkDur(a.after, `${rw} after`); if (typeof a.duration !== "undefined" && kind !== "move") checkDur(a.duration, `${rw} ${kind} duration`);
          const v = a[kind];
          if (kind === "move") {
            if (v.channel) {
              chans.has(v.channel) || err("unresolved", rw, `move channel ${v.channel} is not defined`);
              DIRECTIONS.includes(v.direction) || err("shape", rw, "move direction must be forward or return");
              checkDur(v.duration, `${rw} move`);
              const list = carriedOf(v, `${rw} move`);
              if (list) {
                if (assets) list.forEach((a) => assets.has(a) || err("unknown-asset", rw, `asset ${a} is not in the iconography`));
                checkBox(v, `${rw} move`, list);
                checkSpacing(v, `${rw} move`, list);
                moves.push({ lane: s.lane, phase: s.phase, seq: s.name, channel: v.channel, direction: v.direction, assets: list, ...endpoints(v.channel, v.direction), dur: resolveDur(v.duration, v.channel), trigger, inRepeat });
              }
            } else if (v.from && v.to) {
              nodes.has(v.from) && nodes.has(v.to) || err("unresolved", rw, "move from/to must be nodes");
              checkDur(v.duration, `${rw} move`);
              const list = carriedOf(v, `${rw} move`);
              if (list) {
                if (assets) list.forEach((a) => assets.has(a) || err("unknown-asset", rw, `asset ${a} is not in the iconography`));
                checkBox(v, `${rw} move`, list);
                checkSpacing(v, `${rw} move`, list);
                moves.push({ lane: s.lane, phase: s.phase, seq: s.name, channel: undefined, direction: undefined, assets: list, origin: v.from, destination: v.to, dur: resolveDur(v.duration, "none"), trigger, inRepeat });
              }
            }
            else err("shape", rw, "a move needs a channel, or from and to");
          } else if (kind === "reveal" || kind === "hide") {
            arr(v).forEach((n) => targets.has(n) || err("unresolved", rw, `${kind} ${n} is not a node or channel`));
            if (kind === "hide") checkDur(a.duration, `${rw} hide`);
          } else if (kind === "acknowledge") {
            arr(v.targets).forEach((n) => targets.has(n) || err("unresolved", rw, `acknowledge target ${n} is not a node or channel`)); checkDur(v.duration, `${rw} acknowledge`);
          } else if (kind === "hint") { gestureNodes.has(v.node) || err("unresolved", rw, `hint node ${v.node} is not a gesture node`); typeof v.text === "string" || err("shape", rw, "hint.text must be a string"); }
          else if (kind === "narrate") { typeof v === "string" || err("shape", rw, "narrate must be a static string"); }
          else if (kind === "repeat") { checkDur(v.every, `${rw} repeat`); each(arr(v.do), true); }
          else if (kind === "dock") { arr(v).forEach((n) => vols.has(n) || err("unresolved", rw, `dock ${n} is not a volume`)); checkDur(a.duration, `${rw} dock`); } // proposed F10
          else if (kind === "store") {
            // Strict mode (core/descriptor.md section 3.2): the one way a node comes to hold an asset that
            // didn't just arrive there over a channel — "created itself" or "received from a docked volume"
            // are both just a store fired by whatever rule states the reason (an arrival, a dock completing,
            // start, a gesture, a datum). No separate node or volume field: the reason is the rule it's in.
            nodes.has(v.at) || err("unresolved", rw, `store at ${v.at} is not a node`);
            const list = carriedOf(v, `${rw} store`);
            if (list) { if (assets) list.forEach((a) => assets.has(a) || err("unknown-asset", rw, `asset ${a} is not in the iconography`)); if (nodes.has(v.at)) stores.push({ at: v.at, assets: list }); }
          }
          else if (kind === "divergence") {
            const br = arr(v.branches);
            if (!nodes.has(v.origin)) err("unresolved", rw, `divergence origin ${v.origin} is not a node`);
            if (br.length < 2) err("divergence", rw, "a divergence needs at least two branches");
            const list = carriedOf(v, `${rw} divergence`);
            if (list) { if (assets) list.forEach((a) => assets.has(a) || err("unknown-asset", rw, `divergence asset ${a} is not in the iconography`)); checkBox(v, `${rw} divergence`, list); checkSpacing(v, `${rw} divergence`, list); }
            const seen = new Set();
            for (const b of br) {
              if (!chans.has(b.channel)) { err("unresolved", rw, `divergence branch channel ${b.channel} is not defined`); continue; }
              const key = b.channel + "/" + b.direction; if (seen.has(key)) err("divergence", rw, `branches must differ: ${key} appears twice`); seen.add(key);
              const ch = d.channels.find((c) => c.name === b.channel);
              const start = b.direction === "forward" ? ch.a : ch.b;
              if (start !== v.origin) err("divergence", rw, `branch ${key} starts at ${start}, not the declared origin ${v.origin}`);
              if (list) moves.push({ lane: s.lane, phase: s.phase, seq: s.name, channel: b.channel, direction: b.direction, assets: list, origin: v.origin, destination: endpoints(b.channel, b.direction).destination, dur: resolveDur(b.duration, b.channel), trigger, inRepeat, divergence: true });
            }
            if (v.sharedPrefix) warn("divergence", rw, "sharedPrefix is declared, and this validator does not check it: confirm every branch is in this rule's lane");
          }
        }
      };
      each(r.do, false);
    }
  }

  // ---- 4. lanes and phases ----------------------------------------------------
  const armed = new Set(); const armedBy = {};
  for (const l of d.lanes) {
    const lw = `lane ${l.name}`;
    if (typeof l.subject !== "string" || !l.subject.trim()) err("lane", lw, "a lane needs exactly one subject (a string)");
    if (!isObj(l.entry)) err("lane", lw, "a lane needs an entry trigger");
    else checkCond(l.entry, `${lw} entry`), useCond(l.entry);
    if (l.resetTrigger) checkCond(l.resetTrigger, `${lw} resetTrigger`);
    const ph = arr(l.phases); if (!ph.length) err("lane", lw, "a lane needs at least one phase");
    dupes(ph, `${lw} phase`);
    ph.forEach((p, i) => {
      const pw = `${lw} phase ${p.name}`, last = i === ph.length - 1;
      if (!TIMEBOX.includes(p.timebox)) err("lane", pw, `timebox must be one of ${TIMEBOX.join(", ")}`);
      if (p.timebox === "event-bounded" && !p.exit) err("lane", pw, "event-bounded needs an exit datum");
      if (p.timebox === "timed" && !p.duration && !p.exit) err("lane", pw, "timed needs a duration or an exit datum");
      if (p.timebox === "user-paced") { if (!arr(p.arms).length) err("lane", pw, "user-paced needs arms (gesture nodes)"); if (!p.exit && !last) err("lane", pw, "a user-paced phase that isn't last needs an exit datum"); }
      if (p.timebox === "open-ended" && !last) err("lane", pw, "an open-ended phase never ends, so it must be the lane's last phase");
      if (!last && !p.exit) err("lane", pw, "a phase that isn't last needs an exit datum, which is the next phase's entry");
      if (p.exit) { datums.has(p.exit) ? (!last && used.add(p.exit)) : err("unresolved", pw, `exit datum ${p.exit} is not defined`); }
      for (const n of arr(p.arms)) { gestureNodes.has(n) ? (armed.add(n), (armedBy[n] ||= new Set()).add(l.name + "/" + p.name)) : err("unresolved", pw, `arms ${n}, which is not a gesture node`); }
    });
  }
  for (const n of gestureNodes) armed.has(n) || err("gesture", `node ${n}`, "a gesture node that no phase arms can never be clicked");
  for (const g of gestureRules) { if (!armedBy[g.node]?.has(g.lane + "/" + g.phase)) err("gesture", g.where, `fires on a click of ${g.node}, but phase ${g.lane}/${g.phase} does not arm it`); }

  // ---- 5. arrival triggers are fed, in the same lane -------------------------
  // best-effort extraction with no side effects: carriedOf already reported a shape error, if any, above
  const rawCarried = (x) => (x ? (Array.isArray(x.assets) ? x.assets : x.asset !== undefined ? [x.asset] : null) : null);
  const listEq = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
  for (const a of arrivalRules) { const list = rawCarried(a); if (list && !moves.some((m) => m.lane === a.lane && m.channel === a.channel && m.direction === a.direction && listEq(m.assets, list)))
    err("dead-trigger", a.rule, `waits for ${list.join(" + ")} on ${a.channel}/${a.direction}, but no move in lane ${a.lane} sends it`); }
  for (const x of d.datums) walk(x.when, "", (c) => { if (c.arrival) { const list = rawCarried(c.arrival); if (list && !moves.some((m) => m.channel === c.arrival.channel && m.direction === c.arrival.direction && listEq(m.assets, list))) err("dead-trigger", `datum ${x.name}`, `waits for ${list.join(" + ")} on ${c.arrival.channel}/${c.arrival.direction}, which no move sends`); } });

  // ---- 6. datum consequences and terminals -----------------------------------
  for (const x of d.datums) walk(x.when, "", () => {}), useCond(x.when);
  for (const x of d.datums) {
    if (x.terminal && used.has(x.name)) err("terminal", `datum ${x.name}`, "is marked terminal, but something reacts to it");
    else if (!x.terminal && !used.has(x.name)) esc("terminal", `datum ${x.name}`, `"${x.label || x.name}" leads to nothing and isn't marked terminal: is it the end of that flow, or is a step missing after it?`);
  }
  // datums a guard depends on must be satisfiable: a `when` that names a datum nothing can ever satisfy is caught by the arrival check above

  // ---- 7. shared channels (ontology rule 6) ----------------------------------
  const byChan = {}; moves.forEach((m) => (byChan[m.channel] ||= []).push(m));
  const conflicts = {};
  for (const [c, ms] of Object.entries(byChan)) {
    const perLP = {}; ms.forEach((m) => (perLP[m.lane + "/" + m.phase] ||= new Set()).add(m.seq));
    for (const [lp, seqs] of Object.entries(perLP)) if (seqs.size > 1) err("shared-channel", `channel ${c}`, `sequences ${[...seqs].join(", ")} share it within lane/phase ${lp}: restructure so each channel belongs to one sequence there`);
    const byLane = {}; ms.forEach((m) => (byLane[m.lane] ||= new Set()).add(JSON.stringify(m.assets)));
    const ls = Object.keys(byLane), pairs = [];
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) for (const a1 of byLane[ls[i]]) for (const a2 of byLane[ls[j]]) if (a1 !== a2) pairs.push(`${JSON.parse(a1).join(" + ")} (${ls[i]}) vs ${JSON.parse(a2).join(" + ")} (${ls[j]})`);
    if (ls.length > 1) conflicts[c] = { lanes: ls, pairs };
  }
  for (const [c, info] of Object.entries(conflicts)) {
    if (!info.pairs.length) continue; // identical assets only: exempt
    const o = d.overlays.find((x) => x.channel === c);
    if (!o) esc("overlay", `channel ${c}`, `${info.pairs.length} different-asset pairs from lanes ${info.lanes.join(", ")} can coincide (e.g. ${info.pairs[0]}). Which is drawn on top, or can they never coincide?`);
    else if (o.precedence === "unresolved") esc("overlay", `channel ${c}`, `overlay precedence is still unresolved (${info.pairs.length} conflicting pairs, e.g. ${info.pairs[0]})`);
  }
  for (const o of d.overlays) {
    const w = `overlay ${o.channel}`;
    if (!chans.has(o.channel)) { err("unresolved", w, "not a channel"); continue; }
    const info = conflicts[o.channel];
    if (!info || !info.pairs.length) { err("overlay", w, "has no conflicting assets from different lanes: remove the entry"); continue; }
    if (o.precedence !== "unresolved") {
      if (!Array.isArray(o.precedence)) err("overlay", w, "precedence must be a list of lane names or 'unresolved'");
      else { o.precedence.forEach((l) => lanes.has(l) || err("unresolved", w, `precedence lane ${l} is not defined`)); if (info.lanes.some((l) => !o.precedence.includes(l))) err("overlay", w, `precedence must rank every lane that uses the channel (${info.lanes.join(", ")})`); }
    }
    if (JSON.stringify([...arr(o.lanes)].sort()) !== JSON.stringify([...info.lanes].sort())) err("overlay", w, `lanes ${JSON.stringify(o.lanes)} differ from the lanes that use the channel (${info.lanes.join(", ")}): the entry is stale`);
  }
  const unresolved = d.overlays.some((o) => o.precedence === "unresolved");
  if (unresolved && d.draft !== true) err("draft", "draft", "an overlay is unresolved, so the descriptor must be marked draft: true");
  if (d.draft === true && !unresolved) warn("draft", "draft", "marked draft: true but no overlay is unresolved: is anything else still open?");

  // ---- 8. identical assets that start together at the same channel startpoint (ontology rule 8) ---
  // A channel startpoint is measured from the markup: a forward move starts at the first point of the
  // channel's path, a return move at its last. Assumes the path runs from the channel's `a` to its `b`.
  const pathPoints = (name) => {
    const ch = d.channels.find((c) => c.name === name);
    if (!ch || !ch.element || opts.markup === undefined) return null;
    const tag = new RegExp(`<[a-z]+\\b[^>]*\\bid="${`${ch.element}-${d.diagramLabel}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`).exec(opts.markup);
    const dd = tag && /\sd="([^"]*)"/.exec(tag[0]);
    const n = dd && dd[1].match(/-?\d+(?:\.\d+)?/g);
    return n && n.length >= 4 ? { first: `${+n[0]},${+n[1]}`, last: `${+n[n.length - 2]},${+n[n.length - 1]}` } : null;
  };
  const startpoint = (channel, direction) => {
    const o = opts.startpoints?.[channel]?.[direction]; if (o !== undefined) return o;
    const p = pathPoints(channel); return p ? (direction === "forward" ? p.first : p.last) : null;
  };
  const byTrigger = {}; moves.forEach((m) => (byTrigger[m.trigger] ||= []).push(m));
  let startpointsUnknown = false;
  for (const ms of Object.values(byTrigger)) {
    const byAsset = {}; ms.forEach((m) => (byAsset[JSON.stringify(m.assets)] ||= []).push(m));
    for (const [key, group] of Object.entries(byAsset)) {
      const label = JSON.parse(key).join(" + ");
      const paths = [...new Map(group.map((m) => [m.channel + "/" + m.direction, m])).values()];
      if (paths.length < 2) continue;
      const seqs = [...new Set(group.map((m) => m.seq))].join(", ");
      const byPoint = {};
      for (const m of paths) { const p = startpoint(m.channel, m.direction); if (p === null) { startpointsUnknown = true; continue; } (byPoint[p] ||= []).push(m); }
      for (const [p, same] of Object.entries(byPoint)) {
        if (same.length > 1 && !same.every((m) => m.divergence)) err("undeclared-divergence", `${label} from ${seqs}`, `${label} starts together at ${p} on ${same.map((m) => m.channel + "/" + m.direction).join(" and ")} without a divergence action: declare one, or start them from different triggers`);
      }
      // a declared divergence must have ONE startpoint
      if (group.every((m) => m.divergence) && Object.keys(byPoint).length > 1) err("divergence", `${label} from ${seqs}`, `a declared divergence's branches start at different points (${Object.keys(byPoint).join(" and ")}): that is two rules on one trigger, not a divergence`);
    }
  }
  if (startpointsUnknown) warn("startpoint-unknown", "divergence check", "identical assets start together on different channels, but their startpoints can't be read (give the descriptor a `markup`, or pass --markup, and give each channel an `element`): the divergence check was skipped for them");

  // ---- 9. convergence: sequences meant to finish together use one named duration
  for (const [trig, ms] of Object.entries(byTrigger)) {
    const lanesHere = [...new Set(ms.map((m) => m.lane))];
    if (lanesHere.length < 2 || !JSON.parse(trig.split("|")[0].split("@")[0]).datum) continue;
    const specs = new Set(ms.filter((m) => !m.inRepeat).map((m) => m.dur));
    if (specs.size > 1) warn("convergence", `moves started by ${trig.split("|")[0]}`, `lanes ${lanesHere.join(", ")} start moves together with different durations (${[...specs].join(", ")}). If they are meant to finish together, give every leg one named duration (core/timing.md section 4)`);
  }

  // ---- 9b. interaction mode (ontology rules 17 to 19) ---------------------------
  if (d.modes !== undefined) {
    const m = d.modes, w = "modes";
    if (!isObj(m)) err("modes", w, "modes must be an object");
    else {
      for (const k of Object.keys(m)) if (!["default", "toggle", "simulated"].includes(k)) warn("unknown-key", w, `unknown key modes.${k}`);
      if (!["user-driven", "automated"].includes(m.default)) err("modes", w, "default must be 'user-driven' or 'automated'");
      if (m.toggle !== undefined && typeof m.toggle !== "boolean") err("modes", w, "toggle must be true or false");
      const s2 = m.simulated;
      if (s2 !== undefined) {
        if (!isObj(s2)) err("modes", w, "simulated must be an object");
        else {
          if (!(s2.delay >= 0)) err("modes", w, "simulated.delay must be a non-negative number of milliseconds");
          const a = s2.acknowledge;
          if (!isObj(a) || typeof a.color !== "string" || !a.color || !(a.duration > 0)) err("modes", w, "simulated.acknowledge needs a color (a string) and a positive duration");
        }
      }
      // the mode can be automated when it is the default or the viewer can switch to it
      if ((m.default === "automated" || m.toggle === true) && gestureNodes.size && s2 === undefined) err("modes", w, "the mode can be automated but the simulated-gesture acknowledgement (modes.simulated) is not declared: rule 18 requires a visible press");
      if (m.toggle === true && !gestureNodes.size) warn("modes", w, "a mode toggle with no gesture node has nothing to switch");
    }
  }

  // ---- 9c. local shape storage (core/ontology.md "Local storage"; core/descriptor.md section 3.2) -------
  // Tracking is always on, independent of `strict`: `store` actions and channel arrivals build up each
  // node's local storage regardless, because the interpreter can display it (a node's `showLocalStorage`)
  // whether or not anything enforces it. `strict: true` is only whether an unstored send is an ERROR.
  //
  // The check itself is a purely structural, non-temporal one: does SOME rule ever give this node this
  // asset, anywhere in the descriptor — not whether it happens before this particular send in every run.
  // That's what makes it a local shape check rather than a full dataflow analysis: no execution order is
  // simulated, and storage only ever grows (nothing is spent or removed on send).
  const holds = {}; // node name -> Set of asset names it can ever hold
  const give = (node, list) => { if (!node || !list) return; (holds[node] ||= new Set()); list.forEach((a) => holds[node].add(a)); };
  for (const st of stores) give(st.at, st.assets);
  for (const m of moves) give(m.destination, m.assets);
  if (d.strict === true) {
    for (const m of moves) {
      const have = holds[m.origin];
      for (const a of m.assets) if (!have || !have.has(a))
        err("strict", `${m.seq} (${m.channel ? `${m.channel}/${m.direction}` : `from ${m.origin}`})`,
          `${m.origin} sends ${a}, but nothing gives it to ${m.origin} anywhere in the descriptor (no arrival ending there, and no store): add a store at '${m.origin}', or a move that delivers it there first`);
    }
  }

  // `showLocalStorage` (optional, per node): the interpreter displays that node's held assets as small
  // icons, overlaid on the node's own box or in an adjacent bounding box. Independent of `strict`.
  for (const n of d.nodes) {
    if (n.showLocalStorage === undefined) continue;
    const s = n.showLocalStorage, w = `node ${n.name} showLocalStorage`;
    if (!isObj(s)) { err("shape", w, "showLocalStorage must be an object, { position, offset? }"); continue; }
    if (!["overlay", "adjacent"].includes(s.position)) err("shape", w, "position must be 'overlay' or 'adjacent'");
    if (s.position === "overlay" && s.offset !== undefined) err("shape", w, "offset only applies to 'adjacent' (an overlay is centred on the node's own box)");
    if (s.position === "adjacent" && (!isObj(s.offset) || typeof s.offset.x !== "number" || typeof s.offset.y !== "number")) err("shape", w, "adjacent needs an offset: { x, y }");
  }

  // ---- 9e. watermark (optional): attribution to the skill and the developer ---------------------
  // Its position and size are a zone (with no members), reused rather than a new geometry-holding field —
  // geometry stays in the SVG either way. Content and timing are the watermark's own.
  if (d.watermark !== undefined) {
    const w = d.watermark, ww = "watermark";
    if (!isObj(w)) err("shape", ww, "watermark must be an object");
    else {
      for (const k of Object.keys(w)) if (!["zone", "repo", "author", "website", "fade"].includes(k)) warn("unknown-key", ww, `unknown key watermark.${k}`);
      const z = d.zones.find((x) => x.name === w.zone);
      if (typeof w.zone !== "string" || !w.zone) err("shape", ww, "watermark.zone is required: the name of the zone to use as its box");
      else if (!z) err("unresolved", ww, `zone ${w.zone} is not defined`);
      else { const m = isObj(z.members) ? z.members : { nodes: arr(z.members), volumes: [] }; if (arr(m.nodes).length || arr(m.volumes).length) err("shape", ww, `zone ${w.zone} has members: a watermark's zone must have none (it's an attribution box, not a trust boundary)`); }
      if (w.repo !== undefined && typeof w.repo !== "boolean") err("shape", ww, "repo must be true or false");
      if (w.author !== undefined && (typeof w.author !== "string" || !w.author.trim())) err("shape", ww, "author must be a non-empty string");
      if (w.website !== undefined) {
        if (typeof w.website !== "string" || !w.website.trim()) err("shape", ww, "website must be a non-empty string");
        else if (!/^https?:\/\//.test(w.website)) warn("shape", ww, `website "${w.website}" doesn't start with http:// or https://: is that intended?`);
      }
      if (w.fade !== undefined && w.fade !== false && !(typeof w.fade === "number" && w.fade > 0)) err("shape", ww, "fade must be false (permanent) or a positive number of seconds");
    }
  }

  // ---- 10. markup (optional) --------------------------------------------------
  if (opts.markup !== undefined) {
    const ids = (e) => `${e.element}-${d.diagramLabel}`;
    for (const [kind, list] of [["node", d.nodes], ["channel", d.channels], ["zone", d.zones], ["volume", d.volumes]]) for (const e of list) {
      if (!e.element) { warn("markup", `${kind} ${e.name}`, "has no `element` (the id without -<diagram-label>): cannot be checked"); continue; } // proposed F1
      if (!opts.markup.includes(`id="${ids(e)}"`)) err("markup", `${kind} ${e.name}`, `no element id="${ids(e)}" in the markup`);
    }
    for (const c of d.channels) if (c.label?.element && !opts.markup.includes(`id="${c.label.element}-${d.diagramLabel}"`)) err("markup", `channel ${c.name}`, `no label element id="${c.label.element}-${d.diagramLabel}"`);
  }
  return out;
}

// ---- CLI -----------------------------------------------------------------------
function readAssets(file) {
  const t = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) { const j = JSON.parse(t); return Array.isArray(j) ? j : Object.keys(j); }
  return [...t.matchAll(/^  (\w+): \{ shape:/gm)].map((m) => m[1]); // the ICONOGRAPHY object in diagram-shared.js
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i < 0 ? undefined : args.splice(i, 2)[1]; };
  const json = args.includes("--json"); if (json) args.splice(args.indexOf("--json"), 1);
  const markupOverride = flag("--markup"), assetsFile = flag("--assets"), file = args[0];
  if (!file) { console.error("usage: validate.mjs <descriptor.animation.js> [--markup diagram.html] [--assets iconography.js|.json] [--json]"); process.exit(64); }
  const d = (await import(pathToFileURL(path.resolve(file)).href)).default;
  const baseDir = path.dirname(path.resolve(file));
  const markupFile = markupOverride ?? (typeof d.markup === "string" && !path.isAbsolute(d.markup) ? path.resolve(baseDir, d.markup) : undefined);
  const found = validate(d, { baseDir, markup: markupFile && fs.existsSync(markupFile) ? fs.readFileSync(markupFile, "utf8") : undefined, assets: assetsFile && readAssets(assetsFile) });
  if (json) console.log(JSON.stringify(found, null, 2));
  else {
    for (const level of ["error", "escalation", "warning"]) {
      const fs_ = found.filter((f) => f.level === level); if (!fs_.length) continue;
      console.log(`\n${level.toUpperCase()} (${fs_.length})`);
      for (const f of fs_) console.log(`  [${f.code}] ${f.where}: ${f.message}`);
    }
    const n = (l) => found.filter((f) => f.level === l).length;
    console.log(`\n${n("error")} errors, ${n("escalation")} escalations, ${n("warning")} warnings`);
  }
  process.exit(found.some((f) => f.level === "error") ? 1 : found.some((f) => f.level === "escalation") ? 2 : 0);
}
