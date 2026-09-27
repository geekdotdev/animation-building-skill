# Layout rules that come from anime.js and SVG

Rules a diagram built on **anime.js v3 and inline SVG** has to follow. They come from how that library and format work, not from taste, so they are **hard**. The general layout rules are in `core/layout.md`, and this project's numbers are in `examples/nats-nkey-demo/conventions.md`.

The structure and ids the interpreter needs from a diagram file are in `markup-contract.md`, and a diagram to start from is in `reference-implementation/renderers/anime-svg/skeleton/`.

## Canvas

- **The `viewBox` starts at 0, 0.** Never a negative origin. anime.js v3's `path()` helper offsets every crawler by exactly the `viewBox`'s negative min-y. Shift all coordinates instead. (The example project's example diagram 5 shifts its coordinates +70 in y for this reason.)
- **Scaling.** The SVG fills its container (`width: 100%; height: auto`), so all coordinates are SVG units, not pixels. Its `overflow` is visible, so glows and crawlers can extend past the edge, but don't place anything out there.
- **HTML overlays don't scale with it.** An event log or a button beside the SVG is sized in CSS pixels and `rem`.

## Lines and paths

- **One `<path>` per channel.** Crawlers follow it with `anime.path(selector)`, which needs a single element. Reveal a line and its label together by passing an array of targets to the reveal helper. Don't fold the label into the path selector.
- **Drawing order is direction.** The path's start is the channel's first endpoint (`normal`, a to b). anime's `direction: 'reverse'` plays it backwards.
- **Selectors are ids.** Every animated element is found by id, which is why ids must be unique across the page (`core/layout.md` §2).

## Docking

- **A volume has no path element.** It moves by fixed `translateX` and `translateY` offsets from its start position (`playVolumeDocking` in the example project). A final position is start plus offset.

## Measuring in the browser

- Measure rendered geometry with `getBoundingClientRect()` on the elements by id, not `getBBox()` (which is in SVG units and ignores transforms).

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
