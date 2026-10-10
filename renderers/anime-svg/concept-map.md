# Concept → animation map

Maps each ontology term to the animation behavior that realizes it, so an agent can configure an animation and describe it to the user with the same words every time.

**Scope.** This is the **anime.js v3 and inline SVG** renderer adapter. How a primitive is realized (a reveal is an opacity animation, a transition follows `anime.path()`, a glow animates the stroke) holds for any diagram built that way. The **function and variable names** in the tables (`showLine`, `glowBox`, `sendBead`, `beadArrived`, `payloadGeneration`, …) and the file paths are the example project's own, so treat them as illustrations.

**Status.** "Realized today" describes the current gateway scripts (anime.js v3 plus SVG). A reference interpreter (`reference-implementation/renderers/anime-svg/interpreter.js`) does that column's job from a descriptor, but no diagram uses it yet, and the *Parameters* column is the descriptor's fields. Values are example diagram 5's at the time of writing; other diagrams differ in details. Nothing here is a specification: where the user wants something different, follow the user and update this file.

Files: `spa-server/public/gateways/*-gateway.js` (one per diagram), `spa-server/public/diagram-shared.js`, `spa-server/public/shared.css`.

**Columns.** *Say it as* is the plain wording to use with the user. *Agent-only* terms have no animation behavior of their own.

## Canvas

| Concept | Realized today | Parameters | Say it as |
|---|---|---|---|
| **Node** | SVG `<rect class="diagram-box">` with `<text>` labels. A gesture target is a `<g id="dg-node-…" tabindex role="button">` with a click listener. | position, size, label; gesture target: which gestures arm it | "the browser box", "the component" |
| **Zone** | `<rect class="diagram-zone" rx="10">` plus `<text class="diagram-zone-label">` at the rect's top-left (+8, +13). Static, drawn first so it sits under everything. No animation. | x, y, width, height (padding is measured from its members, including docked assets), label | "the private network box" |
| **Channel** | A `CHANNELS.chN = { path: '#dg-line-…', duration }` entry. Direction `normal` follows the path's drawing order (a → b), `reverse` runs it backwards. | path selector, per-channel duration, endpoints | "the connection between X and Y" |
| **Line** | `<path class="diagram-line">`, opacity 0 until revealed. `.diagram-line-static` is always visible. Must be a single `<path>`, because crawlers follow it with `anime.path()`. | `d` (geometry), style class | "the line" |
| **Path** | The line's `d` attribute, sampled by `anime.path(selector)` into `translateX`/`translateY`. A volume has no path element: it moves by a fixed offset. The `viewBox` must be zero-based or the helper miscomputes points. | geometry, or an (x, y) offset | "the route" |
| **Asset** | An `ICONOGRAPHY` entry built by `createCrawlerElement(type)` and appended to the `<svg>`, or, for a node's static `icons`, by `createIconElement(type, …)` and placed by the interpreter's `placeNodeIcons`. See `domains/nats-oidc/iconography.md`. | type (shape, colours) | "the padlock", "the token" |

## Things that happen

| Concept | Realized today | Parameters | Say it as |
|---|---|---|---|
| **Trigger: start** | `initDiagram()` on load. Replay doesn't call it again: it re-runs the init narration and docking directly (see Reset). | none | "when the diagram loads" |
| **Trigger: delay** | `setTimeout` (guarded by `payloadGeneration`) or `setInterval`. Not anime's own `delay`: anime doesn't cancel a pending delay on `anime.remove`, so a stale one would fire after Replay. | milliseconds | "two seconds later" |
| **Trigger: gesture** | A click listener on a `#dg-node-…` group, gated by state flags. The hint under the node tells the viewer what is armed. | which node, which phase arms it, hint text | "when the user clicks the browser" |
| **Trigger: arrival** | A branch of `beadArrived(channel, direction, type[, tag])`, matching on that triple | channel, direction, asset type | "when the padlock reaches the broker" |
| **Trigger: datum activated** | The code that runs after the flag is set (in the acknowledgement's `onDone`) | which datum | "once X is authenticated" |
| **Transition** | `sendBead(channel, direction, type[, tag])`: create a crawler, `anime({ targets: bead, translateX: path('x'), translateY: path('y'), easing: 'linear', duration, direction })`. On completion it fades out (350ms, easeOutQuad) and calls `beadArrived`. A volume: `playVolumeDocking(selectors, deltas, onComplete)`, offsets over 900ms, easeOutQuad. | channel, direction, asset, duration (channel default, or `HANDSHAKE_LEG_DURATION` for handshake legs) | "the token travels from A to B" |
| **Arrival** | The point in `sendBead`'s completion where `beadArrived` is called. If Replay happened meanwhile (`payloadGeneration` changed) the crawler is removed and there is no arrival. | asset, destination | "reaches", "lands at" |
| **Effect: reveal** | `showLine(selector \| [selectors], onVisible)`: opacity 0 → 1 over 700ms (easeOutQuad). A node can fade the same way (the Init Containers box fades out 2s after docking, over 600ms). | target(s), duration | "the line appears" |
| **Effect: acknowledge** | `glowBox(selector, onDone)`: adds `.diagram-glow` (orange drop shadow) and animates the outline gray → `#ff9f1c` → gray with width 1.5 → 3 → 1.5 over 700ms. It works on any stroked element, nodes and lines alike. `resetBox` clears it. | target, duration | "the line glows orange" |
| **Effect: narrate** | `logDiagramTransition(logSelector, message)`: appends a `<p>` (present tense, a static string), keeps at most 40 lines, scrolls to the bottom | message | "the log says …" |
| **Effect: hint** | Setting `.textContent` of `#dg-node-… .diagram-hint` | text | "the hint changes to …" |
| **Condition** | An `if` over flags, or a counter compared with a total | which arrivals, datums or gestures, AND/OR | "once both … have happened" |
| **Datum** | A boolean flag (`linesReady`, `oidcAuthenticated`, `loggingClientAuthenticated`, `authCalloutAuthenticated`, …), set in the acknowledgement's `onDone`, usually with a log line announcing it | label, conditions, acknowledgement, activated triggers | "X is authenticated", "all services are ready" |
| **Terminal datum** | Today, just the absence of any following call. The explicit `terminal` marker is a descriptor concern. | `terminal: true` | "the end of that flow" |
| **Sequence** | A chain of `sendBead` calls across successive `beadArrived` branches (for example INFO → CONNECT → OK → glow) | ordered steps, fidelity tag | "the handshake", "the login" |
| **Divergence** | No instance today. It would be several `sendBead` calls started from one handler with the same asset and different channels whose paths begin at the same point. Channels that begin at different points are not one. | asset, origin, branches, shared prefix | "the message fans out to …" |

## Meaning and verification

| Concept | Realized today | Say it as |
|---|---|---|
| **Fidelity** (`faithful`, `adapted`, `metaphor`) | No animation behavior. Recorded in the descriptor. Today it only appears in code comments (for example "simplified: really via the redirect") and in the wording of log lines. | "this follows the real code", "this is simplified because …", "this is a picture of …, not real movement" |
| **Operational logic correlation** | No animation behavior. A `source:` citation in the descriptor. | "this mirrors `file:function`" |
| **Metaphor** | The volumes: visible and docked at the Init Containers box from the first frame, then sliding 900ms to their consumers; when all have docked, every service box glows at once | "the volume slides to the service that uses it" |
| **Convergence** | *Agent-only.* Realized by a counter (`boxesGlowed` against the number of boxes) that gates "All services are ready", and by equal leg durations across sequences that must finish together (`HANDSHAKE_LEG_DURATION`). | "both finish together" |

## Time

| Concept | Realized today | Parameters | Say it as |
|---|---|---|---|
| **Lane, subject** | Not explicit. Implicit in code groupings: the logging client's handshake (`ch3`), auth-callout's (`ch7`), setup, and the user's gestures. The `tag` argument on `sendBead` works around two lanes sharing `ch7`. | subject, entry trigger | "the logging client's connection" |
| **Phase** | Not explicit. Implicit: init narration (`logInitContainerSequence`), docking plus glows, the gesture chain, the steady-state loop. | entry, exit datum, armed gestures | "the docking part" |
| **Pace** | The reference interpreter: `dur()` and `scaled()` multiply every duration and delay by the descriptor's `settings.paceMultiplier` (or `env.pace`). The diagram scripts have no such thing. | pace | "slow it all down", "twice as fast" |
| **Timebox** | *timed:* narration lines 2000ms apart. *event-bounded:* docking, ends at "All services are ready". *user-paced:* the gesture chain. *open-ended:* payload traffic every 3000ms. | kind and value | "this waits for the user", "this repeats" |
| **Lifecycle control** (Reset and the mode toggle) | Reset is the Replay handler. The mode toggle is a checkbox the interpreter puts beside Replay (`setMode`). Neither goes through `onClick`, so neither is a gesture: nothing arms them, and they don't consume a step. | | "Replay", "the switch by Replay" |
| **Local storage, and its display** | The interpreter tracks each node's holdings (`storeAt`) from every arrival and `store` action, whether or not the descriptor's `strict` is set. A node's `showLocalStorage` gets a small `<g>` of icons: `overlay` centred on the node's own `getBBox()`, `adjacent` at that centre plus the node's `offset`, in its own bounding box. | position, offset | "what does the server have now", "show its storage" |
| **Interaction mode** | The reference interpreter (`reference-implementation/renderers/anime-svg/`): a switch beside Replay when `settings.interactionModes.toggle` is set. The diagram scripts have no such thing: they are user-driven only. | default, toggle | "automated" or "user-driven", "the switch by Replay" |
| **Simulated gesture, and its acknowledgement** | The interpreter waits `settings.interactionModes.simulated.delayMs`, plays a short glow (a Web Animations `filter: drop-shadow` in `settings.interactionModes.simulated.acknowledge.color`) on the pressed node, then performs the gesture through the same path as a click. Not in the diagram scripts. | delay, color, duration | "it presses for you", "the blue glow" |
| **Reset** | The Replay handler: `payloadGeneration++`, clear flags, empty the log, `clearInterval`, remove crawlers (`anime.remove`, then remove the element), reset lines and boxes, re-run the init narration | none | "replay" |
| **Lane reset trigger** | None today | trigger, lane | "replay just this part" |
| **Overlay precedence** | Not declared today. What happens is DOM order: crawlers are appended to the `<svg>` last, so they paint on top, and the most recently appended is on top. That is also the fallback when the user gives no precedence. Required, via an escalation, when different assets from two lanes can coincide; identical assets need none. | ordered list of lanes | "which one is drawn on top" |
| **Escalation** | *Agent-only.* Stop and ask. | | "I need you to decide …" |

## Delivery

| Concept | Realized today | Say it as |
|---|---|---|
| **Delivery target, target profile, parameter surface, export** | `scripts/build_lab5_standalone.py`: exact-string replacements on the source CSS, an import rewrite, and a wrapper, producing one Ghost HTML fragment. There is no profile file or parameter surface yet (see `core/ontology.md`, section F). | "the Ghost version", "the exported copy" |

## Timing reference (example diagram 5, as of writing)

| Name | Value | Used for |
|---|---|---|
| `LINE_ACK_DURATION` | 700ms | reveal, acknowledge |
| bead fade-out | 350ms | end of every transition |
| volume docking | 900ms | metaphor transition |
| init narration spacing | 2000ms | timed phase |
| Init Containers fade | 600ms, started 2000ms after docking | reveal effect |
| logging-client traffic | every 3000ms | open-ended phase |
| log cap | 40 lines | narrate |
| channel durations | `ch1` 1300, `ch2` 900, `ch3` 1200, `ch4` 1800, `ch7` 800, `ch8` 800 (ms) | transitions |
| `HANDSHAKE_LEG_DURATION` | equal to `ch3` (1200ms) | handshake legs, so two handshakes finish together |

## Keeping the words consistent

- **Channel, line, path.** The *channel* is the connection, the *line* is its drawing, the *path* is a transition's route. Don't use "line" for the connection.
- **Zone, not boundary.** A boxed spatial area is a zone. A milestone is a datum.
- **Datum, not flag.** "Flag" is the code; "datum" is what the viewer sees as a milestone.
- **Transition versus effect.** Only something that travels is a transition. A glow, a reveal, a log line and a hint are effects.
- **Delivery target, not channel.** "Channel" already means a connection on the canvas.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
