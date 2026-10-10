---
name: diagram-animation
description: Use when creating, changing, reviewing or exporting an animated diagram that visualizes an application's behavior, replacing or accompanying written documentation. Defines a shared vocabulary (datum, transition, effect, sequence, ...), a descriptor format, and rules for layout, timing, verification and export, and says when the agent must stop and ask the user. Has a renderer adapter for anime.js and SVG, a NATS and OIDC domain pack, and a worked example from this project.
---

# Diagram animation

**Status: draft.** The guidance layers, the descriptor format, a validator and an interpreter are written. One diagram, lab 5 of the example project, runs on the interpreter (the other example diagrams still use their own scripts), and the unwritten parts are listed under "Not yet written" so the gaps are visible instead of assumed.

## Purpose

The animation is a visualization of the intended behaviors of an application, replacing or accompanying written documentation. It is claimed behavior, so accuracy is the success criterion: a wrong asset is a documentation bug, and every simplification has to be labelled (see fidelity tags in the ontology).

## Layers

The skill is layered so that most of it works for **any application**. Read what your task needs.

| Layer | Folder | What it holds | Applies to |
|---|---|---|---|
| **Core** | `core/` | `ontology.md` (terms and rules), `workflow.md` (the order to work in), `phrasebook.md` (reading the user's requests), `descriptor.md` (the format), `delivery-targets.md` (exports), `layout.md`, `timing.md`, `verification.md` | any application and renderer |
| **Renderer** | `renderers/anime-svg/` | `concept-map.md` (terms to animation behavior), `markup-contract.md` (what a diagram file must provide), `layout.md`, `timing.md`, `pitfalls.md` | diagrams built with anime.js v3 and inline SVG |
| **Domain pack** | `domains/nats-oidc/` | `iconography.md` (assets and their meaning), `patterns.md` (recurring flows) | diagrams about NATS messaging and OIDC login. An example: another domain gets its own pack. |
| **Reference implementation** | `reference-implementation/` | `core/validator/` (the descriptor validator, with tests). `renderers/anime-svg/`: the interpreter, `skeleton/` (a diagram file and descriptor to copy), `markup/` (the markup check), `reference/` (a stylesheet and helpers that meet the contract), a test page, and `export/` (the exporter for delivery targets). | runnable code that mirrors the layers above. It is not read as guidance. |
| **Example** | `examples/nats-nkey-demo/` | `README.md`, `conventions.md` (sizes, durations, timeline), `environment.md` (commands and pitfalls), `phrases.md` (real requests, mapped), `ghost-export.md` | this project, as a worked example to imitate |

For a **new project**, read `core/`, pick or write a renderer adapter and a domain pack, and use the example as a model. For **this project**, also read the example.

## How to use this skill

1. **Read `core/ontology.md` first,** then follow `core/workflow.md` for the task: a new animation, a change to an existing one, or an export. The ontology defines every term and the rules that follow from them. The workflow orders the other files and marks where to stop and ask. The same path for a person, with the commands in one place, is `AUTHORING-WORKFLOW.md`.
2. **Use its terms with the user, and read their requests through `core/phrasebook.md`.** Say "datum", "lane", "divergence" and "escalation" the way the ontology defines them, so the vocabulary stays consistent across sessions and agents. Some terms are agent-only and have no construct in the animation descriptor. The phrasebook maps the user's own words (crawler, line, glow, "at the same time") to constructs, and gives question templates for escalations.
3. **Escalate, don't guess.** Stop and ask the user in these situations, and record the answer explicitly in the descriptor:
   - different assets from two lanes (or phases) can coincide on one channel: ask which takes overlay precedence. Identical assets, like event payloads, need none, and two sequences in the same lane and phase sharing a channel should be restructured instead;
   - a datum has no triggers and no `terminal` marker: ask whether it is terminal or a trigger is missing.
4. **Declare intent explicitly, and in primitives.** Express behavior in the ontology's primitives (a datum and its closing acknowledgement), not in the mechanics of an existing script. Fidelity tags, lane subjects, lane reset triggers, overlay precedence (when declared), divergences and terminal datums are written down, never left to be inferred from geometry. You will re-read your own generated source later, and inference from geometry is lossy.
5. **Tag every sequence** `faithful`, `adapted` or `metaphor`, with a `source:` citation for the first two.
6. **Lanes and phases are guidance for you,** the agent creating the animation. The descriptor records them and can use them to scope behavior, but the renderer doesn't validate them: you and the validator do.
7. **Configuring an animation:** use the renderer's concept map (`renderers/anime-svg/concept-map.md`) to translate an ontology term into the behavior and parameters that realize it, and its "say it as" wording when describing the result to the user.
8. **Starting a new flow:** look in the domain pack's `patterns.md` for a matching pattern before inventing a sequence. Adapt it to the user's intent, tag fidelity on each resulting sequence, and remember that two lanes sharing a channel with different assets are an escalation.
9. **Creating the diagram file, or placing or moving anything on the canvas:** the descriptor holds no geometry, so the drawing lives in a diagram file that the descriptor names in `markup`. To create one, copy `reference-implementation/renderers/anime-svg/skeleton/` and meet the renderer's `markup-contract.md`, then run `reference-implementation/renderers/anime-svg/markup/check.mjs`. To place or move things, follow `core/layout.md` and the renderer's `layout.md`. Hard rules always apply. Conventions are defaults, so change them if the user wants. Re-run the geometry checks after a layout change.
10. **Describing or designing an animation:** write it in the format of `core/descriptor.md`, marking each choice there that isn't settled. Run `reference-implementation/core/validator/` on it before anything else. A reference interpreter exists (`reference-implementation/renderers/anime-svg/`), but no diagram has been switched over, so each project's own scripts remain what runs until the user asks for that.
11. **Setting durations or pacing:** follow `core/timing.md` and the renderer's `timing.md`. Sequences that must finish together get equal leg durations, never a wait. To change the overall speed, set the descriptor's `pace`, don't edit each duration. Re-measure after any change.
12. **Adding a gesture, timer, loop or any state:** follow the interpreter's contract in `core/descriptor.md` §9 (gating, hints, waiting, reset). Until an interpreter exists it binds whoever implements the animation by hand: every new piece of state gets its reset in the same change, and every pending behavior is guarded by the generation counter. **Verifying a change:** follow `core/verification.md`, choosing the steps for the kind of change, and report what you verified, what you only read from the code, and what you couldn't verify.
13. **When something doesn't work or doesn't show up:** check the renderer's `pitfalls.md`, then the example's `environment.md`. Most problems so far were already hit once.
14. **Choosing or adding an asset:** see the domain pack's `iconography.md`. It is an example seed of the visual vocabulary and how meaning is attached to it, not a specification. Reuse an existing asset before adding one, and prefer what the user wants over what the seed happens to do.
15. **Exports change presentation only.** When exporting an animation for a delivery target (a blog post, a slide), follow `core/delivery-targets.md`: record every difference in a target profile that sets only parameters on the parameter surface, regenerate from source, never hand-edit the output, and never change the sequences. How to run the exporter is in "Exporting an animation", below.
16. **When the user asks how to set up or use the skill,** point them to `README.md` ("Getting started") and `AUTHORING-WORKFLOW.md`. The whole path, in order: install the skill as a link at `~/.claude/skills/diagram-animation`; make a git repo for the animations with `init-project.sh <folder> [--diagram label] [--css f --helpers f]` at the top of this skill (an entry point that forwards to `reference-implementation/renderers/anime-svg/init/`, where the logic and tests live because they are specific to the anime.js renderer; it installs anime.js, copies in the renamed skeleton, and writes an `export.sh`, which, like `export/`, is committed rather than ignored); describe the animation in plain language and build it with the ontology; check it and try it; change it by asking; put it in the application (copy the descriptor, the diagram block and the interpreter, and start it with a few lines) or export it; keep the copies in step with the source, which is the animation project.

    `init-project.sh <project-dir> [options]` takes:
    - `<project-dir>`: the folder to create. It must not exist, or be empty, or hold only a `.git` folder (a fresh clone of an empty remote; its remote and settings are kept); the script refuses anything else.
    - `--diagram <label>`: the first diagram's folder and id suffix (lowercase letters, digits, hyphens). Default: the folder's name.
    - `--css <file>` and `--helpers <file>`: the application's own stylesheet and helpers, instead of the reference ones. Give both: the helpers hold the iconography the validator checks the descriptor's assets against, and the script warns if only `--css` is given.
    - `--anime <file>`: use an existing `anime.es.js` instead of installing anime.js into the project.
    - `--app <repo>`: an application laid out like the example project; supplies the stylesheet, helpers and anime.js together.
    - `--no-install`: don't run npm (for no network, or when `--anime`/`--app` supplies anime.js, or the user will install it). The script skips npm on its own when `--anime` or `--app` is given.
    - `-h`: the full list. The script makes the repo but doesn't commit, so leave the first commit to the user.

## Exporting an animation

Use this when the user wants the diagram somewhere other than the application: a blog card, a standalone page, a slide. The exporter turns the descriptor and a **target profile** into one self-contained file. Rules 11 to 14 of `core/ontology.md` apply: an export changes presentation only.

1. **Find out the target and what it can do.** Ask if the user hasn't said: where the file goes, whether it can take clicks (a live page can, a slide or a static embed can't), and whether it has network access for a CDN import.
2. **Find or write the profile.** Look in `reference-implementation/renderers/anime-svg/export/profiles/` for one that fits (`ghost-html-card`, `standalone-page`). For a new target, copy the nearest one and change only these:
   - `presentation`: parameters from the fixed surface in `export/surface.mjs` (diagram width, margin and max width; the log's width, height, padding, font size and colour; Replay's padding and font size; the mode switch's font size), each a plain CSS value **with a reason** in `reasons`;
   - `behavior`: the default `mode`, whether to show the `toggle`, and whether to keep `replay`;
   - `packaging` (`fragment` to paste into a host page, or `page`), `assets.anime` (`cdn`, or `inline` when the target has no network or blocks external scripts), and `gestures` (`live` or `none`);
   - `unverified`: what you couldn't test, honestly.

   If the look you need isn't on the surface, don't patch the output or the CSS: ask the user before adding a parameter to `surface.mjs`, since it extends the contract.
3. **Export.** In a project made by `init-project.sh` (it's in the project's root as `export.sh`), run that: it has the skill, stylesheet, helpers and anime.js paths filled in, creates `export/` if it's missing, and passes any other argument to the exporter.

   ```bash
   ./export.sh [--diagram <label>] [--profile ghost-html-card|standalone-page|<profile.js>] [--allow-open] [--check]
   ```

   The output is `export/<label>-<profile>.html`. Both the script and `export/` are committed, not git-ignored. Without that script, call the exporter directly:

   ```bash
   node reference-implementation/renderers/anime-svg/export/export.mjs \
     --descriptor <file.animation.js> --profile <target profile.js> --out <file.html> \
     --css <shared.css> --helpers <diagram-shared.js> --anime <anime.es.js> [--allow-open] [--check]
   ```

   The descriptor names its own diagram (`markup`) and id suffix (`diagramLabel`), so neither is a flag. `--app <repo>` can replace the three file options for the example project's layout. If the descriptor has no `markup`, add one (a path relative to the descriptor) rather than working around it.

   Exit 0: written. **Exit 1:** errors in the descriptor or the profile: fix the cause, never the output. **Exit 2:** open escalations, or a target that can't take clicks: **stop and ask the user** (`core/phrasebook.md` §5 has the wording). Pass `--allow-open` only when the user knows the descriptor is a draft. If the target can't take clicks, the choices are automated mode (`behavior: { mode: 'automated', toggle: false }`, so the renderer presses each step for the viewer with a visible press) or a decision to drop the phase or show a still frame, which the exporter doesn't implement.
4. **Verify what you can.** Load the file in a browser (`python3 -m http.server <port> --directory <folder with the file as index.html>`), and check: no console errors; the styles the profile sets, with `getComputedStyle`; the width at the target's column width and at a narrow one; the mode switch (if present) and a run in automated mode. `--check` says whether an existing export is stale. After changing the exporter itself, run `node reference-implementation/renderers/anime-svg/export/test.mjs`.
5. **Report** what you verified, what the profile lists as `unverified`, and the known difference: the export's behavior comes from the descriptor and the interpreter, not from the diagram's own script.

**Never** hand-edit an exported file, change the descriptor to fix how an export looks, or use `--allow-open` to get past an escalation the user hasn't seen. To change how an export looks, change its profile and regenerate. More detail, including the profile format and the exporter's limits, is in `reference-implementation/renderers/anime-svg/export/README.md`, and the method is in `core/delivery-targets.md`.

## Not yet written

Nothing is planned. Until the user names something, don't invent contents: ask, or read the current scripts. Known gaps:

1. **Only one example diagram uses the interpreter.** Lab 5 of the example project runs on it (its `callout-pop-zero-permission` descriptor, with a vendored copy of `interpreter.js`); the interpreter was first validated against that diagram's original script (`reference-implementation/renderers/anime-svg/test/README.md`). The other example diagrams keep their own scripts, and switching one over needs the user's request.
2. **Not implemented in the interpreter:** overlay precedence (the newest asset is on top), lane reset triggers, and `sharedPrefix` divergences.
3. **The exporter** has no `armedGestures` parameter, and no still-frame or drop-the-phase rendering for a target that can't take clicks. It takes the application's stylesheet, helpers and anime.js as options (`--app` supplies the example project's layout).
4. **The descriptor format still lists seven additions as *proposed*** (`examples/nats-nkey-demo/README.md`, its `FINDINGS.md`). The validator and interpreter accept them.

**Written:** `core/descriptor.md` specifies the animation descriptor (a data-only ES module of rules that say "when this trigger fires, do these actions", plus datums, lanes and phases, with fidelity and explicit-intent fields), what a validator checks, and the renderer's contract. Its six design choices are approved by the user.

**Existing code does not conform yet.** See `examples/nats-nkey-demo/README.md`. This skill describes how new or changed work should be done. Don't refactor existing diagrams or scripts to conform unless the user asks.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
