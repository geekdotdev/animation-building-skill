# Authoring workflow

The order to work in, tying the other files together. Three tasks:

- **A. A new animation** for an application.
- **B. A change to an existing animation,** usually from a user's request.
- **C. An export** for a delivery target.

Each step names the file that has the details. This file only orders them and marks where to stop and ask. A shorter version for people, with the commands, is `AUTHORING-WORKFLOW.md` at the repo root.

**Where things stand.** The descriptor format (`core/descriptor.md`) has a validator and a reference interpreter (`reference-implementation/`), but no diagram has been switched over. So today the descriptor is the **design record**, and the animation is still implemented in the project's own scripts (`renderers/anime-svg/concept-map.md` shows how each construct is realized). Keep the two in sync. For a diagram that has been switched over to the interpreter, the descriptor is the source and the implementation step disappears.

## Principles

- **Read the source, then describe intent.** The application's code is the truth for what is faithful. The descriptor states the *intent* in the ontology's primitives, not the mechanics of an existing script (`core/ontology.md`, rule 16).
- **Ask before deciding what only the user can decide.** See "Where to stop" at the end.
- **Say what you did and didn't verify** (`core/verification.md`).
- **Don't refactor what wasn't asked.** The skill says how new or changed work should be done, and existing code may not conform.

## A. A new animation

### 1. Frame it with the user
Agree on the **purpose sentence**: which application behavior this animation shows, for whom, and what it deliberately leaves out. List the flows to include. Choose the renderer adapter and the domain pack (`SKILL.md`, layers). **Checkpoint: confirm scope before drawing anything.**

### 2. Read the source of truth
For each flow, read the application code that does it, and note where (`file:function`). These become `source:` citations. Don't work from memory or from another diagram.

### 3. Find the subjects and the milestones
- **Subjects:** each connection, session or process that has its own story. Each becomes a **lane** (guidance for you; `core/ontology.md`, section D).
- **Milestones:** each moment the viewer should recognize ("All services are ready", "the browser is authenticated"). Each becomes a **datum**. Give each a name specific to its subject.
- **Sequences:** the ordered chains between them. Write one line of intent for each.

### 4. Choose patterns and assets
Look in the domain pack's `patterns.md` for a matching sequence, and in its `iconography.md` for assets. Reuse before inventing. Tag each sequence `faithful`, `adapted` (with a reason) or `metaphor` (with what it explains). Note every simplification.

### 5. Find what needs a decision
Before drafting, look for the situations that need the user:
- different assets from two lanes coinciding on one channel (an **escalation**; `core/ontology.md`, rule 6);
- a datum with no triggers and no `terminal` marker;
- identical assets starting together from the same channel startpoint on different paths (a **divergence**, to declare);
- a design choice with several reasonable answers (offer options, don't pick).

Ask now, once, with the question templates in `core/phrasebook.md` §5.

### 6. Draft the descriptor
Write it in the format of `core/descriptor.md`, in primitives: datums with closing acknowledgements, rules of trigger and actions, and guards and gesture phases instead of flag chains. Leave a decision you couldn't resolve as `unresolved` and say so. **Checkpoint: show the user the draft**, especially the `adapted` and `metaphor` choices and any open escalations.

### 7. Lay out the canvas, and create the diagram file
Nodes, zones, channels, volumes, in the order the layout files give (`core/layout.md`, and the renderer's `layout.md` for hard rules). If the diagram file doesn't exist yet, **create it from the renderer's skeleton** (`reference-implementation/renderers/anime-svg/skeleton/`) so that it meets the renderer's markup contract (`renderers/anime-svg/markup-contract.md`), and name it in the descriptor's `markup`. The descriptor holds no geometry, so this file is where the drawing lives. Then run the markup check and the geometry checks.

### 8. Set the timing
Durations, the convergence rule for anything that must finish together, and the pacing (`core/timing.md`, and the renderer's `timing.md`). Decide the viewer's wait and whether it is acceptable.

### 9. Validate
Run the descriptor validator and the renderer's markup check (`reference-implementation/renderers/anime-svg/markup/check.mjs`), and fix what they find. Structural mistakes are cheaper here than in the browser.

### 10. Implement, keeping the descriptor in sync
Build it in the renderer's terms (`renderers/anime-svg/concept-map.md`). Where the implementation can't match the descriptor exactly, change the descriptor to say so as an `adaptation:`, or fix the implementation. They must not disagree silently.

### 11. Verify and report
Follow `core/verification.md` for the kind of change. Report in three parts: verified in the browser, read from the code, not verified. **Checkpoint: report to the user.**

### 12. Export, if asked
Task C.

## B. A change to an existing animation

1. **Read the request through the phrasebook** (`core/phrasebook.md`): its kind, the constructs it touches, and the user's own words to reply in.
2. **Find what depends on what you'll change.** Moving a node also moves labels, lines, docked volumes and zones (`core/layout.md` §8). Changing a duration may change a group of linked ones (`core/timing.md` §6). Changing a datum changes what it triggers.
3. **Check for an escalation** the change would create, and ask if so.
4. **Decide the scope.** One diagram, several, or a diagram and its export? If the user described one and its siblings share the feature, say what you assumed.
5. **Change the descriptor first,** if one exists, then the implementation.
6. **Re-run the checks that apply:** geometry after a layout change, timing after a timing change, the markup check after editing the diagram file, the validator after any of them.
7. **Verify** (`core/verification.md`), including Reset, and the other diagrams if you changed several.
8. **Regenerate any export** of a changed diagram. Nothing detects a stale export for you.
9. **Update the skill when you learn something.** A new pitfall, a rule the user corrected, a value that changed: put it where it belongs (the renderer's `pitfalls.md`, the ontology, the example's conventions), so it isn't relearned.
10. **Reply** in the shared words, saying what moved with the change.

## C. An export

Follow `core/delivery-targets.md`:
1. Name the delivery target, and find or write its profile (examples in `reference-implementation/renderers/anime-svg/export/profiles/`).
2. Change only **presentation** parameters. Never change sequences, datums, fidelity tags or timing relationships.
3. Regenerate from source with the exporter (`reference-implementation/renderers/anime-svg/export/`). Never hand-edit the output. Its `--check` says whether an existing export is stale.
4. Verify what the environment lets you (often styling only), and record what you couldn't.
5. If the target can't run a gesture-driven phase, that is an escalation (rule 13).

## Where to stop and ask

| Situation | Ask about |
|---|---|
| Scope and purpose aren't clear | What the animation should show, for whom, and what to omit |
| Different assets from two lanes can coincide on a channel | Which is drawn on top, or whether they can never coincide (the newest if the user gives none) |
| A datum has no triggers and no marker | Whether it is terminal, or a step is missing |
| A target can't take a gesture the flow needs | Drop the phase, automated mode (simulated, visibly acknowledged presses), or a still frame |
| A choice with several reasonable answers | Which option, after you offer two or three and a recommendation |
| A phrase could mean two constructs | The one question that separates them, with a default |
| The code and the intended story disagree | Whether to show the code's behavior, or the intent, tagged `adapted` |

Otherwise decide, say what you decided, and move on. Don't interview.

## Definition of done

- The descriptor (or its draft) exists and states the intent in primitives, with a fidelity tag and a `source:` on every sequence.
- No escalation is open, or each open one is marked `unresolved` and reported.
- The layout and timing checks pass, and the implementation and descriptor agree.
- Verification ran for the kind of change, Reset was checked twice, and the report separates verified from read from unverified.
- Any export was regenerated, and anything an export couldn't verify is stated.
- What you learned is recorded in the skill, if it was new.

## Anti-patterns

- **Transcribing the script.** Counting glows, flag chains and other mechanics belong in the implementation. The descriptor states the milestone and its acknowledgement.
- **Choosing silently** where the ontology says to ask.
- **Verifying by reading the code** when you could have run it, or reporting a read as a check.
- **Fixing the diagram to fix its export,** or the reverse. Presentation belongs to the target profile.
- **Applying a change to one diagram** that belongs in its siblings, without saying so.
- **Refactoring existing diagrams or scripts** to match the skill, unasked.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
