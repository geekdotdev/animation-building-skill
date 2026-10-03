# Authoring workflow

How a diagram gets from "I have an application" to an exported file, and what you do at each stage. The agent follows `core/workflow.md`, which is the same path in more detail and written for it. This is the shorter version for you, with the commands.

Once the skill is installed (next section), set a shorthand for the code. It is an absolute path, so the commands below run from your animation project, not from the skill's folder:

```bash
R="$HOME/.claude/skills/diagram-animation/reference-implementation"
```

(Working inside this repo instead? Use `R=reference-implementation`.)

## What you end up with

| File | What it holds | Who writes it |
|---|---|---|
| **Descriptor** (`x.animation.js`) | What happens: the milestones, the steps, who moves what, in what order. No geometry. | The agent, from your application's code. You review it. |
| **Diagram file** (`diagram.html`) | The drawing: an SVG with the boxes, lines and volumes, plus a log and a Replay button. | The agent, from the skeleton. You look at it. |
| **Stylesheet and helpers** | How things look and how the crawlers are drawn. | Use the reference ones (`$R/renderers/anime-svg/reference/`), or your application's. |

The descriptor names its diagram in `markup`, so tools only need the descriptor.

## Set up once: install the skill

Link this folder into your personal skills, named `diagram-animation` (the skill's `name`):

```bash
mkdir -p ~/.claude/skills
ln -s /path/to/animation-building-skill ~/.claude/skills/diagram-animation
```

Claude Code finds personal skills at `~/.claude/skills/<name>/SKILL.md` and follows the link, so every project sees this one copy and there is nothing to keep in step. Check with `ls -l ~/.claude/skills`, and start a new session if the skill isn't listed. The tools in `reference-implementation/` need Node 18 or later. To make it available to one project only, link or copy it to `<project>/.claude/skills/diagram-animation` instead (a copy goes stale; a link doesn't).

## Set up per project: a repo for the animations

Each application gets its own folder for animation files, in its own git repo, so the descriptors and drawings have a history and one source of truth. The init script makes it:

```bash
$R/renderers/anime-svg/init/init-project.sh ~/projects/my-animations
cd ~/projects/my-animations
```

Optionally, name the first diagram (the default is the folder's name) and point at your application's stylesheet and helpers:

```bash
$R/renderers/anime-svg/init/init-project.sh ~/projects/my-animations --diagram login-flow \
  --css /path/to/your-app/shared.css --helpers /path/to/your-app/diagram-shared.js
```

It refuses a folder that already has files in it. What it creates:

| In the new folder | What it is |
|---|---|
| `.git/` | A new repo. Nothing is committed, so you choose the first commit. |
| `.gitignore` | Ignores `node_modules` only. |
| `package.json` | Marks your `.animation.js` files as ES modules (without it Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning each time it loads one). |
| `node_modules/animejs` | anime.js 3.2.2, which isn't included with the skill. Skipped with `--no-install`, `--anime` or `--app`. |
| `<label>/diagram.html`, `diagram.animation.js` | The skeleton, with the label already in every id and in `diagramLabel`. Step 3 below is done for the first diagram. |
| `export.sh` | A script that runs the export (step 7) with the right paths and arguments already filled in. |

Then it runs the validator and the markup check on the skeleton as a smoke test. The `REPLACE:` warnings it prints are the placeholders you're about to fill in.

`--css` and `--helpers` are the application's own and replace the reference ones in every command below; give them together, because the helpers hold the iconography and the validator checks the descriptor's assets against it. `--anime` is a path to an existing `anime.es.js` if you have one. `--app <repo>` supplies all three at once, but only for the example project's layout. The paths are recorded in `export.sh`, so you don't repeat them there. Run the script with `-h` for the full list.

The commands in steps 4 to 6 spell the paths out. In your own project, set shorthands once and use them in place of the `$R/…/reference/…` paths:

```bash
CSS=$R/renderers/anime-svg/reference/diagram.css      # or your application's
HELPERS=$R/renderers/anime-svg/reference/helpers.js   # or your application's
ANIME=node_modules/animejs/lib/anime.es.js
```

Pass `--css "$CSS" --helpers "$HELPERS" --anime "$ANIME"` where the commands name the reference files, and `--assets "$HELPERS"` to the validator.

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

`init-project.sh` already did this for the first diagram. For a second diagram in the same project, copy the skeleton into a new folder, keeping the file names so the descriptor's `markup` still finds the drawing:

```bash
mkdir my-diagram
cp $R/renderers/anime-svg/skeleton/diagram.html $R/renderers/anime-svg/skeleton/diagram.animation.js my-diagram/
```

Then replace `skeleton` with your diagram's label (lowercase letters, digits and hyphens) in every id in the HTML and in the descriptor's `diagramLabel`, and replace the content. The agent does this for you (the script did it for the first diagram). `renderers/anime-svg/markup-contract.md` lists what the drawing has to contain.

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

In a project made by `init-project.sh`, run the script it generated:

```bash
./export.sh                          # <label> as a Ghost card → export/<label>-ghost-html-card.html
./export.sh --profile standalone-page
./export.sh --diagram other-diagram  # a second diagram in the same project
./export.sh --check                  # is the export up to date?
```

It creates `export/` if it isn't there. Extra arguments such as `--check` and `--allow-open` go to the exporter. The script and `export/` are committed, not ignored: the exports are derived files, but they are what you publish, so the repo keeps them in step with the diagram. The script is plain bash with its paths at the top, so change them there if the skill or the application moves (or set `SKILL_REPO=…` for one run).

Without it, the same thing by hand:

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

## 8. Put it in your application

Instead of (or as well as) an export, run the diagram inside the application itself. The application gets copies of four things, and a few lines to start it. The example project's lab 5 is built this way (`spa-server/public/gateways/callout-pop-zero-permission-gateway.html` and `.js`).

1. **The descriptor.** Copy it beside the diagram, renamed if you like:

   ```bash
   cp my-diagram/diagram.animation.js /path/to/your-app/public/gateways/my-diagram.descriptor.js
   ```

2. **The diagram block.** Put the `<div class="diagram" id="diagram-<label>">…</div>` from `diagram.html` into the page where the diagram should appear. It is the SVG plus the log and the Replay button; the rest of `diagram.html` can be left out. Each diagram's ids end in its label, so several can share a page.
3. **The interpreter.** Copy `$R/renderers/anime-svg/interpreter.js` into the folder your server serves. It is one browser module with no imports. This is a vendored copy: refresh it when the skill's changes.
4. **A stylesheet and helpers that meet the contract.** The application's own (`renderers/anime-svg/markup-contract.md` §4 lists what they must provide), or copy the reference ones from `$R/renderers/anime-svg/reference/` if it has none.
5. **A few lines to start it,** loaded after the diagram block is in the page:

   ```js
   import anime from '/vendor/animejs/anime.es.js';
   import { createCrawlerElement, logDiagramTransition, playVolumeDocking } from '/diagram-shared.js';
   import { createInterpreter } from '/interpreter.js';
   import descriptor from './my-diagram.descriptor.js';

   createInterpreter(descriptor, { anime, createCrawlerElement, logDiagramTransition, playVolumeDocking }).start();
   ```

   Adjust the import paths to where your server serves each file. The interpreter wires the Replay button to its own `reset()`.

The descriptor's `markup` path is read only by the Node tools, never by the browser, so the copy needs no change there. Run the validator and the markup check against the application's own stylesheet and helpers (`--css`, `--helpers`), then look at the page.

## 9. Keep the copies in step

The animation project is the source of truth. Everything in the application, and every export, is a copy:

- Change the descriptor or the drawing in the animation project, then re-run step 4.
- Copy the descriptor again (and the diagram block, if the drawing changed). Never edit the copy: the next copy overwrites it.
- Refresh the vendored `interpreter.js` when the skill's has changed.
- Regenerate exports with `./export.sh`, and use `./export.sh --check` (or `export.mjs --check`) to find the ones that have gone stale.
- A change that adds or renames an element, or moves a node or its docked volume, needs the drawing and the descriptor changed together. The descriptor's dock offsets are the one geometry it holds.

## Where the details are

| For | See |
|---|---|
| What `init-project.sh` makes and its options | `reference-implementation/renderers/anime-svg/init/init-project.sh -h` |
| The agent's version of this path, with the decision points | `core/workflow.md` |
| What a diagram file, stylesheet and helpers must provide | `renderers/anime-svg/markup-contract.md` |
| The descriptor format | `core/descriptor.md` |
| Profiles and what an export can change | `reference-implementation/renderers/anime-svg/export/README.md` |
| The checks to run after a change | `reference-implementation/renderers/anime-svg/test/README.md` |
| How the interpreter is started, and what it needs passed in | `reference-implementation/README.md` (`renderers/anime-svg/`) |
| The reference stylesheet and helpers | `reference-implementation/renderers/anime-svg/reference/README.md` |
| Something not working | `renderers/anime-svg/pitfalls.md`, and Troubleshooting in `README.md` |

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
