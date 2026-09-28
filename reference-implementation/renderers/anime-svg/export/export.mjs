#!/usr/bin/env node
// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Exports an animated diagram to a delivery target (core/delivery-targets.md).
//
//   node export.mjs --descriptor <file.animation.js> --profile <target.js> --out <file.html> \
//                   [--css <shared.css> --helpers <diagram-shared.js> --anime <anime.es.js> | --app <repo>] \
//                   [--markup <file>] [--allow-open] [--check]
//
// Input: the descriptor, which names its own diagram markup (`markup`) and id suffix (`diagramLabel`); the app's
// stylesheet, shared helpers and anime.js; the interpreter; and a TARGET PROFILE (a data-only module: see
// profiles/). `--app <repo>` supplies the example project's layout for the last three of the app's files;
// each can be given on its own instead. Output: ONE self-contained file that runs the diagram with the
// interpreter. It contains the diagram markup, the diagram's CSS from the app, any presentation
// overrides the profile sets, and one script with anime.js (or its CDN import), the app's shared
// helpers, the interpreter and the descriptor.
//
// An export changes presentation only (ontology rules 11 to 14): the sequences, datums, lanes, fidelity
// tags and timing come from the descriptor unchanged. Every presentation difference is a named
// parameter from the fixed surface in surface.mjs, with a reason, so nothing is a hand-patched string.
//
// --allow-open   proceed when the descriptor still has open escalations (a draft). Errors always stop.
// --check        don't write: compare what would be generated with the existing --out file and exit 1
//                if it differs (a stale export).
// Exit codes: 0 ok, 1 errors (or a stale export), 2 open escalations, 64 usage.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractDiagram, resolveInputs, UsageError } from "../lib.mjs";
import { validate } from "../../../core/validator/validate.mjs";
import { checkMarkup, checkStylesheet, checkHelpers } from "../markup/check.mjs";
import { SURFACE, BEHAVIOR_KEYS } from "./surface.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SLOTS = ["header", "style", "diagram", "script", "asset-url"];
const REQUIRED_SLOTS = ["style", "diagram", "script"];
const PROFILE_KEYS = ["target", "description", "packaging", "template", "assets", "gestures", "behavior", "presentation", "reasons", "unverified"];

export class ExportError extends Error {
  constructor(errors, escalations = []) {
    super([...errors, ...escalations].join("\n"));
    this.errors = errors;
    this.escalations = escalations;
  }
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

// ---- CSS ---------------------------------------------------------------------------------------
// Splits a stylesheet into its top-level rules (an at-rule is one rule). Comments are dropped.
export function splitRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let depth = 0, start = 0, quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth < 0) throw new Error("the stylesheet has an unmatched }");
      if (depth === 0) { rules.push(src.slice(start, i + 1).trim()); start = i + 1; }
    }
  }
  if (depth !== 0) throw new Error("the stylesheet has an unclosed {");
  if (src.slice(start).trim()) throw new Error(`the stylesheet has text outside a rule: ${src.slice(start).trim().slice(0, 40)}`);
  return rules;
}

// The rules the diagram needs: those with a selector on a `.diagram…` class, a `#diagram-…` / `#dg-…`
// id, or an attribute selector on such an id (`[id^="dg-vol-"]`). An id selector belongs to one diagram, so it is kept only for this one. A rule listing several selectors
// keeps only the ones that apply. (A selector list split on commas won't survive `:is(a, b)`.)
const DIAGRAM = /\.diagram|#diagram-|#dg-|\.dg-|\[id[\^$*~|]?=["']?(?:diagram|dg)-/;
const LAB_ID = /#(?:diagram|dg)-/;
export function diagramCss(css, label) {
  const out = [];
  for (const rule of splitRules(css)) {
    const brace = rule.indexOf("{");
    const head = rule.slice(0, brace).trim(), body = rule.slice(brace);
    if (head.startsWith("@")) { if (DIAGRAM.test(rule)) out.push(rule); continue; }
    const mine = head.split(",").map((s) => s.trim()).filter((s) => DIAGRAM.test(s) && (!LAB_ID.test(s) || s.includes(label)));
    if (mine.length) out.push(`${mine.join(",\n")} ${body}`);
  }
  return out.join("\n");
}

// The CSS a profile's presentation parameters and `replay: false` produce: each parameter is a custom
// property on the diagram root, and the rules it drives read it. Only parameters the profile sets appear.
export function presentationCss(label, presentation = {}, behavior = {}) {
  const root = `#diagram-${label}`, names = Object.keys(presentation), lines = [];
  if (names.length) {
    lines.push(`${root} {`, ...names.map((n) => `  --${n}: ${presentation[n]};`), "}");
    for (const n of names) for (const r of SURFACE[n].rules) lines.push(`${root}${r.sel} { ${r.prop}: ${r.constant ?? `var(--${n})`}${r.important ? " !important" : ""}; }`);
  }
  if (behavior.replay === false) lines.push(`${root} .diagram-footer .diagram-replay { display: none; }`);
  return lines.join("\n");
}

// ---- script ------------------------------------------------------------------------------------
const IMPORT_LINE = /^import\s.+\sfrom\s+['"][^'"]+['"];?[ \t]*$/;
// Turns an ES module into plain statements: removes single-line imports and the `export` keyword, and
// returns the exported names. Any other import/export form is an error, not a guess.
export function stripModule(src, what) {
  const names = [];
  const lines = src.split("\n").map((line) => {
    if (/^import\b/.test(line)) { if (IMPORT_LINE.test(line)) return ""; throw new Error(`${what}: unsupported import (only single-line \`import x from '…'\`): ${line.slice(0, 60)}`); }
    const m = /^export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (m) { names.push(m[2]); return line.replace(/^export\s+/, ""); }
    if (/^export\b/.test(line)) throw new Error(`${what}: unsupported export: ${line.slice(0, 60)}`);
    return line;
  });
  return { code: lines.join("\n"), names };
}
// anime.js is one module ending in `export default anime;`
export function animeBody(src) {
  const re = /^export default anime;[ \t]*$/gm;
  if ((src.match(re) || []).length !== 1) throw new Error("anime.es.js: expected exactly one `export default anime;`");
  const out = src.replace(re, "return anime;");
  if (/^(import|export)\b/m.test(out)) throw new Error("anime.es.js: unexpected import or export");
  return out;
}
const safeInline = (text, what) => {
  if (/<\/script/i.test(text) || /<!--/.test(text)) throw new Error(`${what} contains "</script" or "<!--" and can't be inlined in a <script>`);
  return text;
};
// Compact JSON for a <script>: `<` is escaped so no string can close the tag, and the two line separators too.
export const jsonForScript = (v) => JSON.stringify(v).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");

export function assembleScript({ assets, animeUrl, animeSrc, sharedJs, interpreterSrc, descriptor }) {
  const shared = stripModule(sharedJs, "diagram-shared.js");
  const interp = stripModule(interpreterSrc, "interpreter.js");
  if (!interp.names.includes("createInterpreter")) throw new Error("interpreter.js does not export createInterpreter");
  const parts = [];
  if (assets.anime === "cdn") parts.push(`import anime from ${JSON.stringify(animeUrl)};`);
  else parts.push(`const anime = (function () {\n${safeInline(animeBody(animeSrc), "anime.es.js")}\n})();`);
  parts.push(`const shared = (function () {\n${safeInline(shared.code, "diagram-shared.js")}\nreturn { ${shared.names.join(", ")} };\n})();`);
  parts.push(`const { createInterpreter } = (function () {\n${safeInline(interp.code, "interpreter.js")}\nreturn { createInterpreter };\n})();`);
  parts.push(`const descriptor = ${jsonForScript(descriptor)};`);
  parts.push(`createInterpreter(descriptor, { anime, ...shared }).start();`);
  return parts.join("\n\n");
}

// ---- template ----------------------------------------------------------------------------------
// Slots are filled in one pass over the TEMPLATE, so an inserted value is never re-read as a slot.
export function fillTemplate(template, slots) {
  const seen = new Set();
  const out = template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!SLOTS.includes(name)) throw new Error(`the template has an unknown slot {{${name}}} (slots: ${SLOTS.join(", ")})`);
    seen.add(name);
    return slots[name] ?? "";
  });
  for (const r of REQUIRED_SLOTS) if (!seen.has(r)) throw new Error(`the template has no {{${r}}} slot`);
  return out;
}

// ---- profile -----------------------------------------------------------------------------------
export function applyBehavior(descriptor, behavior = {}) {
  const d = structuredClone(descriptor);
  if (behavior.pace !== undefined) d.pace = behavior.pace; // the profile's pace replaces the descriptor's
  if (behavior.mode !== undefined || behavior.toggle !== undefined) {
    d.modes = { ...(d.modes ?? {}), default: behavior.mode ?? d.modes?.default ?? "user-driven", toggle: behavior.toggle ?? d.modes?.toggle ?? false };
  }
  return d;
}

// Checks a profile against the descriptor and the exported parts. Returns { errors, escalations }.
export function checkProfile(profile, descriptor, defined) {
  const errors = [], escalations = [];
  const err = (m) => errors.push(`profile: ${m}`);
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { errors: ["profile: not an object"], escalations };
  try { if (JSON.stringify(JSON.parse(JSON.stringify(profile))) !== JSON.stringify(profile)) err("must be data only"); } catch { err("must be data only"); }
  for (const k of Object.keys(profile)) if (!PROFILE_KEYS.includes(k)) err(`unknown key "${k}"`);
  if (typeof profile.target !== "string" || !profile.target) err("target (a name) is required");
  if (!["fragment", "page"].includes(profile.packaging)) err("packaging must be 'fragment' or 'page'");
  if (!["cdn", "inline"].includes(profile.assets?.anime)) err("assets.anime must be 'cdn' or 'inline'");
  if (!["live", "none"].includes(profile.gestures)) err("gestures must be 'live' (the target can take clicks) or 'none'");
  if (profile.unverified !== undefined && !(Array.isArray(profile.unverified) && profile.unverified.every((s) => typeof s === "string"))) err("unverified must be a list of strings");

  const b = profile.behavior ?? {};
  for (const k of Object.keys(b)) if (!BEHAVIOR_KEYS.includes(k)) err(`unknown behavior parameter "${k}" (allowed: ${BEHAVIOR_KEYS.join(", ")})`);
  if (b.mode !== undefined && !["user-driven", "automated"].includes(b.mode)) err("behavior.mode must be 'user-driven' or 'automated'");
  for (const k of ["toggle", "replay"]) if (b[k] !== undefined && typeof b[k] !== "boolean") err(`behavior.${k} must be true or false`);
  if (b.pace !== undefined && !(typeof b.pace === "number" && Number.isFinite(b.pace) && b.pace > 0)) err("behavior.pace must be a positive number (1 is the authored speed, 2 is twice as slow, 0.5 twice as fast)");

  const p = profile.presentation ?? {}, reasons = profile.reasons ?? {};
  for (const [n, v] of Object.entries(p)) {
    if (!SURFACE[n]) { err(`unknown presentation parameter "${n}" (allowed: ${Object.keys(SURFACE).join(", ")})`); continue; }
    if (typeof v !== "string" || !v.trim() || /[;{}<>]|\/\*|!\s*important/.test(v)) err(`presentation.${n} must be a plain CSS value (no ; { } < > comments or !important)`);
    if (typeof reasons[n] !== "string" || !reasons[n].trim()) err(`presentation.${n} needs a reason in reasons.${n} (ontology rule 12)`);
    if (!defined.includes(SURFACE[n].mustExist)) err(`presentation.${n} controls "${SURFACE[n].mustExist}", which the exported diagram does not contain`);
  }
  for (const n of Object.keys(reasons)) if (!(n in p)) err(`reasons.${n} has no matching presentation parameter`);

  // gestures (ontology rules 13 and 17 to 19)
  const gestureNodes = (descriptor.nodes ?? []).filter((n) => n.gesture);
  const eff = applyBehavior(descriptor, b).modes;
  if (gestureNodes.length && profile.gestures === "none" && !(b.mode === "automated" && b.toggle === false)) {
    escalations.push(`escalation: the target can't take clicks, but the descriptor has gesture nodes (${gestureNodes.map((n) => n.name).join(", ")}). Set behavior { mode: 'automated', toggle: false } to press them for the viewer with a visible press, or decide to drop the phase or show a still frame (not implemented here).`);
  }
  if (gestureNodes.length && (eff?.default === "automated" || eff?.toggle === true) && !eff?.simulated) err("automated mode needs the descriptor's modes.simulated (a visible press, ontology rule 18)");
  return { errors, escalations };
}

// ---- output ------------------------------------------------------------------------------------
// `script` is the assembled script on its own, so a template that puts `<script>` on the same line as
// `{{script}}` can't hide an import from the line-start checks.
export function checkOutput(html, { label, assets, presentation = {}, script }) {
  const errors = [], bad = (m) => errors.push(`output: ${m}`);
  if ((html.match(/\{\{\s*(?:header|style|diagram|script|asset-url)\s*\}\}/g) || []).length) bad("an unfilled slot is left");
  if (/^import\b[^\n]*from\s+['"]\/(?:vendor|diagram-shared)/m.test(script)) bad("an app-relative import is left (the export must be self-contained)");
  const imports = (script.match(/^import\b/gm) || []).length;
  if (imports !== (assets.anime === "cdn" ? 1 : 0)) bad(`expected ${assets.anime === "cdn" ? 1 : 0} import line(s), found ${imports}`);
  if (/^export\b/m.test(script)) bad("an `export` statement is left");
  if ((html.match(new RegExp(`id="diagram-${label}"`, "g")) || []).length !== 1) bad(`the diagram root id="diagram-${label}" should occur exactly once`);
  for (const [n, v] of Object.entries(presentation)) if (!html.includes(`--${n}: ${v};`)) bad(`the parameter --${n} is missing`);
  return errors;
}

// Builds the export from file contents. Pure: no file access. Unless skipValidate, the descriptor is
// validated and the markup, stylesheet and helpers are checked against the markup contract; `findings`
// holds the warnings. `markup` is the text of the file holding the
// diagram (a whole page or just the diagram): the `<div class="diagram">` block is taken from it. Throws ExportError on errors, or on open
// escalations unless allowOpen. Returns { html, findings, notes }.
export function buildExport(input, { allowOpen = false, skipValidate = false } = {}) {
  const { markup, sharedCss, sharedJs, animeSrc, animeVersion, interpreterSrc, profile, templates } = input;
  const label = input.descriptor.diagramLabel; // the diagram's id suffix: it comes from the descriptor, never from a flag
  if (typeof label !== "string" || !label) throw new ExportError(["descriptor: `diagramLabel` (the diagram's id suffix) is required"]);
  const diagram = extractDiagram(markup);
  const css = diagramCss(sharedCss, label);
  const defined = `${diagram}\n${css}\n${interpreterSrc}`;
  const { errors, escalations } = checkProfile(profile, input.descriptor, defined);
  const behavior = profile.behavior ?? {};
  const descriptor = applyBehavior(input.descriptor, behavior);
  let findings = [];
  if (!skipValidate) {
    findings = validate(descriptor, { markup });
    for (const f of findings) {
      if (f.level === "error") errors.push(`descriptor [${f.code}] ${f.where}: ${f.message}`);
      else if (f.level === "escalation" && !allowOpen) escalations.push(`escalation [${f.code}] ${f.where}: ${f.message}`);
    }
    // the markup contract (renderers/anime-svg/markup-contract.md): the diagram file, the stylesheet and the helpers
    const contract = [...checkMarkup(descriptor, markup), ...checkStylesheet(sharedCss, descriptor), ...checkHelpers(sharedJs)];
    for (const f of contract) {
      if (f.level === "error") errors.push(`markup [${f.code}] ${f.where}: ${f.message}`);
      else findings.push(f);
    }
  }
  if (errors.length || escalations.length) throw new ExportError(errors, escalations);

  const animeUrl = profile.assets.animeUrl ?? (animeVersion ? `https://cdn.jsdelivr.net/npm/animejs@${animeVersion}/lib/anime.es.js` : null);
  if (profile.assets.anime === "cdn" && !animeUrl) throw new ExportError(["assets.anime is 'cdn' but there is no assets.animeUrl and the app's anime.js version is unknown"]);
  // `markup` is a build-time pointer to a local file: it stays out of the exported file.
  const embedded = structuredClone(descriptor);
  delete embedded.markup;
  const script = assembleScript({ assets: profile.assets, animeUrl, animeSrc, sharedJs, interpreterSrc, descriptor: embedded });
  const presentation = profile.presentation ?? {};
  // The app's stylesheet sets `box-sizing: border-box` on everything, and the diagram's layout (its width
  // and padding) depends on it. A host page may not, so it is scoped to the diagram in every export.
  const base = `#diagram-${label}, #diagram-${label} * { box-sizing: border-box; }`;
  const style = [base, css, presentationCss(label, presentation, behavior)].filter(Boolean).join("\n\n");
  const template = templates[profile.template ?? profile.packaging];
  if (template === undefined) throw new ExportError([`no template "${profile.template ?? profile.packaging}"`]);

  const sources = { descriptor: sha(JSON.stringify(embedded)), markup: sha(markup), "shared.css": sha(sharedCss), "diagram-shared.js": sha(sharedJs), interpreter: sha(interpreterSrc), profile: sha(JSON.stringify(profile)) };
  const header = [
    "diagram-animation export. Generated: change the sources or the profile and regenerate, never this file.",
    `target: ${profile.target} | diagram: ${label} | packaging: ${profile.packaging} | anime.js: ${profile.assets.anime}`,
    `sources (sha256, first 12): ${Object.entries(sources).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `presentation set: ${Object.keys(presentation).join(", ") || "none"} | behavior: ${JSON.stringify(behavior)}`,
  ].join("\n").replace(/--/g, "- -");
  const html = fillTemplate(template, { header, style, diagram, script, "asset-url": profile.assets.anime === "cdn" ? animeUrl : "" });
  const outErrors = checkOutput(html, { label, assets: profile.assets, presentation, script });
  if (outErrors.length) throw new ExportError(outErrors);
  return { html, findings, notes: { params: Object.keys(presentation), behavior, unverified: profile.unverified ?? [], sources, bytes: Buffer.byteLength(html) } };
}

// ---- CLI ---------------------------------------------------------------------------------------
async function loadModule(file) {
  if (!fs.existsSync(file)) throw new Error(`file not found: ${file}`);
  return (await import(pathToFileURL(path.resolve(file)).href)).default;
}
async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args.splice(i, 2)[1]; };
  const has = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
  const allowOpen = has("--allow-open"), check = has("--check");
  const descFile = flag("--descriptor"), profileFile = flag("--profile"), outFile = flag("--out");
  const opts = { markup: flag("--markup"), css: flag("--css"), helpers: flag("--helpers"), anime: flag("--anime"), app: flag("--app") };
  if (!descFile || !profileFile || !outFile) {
    console.error("usage: export.mjs --descriptor <file> --profile <file> --out <file> [--css <shared.css> --helpers <diagram-shared.js> --anime <anime.es.js> | --app <repo>] [--markup <file>] [--allow-open] [--check]");
    process.exit(64);
  }
  const read = (f) => fs.readFileSync(f, "utf8");
  const descriptor = await loadModule(descFile);
  let inputs;
  try { inputs = resolveInputs({ descFile, descriptor, ...opts }); }
  catch (e) { if (!(e instanceof UsageError)) throw e; console.error(e.message); process.exit(64); }
  const profile = await loadModule(profileFile);
  const templates = {};
  for (const n of ["fragment", "page"]) templates[n] = read(path.join(HERE, "templates", `${n}.html`));
  if (profile?.template) templates[profile.template] = read(path.resolve(path.dirname(profileFile), profile.template));
  let result;
  try {
    result = buildExport({
      profile, templates, descriptor, markup: read(inputs.markup), sharedCss: read(inputs.css), sharedJs: read(inputs.helpers),
      animeSrc: read(inputs.anime), animeVersion: inputs.animeVersion, interpreterSrc: read(path.join(HERE, "../interpreter.js")),
    }, { allowOpen });
  } catch (e) {
    if (!(e instanceof ExportError)) throw e;
    for (const m of e.errors) console.error("ERROR  " + m);
    for (const m of e.escalations) console.error("ESCALATION  " + m.replace(/^escalation /, ""));
    console.error(e.errors.length ? "\nnot exported: fix the errors above." : "\nnot exported: the escalations above need the user's answer (or pass --allow-open for a draft).");
    process.exit(e.errors.length ? 1 : 2);
  }
  const { html, notes, findings } = result;
  for (const f of findings.filter((f) => f.level === "warning")) console.error(`warning  [${f.code}] ${f.where}: ${f.message}`);
  if (check) {
    const same = fs.existsSync(outFile) && read(outFile) === html;
    console.log(same ? `up to date: ${outFile}` : `STALE: ${outFile} differs from a fresh export (or is missing). Regenerate it.`);
    process.exit(same ? 0 : 1);
  }
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, html);
  console.log(`wrote ${outFile} (${notes.bytes} bytes) for target "${profile.target}", diagram "${descriptor.diagramLabel}"`);
  console.log(`presentation parameters set: ${notes.params.join(", ") || "none"}`);
  if (notes.unverified.length) console.log("not verified (from the profile):\n" + notes.unverified.map((u) => "  - " + u).join("\n"));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
