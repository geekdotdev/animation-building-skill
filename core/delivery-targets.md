# Delivery targets

How to export an animation for a specific environment (a blog post, a slide, the application itself) without changing what it says. The terms are defined in `core/ontology.md`, section F: **delivery target**, **target profile**, **parameter surface**, **export**. The rules that apply are 11 to 15 of that file.

The core idea: an export may change **presentation** (size, typography, colour, control size, packaging, asset loading). It must never change **semantics** (sequences, datums, lanes, phases, fidelity tags, asset meanings, timing relationships including convergence).

A concrete profile, the Ghost blog export of the example project's diagram 5, is in `examples/nats-nkey-demo/ghost-export.md`.

## What a target profile records

- container sizing;
- typography and control scaling, with the reason;
- colour and contrast overrides;
- the specificity strategy, for collisions with the target's own styles;
- packaging (fragment or full page; markup, style, script);
- asset loading (vendored path or CDN URL; module or classic script);
- armed gestures: which gesture triggers stay armed, and how an unsupported one is rendered *(proposed)*;
- unsupported features;
- the verification method, and what remains unverified.

## Parameterizing an export

**Status.** This describes how new or changed work should be done. It does not by itself authorize refactoring an existing diagram or script. An existing export may not conform (in the example project it doesn't). Follow this when building or exporting a diagram, or when the user asks to conform existing code.

Use a different technique for each kind of difference:

| Kind | Technique | Why |
|---|---|---|
| **Presentation** (size, colour, font, control size) | CSS custom properties defined in the source styles, with the application's current values as defaults. A profile sets only the ones it changes. | No text replacement or build step. It survives changes to how the source CSS is formatted, and works inside a host page. |
| **Behavior** (armed gestures, autoplay delays, Replay) | A JSON config object injected into the script and read by the renderer. | It is data, not markup. |
| **Packaging** (wrapper, header comment, asset URL) | A small template with named slots (`diagram`, `style`, `script`, `asset-url`, `header`). Handlebars only if the generator runs in Node; Jinja2 or plain slot substitution otherwise. | It is a few lines of scaffolding, and slot values are inserted, not re-parsed. |

Why not text replacement on the source: it couples the export to the source's *formatting*, so an unrelated edit breaks it, and it doesn't tell a reader which differences are intended. The parameter surface is a stable contract instead.

**Presentation parameters.** Name each one after what it controls (`--diagram-width`, `--log-font-size`, `--replay-padding`, …) with the application's current value as its default. Set them on the diagram's own root element so a host page's rules for `p` or `button` can't override them. The specificity fix then lives once, in the source rules, not in each export. A table of one project's parameters and values is in `examples/nats-nkey-demo/ghost-export.md`.

**Behavior parameters** *(proposed)*: `armedGestures` (`all`, or a list), `mode` (the default interaction mode, and whether the toggle is shown: the descriptor's `settings.interactionModes`; ties to rules 13 and 17 to 19), `replay` (present or not).

**Packaging slots**: `header`, `diagram`, `style`, `script`, `asset-url`.

**Generator checks.** Fail if a profile sets an unknown parameter, if a profile parameter has no definition in the source, or if the output still contains an unfilled slot.

## Verifying an export

1. Regenerate. Never edit the output.
2. Confirm the output contains each profile rule and the current sentinel strings (renamed titles, recent features), so you know it isn't stale.
3. Load the exported fragment into an isolated frame at the target's width and check computed styles and a screenshot. Whether that can also run the animation depends on the environment's script policy. Where it can't, the check covers **styling only**.
4. Verify animation behavior in the application itself. If the export's script is the source script unchanged apart from imports, behavior cannot drift.
5. Remove any temporary copy afterwards.
6. Record what remains unverified, such as behavior inside the real host.

## Reference implementation

`reference-implementation/renderers/anime-svg/export/` is an exporter for the anime.js renderer. It takes the descriptor and a target profile and writes one self-contained file. How it maps to this file:

- **Presentation** uses the parameter surface in `surface.mjs`: each parameter is a custom property on the diagram's root id, and the rules it drives are scoped to that id (the specificity strategy). **Deviation from the method above:** the application's own CSS doesn't define these properties, so the exporter defines the surface itself and emits the rules, instead of reading defaults from the source. When an application's CSS defines them, a profile can set them directly.
- **Behavior** is the profile's `behavior` (`mode`, `toggle`, `replay`, `pace`), applied to a copy of the descriptor: `settings.interactionModes` for the first two, and `settings.paceMultiplier` (ontology rule 22) for how fast everything runs.
- **Packaging** is a template with the slots `header`, `style`, `diagram`, `script` and `asset-url`.
- **Generator checks:** an unknown parameter, a parameter with no reason, or one whose target isn't in the exported diagram is an error, and so is an unfilled slot in the output.
- **Staleness:** the export's header records a hash of each source, and `--check` compares a fresh export with an existing file.
- **Gestures:** a target that can't take clicks, for a descriptor with gesture nodes, is an escalation unless the profile sets automated mode with no toggle (ontology rules 13 and 17 to 19).

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
