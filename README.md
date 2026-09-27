# diagram-animation

An agent skill for building animated diagrams that visualize an application's behavior. `SKILL.md` is the entry point. The rest is layered: `core/` (any application), `renderers/`, `domains/`, `examples/`, and `reference-implementation/` (runnable code: a descriptor validator and an anime.js interpreter).

**Install** by copying this folder to `<your project>/.claude/skills/diagram-animation`.

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
