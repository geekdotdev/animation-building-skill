# Reference implementation

Runnable code that implements what the prose layers specify. It is a **reference**: a working, tested version to run, read or copy, not a package the skill depends on. The layers (`core/`, `renderers/`, `domains/`, `examples/`) are what the agent reads. This folder mirrors them, so code goes where its dependency is:

| Folder | Depends on | Status |
|---|---|---|
| `core/validator/` | only the descriptor format (`core/descriptor.md`) | written, 58 tests |
| `renderers/anime-svg/` | the format and anime.js v3 with inline SVG: the shared interpreter that replaces the per-diagram `beadArrived` chains | written and checked against example diagram 5 (`test/README.md`). No diagram has been switched over to it. |
| `renderers/anime-svg/reference/` | the markup contract §4 | a stylesheet and the three helper functions with a small generic iconography, so a diagram runs with nothing from the example project (9 tests). anime.js is passed in. |
| `renderers/anime-svg/markup/` and `skeleton/` | the markup contract (`renderers/anime-svg/markup-contract.md`) | `check.mjs` checks a diagram file, its stylesheet and helpers against it (20 tests). `skeleton/` is a diagram file and descriptor to copy, and it runs. |
| `renderers/anime-svg/export/` | the interpreter, a descriptor and a target profile | the exporter: writes one self-contained file for a delivery target. Written, 36 tests, and its output loaded in a browser (`export/README.md`). |

Anything renderer-specific belongs under `renderers/<name>/`, and nothing under `core/` may import from there.

## `core/validator/`

Implements the checks of `core/descriptor.md` §8. No dependencies (Node 18+).

```bash
node validate.mjs <descriptor.animation.js> [--markup diagram.html] [--assets diagram-shared.js|list.json] [--json]
node test.mjs
```

- **Exit code:** 0 clean, 1 errors, 2 no errors but open escalations. **Levels:** `error` (the agent fixes it), `escalation` (stop and ask the user), `warning`.
- The descriptor's `markup` (a path relative to the descriptor; `--markup` overrides it) is read to check that every `element` exists as `id="<element>-<diagram-label>"`, and that the `markup` file exists. `--assets` checks asset names against an iconography (a `.json` list or object, or a `.js` file in the `ICONOGRAPHY` shape of `diagram-shared.js`).
- `test.mjs` mutates a valid fixture (`fixtures/minimal.animation.js`) and expects each fault to be reported with its code. Each check family was also disabled in turn to confirm at least one test fails without it.
- **Divergence check:** identical assets started by one trigger on different channels are an error only when the channels' **startpoints coincide**, read from the markup (a forward move starts at the first point of the channel's path, a return move at its last, assuming the path runs from `a` to `b`). Without `--markup` the check is skipped, with a warning.
- **Accepted format extensions** (proposed in the worked example's `FINDINGS.md`, so they are marked *proposed* in the source and are easy to remove if rejected): `element` (F1), `{ delay }` (F3), `hide` (F6), rule-level `when` (F9), `dock` and `{ completed }` (F10), derived consequences (F15).

**Not covered:** zone geometry (needs the rendered SVG in a browser), lane reset behavior, whether a `source:` is true, and whether the descriptor behaves like the script it was written from.

## `renderers/anime-svg/`

`interpreter.js` reads a descriptor and animates a diagram whose markup already exists. It is one browser ES module with no imports: anime.js and the project's helpers (`createCrawlerElement`, `logDiagramTransition`, `playVolumeDocking`) are passed in.

```js
const run = createInterpreter(descriptor, { anime, createCrawlerElement, logDiagramTransition, playVolumeDocking });
run.start();   // Replay calls run.reset()
```

It implements the contract of `core/descriptor.md` §9, including the interaction mode (§9.10: `modes.toggle` puts a switch beside Replay, and in automated mode each armed gesture is pressed for the viewer with a visible acknowledgement, then performed like a click): datums that close on their acknowledgement, lane-scoped arrival triggers, phases that arm gestures (consumed once in a user-paced phase, repeatable in an open-ended one), ordered actions with blocking and non-blocking semantics, `repeat`, `dock`, and one generation counter that every timer, hop and glow checks. Reset advances it first.

**Not implemented:** simulation of gestures the descriptor didn't declare `arms` for, overlay precedence (crawlers are appended last, so the newest is on top, which is the ontology's fallback), lane reset triggers, and `sharedPrefix` divergences. It doesn't validate: run `core/validator/` first.

`test/` builds a static page that runs a diagram with the interpreter and a descriptor, which any static server can serve. See `test/README.md` for the procedure, and for how the interpreter was validated against example diagram 5.

## `renderers/anime-svg/export/`

`export.mjs` exports a diagram to a delivery target as one self-contained file (a fragment to paste into a host page, or a full page), following `core/delivery-targets.md`. It validates the descriptor first, applies a target profile (presentation parameters with reasons, behavior, packaging, asset loading), and checks its own output. See `export/README.md`.
