# Exporter

Exports an animated diagram to a delivery target (a blog card, a standalone page, ...) as **one self-contained file**. The method and its rules are in `core/delivery-targets.md`. This is the code that follows them.

```bash
node export.mjs --descriptor <file.animation.js> --profile <target profile.js> --out <file.html> \
                [--css <shared.css> --helpers <diagram-shared.js> --anime <anime.es.js> | --app <repo>] \
                [--markup <file>] [--allow-open] [--check]
```

| Option | What it does |
|---|---|
| `--css`, `--helpers`, `--anime` | The app's stylesheet, its shared helpers (`diagram-shared.js`) and its `anime.es.js`. `--app <repo>` supplies all three from the example project's layout (`spa-server/public/`, `spa-server/node_modules`), and any of them can be given on its own. |
| `--markup` | The file holding the diagram, overriding the descriptor's own `markup`. Rarely needed. |
| `--allow-open` | Proceeds when the descriptor still has open escalations (a draft). Errors always stop it. |
| `--check` | Writes nothing: compares a fresh export with `--out` and exits 1 if it differs. That detects a stale export. |

Exit code: 0 done, 1 errors (or a stale `--check`), 2 open escalations, 64 usage (including a missing input).

**Where the diagram comes from.** The descriptor names it: `markup` is a path relative to the descriptor, to a page or a file holding the diagram, and the `<div class="diagram">` block is taken from it. The diagram's id suffix is the descriptor's `diagramLabel`. Neither is a flag, so they can't disagree with the descriptor. The `markup` path is a build-time pointer and is left out of the exported file.

## What goes into the file

The `<div class="diagram">` block (SVG, log and Replay), the diagram's CSS from the app's `shared.css`, the profile's presentation overrides, and **one script** holding anime.js (or its CDN import), the app's `diagram-shared.js`, the interpreter and the descriptor. Its behavior comes from the descriptor: the diagram's own script is not used. The file's header comment lists the target, the diagram and a short hash of every source, so you can tell what it was built from.

An export **changes presentation only** (ontology rules 11 to 14). Sequences, datums, lanes, fidelity tags and timing come from the descriptor unchanged.

## Before it writes anything

1. The descriptor is validated (`core/validator/`) against the diagram's markup, and the markup, stylesheet and helpers are checked against the markup contract (`renderers/anime-svg/markup-contract.md`). Errors stop the export, and warnings are printed. Open escalations stop it too (exit 2) unless `--allow-open`.
2. The profile is checked (below). A target that can't take clicks, for a descriptor with gesture nodes, is an **escalation** unless the profile runs it automated with no toggle.
3. After building, the output is checked: no unfilled slot, no import left except the CDN one, no `export`, the diagram root appears once, and every parameter the profile sets is present.

## A target profile

A data-only module, `<name>.target.js`. Examples are in `profiles/`.

| Key | Meaning |
|---|---|
| `target` | The target's name (required). |
| `packaging` | `'fragment'` (style, diagram, script: for pasting into a host page) or `'page'` (a full document). |
| `template` | Optional. The name of a template, given in a file next to the profile, that puts the five slots wherever the target needs them. |
| `assets.anime` | `'cdn'` (an `import` of the CDN URL, built from the app's anime.js version, or `assets.animeUrl`) or `'inline'` (anime.js pasted into the script, so it needs no network). |
| `gestures` | `'live'` (the target can take clicks) or `'none'`. |
| `behavior` | `mode` (`'user-driven'` or `'automated'`), `toggle` (show the mode switch), `replay` (`false` hides Replay), `pace` (a positive number: 2 is twice as slow, 0.5 twice as fast, replacing the descriptor's own). `mode` and `toggle` override the descriptor's `modes`. |
| `presentation` | Parameters from the surface below, each a plain CSS value. |
| `reasons` | **A reason for every presentation parameter** (ontology rule 12). |
| `unverified` | What this export was not verified against. It is printed after the export. |

Anything else is an error, as is a parameter with no reason.

### The parameter surface (`surface.mjs`)

Each parameter becomes a custom property on the diagram's root (`#diagram-<diagram-label>`), and the rules it drives read it. The rules are scoped to that id, so a host page's own `p` or `button` rules can't override them.

| Parameter | Controls |
|---|---|
| `diagram-width`, `diagram-max-width`, `diagram-margin` | the diagram's own box |
| `log-width`, `log-max-height`, `log-padding`, `log-font-size` | the event log |
| `log-color` | the log's text, its paragraphs, and their opacity (a host theme often restyles paragraphs) |
| `replay-padding`, `replay-font-size` | the Replay button |
| `toggle-font-size` | the mode switch's label (set with `!important`, because the interpreter styles it inline) |

A parameter whose target isn't in the exported diagram is an error.

### Packaging slots

A template has the slots `{{header}}`, `{{style}}`, `{{diagram}}`, `{{script}}` and `{{asset-url}}` (the anime.js CDN URL, or empty). `style`, `diagram` and `script` are required. Slots are filled in one pass over the template, so an inserted value is never re-read as a slot, and an unknown slot is an error.

## What every export includes on its own

- **`box-sizing: border-box` on the diagram.** The app sets it on everything, and the diagram's width and padding depend on it. A host page may not.
- **Only the CSS the diagram needs:** rules on `.diagram…` classes, `#diagram-…` and `#dg-…` ids, and attribute selectors on such ids, for this diagram only. A rule listing several selectors keeps only the ones that apply.

## Limits

- The CSS filter is by selector name. A rule the diagram needs that doesn't mention a `diagram` or `dg-` name is missed, and so is a selector list using `:is(a, b)`. When something looks unstyled in an export, compare the exported `<style>` with `shared.css`.
- The stylesheet and helpers come from the application (`--css`, `--helpers`, or `--app` for the example project's). The exporter checks them against the markup contract. Reference ones that meet it are in `reference/`.
- Only a single-line `import x from '…'` and named `export const/let/var/function/class` can be inlined. Anything else in `diagram-shared.js` is an error, not a guess.
- Not implemented: `armedGestures` (which gestures stay armed), and a still-frame or drop-the-phase rendering for a target that can't take clicks.

## Verifying an export

1. **Regenerate, never edit.** `--check` says whether a file is current.
2. **Load it** in a browser, with anime.js inlined so it needs no network, or from the CDN. Look for console errors, and step through or switch to automated with the toggle.
3. **Measure the styles** the profile sets (`getComputedStyle` on the log, Replay and the toggle) and the width at the target's column width.
4. **Record what you couldn't verify.** The real host (for example, whether a Ghost HTML card keeps a module script) usually can't be tested from here. Put it in the profile's `unverified`.

Tests: `node test.mjs` (30 tests on the pure functions and a build from synthetic inputs, with no app repo needed).

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
