// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Small helpers shared by the anime.js renderer's tools (test/build-site.mjs and export/export.mjs).
import fs from "node:fs";
import path from "node:path";

// The diagram block of a markup file (a page or the diagram itself): from `<div class="diagram"` to its matching `</div>`. The block
// holds other divs (the log, the footer), so the closing tag is found by counting opens and closes.
export function extractDiagram(html) {
  const start = html.indexOf('<div class="diagram"');
  if (start < 0) throw new Error('no <div class="diagram"> in the markup');
  const tag = /<(\/?)div\b/g;
  tag.lastIndex = start;
  for (let depth = 0, m; (m = tag.exec(html)); ) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, html.indexOf(">", m.index) + 1);
  }
  throw new Error("the diagram <div> is never closed");
}

// The app's copy of anime.js (an ES module): { file, version }.
export function findAnime(app) {
  const root = path.join(app, "spa-server/node_modules");
  const hit = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const r = hit(p); if (r) return r; }
      else if (e.name === "anime.es.js") return p;
    }
  };
  const file = hit(root);
  if (!file) throw new Error(`anime.es.js not found under ${root}`);
  const pkg = path.join(path.dirname(path.dirname(file)), "package.json");
  const version = fs.existsSync(pkg) ? JSON.parse(fs.readFileSync(pkg, "utf8")).version : null;
  return { file, version };
}

// The version of an anime.js install, read from the package.json two folders above `lib/anime.es.js`.
export function animeVersion(animeFile) {
  const pkg = path.join(path.dirname(path.dirname(animeFile)), "package.json");
  return fs.existsSync(pkg) ? JSON.parse(fs.readFileSync(pkg, "utf8")).version : null;
}

export class UsageError extends Error {}

// Where each input comes from, for both tools (build-site.mjs and export.mjs).
//   markup   the descriptor's own `markup` (a path relative to the descriptor), or --markup
//   css, helpers, anime   --css, --helpers, --anime, each defaulting to the example project's layout
//            under --app (spa-server/public/shared.css, diagram-shared.js, and its node_modules)
// The diagram's id suffix is the descriptor's `diagramLabel`: there is no separate flag for it.
// The markup file: --markup, or the descriptor's own `markup` (a path relative to the descriptor).
export function resolveMarkup({ descFile, descriptor, markup }) {
  return markup ?? (typeof descriptor.markup === "string" ? path.resolve(path.dirname(descFile), descriptor.markup) : undefined);
}

export function resolveInputs({ descFile, descriptor, markup, css, helpers, anime, app }) {
  const layout = app
    ? { css: path.join(app, "spa-server/public/shared.css"), helpers: path.join(app, "spa-server/public/diagram-shared.js"), anime: findAnime(app).file }
    : {};
  const files = {
    markup: resolveMarkup({ descFile, descriptor, markup }),
    css: css ?? layout.css,
    helpers: helpers ?? layout.helpers,
    anime: anime ?? layout.anime,
  };
  const need = { markup: "the descriptor has no `markup` key (or pass --markup <file>)", css: "--css <shared stylesheet> (or --app <repo>)", helpers: "--helpers <diagram-shared.js> (or --app <repo>)", anime: "--anime <anime.es.js> (or --app <repo>)" };
  const missing = Object.keys(files).filter((k) => !files[k]);
  if (missing.length) throw new UsageError("missing input: " + missing.map((k) => need[k]).join("; "));
  for (const [k, f] of Object.entries(files)) if (!fs.existsSync(f)) throw new UsageError(`${k} file not found: ${f}`);
  if (typeof descriptor.diagramLabel !== "string" || !descriptor.diagramLabel) throw new UsageError("the descriptor has no `diagramLabel` (the diagram's id suffix)");
  return { ...files, label: descriptor.diagramLabel, animeVersion: animeVersion(files.anime) };
}
