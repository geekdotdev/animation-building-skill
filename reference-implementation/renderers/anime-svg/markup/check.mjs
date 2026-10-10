#!/usr/bin/env node
// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Checks a diagram's markup (and, if given, the stylesheet and helpers) against the markup contract in
// renderers/anime-svg/markup-contract.md: the structure and names the interpreter reads and writes.
//
//   node check.mjs <descriptor.animation.js> [--markup <file>] [--css <shared.css>] [--helpers <diagram-shared.js>] [--app <repo>]
//
// The markup is the descriptor's own `markup` (a path relative to it), unless --markup overrides it. The
// stylesheet and helpers are checked only when given (--css, --helpers, or both from --app).
// Exit code: 0 clean (warnings allowed), 1 errors, 64 usage.
//
// The descriptor validator (core/validator/) checks the descriptor; this checks the file the descriptor
// points at, which is renderer-specific, so it lives with the renderer.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractDiagram, resolveMarkup, findAnime } from "../lib.mjs";
import { parseMarkup, hasClass, descendants, isInside } from "./parse.mjs";
import { ICON_LAYOUT, VOLUME_ICON_LAYOUT, planBoxIcons, planVolumeIcons, volumeIconSize } from "../interpreter.js";

// What the interpreter and the app's helpers read from the stylesheet's classes, and what they call.
export const REQUIRED_CLASSES = ["diagram", "diagram-log", "diagram-footer", "diagram-replay", "diagram-line", "diagram-line-static", "diagram-line-label", "diagram-hint", "diagram-clickable", "diagram-glow"];
export const REQUIRED_HELPERS = ["createCrawlerElement", "logDiagramTransition", "playVolumeDocking"];
const STROKED = new Set(["rect", "path", "circle", "ellipse", "polygon", "polyline", "line"]);

// Every name an `acknowledge` (a datum's, or an action's) can glow.
function acknowledgeTargets(d) {
  const out = new Set();
  const acts = (list) => { for (const a of list ?? []) { if (a.acknowledge) (a.acknowledge.targets ?? []).forEach((t) => out.add(t)); if (a.repeat) acts(a.repeat.do); } };
  for (const x of d.datums ?? []) (x.acknowledge?.targets ?? []).forEach((t) => out.add(t));
  for (const s of d.sequences ?? []) for (const r of s.rules ?? []) acts(r.do);
  return out;
}

// Returns findings: { level: 'error' | 'warning', code, where, message }.
export function checkMarkup(descriptor, html) {
  const out = [];
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  const err = (c, w, m) => add("error", c, w, m), warn = (c, w, m) => add("warning", c, w, m);
  const label = descriptor.diagramLabel;
  if (typeof label !== "string" || !label) { err("root", "diagramLabel", "the descriptor has no diagramLabel"); return out; }

  let block;
  try { block = extractDiagram(html); } catch (e) { err("root", "markup", e.message); return out; }
  const doc = parseMarkup(block);
  for (const e of doc.errors) err("parse", "markup", e);
  for (const id of doc.duplicates) err("duplicate-id", `id="${id}"`, "an id must be used once: the interpreter finds elements by id");

  // --- the root
  const root = doc.roots[0];
  if (doc.roots.length !== 1 || !root || root.tag !== "div" || !hasClass(root, "diagram") || root.attrs.id !== `diagram-${label}`)
    { err("root", "root", `the diagram must be one <div class="diagram" id="diagram-${label}">`); return out; }

  // --- the SVG: crawlers are drawn into it, and it scales with the container
  const svgs = root.children.filter((c) => c.tag === "svg");
  if (svgs.length !== 1) { err("svg", "svg", `the root needs exactly one <svg> as a direct child (found ${svgs.length})`); return out; }
  const svg = svgs[0];
  const vb = (svg.attrs.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) err("viewbox", "svg", 'the <svg> needs a viewBox of four numbers with a positive width and height, e.g. viewBox="0 0 980 450"');
  else if (vb[0] !== 0 || vb[1] !== 0) err("viewbox", "svg", `the viewBox must start at 0 0 (it is ${vb[0]} ${vb[1]}): anime.js's path() helper offsets every crawler by a negative origin. Shift the coordinates instead.`);

  // --- the log and the footer (Replay), direct children of the root
  const log = doc.byId.get(`diagram-${label}-log`);
  if (!log || log.parent !== root || log.tag !== "div" || !hasClass(log, "diagram-log")) err("log", "log", `the root needs <div class="diagram-log" id="diagram-${label}-log"> as a direct child`);
  const footer = root.children.find((c) => c.tag === "div" && hasClass(c, "diagram-footer"));
  if (!footer) err("footer", "footer", 'the root needs <div class="diagram-footer"> as a direct child (it holds Replay, and the mode switch when the descriptor has one)');
  const replay = doc.byId.get(`diagram-${label}-replay`);
  if (!replay || replay.tag !== "button" || !hasClass(replay, "diagram-replay") || (footer && !isInside(replay, footer)))
    err("replay", "replay", `the footer needs <button class="diagram-replay" type="button" id="diagram-${label}-replay">`);
  if (descriptor.settings?.interactionModes?.toggle === true && !footer) err("footer", "footer", "settings.interactionModes.toggle is set, and the mode switch is placed in the footer");

  // --- every element the descriptor names, by id, inside the SVG
  const el = (name, element, kind) => {
    if (!element) { warn("element", `${kind} ${name}`, "has no `element`, so it can't be found in the markup"); return null; }
    const id = `${element}-${label}`, found = doc.byId.get(id);
    if (!found) { err("element", `${kind} ${name}`, `no element with id="${id}"`); return null; }
    if (!isInside(found, svg)) { err("element", `${kind} ${name}`, `id="${id}" is outside the <svg>`); return null; }
    return found;
  };
  const glow = acknowledgeTargets(descriptor);
  const nodeEls = {};
  for (const n of descriptor.nodes ?? []) {
    const e = el(n.name, n.element, "node"); if (!e) continue;
    nodeEls[n.name] = e;
    if (glow.has(n.name) && !STROKED.has(e.tag)) err("glow-target", `node ${n.name}`, `it is glowed (acknowledge), and the glow animates its stroke, so it must be a shape (${[...STROKED].join(", ")}), not <${e.tag}>`);
    if (n.gesture) {
      if (![...descendants(e)].some((c) => hasClass(c, "diagram-hint"))) err("hint", `node ${n.name}`, "a gesture node needs a descendant with class diagram-hint: the interpreter writes the hint's text into it");
      if (e.attrs.tabindex === undefined || e.attrs.role !== "button") warn("accessibility", `node ${n.name}`, 'a gesture node should have tabindex="0" and role="button" so a keyboard user can press it');
    }
    if (n.group && e.tag !== "g") warn("element", `node ${n.name}`, `marked group but is <${e.tag}>, not <g>`);
    if (n.icons?.length) {
      // The icons stand along the box's inside top edge and push the label down (core/descriptor.md section 3.5):
      // say now, from the markup, whether the box is big enough, using the interpreter's own layout. Icon
      // widths aren't known without the helpers, so each is taken as square.
      const w = `node ${n.name} icons`, box = e.tag === "rect" ? e : [...descendants(e)].find((c) => c.tag === "rect");
      const nums = box && ["x", "y", "width", "height"].map((a) => parseFloat(box.attrs[a]));
      if (!box || nums.some((v) => !Number.isFinite(v))) { err("icons", w, "the node needs a <rect> with numeric x, y, width and height: the icons are placed against its inside top edge"); continue; }
      const [x, y, width, height] = nums;
      const lines = doc.all.filter((t) => t.tag === "text" && (hasClass(t, "diagram-label") || hasClass(t, "diagram-hint"))).map((t) => ({ t, x: parseFloat(t.attrs.x), y: parseFloat(t.attrs.y) }))
        .filter((l) => l.x >= x && l.x <= x + width && l.y >= y && l.y <= y + height);
      if (!lines.length) warn("icons", w, "no label inside the box: the icons are drawn, but there is no text to move down");
      const plan = planBoxIcons({ x, y, width, height }, n.icons.map(() => ICON_LAYOUT.size), lines.map((l) => ({ y: l.y, fontSize: hasClass(l.t, "diagram-hint") ? ICON_LAYOUT.hintFontSize : ICON_LAYOUT.labelFontSize })));
      if (!plan.fits) err("icons", w, `the box is too small for its icons and label: after the icons (${ICON_LAYOUT.size} tall) and the label moving down ${Math.round(plan.shift)}, ${Math.round(plan.bottomPadding)} units are left under the text (at least ${ICON_LAYOUT.padBottom} needed), and the row is ${Math.round(plan.rowWidth)} wide in a ${width}-wide box. Make the box taller or wider, or use fewer icons`);
    }
  }
  for (const c of descriptor.channels ?? []) {
    const e = el(c.name, c.element, "channel");
    if (e) {
      const w = `channel ${c.name}`, d = e.attrs.d ?? "";
      if (e.tag !== "path") err("channel-path", w, `a channel must be a single <path> (crawlers follow it with anime.path), not <${e.tag}>`);
      else {
        if (!/\d/.test(d)) err("channel-path", w, "the <path> has no `d`");
        else if ((d.match(/[Mm]/g) || []).length !== 1) warn("channel-path", w, "the path has more than one subpath: a crawler walks all of them as one length");
      }
      if (!hasClass(e, "diagram-line")) err("channel-class", w, 'a channel needs class="diagram-line"');
      if (c.visibility === "static" && !hasClass(e, "diagram-line-static")) err("channel-class", w, 'visibility is static, so it needs class="diagram-line-static" (a plain diagram-line starts hidden)');
      if (c.visibility === "hidden" && hasClass(e, "diagram-line-static")) warn("channel-class", w, "visibility is hidden but the path has diagram-line-static, so it would start visible");
      if (c.style === "mtls" && !hasClass(e, "diagram-line-mtls")) warn("channel-class", w, 'style is mtls, so it needs class="diagram-line-mtls"');
    }
    if (c.label?.element) {
      const le = el(`${c.name} label`, c.label.element, "channel label");
      if (le && !hasClass(le, "diagram-line-label")) warn("channel-class", `channel ${c.name} label`, 'a channel label needs class="diagram-line-label" (hidden until its line is revealed)');
    }
  }
  for (const z of descriptor.zones ?? []) {
    const e = el(z.name, z.element, "zone");
    if (!e) continue;
    const isAttribution = descriptor.settings?.attributionMetadata?.zone === z.name;
    if (e.tag !== "rect") (isAttribution ? err : warn)("element", `zone ${z.name}`, `a zone is drawn as a <rect>, not <${e.tag}>${isAttribution ? " (the attribution box reads its x/y/width/height directly, so it must be a <rect>)" : ""}`);
    else if (isAttribution) for (const attr of ["x", "y", "width", "height"]) if (e.attrs[attr] === undefined || !/^-?\d/.test(e.attrs[attr])) err("element", `zone ${z.name}`, `the attribution box's rect needs a numeric ${attr} attribute`);
  }
  for (const v of descriptor.volumes ?? []) {
    const e = el(v.name, v.element, "volume"); if (!e) continue;
    if (e.tag !== "g") err("volume", `volume ${v.name}`, `a volume is moved by a transform, so it must be a <g>, not <${e.tag}>`);
    if (v.icons?.length && e.tag === "g") {
      // Icons stand at the left end of the volume's box with the label centered in the rest (core/descriptor.md
      // section 3.5): say now whether the box is wide enough, using the interpreter's own layout. Each icon is
      // taken as square, and the label's width is estimated from its text in the descriptor.
      const w = `volume ${v.name} icons`, box = [...descendants(e)].find((c) => c.tag === "rect");
      const nums = box && ["x", "y", "width", "height"].map((a) => parseFloat(box.attrs[a]));
      if (!box || nums.some((n) => !Number.isFinite(n))) err("icons", w, "the volume needs a <rect> with numeric x, y, width and height: the icons are placed against its left end");
      else {
        const b = { x: nums[0], y: nums[1], width: nums[2], height: nums[3] }, size = volumeIconSize(b);
        const plan = planVolumeIcons(b, v.icons.map(() => size), { chars: (v.label ?? "").length, fontSize: VOLUME_ICON_LAYOUT.fontSize });
        if (!plan.fits) err("icons", w, `the box is too narrow for its icons and label "${v.label}": about ${Math.round(plan.textWidth)} units of text in ${Math.round(plan.available)} available. Make the box wider, or shorten the label`);
      }
    }
    if (!e.attrs.id.startsWith("dg-vol-")) err("volume", `volume ${v.name}`, `its id must start with "dg-vol-": the stylesheet's rule [id^="dg-vol-"] sets the transform origin that docking scales from`);
  }
  return out;
}

// Whether any move, divergence or its consumer condition anywhere in the descriptor declares a composite
// crawler's optional bounding box (`box: true`).
function usesCrawlerBox(d) {
  let found = false;
  const walk = (list) => { for (const a of list ?? []) { if (a?.move?.box || a?.divergence?.box) found = true; if (a?.repeat) walk(a.repeat.do); } };
  for (const s of d.sequences ?? []) for (const r of s.rules ?? []) walk(r.do);
  return found;
}

// The classes the markup and interpreter rely on must be defined by some rule, and volumes need their
// transform-origin rule. `css` is the app's stylesheet text.
export function checkStylesheet(css, descriptor = {}) {
  const out = [], bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const c of REQUIRED_CLASSES) if (!new RegExp(`\\.${c}(?![\\w-])`).test(bare)) out.push({ level: "warning", code: "stylesheet", where: `.${c}`, message: `no rule uses the class .${c}, which the markup or interpreter relies on` });
  if ((descriptor.volumes ?? []).length && !/\[id\^=["']?dg-vol-/.test(bare)) out.push({ level: "warning", code: "stylesheet", where: "volumes", message: 'no rule sets [id^="dg-vol-"] { transform-box: fill-box; transform-origin: center; }, so docked volumes scale from the wrong point' });
  if (usesCrawlerBox(descriptor) && !/\.diagram-crawler-box(?![\w-])/.test(bare)) out.push({ level: "warning", code: "stylesheet", where: ".diagram-crawler-box", message: "a composite crawler uses box: true, but no rule styles .diagram-crawler-box, so it will render unstyled (default black fill)" });
  if (descriptor.settings?.attributionMetadata && !/\.diagram-watermark-text(?![\w-])/.test(bare)) out.push({ level: "warning", code: "stylesheet", where: ".diagram-watermark-text", message: "the descriptor has attribution metadata, but no rule styles .diagram-watermark-text, so its credit lines will render in the SVG's default text style" });
  // The event log's mobile hard rule (core/ontology.md rule 27): a 600px @media block moving it
  // out of its overlaid position, below the diagram. A regex spot-check, like the others here —
  // not full CSS parsing — so it assumes a single, simple media block, same as the reference one.
  if (!/@media\s*\([^)]*max-width:\s*600px[^)]*\)\s*\{[^}]*\.diagram-log/.test(bare)) out.push({ level: "warning", code: "stylesheet", where: ".diagram-log", message: "no @media (max-width: 600px) rule repositions .diagram-log below the diagram (core/ontology.md rule 27)" });
  return out;
}

// The helpers file must export the three functions the interpreter is given.
export function checkHelpers(js, descriptor) {
  const names = [...js.matchAll(/^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  // `createIconElement` draws the icons a node declares (`icons`); a descriptor with none doesn't need it
  const required = [...(descriptor?.nodes ?? []), ...(descriptor?.volumes ?? [])].some((n) => n.icons?.length) ? [...REQUIRED_HELPERS, "createIconElement"] : REQUIRED_HELPERS;
  return required.filter((n) => !names.includes(n)).map((n) => ({ level: "error", code: "helpers", where: n, message: `the helpers file must export ${n}` }));
}

// ---- CLI --------------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i < 0 ? undefined : args.splice(i, 2)[1]; };
  const markupOverride = flag("--markup"), cssFile0 = flag("--css"), helpersFile0 = flag("--helpers"), app = flag("--app"), file = args[0];
  if (!file) { console.error("usage: check.mjs <descriptor.animation.js> [--markup <file>] [--css <file>] [--helpers <file>] [--app <repo>]"); process.exit(64); }
  const descriptor = (await import(pathToFileURL(path.resolve(file)).href)).default;
  const markupFile = resolveMarkup({ descFile: file, descriptor, markup: markupOverride });
  if (!markupFile || !fs.existsSync(markupFile)) { console.error(`no markup file: give the descriptor a \`markup\` or pass --markup (${markupFile ?? "none"})`); process.exit(64); }
  const cssFile = cssFile0 ?? (app && path.join(app, "spa-server/public/shared.css")), helpersFile = helpersFile0 ?? (app && path.join(app, "spa-server/public/diagram-shared.js"));
  const found = checkMarkup(descriptor, fs.readFileSync(markupFile, "utf8"));
  if (cssFile) found.push(...checkStylesheet(fs.readFileSync(cssFile, "utf8"), descriptor));
  if (helpersFile) found.push(...checkHelpers(fs.readFileSync(helpersFile, "utf8"), descriptor));
  for (const level of ["error", "warning"]) {
    const list = found.filter((f) => f.level === level); if (!list.length) continue;
    console.log(`\n${level.toUpperCase()} (${list.length})`);
    for (const f of list) console.log(`  [${f.code}] ${f.where}: ${f.message}`);
  }
  const n = (l) => found.filter((f) => f.level === l).length;
  console.log(`\nchecked ${markupFile}${cssFile ? " + stylesheet" : ""}${helpersFile ? " + helpers" : ""}: ${n("error")} errors, ${n("warning")} warnings`);
  process.exit(n("error") ? 1 : 0);
}
// realpath: see validate.mjs: a tool reached through a symlink must still run.
if (process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url) main().catch((e) => { console.error(e.message); process.exit(1); });
