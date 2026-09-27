# Skeleton

A small diagram file and its descriptor that meet the markup contract (`renderers/anime-svg/markup-contract.md`), use every kind of element it names, and run. Copy them to start a new diagram.

| File | What it is |
|---|---|
| `diagram.html` | The SVG, the log and the footer, with a comment on each kind of element. |
| `diagram.animation.js` | Its descriptor: two lanes, three nodes, two channels, a zone, a volume that docks, two datums, and the mode setting. |

## Start a new diagram from it

1. Copy both files. Pick a label (lowercase letters, digits, hyphens), and replace `skeleton` in every id in the HTML and in the descriptor's `diagramLabel`.
2. Replace the content. Every `REPLACE:` in the descriptor is a placeholder: give each sequence its real `source:`, and tag its fidelity honestly. The validator warns until they are gone.
3. Check it, from `reference-implementation/`:

   ```bash
   node core/validator/validate.mjs <your>.animation.js --assets renderers/anime-svg/reference/helpers.js
   node renderers/anime-svg/markup/check.mjs <your>.animation.js --css renderers/anime-svg/reference/diagram.css --helpers renderers/anime-svg/reference/helpers.js
   node renderers/anime-svg/test/build-site.mjs --descriptor <your>.animation.js --css renderers/anime-svg/reference/diagram.css --helpers renderers/anime-svg/reference/helpers.js --anime <anime.es.js> --out <dir>
   python3 -m http.server 8765 --directory <dir>
   ```

   The stylesheet and helpers are the reference ones (`reference/`); use your application's instead if it has them. `--anime` is the path to anime.js's `anime.es.js`, which isn't included. `--app <repo>` can replace all three file options for the example project's layout. The first two check the descriptor and the markup. The third refuses a diagram that breaks the contract, and otherwise builds a page you can open at `http://localhost:8765/`.

## Measure the geometry (the checker doesn't)

Open the built page, and in the browser console check what the contract lists as not checked. This asks whether the zone contains its member and its docked volume:

```js
const L = 'skeleton', box = (id) => document.getElementById(id + '-' + L).getBoundingClientRect();
const inside = (a, z) => a.left >= z.left && a.right <= z.right && a.top >= z.top && a.bottom <= z.bottom;
const zone = box('dg-zone-trusted');
[inside(box('dg-box-server'), zone), inside(box('dg-vol-config'), zone)]   // both true once the volume has docked
```

Run it after the volume has docked, because a volume is measured where it is now, not where it will be.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
