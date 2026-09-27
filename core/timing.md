# Timing and pacing rules

How long things take, and how to make sequences line up, for any application. Same strengths as `core/layout.md`:

- **Hard** rules: breaking one makes the animation wrong or broken (stale timers firing after a reset, sequences that can't finish together).
- **Convention** rules: sensible defaults that can change when the user wants something different.

Terms (transition, arrival, effect, timebox, convergence) are in `core/ontology.md`. Library-specific timer and easing rules are in `renderers/anime-svg/timing.md`. This project's actual durations and timeline are in `examples/nats-nkey-demo/conventions.md`.

## 1. Principles

- **Hard: the unit is duration, not speed.** A channel has a duration. A crawler's speed follows from its line's length. To compare or synchronize sequences, compare durations.
- **Hard: a hop starts on the previous hop's arrival.** The arrival fires when the moving asset's animation completes, and the next transition or effect starts at that instant. Don't chain off a fade-out.
- **Hard: don't synchronize by anchoring.** Never add waits, or hold one sequence until another reaches a point, to make them finish together. Give their legs equal durations (section 4). Chained arrivals then keep them together by construction.
- **Hard: every pending timer must be cancellable by Reset.** Use a mechanism that a reset can invalidate (a generation counter checked when the timer fires), not one it can't reach. Which mechanism that is depends on the renderer.
- **Convention: moving assets go at constant speed.** Reveals, glows and docking ease out.

## 2. How each timebox is timed

| Timebox | Timed by | Example |
|---|---|---|
| **timed** | A derived duration made of delays | Narration lines at a fixed spacing |
| **event-bounded** | Its exit datum, not a clock | Docking ends at "All services are ready" |
| **user-paced** | The viewer. **No timers**, and no auto-advance | A gesture chain: the hint names the armed click |
| **open-ended** | A repeating delay until Reset | Steady traffic at a fixed cadence |

## 3. Channel durations, and the convergence rule

**Convention: there is no formula for a channel's duration.** Pick each by feel, so a moving asset is readable and a long line doesn't drag. In the example project, speeds differ about fourfold from a short slow line to a long fast one (`examples/nats-nkey-demo/conventions.md` has the table). The only hard constraint is convergence:

- **Hard: sequences that must finish together give every leg the same duration.** When two exchanges start at the same instant, every leg of both uses one shared duration. The asset on the longer line therefore moves proportionately faster. That is intended.
- **Convention: link them.** Derive the shared duration from one channel's, so retiming that channel retimes the group.
- **Other traffic on the same channel keeps its own duration.**
- **Formula.** A multi-hop exchange takes reveal + n × leg + closing acknowledgement.

## 4. Pacing

- **Convention: one narration line per meaningful step.** A line per hop of an exchange is fine. Don't narrate every repeated message: a steady loop would drown the one-time story.
- **Convention: leave time to read.** A narration line needs a couple of seconds. **Judgement (proposed):** a long or dense line may deserve longer. Ask the user rather than guess.
- **Convention: start what needs no user immediately.** Autonomous parts begin as soon as their precondition is met. Nothing waits for a gesture unless a real client would wait.
- **Convention: keep a loop slow.** A steady cadence should read as "alive" without competing with a one-time flow.
- **The viewer's wait is a design cost.** Extra narration adds its full spacing to the time before the first interaction.
- **Change the overall speed with `pace`, not by editing durations.** The descriptor's `pace` scales every duration and delay by one factor (ontology rule 22), so what must finish together still does. Editing durations one by one is for changing a single channel or step, and a literal number that isn't linked to a channel won't follow a change to it.

## 5. Delivery targets

A target with no gestures can't run a user-paced phase. It must declare how to render it (`core/ontology.md`, section F, rule 13): drop the phase, run it in automated mode (the descriptor's `modes`, with a visibly acknowledged simulated gesture and its `delay`), or a static frame. The agent escalates to the user for the choice.

## 6. Changing a timing

1. Change one value at its source (a channel's duration, a constant, a narration line).
2. Check what is linked to it (a shared handshake duration follows the channel it is derived from).
3. Re-measure, section 7.
4. Re-check the startup timeline: an added or lengthened line moves everything after it.

## 7. Measuring timing

Timestamp the event log's lines in the running application, replay, and compare paired events. For convergent sequences the differences between paired lines (each request and its answer, and the final "authenticated") should be **0 ms**. For a single flow, differences between consecutive lines are the legs you set. A console recipe for one environment is in `examples/nats-nkey-demo/environment.md`.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
