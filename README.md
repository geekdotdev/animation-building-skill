# diagram-animation

An agent skill for building animated diagrams that visualize an application's behavior. `SKILL.md` is the entry point. The rest is layered: `core/` (any application), `renderers/`, `domains/`, `examples/`, and `reference-implementation/` (runnable code: a descriptor validator and an anime.js interpreter).

## Getting started

The whole path, in order. [`AUTHORING-WORKFLOW.md`](AUTHORING-WORKFLOW.md) has the commands for each step.

1. **Install the skill once, as a link.** Link this folder into your personal skills as `diagram-animation`, the skill's `name`:

   ```bash
   mkdir -p ~/.claude/skills
   ln -s /path/to/animation-building-skill ~/.claude/skills/diagram-animation
   ```

   Every project then sees the same copy, so there is nothing to keep in step. (Copying the folder to `<project>/.claude/skills/diagram-animation` also works, but the copy goes stale.) The tools need Node 18 or later. If the skill isn't listed, start a new Claude Code session.
2. **Make a project for your animations, in its own git repo.** One command: `reference-implementation/renderers/anime-svg/init/init-project.sh <folder> [--diagram <label>] [--css <file> --helpers <file>]`. It creates the repo, installs anime.js (it isn't included), copies the skeleton in renamed for your diagram, and writes an `export.sh` with the paths filled in. If your application has its own stylesheet and helpers file, pass both: the checks, the test site and the exports use them in place of the reference ones, and the helpers hold the iconography that the descriptor's assets are checked against.
3. **Describe the animation in plain language.** Say which flow to show and where its code is. The agent maps your words to the ontology's terms, drafts the descriptor, cites the code for each step, tags it faithful, adapted or metaphor, and stops to ask you when something is a judgment call. You review it.
4. **Check it and try it.** The validator checks the descriptor, the markup check checks the drawing, and the test site runs it in a browser, user-driven or automated. Geometry is checked by eye.
5. **Change it by asking,** in your own words ("move the client left"). The agent works out what moves with it and re-runs the checks.
6. **Put it in your application.** Copy the descriptor, the diagram block and the interpreter into the application and start it with a few lines. The application's stylesheet and helpers supply the look and the assets.
7. **Or export it** as one self-contained file for somewhere that isn't your application (a blog card, a standalone page).
8. **Keep the copies in step.** The animation project is the source. Change it there, re-run the checks, copy it again, and regenerate any export. Never edit a copy.

## Capabilities

- **Define the descriptor in plain language.** You describe what should happen in your own words ("once all services are healthy, connect the logging client, and let the user click through the login"), and the skill turns it into a descriptor using a well-defined ontology: named terms such as datum, sequence, lane and effect, with rules that say how they combine. It maps the words you use (crawler, line, glow, "at the same time") to those terms, tags every step as faithful, adapted or metaphor with a citation of the code it mirrors, and stops to ask you when something is ambiguous instead of guessing. The validator then checks the result.
- **Generate an animation from a descriptor.** Give it a descriptor (what happens, in order) and the diagram file it names, and it builds a page that runs the animation in a browser. The viewer clicks through each step, or switches to automated and it presses each one with a visible glow, and one `pace` setting slows or speeds the whole thing. The build refuses a drawing that breaks the markup contract, and a separate validator checks the descriptor. The agent can also draft the diagram file, the drawing itself, from a skeleton.
- **Export for a specific delivery channel.** A target profile says where the animation is going (a blog card or a standalone page so far), and the exporter writes one self-contained file for it. It changes how the animation looks there (size, text, colour, pace) and never what it says, and each change is a named setting with a reason.

[`AUTHORING-WORKFLOW.md`](AUTHORING-WORKFLOW.md) shows the steps and commands for all three.

## Example prompt

> Use the diagram-animation skill to write an animation descriptor for the login flow in `spa-server/public/gateways/callout-pop-zero-permission-gateway.js`. Follow `core/workflow.md`. Read the source for `source:` citations, tag each sequence faithful, adapted or metaphor, and stop and ask me about any escalation. Validate it with the validator, then build the test site so I can try it user-driven, with the automated toggle on.

## Troubleshooting

**The server won't stop with Ctrl-C, or the port is already in use.** Find whatever is listening on the port and kill it:

```bash
lsof -ti :8765 | xargs kill
```

**The page looks stale after rebuilding the site.** Hard-refresh the browser (Cmd-Shift-R). A plain reload can serve the old script and stylesheet from its cache.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
