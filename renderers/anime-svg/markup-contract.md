# Markup contract

What a diagram file, its stylesheet and its helpers must provide for the anime.js interpreter (`reference-implementation/renderers/anime-svg/interpreter.js`) to run a descriptor. The **descriptor** says what happens, the **diagram file** holds the SVG (the descriptor holds no geometry), and this contract is the agreement between them.

- **Checked by** `reference-implementation/renderers/anime-svg/markup/check.mjs`, which the test-page builder and the exporter also run. Each rule below names its check in `[brackets]`.
- **Start from** `reference-implementation/renderers/anime-svg/skeleton/`: a diagram file and descriptor that meet the contract, use every kind of element, and run.
- **The example project's** page and stylesheet are one implementation of it. Another application meets the contract with its own.

In this file, *the label* is the descriptor's `diagramLabel`, and every id ends with it: an element named `dg-box-server` is `dg-box-server-<label>`.

## 1. The file

The tools take one block from the file, the `<div class="diagram">` and everything in it. The file can be that block alone or a whole page around it, and anything outside the block is ignored.

```html
<div class="diagram" id="diagram-<label>">                       [root]
  <svg viewBox="0 0 W H"> … zones, volumes, nodes, channels … </svg>   [svg] [viewbox]
  <div class="diagram-log" id="diagram-<label>-log"></div>          [log]
  <div class="diagram-footer">                                      [footer]
    <button class="diagram-replay" type="button" id="diagram-<label>-replay">Replay</button>   [replay]
  </div>
</div>
```

| Rule | Why |
|---|---|
| `[root]` The block is one `div.diagram` with `id="diagram-<label>"`. | It is the root every other id hangs off, and the exporter scopes its styles to it. |
| `[svg]` Exactly one `<svg>`, a **direct child** of the root. | Crawlers are appended to it, and it scales with the container. |
| `[viewbox]` A `viewBox` of four numbers that **starts at `0 0`**. Never a negative origin. | anime.js's `path()` helper offsets every crawler by the origin's negative part. Shift the coordinates instead. |
| `[log]` A `div.diagram-log` with id `diagram-<label>-log`, a direct child. Named by the descriptor's `eventLog.element` (core/descriptor.md §2), but this id/class convention is fixed and doesn't vary with it. | The interpreter writes each narration line into it. |
| `[footer]` `[replay]` A direct-child `div.diagram-footer` holding `button.diagram-replay` with id `diagram-<label>-replay`. | Replay is the Reset control. The mode switch is added to the footer when the descriptor allows it. |
| `[duplicate-id]` `[parse]` Every id is used once, and every tag is closed. | Elements are found by id. |

## 2. What the descriptor names

Every `element` in the descriptor (a node, channel, zone, volume, or a channel's label) is an id `<element>-<label>` that must exist **inside the `<svg>`** `[element]`. A name with no `element` can't be found, and is a warning. The descriptor's `element` is the authority on ids: the naming scheme below is a habit, not a rule.

| Descriptor | Markup |
|---|---|
| **Box node** | A **shape**: `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<path>` or `<line>`, so the acknowledge glow can animate its stroke. `[glow-target]` is an error if a glowed node is a `<g>` or `<text>`. Label it with a `<text>` beside it. |
| **Gesture node** (`gesture: true`) | A `<g>` the viewer presses, with `tabindex="0"` and `role="button"` (a warning if missing: a keyboard user can't press it otherwise), holding its box and a descendant with class `diagram-hint`, which the interpreter fills with the hint text `[hint]`. |
| **Group node** (`group: true`) | A `<g>` holding a box and its sub-boxes (a warning if it isn't a `<g>`). Volumes start overlapping it. |
| **Channel** | **One `<path>`** with class `diagram-line` `[channel-path]` `[channel-class]`. **`forward` is the path's own direction**, first point to last, so draw it from the channel's `a` to its `b`. A second subpath is a warning, because a crawler walks all of them as one length. |
| **Channel visibility** | `visibility: 'hidden'`: a plain `diagram-line`, which the stylesheet starts hidden, until a `reveal`. `visibility: 'static'`: also `diagram-line-static`. A hidden channel with `diagram-line-static` would start visible (a warning). |
| **Channel style** | `style: 'mtls'`: class `diagram-line-mtls`. |
| **Channel label** | A `<text>` with class `diagram-line-label`, hidden until its line is revealed. The descriptor's `label: { element, text }`. |
| **Volume** | A `<g>` whose **id starts `dg-vol-`** `[volume]`. It sits at its **start** position, overlapping the group it comes from. The descriptor's `offset` is how far it moves to dock, so `offset` = final position minus start position. |
| **Zone** | A `<rect>`, drawn **first** so it paints behind what it encloses. It must contain its member nodes and any volume docked into it, at the volume's final position. The checker doesn't measure this (see 5). |

**Paint order** is document order: later elements paint on top. Draw zones first, then groups and volumes, then boxes, then channels. Crawlers are appended last, so they are on top of everything, and the newest crawler is above older ones.

**Naming habit** (from the example project): `dg-<kind>-<name>-<label>` with kinds `box`, `node`, `line`, `vol`, `zone`, `init`. Only the `dg-vol-` prefix is required.

## 3. What the interpreter adds at run time

So the file needn't and mustn't set these itself:
- **Crawlers**, one SVG element per asset in flight, appended to the `<svg>` with class `diagram-crawler`. A **composite crawler** (a move or divergence with `assets`, core/descriptor.md §3.1) is a `<g class="diagram-crawler diagram-crawler-composite">` holding one icon per asset, side by side; its optional bounding box (`box: true`) is a `<rect class="diagram-crawler-box">`, the group's first child.
- **Classes:** `diagram-glow` on an acknowledged element, `diagram-clickable` on an armed gesture node.
- **Inline styles:** `opacity` on revealed lines and labels, `stroke` and `stroke-width` while glowing, and `transform` on volumes as they dock. Replay clears them.
- **The mode switch**, `label.diagram-mode-toggle`, inserted first in the footer when `settings.interactionModes.toggle` is set.
- **A node's local storage display** (a node with `showLocalStorage`, core/descriptor.md §3.2): a `<g class="diagram-storage-display diagram-storage-overlay">` or `diagram-storage-adjacent`, created the first time that node holds something and repopulated as it grows. It reuses `.diagram-crawler-box` for `adjacent`'s bounding box; `overlay` has none.
- **Text:** narration into the log, and each gesture node's `.diagram-hint`.

## 4. The stylesheet and the helpers

**Classes the stylesheet must define** (`checkStylesheet`, warnings): `diagram`, `diagram-log`, `diagram-footer`, `diagram-replay`, `diagram-line`, `diagram-line-static`, `diagram-line-label`, `diagram-hint`, `diagram-clickable` and `diagram-glow`. `diagram-crawler-box` is needed only when a descriptor uses a composite crawler's `box: true` (checked only then). The ones that carry behavior:

| Rule | It must |
|---|---|
| `.diagram-line` | Start **hidden** (`opacity: 0`), with `fill: none` and a stroke. |
| `.diagram-line-static` | Make it visible (`opacity: 1`), and come **after** `.diagram-line` in the source, since they have equal specificity. |
| `.diagram-line-label` | Start hidden, and not take pointer events. |
| `.diagram-crawler` | Start hidden: the helper sets each crawler's opacity when it draws it. |
| `[id^="dg-vol-"]` | `transform-box: fill-box; transform-origin: center;`, so a volume scales and moves from its own centre. Without it docking looks wrong. |
| `.diagram-glow` | The acknowledge glow (a drop shadow). |
| `.diagram-clickable` | Show a pressable node (a pointer cursor). |
| `.diagram-hint` | Small italic text that ignores the pointer. |
| `.diagram-log` | At a viewport of 600px or less, sit in normal document flow **below** the diagram — not overlaid on the canvas. Hard rule (core/ontology.md rule 27): no descriptor field changes it. |

**The log's entries should wrap with a hanging indent** (not checked: it is readability, not something the interpreter depends on). Each entry is a `<p>` that `logDiagramTransition` appends, and a narration line is often long enough to wrap onto several lines. Without an indent the wrapped lines are indistinguishable from the start of the next entry. So `.diagram-log p` takes `padding-left: 1.25em; text-indent: -1.25em;` (or equivalent): the first line stays flush left and every wrapped line is indented. The reference stylesheet does this. A delivery target that restyles the log's paragraphs (the exporter's `log-color` parameter, a host theme's `p` rules) must not undo it.

**Helpers the interpreter is given** (`checkHelpers`, errors if not exported by the helpers file):
- `createCrawlerElement(type)` returns the SVG element for the asset named `type` (a key of the application's iconography), ready to append, with class `diagram-crawler`.
- `createIconElement(type, { x, y, size })` returns a static icon for the asset named `type` (the same shapes as the crawlers, without the `diagram-crawler` class), `size` units tall and centered on (x, y). It has a `place(x, y)` method that moves it and an `iconWidth` (its width at that size). **Required only when some node declares `icons`** (core/descriptor.md §3.5).
- `logDiagramTransition(logSelector, message)` appends a line to the log and scrolls it into view.
- `playVolumeDocking(volumeSelectors, deltas, onComplete, duration)` moves each volume by `deltas[i]` (`{ x, y }`) and calls `onComplete` when all have arrived. `duration` (ms) is the descriptor's dock duration, and a helper that ignores it keeps its own.

**Reference files** that meet all of this, and that the skeleton runs on, are in `reference-implementation/renderers/anime-svg/reference/`. The descriptor's assets must be keys of the iconography. The descriptor validator checks them when given the file (`--assets`).

## 5. What is not checked

Geometry: whether a zone contains its members and docked volumes, whether a channel's endpoints touch its two boxes, whether things overlap or text fits, and whether a channel's path really runs from `a` to `b`. Measure those in a browser (`core/layout.md` §9). The skeleton's README shows how.

## 6. Creating a diagram file

1. Copy `skeleton/diagram.html` and `skeleton/diagram.animation.js`. Choose the label (lowercase letters, digits and hyphens), and replace `skeleton` in every id and in `diagramLabel`.
2. Decide the canvas (`viewBox` width and height) and lay things out on it: `core/layout.md` for the rules, and the renderer's `layout.md` for the anime.js ones.
3. Draw in paint order (zones, groups and volumes, boxes, then channels), giving each descriptor item an id `<element>-<label>`. Draw each channel as one path from `a` to `b`.
4. Write the descriptor's `nodes`, `channels`, `zones` and `volumes` to name them, and put `markup` (the file's path, relative to the descriptor) at the top.
5. Run `markup/check.mjs`, then the descriptor validator, then the test-page builder, and look at it in a browser. Measure the geometry the checker doesn't.

Never edit the ids to make a check pass without changing the descriptor's `element` to match: the two must agree.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
