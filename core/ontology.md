# Diagram animation: ontology

Status: draft 7, defaults adopted. Revisit a rule if a real diagram disagrees with it. Items marked *(proposed)* have not been confirmed by the user.

**Purpose.** The animation visualizes the intended behaviors of the application, replacing or accompanying written documentation. It is claimed behavior, so accuracy is the success criterion.

**Kinds.** *DSL* means a construct the animation descriptor expresses. *Metadata* is recorded in the descriptor but doesn't animate. *Guidance* is recorded in the descriptor for the agent and its validator, and may scope behavior there, but the renderer neither needs nor enforces it. *Agent-only* is vocabulary for reasoning and for talking with the user. *Export config* is declared per delivery target and applied when exporting; it is not part of the animation itself.

## A. Things on the canvas

| Term | Definition | Kind |
|---|---|---|
| **Node** | A component box. It may be a gesture target, with a hint. | DSL |
| **Zone** | A static spatial container with **members** (including docked assets, measured at their final position), a **padding**, and a label. It is a spatial annotation, not a logical milestone. | DSL |
| **Channel** | A persistent connection between two nodes with ordered endpoints (a → b); "forward" is a → b. It carries many transitions in both directions. Its visibility is a policy: static, or hidden until a trigger reveals it. | DSL |
| **Line** | The visible drawing of a channel. Its visibility belongs to the channel, not to any one transition. | DSL |
| **Path** | The geometry a transition follows. Every transition has one: a channel's path, or its own straight or free path with no channel. | DSL |
| **Asset** | What moves or is shown: a primitive shape, an icon or a bitmap. Its meaning comes from the iconography dictionary. | DSL |
| **Watermark** | An attribution box: credit to the skill and, optionally, to the diagram's author. Its position and size are a **zone with no members**, reused rather than a new geometry-holding construct. Its content (a repo mention, an author name and website) and its fade timing are its own, and it is **permanently static**: once placed it never moves, and only its opacity ever changes. | DSL |

### Zone rules (padding and intersections)

- **Padding** is the clearance between a zone's edge and the outer extent of its members. Padding values, and the minimum clearance to non-members, are recorded per zone.
- A channel between a member and a non-member crosses the zone edge once. That is permitted.
- A channel between two non-members must not pass through the zone: it would read as traffic traversing the zone. Reroute it around the zone.
- A non-member must not overlap a zone edge or sit inside the padding.
- The zone label must not collide with a member.

## B. Things that happen

| Term | Definition | Kind |
|---|---|---|
| **Trigger** | A stimulus that starts a transition or an effect. Kinds: **start**, **delay**, **gesture**, **arrival**, **datum activated**. | DSL |
| **Transition** | An asset moving along a path from an origin to a destination. It starts on a trigger, has a duration, and on completion emits an arrival. Movement only. | DSL |
| **Composite crawler** | Several assets that travel together, from the same origin to the same destination along one channel, as **one transition**: one arrival, matched as the whole list, in order. Declared explicitly as a list of assets on the transition (a move, or a divergence's shared list), never inferred from two single-asset moves that happen to coincide. May have an optional **bounding box**, a visual effect enclosing the cluster while it travels, and a configurable **separation** between the shapes. | DSL |
| **Arrival** | The fact that an asset reached a destination. It can be a trigger (chaining hops without a datum) or part of a condition. | DSL |
| **Local storage** | The set of assets a node holds. It only grows: an asset joins a node's local storage when it **arrives** there (any channel ending at that node), or when a **store** action names that node, and nothing ever removes one. It exists whether or not strict mode is on; strict mode only decides whether sending something a node's storage doesn't contain is an error. It may be **displayed**: small icons overlaid on the node's own box, or in an adjacent bounding box. | DSL |
| **Store** | An action that adds an asset to a node's local storage, for the two cases an arrival doesn't already cover: a node **originating** an asset itself (a store with no arrival precondition), or a node receiving one from a **docked volume** (a store fired once the dock completes). Explicit: the rule it's placed in is the stated reason the node comes to hold it. | DSL |
| **Effect** | A change with no travelling asset. Kinds: **reveal** (a line or node fades in), **acknowledge** (a glow, with a duration), **narrate** (a log line), **hint** (prompt text). | DSL |
| **Condition** | What must hold for a datum: an arrival, another datum, or a gesture, combined with AND/OR. | DSL |
| **Datum** | A named, conceptual milestone meaningful to the viewer, with a label. It becomes true when its conditions hold. It then plays its **closing acknowledgement** (an effect, possibly on several targets at once), and **its triggers activate when that acknowledgement completes**. It may have several triggers, and usually has at least one. Datums are sparse: intermediate hops chain by arrival and need no datum. | DSL |
| **Terminal datum** | A datum that activates no trigger. It ends its sequence with its acknowledgement and nothing follows. It is marked explicitly `terminal`. | DSL |
| **Sequence** | An ordered chain of transitions, effects and datums from one trigger to a closing datum. | metadata |
| **Divergence** | Several transitions carry the identical asset and start together at the **same channel startpoint** (the point where a channel begins on its node), then follow different paths. It is **declared explicitly** on the trigger that starts them, naming the asset (or, for a composite crawler, its list) and the origin node and the branches. Two channels that leave one node from different startpoints are not a divergence: a datum that starts both is simply a datum with two triggers. A **shared prefix** (an initial stretch of path the branches have in common) is allowed only when all branches are in the same lane. It is not a conflict and is never escalated. | DSL |

## C. Meaning and verification

| Term | Definition | Kind |
|---|---|---|
| **Fidelity** | Every sequence is tagged exactly one of: **faithful** (mirrors the application source as coded), **adapted** (changed to fit the medium, with an `adaptation:` reason), or **metaphor** (no real counterpart, conveying a concept, with an `explains:` field). The tag is the sequence's **anchor**: the fixed reference a later reviewer or agent checks it against. | metadata |
| **Operational logic correlation** | A `faithful` or `adapted` sequence carries a `source:` citation to the application code it mirrors. | metadata |
| **Metaphor** | A `metaphor` sequence. Its transitions typically have no channel. Example: shared volumes shift and dock though nothing really moves. | metadata plus DSL |
| **Convergence** | Several sequences converge to satisfy one datum's conditions. Sequences meant to finish together get equal leg durations, not equal crawler speeds. | agent-only |

## D. Time

**Lanes and phases are guidance for the agent creating the animation.** The descriptor records them, and it may use them to scope behaviors, events and sequences (for example, an arrival trigger is scoped to its lane). The renderer **doesn't validate them**: exclusivity of phases, one subject per lane and the escalations below are checked by the agent and the validator, not enforced by the renderer. A decision the agent made because of lanes shows up in behavior only through the descriptor's ordinary constructs.

| Term | Definition | Kind |
|---|---|---|
| **Lane** | An ordered chain of phases about exactly one **subject**. Within a lane, phases are strictly ordered and exclusive: at most one is active at a time. Different lanes run independently and may overlap in time. | guidance, recorded in the descriptor |
| **Subject** | The single thing a lane is about: one connection, one session, one setup process. A flow that seems to have two subjects is two lanes. | guidance, recorded in the descriptor |
| **Phase** | A named, conceptual grouping of sequences inside one lane, isolating a set of behaviors within one timebox. It has an entry (a trigger, usually the previous phase's exit datum), an exit (a datum), the sequences it owns, and the gestures it arms. Phases are not drawn. | guidance, recorded in the descriptor |
| **Timebox** | A phase's time bound. Kinds: **timed** (a derived duration), **event-bounded** (ends at its exit datum), **user-paced** (ends on a gesture, real or simulated), **open-ended** (runs until Reset). | guidance, recorded in the descriptor |
| **Pace** | One factor on every duration and delay in the run: 1 is as authored, 2 is twice as slow, 0.5 twice as fast. It is declared in the descriptor (`pace`) and can be overridden by whatever runs it (a test page, an export profile). It changes how long things take, never what happens or in what order. | DSL |
| **Reset** | Returns the diagram to its start and invalidates every pending timer, transition and effect. Global by default. | DSL |
| **Lane reset trigger** | An optional trigger, declared explicitly on a lane. Firing it resets only that lane. A lane without one is reset only by the global Reset. | guidance, recorded in the descriptor |
| **Interaction mode** | How a viewer's gestures arrive: **user-driven** (the viewer performs each one) or **automated** (the renderer performs each armed gesture on the viewer's behalf). The descriptor declares the default mode and whether the viewer can switch it (the **mode toggle**). Reset keeps the mode (rule 21). | DSL |
| **Lifecycle control** | A control the viewer uses on the run itself, not on the diagram's story. There are two: **Reset** and the **mode toggle**. Neither is a gesture: no phase arms them, they aren't consumed or simulated, and using one fires no rule and satisfies no datum (rule 20). | DSL |
| **Mode toggle** | The lifecycle control that switches the interaction mode, and so decides **who drives the lifecycle**: the viewer, or the renderer on the viewer's behalf. It exists only when the descriptor allows it (`modes.toggle`), sits beside Reset, and can be used at any moment (rule 21). | DSL |
| **Simulated gesture** | A gesture the renderer performs in automated mode after a short delay. It is the **same trigger** as a real one (rule 17) and is acknowledged visibly (rule 18). | DSL |
| **Simulated-gesture acknowledgement** | The effect that shows a simulated gesture happened: for example a short blue glow on the feature being pressed. Its look and duration are declared in the descriptor. It is distinct from a datum's closing acknowledgement. | DSL |
| **Overlay precedence** | For a channel where **different** assets from two lanes (or phases) can coincide, the order in which they take visual precedence: draw order, and which acknowledge glow shows. It is the user's answer to an escalation. **If the user gives none, the newest asset is on top.** Identical assets (same type and colour, like event payloads) need none, since their order is invisible. | DSL |
| **Escalation** | An ambiguity the agent must put to the user instead of resolving itself. | agent-only |

## E. The descriptor and explicit intent

The **animation descriptor** is the generated DSL document for one diagram. It records nodes, zones, channels, lanes, phases, sequences and datums, and the fidelity tag of every sequence. Its draft format is in `core/descriptor.md`.

**Explicit intent:** anything a validator or agent would otherwise infer is stated in the descriptor, because agents re-read what they generated and inference from geometry is lossy. It applies to fidelity tags, lane subjects, lane reset triggers, overlay precedence (when declared), divergences, terminal datums and target profiles.

**Primitives, not mechanics.** Express behavior in the ontology's primitives, not in how the current code happens to produce it. Five service boxes glowing is the closing acknowledgement of the datum "All services are ready", which is satisfied when the volumes have docked. It is not a counter of finished glows. A gesture chain is a series of phases that arm the gesture, not a chain of flags. When the code's mechanics differ from the intent, the descriptor states the intent and the difference is noted in the sequence's `adaptation:`.

## F. Delivery targets

| Term | Definition | Kind |
|---|---|---|
| **Delivery target** | The environment an exported animation is embedded in: the app itself, a Ghost post, a slide. It fixes which presentation differences are allowed, how the animation is packaged, and which gesture triggers can be armed. Not to be confused with a **channel**, which is a connection between two nodes on the canvas. | export config |
| **Target profile** | The declared, per-target record of every allowed difference from the canonical diagram, each with its reason. | export config |
| **Export** | Regenerating a self-contained artifact for one delivery target from the canonical source. | agent-only |
| **Parameter surface** | The named, versioned set of parameters a target profile may set: presentation parameters (CSS custom properties), behavior parameters (a config object) and packaging slots. It is the contract between the canonical source and its exports, so the animation spec can keep changing behind it. | export config |

**Presentation** is what an export may change: size, typography, colour, control size, packaging and asset loading. **Semantics** is what it must not: sequences, datums, lanes, phases, fidelity tags, asset meanings and timing relationships (including convergence).

Procedures for profiles, parameterizing an export and verifying one are in `core/delivery-targets.md`. A concrete profile is in `examples/nats-nkey-demo/ghost-export.md`.

## Relationships

```
trigger → transition(origin → destination, along a path) → arrival
arrival → next transition          (chaining, no datum needed)
arrival(s) + other conditions → datum → acknowledge effect + zero or more triggers
                                        (zero triggers = a terminal datum)
several sequences → one datum       (a convergence)
lane = phase → phase → ...          (one subject; phases chain by exit datum → entry trigger)
```

## Rules

Rules 1, 2, 4, 5, 7 and 10 concern lanes and phases. They are guidance for the agent, checked by the validator and not enforced by the renderer.

1. Each phase belongs to exactly one lane, and at most one phase per lane is active.
2. Every transition, effect and trigger belongs to exactly one phase, so to exactly one lane.
3. Arrival triggers are scoped to their lane. The same channel, direction and asset can mean different things in different lanes without conflict.
4. A gesture trigger is armed only during the phases that list it.
5. Lanes influence each other only through datums. A datum in one lane may be a condition for, or the entry trigger of, a phase in another lane.
6. **Shared channels.** (a) **Avoid** two sequences in the same lane and phase using the same channel: restructure the design. (b) When different lanes or phases put moves on one channel, look at the assets that could coincide. **Identical assets** (same type and colour, like event payloads, or two composite crawlers with the same list in the same order) don't conflict and need no precedence. **Different assets in conflict require an escalation**: ask the user which takes visual precedence, and record the answer as an overlay precedence. If the user gives none, the newest is on top. (c) Where the rendering library needs an order for identical assets, the newest is on top.
7. Only the global Reset exists unless a lane declares its own reset trigger.
8. **Divergence validation.** For a declared divergence: every branch uses the identical asset (or, for a composite crawler, the identical list, in the same order); every branch starts at the declared origin, at the same channel startpoint and at the same time; the branches differ after any shared prefix; a shared prefix is present only if all branches are in one lane.
9. **A declared overlay precedence covers** the draw order of assets on the shared channel and which lane's acknowledge glow shows when both fire. A channel's revealed state is shared: once any lane reveals it, it stays revealed.
10. **Lane reset.** Firing a lane reset trigger returns that lane to its first phase and invalidates its own pending behaviors. Datums the lane had satisfied become unsatisfied. Lanes that already passed those datums are unaffected, because conditions are evaluated when a phase is entered, not continuously. The global Reset applies this to every lane.
11. **An export changes presentation only.** Sequences, datums, lanes, phases, fidelity tags, asset meanings and timing relationships are identical in every delivery target.
12. Every presentation difference is recorded in the target profile with its reason and applied by regenerating from source. An export is never hand-edited.
13. *(proposed)* A target profile declares how each user-paced phase is rendered. If the target cannot provide the gesture, the agent escalates. Automated mode (rules 17 to 19) is one of the answers.
14. A target profile may set only parameters on the parameter surface. Presentation parameters are CSS custom properties defined in the source with defaults equal to the app's values; behavior parameters are a config object; packaging uses named template slots. An unknown or undefined parameter is an error.
15. This skill describes how new or changed work should be done. It does not by itself authorize refactoring existing diagrams or scripts to conform.
16. **Express behavior in primitives** (section E). Don't transcribe the mechanics of an existing script into the descriptor.
17. **A simulated gesture is the same trigger as a real one.** In automated mode nothing in the lifecycle is skipped because no user acted: the gesture fires only in a phase that arms it, is consumed, clears its hint, and its rules and datums then follow exactly as they would after a user's.
18. **A simulated gesture is acknowledged visibly,** before its rules fire, so a viewer can tell a press happened. The acknowledgement is declared in the descriptor (`modes.simulated`). A phase's timebox doesn't change with the mode: a user-paced phase still ends only by a gesture.
19. **The mode is declared.** The descriptor states the default mode and whether the viewer may switch it. Without a toggle the mode is fixed. Switching to user-driven cancels every pending simulated gesture. Switching to automated simulates whatever is armed at that moment. A descriptor with gesture nodes that allows automated mode must declare the simulated-gesture acknowledgement.
20. **The mode toggle is a lifecycle control, not a gesture.** Like Reset it acts on the run, not on the diagram's story. No phase arms it, it isn't consumed, it isn't simulated, and using it fires no rule and satisfies no datum. It changes only who performs armed gestures (rule 19).
21. **The toggle can be used at any moment and never disturbs the run.** Switching leaves every datum, phase, consumed gesture, hint, glow and asset in flight as it is. The only thing cancelled is a pending simulated gesture (going to user-driven), and the only thing started is the simulation of what is armed at that moment (going to automated). Reset returns the run to its start and keeps the mode: the mode is the viewer's choice, not part of the story's state.
22. **Pace scales everything equally.** It multiplies every duration and delay (moves, reveals, glows, docking, `after` delays, repeat intervals, delay conditions, the crawler fade-out, the simulated press) by the same factor, so every relationship between them holds: sequences given equal leg durations still finish together, and a glow still follows the arrival that caused it. To change overall speed, change `pace`. Don't edit each duration.
23. **A composite crawler is one transition with several assets, declared explicitly.** It is not two coincidental single-asset moves that happen to share a trigger and a channel: those are still separate transitions and, if they start together at the same channel startpoint, an undeclared divergence (rule 8). A composite crawler's arrival condition names the same list, in the same order, as the move that sent it.
24. **Local storage is tracked whether or not strict mode is on.** An asset joins a node's storage on arrival there, or on a `store` naming it, independent of `strict` and of whether it's displayed. Strict mode (`strict: true`) only adds a check: every asset a move or divergence sends must be in its origin's local storage. The check is a **local shape check** — does any rule anywhere give this node this asset, not whether it happens before this particular send in every run — so it doesn't verify execution order, and storage only grows, never spends. A node's display (`showLocalStorage`) is independent again: it can be shown with strict mode off, and left undisplayed with it on.
25. **A watermark's zone has no members,** and using one that has any is an error: it is an attribution box, not a trust boundary, so the two roles don't mix. It is visible from the start; if a fade is declared, it fades once and stays hidden, and never re-fades on its own. Reset returns it to visible and restarts its fade, the same as anything else Reset returns to its start.

## Escalations: the agent stops and asks the user

| Situation | What gets recorded |
|---|---|
| Different assets from two lanes (or phases) can coincide on one channel | `overlay precedence` for that channel (the newest on top if the user gives none) |
| A datum has no triggers and no `terminal` marker | `terminal: true`, or the missing trigger |
| *(proposed)* A delivery target cannot arm a gesture a user-paced phase needs | How to render it: drop the phase, run it in **automated mode** with simulated gestures (rules 17 to 19), or show a static frame. Recorded in the target profile |

**Not escalated:**
- Identical assets starting together at the same channel startpoint on different paths, with no divergence declared, is an error the agent fixes itself, either by declaring the divergence or by staggering the starts. Starting from different startpoints is not a divergence and needs nothing declared.
- **Identical assets** overlapping on a shared channel (same type and colour, like event payloads): their order is invisible. The newest is on top if the library needs an order.

## Where each concept lives in the code

See `renderers/anime-svg/concept-map.md`, which maps every term here to the animation behavior and code that realizes it in one renderer.
