# Authoring workflow

How a diagram gets from "I have an application" to an exported file, and what you do at each stage. The agent follows `core/workflow.md`, which is the same path in more detail and written for it. This is the shorter version for you, with the commands.

Commands run from this folder. Set a shorthand for the code:

```bash
R=reference-implementation
```

## What you end up with

| File | What it holds | Who writes it |
|---|---|---|
| **Descriptor** (`x.animation.js`) | What happens: the milestones, the steps, who moves what, in what order. No geometry. | The agent, from your application's code. You review it. |
| **Diagram file** (`diagram.html`) | The drawing: an SVG with the boxes, lines and volumes, plus a log and a Replay button. | The agent, from the skeleton. You look at it. |
| **Stylesheet and helpers** | How things look and how the crawlers are drawn. | Use the reference ones (`$R/renderers/anime-svg/reference/`), or your application's. |

The descriptor names its diagram in `markup`, so tools only need the descriptor.

## 1. Ask for a draft

Tell the agent which flow to show and where its code is, and say you want to be asked about anything that's a judgment call. For example:

> Use the diagram-animation skill to animate the login flow in `src/auth/`. Cite the code for each step, label what you simplified, and stop and ask me about anything ambiguous.

It reads your code, drafts the descriptor, and **stops to ask you** about a few things it can't decide:

- two different things can be on the same line at once (which should be drawn on top?);
- a milestone leads to nothing (is it the end, or is a step missing?);
- a step the viewer clicks, in a place that can't take clicks (play it automatically, drop it, or show a still?).

Everything else it decides and tells you.

## 2. Look at the draft

Two things worth checking before you go further:

- **Does each step say what the code does?** Every step is tagged `faithful`, `adapted` (with what was simplified and why) or `metaphor`. The animation is a claim about your application, so a wrong step is a documentation bug.
- **Are the milestones the ones a viewer would name?** "All services ready", "the user is signed in". They are what the rest of the animation hangs off.

## 3. Create the diagram file

Copy the skeleton into a new folder, keeping the file names so the descriptor's `markup` still finds the drawing:

```bash
mkdir my-diagram
cp $R/renderers/anime-svg/skeleton/diagram.html $R/renderers/anime-svg/skeleton/diagram.animation.js my-diagram/
```

Then replace `skeleton` with your diagram's label (lowercase letters, digits and hyphens) in every id in the HTML and in the descriptor's `diagramLabel`, and replace the content. The agent does this for you. `renderers/anime-svg/markup-contract.md` lists what the drawing has to contain.

## 4. Check it

```bash
node $R/core/validator/validate.mjs my-diagram/diagram.animation.js --assets $R/renderers/anime-svg/reference/helpers.js
node $R/renderers/anime-svg/markup/check.mjs my-diagram/diagram.animation.js \
  --css $R/renderers/anime-svg/reference/diagram.css --helpers $R/renderers/anime-svg/reference/helpers.js
```

The first checks the descriptor, and the second checks the drawing against the contract. Exit 0 is clean, 1 means errors to fix, and (for the validator) 2 means open questions for you. Warnings are worth reading: a `REPLACE:` placeholder left in a step is one.

## 5. Try it

```bash
node $R/renderers/anime-svg/test/build-site.mjs --descriptor my-diagram/diagram.animation.js \
  --css $R/renderers/anime-svg/reference/diagram.css --helpers $R/renderers/anime-svg/reference/helpers.js \
  --anime <path to anime.es.js> --out /tmp/my-diagram-site
python3 -m http.server 8765 --directory /tmp/my-diagram-site
```

Open `http://localhost:8765/`. anime.js isn't included, so `--anime` is the path to its `anime.es.js`. The build refuses a drawing that breaks the contract.

It starts in the descriptor's default mode, and the switch beside Replay changes it: **user-driven** waits for you to click the highlighted node at each step, and **automated** presses each one for you, with a short blue glow so you can see it happened. Add `?mode=automated` to the URL to start that way.

To see it slower or faster, add `?pace=2` (twice as slow) or `?pace=0.5` to the URL. To make it permanent, set `pace` in the descriptor: one number that scales every duration and delay together, so anything that should finish together still does.

What to look at:

- the steps happen in the order you expect, and the log tells the same story;
- lines and labels appear when their step starts, not before;
- Replay puts everything back, twice in a row;
- nothing overlaps or runs off the box it belongs to. The checker doesn't measure geometry, so this one is by eye (the skeleton's README has a snippet for zone containment).

## 6. Change it, and go round again

Ask for the change in your own words ("move the client left", "make both handshakes finish together", "add a glow when the token arrives"). The agent works out what else moves with it (labels, lines, a docked volume) and re-runs the checks that apply. Reload after rebuilding. If the page looks stale, hard-refresh.

## 7. Export it

An export is the diagram as **one self-contained file** for somewhere else: a blog card, a standalone page. It changes how the diagram looks (size, text, colour), never what it says.

```bash
node $R/renderers/anime-svg/export/export.mjs --descriptor my-diagram/diagram.animation.js \
  --css $R/renderers/anime-svg/reference/diagram.css --helpers $R/renderers/anime-svg/reference/helpers.js \
  --anime <path to anime.es.js> \
  --profile $R/renderers/anime-svg/export/profiles/standalone-page.target.js --out my-diagram.html
```

The **profile** says where it's going, and it can set the pace of the exported copy (`behavior: { pace: 1.5 }`). Use `standalone-page` (a full page, anime.js inlined, no network) or `ghost-html-card` (a fragment to paste into a Ghost post), or ask the agent to write one for a new place. Every difference from the app's look is a named setting with a reason, so nothing is a hand-edited string.

- The export stops if the descriptor has errors, or open questions. Add `--allow-open` only when you know it's a draft.
- If the place can't take clicks, the export stops and asks: play the steps automatically (a profile setting), drop them, or show a still.
- `--check` tells you whether an exported file is out of date. Regenerate it, and never edit it.
- Load the result in a browser before you publish it. The real destination (does a Ghost card keep the script?) often can't be tested from here, and the profile lists what wasn't.

## Where the details are

| For | See |
|---|---|
| The agent's version of this path, with the decision points | `core/workflow.md` |
| What a diagram file, stylesheet and helpers must provide | `renderers/anime-svg/markup-contract.md` |
| The descriptor format | `core/descriptor.md` |
| Profiles and what an export can change | `reference-implementation/renderers/anime-svg/export/README.md` |
| The checks to run after a change | `reference-implementation/renderers/anime-svg/test/README.md` |
| Something not working | `renderers/anime-svg/pitfalls.md`, and Troubleshooting in `README.md` |

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
