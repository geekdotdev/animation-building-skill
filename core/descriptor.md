# Animation descriptor format (draft)

The **animation descriptor** is the generated document that states what a diagram's animation means and does, in the terms of `core/ontology.md`. A validator (`reference-implementation/core/validator/`) and an anime.js interpreter (`reference-implementation/renderers/anime-svg/`) read it, but no diagram has been switched over: the example project's gateway scripts still hard-code their flows in `beadArrived` chains (`renderers/anime-svg/concept-map.md` shows how). This file specifies a format for a validator and a shared renderer to read, and it is meant to hold for any application and renderer. The six design choices under "Decisions" were approved by the user. Anything else still marked *(proposed)* is open.

**Examples in this file** use the assets and flows of the NATS and OIDC domain pack (`domains/nats-oidc/`) for concreteness. The format doesn't depend on them.

Following the rule in `SKILL.md`, this describes how new or changed work should be done. It doesn't authorize rewriting an existing diagram to use it.

## 1. Shape of the format

- **A data-only ES module** *(approved)*. `export default { … }`, restricted to values that could be written as JSON: no functions, no computed values. It imports natively in a browser with no policy change (a same-origin module satisfies a strict script policy such as `script-src 'self'`), allows comments for the human reader, inlines into an export as a literal, and needs no parser. File name: `<name>.animation.js`, beside the diagram it describes (in the example project, `spa-server/public/gateways/`).
- **Meaning and behavior live here. Geometry stays in the SVG** *(approved)*. The descriptor points at its SVG with `markup` (a relative path), which is a pointer and not geometry. The descriptor refers to elements by name and never repeats coordinates. A validator reads geometry from the rendered SVG. That keeps one source of truth and lets the format be adopted for an existing diagram without redrawing it.
- **Names, not ids.** The descriptor says `broker`. The interpreter builds `#dg-box-broker-<diagram-label>` from the naming scheme in `core/layout.md`.
- **Fully expanded.** No macros or pattern references. An agent expands a pattern from `domains/nats-oidc/patterns.md` into rules, so the file states exactly what happens and can be read back without knowing the pattern.
- **Direction is `forward` or `return`.** `forward` is the channel's first endpoint to its second (the code's `normal`), `return` the reverse.

## 2. Top level

```js
export default {
  version: 1,
  diagramLabel: 'callout-pop-zero-permission',   // the diagram's id suffix
  markup: 'gateways/callout-pop-zero-permission-gateway.html',   // the diagram's SVG, a path relative to this file
  title: 'Auth-Callout: BFF-Initiated SPA Login, PoP Zero Permission',
  nodes: [ … ], channels: [ … ], zones: [ … ], volumes: [ … ],
  eventLog: { element: 'log' },
  durations: { … },
  datums: [ … ], lanes: [ … ], sequences: [ … ],
  overlays: [ … ],
  pace: 1,                              // one factor on every duration and delay: 2 is twice as slow
  modes: { default: 'user-driven', toggle: true, simulated: { delay: 800, acknowledge: { color: '#1e88e5', duration: 400 } } },
}
```

| Key | Content | Ontology term |
|---|---|---|
| `diagramLabel` | The diagram's id suffix (required). Every element's id is `<element>-<diagram-label>`, and tools read it from here, so there is no separate flag for it. | |
| `markup` | Where the diagram's SVG lives: a path **relative to this file**, to a page or a file holding the diagram. The tools take the `<div class="diagram">` block from it, and it must meet the renderer's markup contract (for anime.js, `renderers/anime-svg/markup-contract.md`). A pointer only: the descriptor still holds no geometry, and the exporter leaves the path out of what it writes. Optional. | |
| `nodes` | `{ name, label?, gesture?, showLocalStorage? }`. `gesture: true` makes it a gesture target and gives it a hint element. `showLocalStorage: { position, offset? }` displays that node's local storage (§3.2): `position` is `'overlay'` or `'adjacent'` (`adjacent` needs an `offset: { x, y }`; `overlay` must not have one). | node, local storage |
| `channels` | `{ name, a, b, duration, visibility, style?, label?, authenticated?, authenticatedBy? }`. `a` and `b` are node names, `duration` is milliseconds, `visibility` is `static` or `hidden`, `style` may be `mtls`. `authenticated: false` declares the channel's authentication as a tracked state (starts false, like `visibility` starts hidden); `authenticatedBy` names the datum whose `acknowledge` targets this channel — that's what sets it `true`. Both optional, and `authenticatedBy` is required whenever `authenticated` is declared. Declaring this doesn't gate anything by itself: nothing currently requires a move onto an `authenticated` channel to check it. | channel, line |
| `zones` | `{ name, label, members: [names], padding }`. The zone's rectangle stays in the SVG. This declares what it must contain. A zone with no members is reusable as a watermark's box (§3.3). | zone |
| `volumes` | `{ name, label, consumer, offset }`. The start position stays in the SVG. The offset is the docking move. | metaphor asset |
| `eventLog` | `{ element }`. Required. Declares the diagram's narration log as an explicit construct rather than an assumed part of the markup contract — `element` names it the same way every other construct is named, so the validator can check it resolves. Its id and class convention (`diagram-<diagram-label>-log`, class `diagram-log`) is fixed by the markup contract and doesn't vary by `element`'s value; geometry and position stay out of the descriptor, same as everywhere else — on a narrow viewport (600px or less) it moves out of its overlay position to sit below the diagram, a hard rule with no per-diagram opt-out. | event log |
| `durations` | Named durations, optionally linked: `{ handshakeLeg: { link: 'channel:logging-client' } }`. | timebox, convergence |
| `datums` | See §4. | datum |
| `lanes` | See §5. | lane, phase |
| `sequences` | See §3. | sequence |
| `pace` | A positive number, default 1: a factor on **every** duration and delay in the run, so 2 is twice as slow and 0.5 twice as fast. To change overall speed, change this and not each duration. Optional. See §9.11. | pace |
| `modes` | `{ default, toggle, simulated }`. `default` is `'user-driven'` or `'automated'`. `toggle: true` lets the viewer switch (the renderer puts a switch beside Replay), and `false` fixes the mode at `default`. `simulated: { delay, acknowledge: { color, duration } }` is required when the mode can be automated: `delay` is the ms between a gesture being armed and its simulated press, and `acknowledge` is the short glow that shows the press. See §9.10. Omitted means user-driven only, with no toggle. | interaction mode, simulated gesture |
| `strict` | A boolean, default `false`: every move's and divergence's assets must be in its origin node's local storage (§3.2). Local storage is tracked either way; this only makes an unstored send an error. | local storage |
| `watermark` | `{ zone, repo?, author?, website?, fade? }`. Attribution to the skill and the developer (§3.3). Optional; omitted means no watermark at all. | watermark |
| `overlays` | `{ channel, lanes, precedence, conflicts? }`. Required when different assets from two lanes (or phases) can coincide on a channel, which is an **escalation**. `precedence` is `[lane names]`, first wins, or `'unresolved'` while the user hasn't answered (a descriptor with any is a draft). `conflicts` lists the asset pairs that differ, so the question can be specific. Identical assets need no entry. The newest is on top if the user gives no precedence. | overlay precedence |
| `validatorExceptions` | `[{ check: 'overlay', channel, reason }]`. Optional. Records that the user has looked at a specific overlay conflict and verified it can't actually happen, so the validator stops escalating it — the conflict is still real and still found, it just no longer blocks the agent. `reason` is a short string; `'temporallySeparated'` is the one defined value so far. It also drops that channel from the "an overlay is unresolved, so mark `draft: true`" requirement, since an exempted conflict isn't an open question anymore. A stale entry (the conflict it names no longer exists) is flagged. | validator exception |

## 3. Sequences, rules, triggers and actions

A **sequence** groups rules, belongs to one lane and phase, and carries its fidelity:

```js
{
  name: 'logging-client-connect',
  lane: 'logging-client', phase: 'connect',
  fidelity: 'faithful',                         // faithful | adapted | metaphor  (required)
  source: 'nats-server INFO/CONNECT handshake', // required unless metaphor
  // adaptation: 'why it differs'                //   required if adapted
  // explains: 'the concept conveyed'            //   required if metaphor
  rules: [ { on: <trigger>, do: [ <action>, … ] }, … ],
}
```

A **rule** says: when the trigger fires, perform the actions. That is the whole behavior model, and it is what the `beadArrived` chain does.

**Triggers** (`on`):

| Trigger | Fires when |
|---|---|
| `{ start: true }` | the diagram loads or the lane's entry fires |
| `{ gesture: 'browser' }` | the node is clicked, in a phase that arms it |
| `{ arrival: { channel, direction, asset } }` | that asset arrives, **from a move in the same lane** |
| `{ arrival: { channel, direction, assets: [name, …] } }` | a **composite crawler** with exactly that list, in that order, arrives, from a move in the same lane |
| `{ datum: 'name' }` | the datum becomes true |

**Actions** (`do`), each optionally with `after: ms`:

| Action | Meaning |
|---|---|
| `{ move: { asset, channel, direction, duration? } }` | a transition along the channel's path. `duration` defaults to the channel's and may name a duration: `'@handshakeLeg'`. |
| `{ move: { assets: [name, …], channel, direction, duration?, box? } }` | a **composite crawler** (§3.1): several assets travel together as one transition. `box: true` draws a bounding box around the cluster. |
| `{ move: { asset, from, to, duration? } }` | a straight transition with no channel (metaphor) |
| `{ reveal: ['name', …] }` | fade in channels or nodes |
| `{ acknowledge: { target, duration? } }` | the orange glow |
| `{ narrate: 'text' }` | a log line, a static string |
| `{ hint: { node, text } }` | set a node's hint |
| `{ repeat: { every: ms, do: [ … ] } }` | run the actions now and every `every` ms until Reset |
| `{ divergence: { asset, origin, branches: [ { channel, direction }, … ], sharedPrefix? } }` | see §6 |
| `{ store: { at, asset } }` / `{ store: { at, assets: [name, …] } }` | adds to a node's local storage (§3.2); no animation, an instant fact |

**Lane scoping replaces the `tag` workaround.** The interpreter tags each in-flight asset with the lane of the rule that created it, and an arrival trigger fires only for a rule in the same lane. Two lanes can use the same channel, direction and asset without colliding.

## 3.1 Composite crawlers

Several assets that travel together as one transition (ontology: **composite crawler**), for a payload that really carries more than one object — a CONNECT frame carrying both a JWT and an access token, say — instead of picking one icon to stand in for the rest.

```js
{ move: { assets: ['zeroPermissionJwt', 'accessToken'], channel: 'broker-browser', direction: 'return', box: true } }
```

- **`asset` and `assets` are mutually exclusive.** Exactly one, on a move, a divergence, or an arrival condition. `assets` needs **at least two** names; a single name is `asset`.
- **Order is part of its identity.** An arrival condition matches the same list, in the same order, as the move that sent it. Two composite crawlers are "identical" (rule 6's exemption, rule 8's divergence identity) only when their lists match exactly.
- **`box` and `spacing` only apply to a composite** (`assets`), never to a single `asset`. `spacing` is the gap between each shape's centre, in diagram units; omitted, it defaults to the renderer's own value (11 for the anime.js renderer).
- **The renderer draws it as one crawler**, one icon per asset, side by side, moving together. The bounding box, if requested, encloses them. No dictionary entry or helper change is needed: each icon is drawn exactly as it would be alone.
- **It's still one transition.** Everything about transitions (a duration, an origin and destination, one arrival) applies to the whole cluster, not to each asset separately.

## 3.2 Local storage and strict mode

Every node has **local storage** (ontology): the set of assets it holds. This is tracked whether or not anything checks it, and whether or not it's displayed — three independent things.

**Tracking (always on).** An asset joins a node's storage when it **arrives** there — the destination end of any move or divergence branch, in any lane — or when a **store** action names that node:

```js
{ store: { at: 'server', asset: 'config' } }        // one asset
{ store: { at: 'browser', assets: ['a', 'b'] } }    // a composite, same rules as a move's assets
```

`store` is a `do` action like any other, so it goes wherever the rule that explains it belongs:
- **Created itself:** a `store` with no incoming arrival needed — typically on `start`, a `gesture`, or a `datum` trigger.
- **Received from a docked volume:** a `store` as the action right after `dock` completes.
- **Received from another channel:** needs no `store` at all — the arrival itself is enough.

Storage only grows. Nothing removes an asset once it's there, and there is no separate node or volume field for this: the rule the `store` is placed in is the stated reason.

**Strict mode (`strict: true`, top-level, optional).** Every move's and divergence's assets must be in its origin node's local storage. This is a **local shape check**, not a simulation: it asks whether *some* rule anywhere gives the origin that asset, not whether it happens *before* this particular send in every run. With `strict` omitted or `false`, storage is still tracked, but an unstored send is not an error.

**Display (`showLocalStorage`, per node, optional, independent of `strict`).** The renderer shows a node's current storage as small icons:

```js
{ name: 'server', element: 'dg-box-server', showLocalStorage: { position: 'overlay' } }
{ name: 'browser', element: 'dg-node-client', showLocalStorage: { position: 'adjacent', offset: { x: 20, y: -20 } } }
```

`position: 'overlay'` centres the icons on the node's own box. `'adjacent'` draws them in a small bounding box beside it, at `offset` from the node (diagram units, like a volume's docking offset). `offset` is required for `adjacent` and invalid for `overlay`.

## 3.3 Watermark: attribution to the skill and the developer

An attribution box, credit to the skill and, optionally, to whoever authored the diagram. Its position and size are a **zone with no members** — reusing the zone construct rather than adding a new geometry-holding field, since geometry already stays in the SVG for every other construct:

```js
zones: [
  { name: 'credits', element: 'dg-zone-credits', label: 'Credits', members: { nodes: [], volumes: [] }, padding: { left: 0, top: 0, right: 0, bottom: 0 } },
],
watermark: { zone: 'credits', repo: true, author: 'Jane Doe', website: 'https://jane.dev', fade: 8 },
```

| Key | Meaning |
|---|---|
| `zone` | Required: the name of a zone to use as the box. That zone must have **no members** — an attribution box, not a trust boundary. |
| `repo` | Optional, default `true`: a credit line naming this skill. `false` omits it. |
| `author` | Optional. **Omitted, it falls back to whatever the host resolves as this machine's git identity** at build or serve time (`git var GIT_AUTHOR_IDENT`: config if set, else `GIT_AUTHOR_NAME`, else the OS account's own name — the same resolution `git commit` itself uses, not just the global config file, which can be empty even when git would still attribute a commit to someone) — the renderer itself has no filesystem access, so a Node-side tool resolves it and passes it in. With no descriptor value and nothing resolvable either, the author line is left out rather than showing a placeholder. |
| `website` | Optional. If given alongside an author (from either source), the author's name becomes a link to it. |
| `fade` | Optional: seconds until it fades out, once, after the diagram starts. `false` (the default if omitted) means **permanent**: it stays visible for the whole run. |

- **Visible on start**, always — there's no "reveal" for a watermark; it's already there in the SVG.
- **Permanently static.** Its position never changes, whatever `fade` is set to. The only thing that can animate is opacity, once, on the fade.
- **Reset** returns it to visible and restarts the fade timer, exactly like anything else Reset returns to its start.

## 4. Datums

```js
{
  name: 'logging-client-authenticated',
  label: 'Logging client is NATS authenticated',
  when: { arrival: { channel: 'logging-client', direction: 'forward', asset: 'natsOk' } },
  acknowledge: { targets: ['logging-client'], duration: 700 },   // a channel's line, a node, or several targets at once
  narrate: 'Logging client is NATS authenticated and starts sending payloads',
  // terminal: true
}
```

- `when` is one condition or `{ all: [ … ] }` or `{ any: [ … ] }` of arrivals, other datums, gestures, or a channel's authenticated state (`{ channel, authenticated: true }`, §2). `all` across sequences is a **convergence**, such as "All services are ready".
- `acknowledge` is the closing acknowledgement, optional: once the datum is satisfied it plays on all its `targets` together, and **the datum's triggers activate when it completes**. `narrate` plays at that point too. This is the ontology's order (a datum is satisfied, then acknowledged, then its triggers fire), and the descriptor states it as intent. It doesn't reproduce a script that counts finished glows to decide a datum is true.
- **`activates` is not stored.** The rules with `on: { datum: name }` are its consequences, so they are derived. Storing them twice would let them disagree.
- **`terminal: true` is explicit** and must be present exactly when no rule reacts to the datum (ontology rule: explicit intent).

## 5. Lanes and phases

**These are guidance for the agent creating the animation.** The descriptor records them and may use them to scope behavior (an arrival trigger fires only for a move in its own lane). The renderer **doesn't validate** them: exclusive phases, one subject per lane and the escalations are checked by the agent's validator (section 8), not enforced at render time.

```js
{
  name: 'logging-client',
  subject: "the logging client's connection to the broker",
  entry: { datum: 'all-services-ready' },
  // resetTrigger: { gesture: 'replay-logging' },   // only if declared
  phases: [
    { name: 'connect', timebox: 'event-bounded', exit: 'logging-client-authenticated' },
    { name: 'steady',  timebox: 'open-ended' },
  ],
}
```

- One `subject` per lane. Phases are ordered: a phase's entry is the previous phase's exit datum (the first phase's is the lane's `entry`).
- `timebox` is `timed` (with `duration`), `event-bounded` (with `exit`), `user-paced` (with `arms: [gesture nodes]`) or `open-ended`.
- Reset is global unless the lane declares `resetTrigger`.

## 6. Divergence, explicitly

A divergence is written as an action, so it cannot be mistaken for an accident:

```js
{ divergence: { asset: 'payload', origin: 'broker',
    branches: [ { channel: 'subscriber-a', direction: 'forward' },
                { channel: 'subscriber-b', direction: 'forward' } ],
    sharedPrefix: null } }
```

A divergence's branches can share a composite list instead of one asset (`assets: [...]` in place of `asset`, §3.1): every branch still carries the identical list, in the same order.

`sharedPrefix` names a shared stretch of path, and is allowed only when every branch is in this rule's lane.

**A divergence is about the channel startpoint,** not the node. The branches must begin at one point, which the SVG holds (the first point of a forward path, the last of a return path), so a validator measures it from the markup. Two channels that leave a node from different points aren't a divergence, even when one datum starts the same asset on both: those are two rules with the same trigger, and nothing needs declaring.

## 7. A worked excerpt

The logging client's handshake (pattern 1) in example diagram 5, fully expanded. The auth-callout handshake is the same with channel `auth-callout` and its own datum and lane.

```js
{
  name: 'logging-client-connect', lane: 'logging-client', phase: 'connect',
  fidelity: 'faithful', source: 'nats-server INFO/CONNECT handshake',
  rules: [
    { on: { datum: 'all-services-ready' }, do: [
        { reveal: ['logging-client'] },
        { narrate: 'Broker sends a NATS INFO request to the logging client' },
        { move: { asset: 'natsInfoRequest', channel: 'logging-client', direction: 'forward', duration: '@handshakeLeg' } } ] },
    { on: { arrival: { channel: 'logging-client', direction: 'forward', asset: 'natsInfoRequest' } }, do: [
        { narrate: 'Logging client responds with a signed NATS CONNECT request' },
        { move: { asset: 'natsConnectRequest', channel: 'logging-client', direction: 'return', duration: '@handshakeLeg' } } ] },
    { on: { arrival: { channel: 'logging-client', direction: 'return', asset: 'natsConnectRequest' } }, do: [
        { narrate: 'Broker sends OK to the logging client' },
        { move: { asset: 'natsOk', channel: 'logging-client', direction: 'forward', duration: '@handshakeLeg' } } ] },
  ],
}
```

The datum `logging-client-authenticated` (§4) closes it. Its consequence, starting the steady traffic, is a rule in the `steady` phase with `on: { datum: 'logging-client-authenticated' }` and a `repeat`.

## 8. What a validator checks

These are the checks of the validator (`reference-implementation/core/validator/validate.mjs`), run before rendering. The renderer itself doesn't enforce the lane and phase rules among them.

| Check | From |
|---|---|
| A move, divergence or arrival has exactly one of `asset` or `assets` (at least two names); `box` only with `assets` | composite crawler |
| With `strict: true`, every move's and divergence's assets are in its origin's local storage (built from arrivals and `store` actions) | local storage |
| A watermark's `zone` resolves, and it has no members | watermark |
| Names and durations resolve, and every asset exists in `ICONOGRAPHY` (`diagram-shared.js`; `domains/nats-oidc/iconography.md` is an example seed of it) | integrity |
| Every sequence has a fidelity; `faithful` and `adapted` have a `source`; `adapted` has an `adaptation`; `metaphor` has `explains` | ontology, fidelity |
| Every lane has one `subject`; phases chain by exit datum | rules 1 and 5 |
| A datum with no reacting rule has `terminal: true`, and one with a reacting rule doesn't. A datum with neither is an **escalation** | terminal datum |
| Two sequences in the same lane and phase sharing a channel is an **error** to restructure. Different assets from two lanes (or phases) on one channel need an `overlays` entry, and without one the validator **escalates**. Identical assets are exempt. A `validatorExceptions` entry naming that channel suppresses the escalation (and drops the draft-required rule for it) instead of requiring a `precedence`; a stale one (the conflict it names no longer exists) is flagged. | rule 6, validator exception |
| A channel's `authenticated` needs `authenticatedBy` naming a real datum, and that datum's `acknowledge.targets` must include the channel. A `{ channel, authenticated: true }` condition needs a channel that declares `authenticated`. | channel authentication |
| A divergence has identical assets, one origin, one channel startpoint (measured from the markup), branches that differ after any prefix, and a prefix only within one lane | rule 8 |
| Identical assets starting together at the **same channel startpoint** on different paths, with **no** divergence declared, is an **error**, which the agent fixes itself. Different startpoints are fine. | rule 8 |
| Every gesture node is armed by some phase | rule 4 |
| Zones: members inside with the padding, non-members outside, no channel between non-members crossing (measured from the rendered SVG) | `core/layout.md` §5, §9 |
| Sequences meant to finish together use one named duration | `core/timing.md` §4 |

## 9. The interpreter's contract

What the interpreter guarantees, so a descriptor author never hand-writes it. Until an interpreter exists, the same rules bind whoever implements the animation by hand (see the renderer's `pitfalls.md`). Rules marked *hard* make the animation wrong when broken.

### 9.1 Order of work
1. Validate, then stop on an escalation rather than guess.
2. Arm gestures and evaluate triggers per phase, and tag assets with their lane so arrival triggers scope to it. Don't validate lane or phase rules: that is the validator's job.
3. Narrate through the renderer's log helper, and animate with the renderer's own calls. For anime.js and SVG, `renderers/anime-svg/concept-map.md` lists them.

### 9.2 State
Everything that can differ between "just loaded" and "mid-run" is one of: **datum state**, **phase and gesture state** (the current phase per lane, what is armed, what was consumed), **pending behavior** (timers, `repeat` loops, hops in flight, glows in progress) and **visible state** (revealed lines and labels, glows, docked assets, hint text, the log). The **interaction mode** is not one of these: it is the viewer's choice, and Reset keeps it (ontology rule 21). The environment (scroll, focus, the host page) isn't the animation's, so leave it alone. The interpreter owns all of it, and the descriptor has no flags.

### 9.3 Start
The interpreter runs the descriptor's start trigger on load (in an export, when the target lets it). Everything begins hidden or at rest. Reset re-runs the start behavior, and it doesn't reload the page.

### 9.4 Gating
- *Hard:* a gesture that arrives before its phase arms it does nothing, silently, and doesn't change state.
- *Hard:* a gesture is consumed when it fires. A second click on the same armed step does nothing, and one click can't match two steps.
- A gesture node isn't presented as clickable until it is armed.
- Conditions are evaluated when a phase is entered, not continuously.

### 9.5 Hints
A hint is set when its gesture is armed and **cleared when that gesture is consumed**. Empty means nothing is armed. On Reset it returns to its first text.

### 9.6 Waiting
- **timed:** a delay, which is pending behavior and is cancelled by Reset;
- **event-bounded:** ends on a datum, with no timer;
- **user-paced:** *hard:* the phase ends only when its gesture fires, and **no timer ends it**. In automated mode the renderer *performs* the gesture (§9.10), so the phase is still ended by a gesture. A target that can't deliver a gesture and can't run automated mode is an escalation (ontology rule 13).

Never poll for state: fire the trigger when the datum is satisfied.

### 9.7 Reset
Reset returns every kind of state in 9.2 to its start and invalidates everything pending. Global unless a lane declares `resetTrigger`.
1. *Hard:* invalidate pending behavior **first** (advance the generation counter, one per diagram, or per lane for lane resets), then reset state.
2. *Hard:* every timer, loop, hop and glow carries the generation it started in and checks it when it fires. On a mismatch it stops without acting: no state change, no next hop, no log line.
3. Cancel what the library can cancel, and check the generation anyway, because some libraries don't cancel their own pending delays.
4. Reset covers all of 9.2, including consumed gestures, datums and hidden lines, even for state that "can't exist yet" (Reset can be pressed mid-run).
5. Reset is idempotent. Twice, mid-run, and before the first step has finished all give the same result.
6. Reset must not remove steady-state traffic other than by stopping and restarting its `repeat`, and must not touch anything outside the diagram.
7. **Lane reset:** firing a lane's `resetTrigger` returns only that lane to its first phase, invalidates only its own pending behavior, and makes the datums it satisfied unsatisfied (ontology rule 10). This needs a generation per lane. Nothing implements it yet: tell the user rather than fake it with a global Reset.

### 9.10 Interaction mode
The descriptor's `modes` (§2) declares the default mode and whether the viewer can switch it. Ontology rules 17 to 19 apply:
1. **Same lifecycle in both modes.** A simulated gesture goes through the same gate as a real one (9.4): it fires only in a phase that arms it, it is consumed, it clears the hint, and its rules and datums follow. Only who performs the gesture differs.
2. **Simulation.** In automated mode, once a gesture node is armed (and not consumed), the renderer waits `modes.simulated.delay`, then plays `modes.simulated.acknowledge` on that node (the press), and only when that finishes performs the gesture. A phase is simulated once per entry, so an open-ended phase that arms a gesture is pressed once.
3. **Re-checked before it fires.** The gesture is dropped if the node is no longer armed when the acknowledgement finishes (the viewer clicked first, the mode changed, or Reset happened).
4. **Switching.** To user-driven: every pending simulated gesture is cancelled, and a press acknowledgement in progress is cancelled with it, so the glow stops and nothing fires. To automated: whatever is armed at that moment is simulated. Reset keeps the mode.
5. **The toggle** is present only when `modes.toggle` is true. The renderer places it beside Replay. It is a lifecycle control like Reset, not a gesture (ontology rules 20 and 21): no phase arms it, it isn't consumed or simulated, it fires no rule, and using it never disturbs the run.
6. **Observable:** each gesture is reported as `by: 'user'` or `by: 'simulated'`.

### 9.11 Pace
The descriptor's `pace` (default 1) is a factor on every time value the interpreter uses, and the interpreter applies it in one place. Ontology rule 22 applies:
1. **Everything scales, by the same factor:** each channel's and move's `duration`, the named `durations`, every `after` delay, `repeat` intervals, `{ delay }` conditions, the crawler fade-out at the end of a move, and the simulated press (`modes.simulated.delay` and its glow).
2. **Relationships are preserved.** Legs that were given one duration stay equal, so sequences that finish together still do, and a datum's acknowledgement still follows the arrival that satisfied it.
3. **Overrides.** A host can override `pace` (the test page's `?pace=2`, an export profile's `behavior.pace`). The override replaces the descriptor's value, and doesn't multiply it.
4. **Validation.** `pace` must be a positive number. A value more than ten times faster or slower than authored is a warning.
5. **What it doesn't change:** what is narrated, the order of events, or which gestures are armed. A user-paced step still waits for the viewer, however slow the pace.

### 9.8 What stays with the descriptor author
- **Gate autonomous behavior on what the real system waits for.** A client publishes after its own handshake completed (a datum), not when its process is merely up. This is a fidelity rule, so write the datum as the rule's condition.
- **One datum, one meaning.** Don't stand in for a datum with a flag the descriptor doesn't declare.
- **Hint words** are the viewer's ("Click to Subscribe"): they name the action, not the mechanism.
- **Checklist when adding behavior:** which datum gates it, what if the viewer acts early, is its gesture consumed and its hint cleared, is every new timer or loop covered by Reset, and did you run Reset twice (`core/verification.md` §8).

## Decisions *(all approved by the user)*

1. **Format:** a data-only ES module. The alternative is JSON, which has no comments and needs a fetch or an inline data block.
2. **Geometry stays in the SVG.** The alternative is generating the SVG from the descriptor, which is a much larger change.
3. **Behavior as rules** (`on` / `do`), with sequences as grouping and metadata. The alternative is an explicit state-machine graph, which is heavier to read and write.
4. **`activates` derived, `terminal` explicit.**
5. **Named durations with links** for convergence.
6. **Lane-scoped arrival triggers** in place of a `tag`.

## Adoption path

Done, in this order:
1. A descriptor written for one diagram (example diagram 5) from its existing script, as documentation and to test the format.
2. The validator: `reference-implementation/core/validator/`.
3. The interpreter: `reference-implementation/renderers/anime-svg/`, checked against example diagram 5's script.

Not done, and not authorized by this file: switching a diagram over to the interpreter. That happens on the user's request.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
