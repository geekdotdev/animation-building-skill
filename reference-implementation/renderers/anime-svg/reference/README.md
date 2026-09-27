# Reference stylesheet and helpers

The two files a diagram needs besides its markup and its descriptor, written to the markup contract (`renderers/anime-svg/markup-contract.md` §4). With them and anime.js, the skeleton runs, and a new application needs nothing from the example project.

| File | What it is |
|---|---|
| `diagram.css` | A stylesheet that stands alone: no host page, wrapper or theme. The rules marked `BEHAVIOR` are the contract (hidden lines, labels and crawlers, static lines, the volume transform origin, the glow, the pressable node). The rest is a plain look you can change. |
| `helpers.js` | `createCrawlerElement`, `logDiagramTransition`, `playVolumeDocking`, and a small generic `ICONOGRAPHY`: `request`, `response`, `message`, `credential`, `redirect`, `exchange`, `ok`, `error`. |
| `test.mjs` | Checks that both still meet the contract and stay in step with the skeleton. `node test.mjs` |

**Not included: anime.js.** It is a third-party library, so pass its `anime.es.js` with `--anime` (or find it under an install's `node_modules`). `helpers.js` imports it as `/vendor/animejs/anime.es.js`, a single line the test-page builder and the exporter both understand: the builder serves it at that path, and the exporter removes the line and inlines or imports anime.js itself.

## Use them

```bash
node renderers/anime-svg/test/build-site.mjs --descriptor <your>.animation.js \
  --css renderers/anime-svg/reference/diagram.css --helpers renderers/anime-svg/reference/helpers.js \
  --anime <anime.es.js> --out <dir>
```

The same three options work for `markup/check.mjs` and `export/export.mjs`. To use them in a real page, link `diagram.css`, and pass the three helper functions to `createInterpreter`.

## Change them

- **An asset:** add one line to `ICONOGRAPHY` in the layout `  name: { shape: '…', fill: '…' },`, one entry per line: the descriptor validator reads the names from it (`--assets`). Shapes are `circle`, `square`, `triangle`, `x` and `text`. A `fill` draws it solid, and a `stroke` alone draws it hollow. A domain with richer symbols (the NATS and OIDC pack has locks and keys) adds its own shapes to `createCrawlerElement`.
- **The look:** change any rule that isn't marked `BEHAVIOR`. Keep `.diagram-line-static` after `.diagram-line`, since they have equal specificity.
- **A different size or layout:** the root `.diagram` is a centred card up to 1100px wide. The presentation parameters an export can set (`export/README.md`) all target rules in this file.

After changing either file, run `node test.mjs`, and `markup/check.mjs` on your diagram.

## What the example project's versions do differently

The example's `diagram-shared.js` and `shared.css` are one application's implementation. Its helpers draw richer assets (a padlock, a padlock with a key) and let a log line carry inline markup, and its stylesheet is laid out for a page with a 720px column that the diagram breaks out of. These are simpler: they set each log line as text, so a narration line can't inject HTML, and they take the docking duration from the descriptor.
