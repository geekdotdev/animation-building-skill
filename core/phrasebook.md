# Conversation phrasebook

How to turn what the user says into the ontology's constructs, and how to answer in the same words. The other direction, what to call each construct when speaking to the user, is the "say it as" column of the renderer's concept map (`renderers/anime-svg/concept-map.md`). Real requests from one project, each mapped to constructs, are in `examples/nats-nkey-demo/phrases.md`.

**This is guidance, not a script.** Users phrase things in their own words. Use this to recognize the *kind* of request, find the constructs it touches, and decide whether to ask.

## 1. The method

1. **Classify the request** (section 3): geometry, timing, behavior, effects, text, export, or a question about what the animation claims.
2. **Find the constructs it touches** and what depends on them. A request to move a box is also a request about its lines, its docked volumes and any zone.
3. **Check for an escalation** (`core/ontology.md`). If the change creates one, stop and ask.
4. **Check the scope.** Does it apply to one diagram, several, or an export of one? See section 4.
5. **Do it, verify it** (`core/verification.md`), and **reply in the shared words**, saying what else changed with it.
6. **If the request is genuinely ambiguous, ask one question and offer a default.** Don't interview.

## 2. The user's words and the ontology's

Users often use the vocabulary of the picture. Keep their word when you talk to them, and map it to the construct underneath.

| The user says | Construct | Notes |
|---|---|---|
| crawler, dot, bead, the lock, the token | asset | Name the specific asset from the domain's iconography. |
| line, connection, link | channel (drawn as a line) | A channel is the connection, its line is the drawing. |
| box, service, component | node | |
| glow, pulse, lights up | acknowledge effect | Usually a datum's closing acknowledgement. A **blue** glow on a pressed feature is the simulated-gesture acknowledgement. |
| the switch, the toggle, "mode switch" | mode toggle (a lifecycle control, like Replay) | Not a gesture. Usable at any moment. It never disturbs the run, and Reset keeps its setting (ontology rules 20 and 21). |
| automated, autoplay, plays by itself, "user-driven", "manual" | interaction mode | Declared in the descriptor's `modes`. Automated still runs the gesture lifecycle (ontology rules 17 to 19). |
| appears, fades in, shows up | reveal effect | |
| "the same time", "together", "in sync" | convergence | Equal leg durations, never a wait (`core/timing.md`). |
| faster, slower, too quick | a channel's or leg's duration, or the **pace** | If they mean the whole diagram ("slow it all down"), set `pace`. If one line or step, change that duration, and ask which legs. |
| bounding box, boundary box, grouped in a box | zone | A spatial trust boundary. |
| volume, shared volume, docks | docked asset (a metaphor) | |
| log, event log, narration | narrate effect | |
| "once X is ready", "when X is healthy" | a datum's condition, and the triggers it activates | |
| "the same way X is" | an existing pattern or sequence to imitate | Find X; instantiate its shape. |

## 3. Kinds of request

### A. Move, resize, align
- **Moving a node** also moves its label and hint, every line that ends on it, any docked volume's offset, and any zone that contains it (`core/layout.md` §8). Say so.
- **"Without moving the boxes"** means change only the line's endpoints, and keep them within the boxes' edges.
- **"Keep it vertical / horizontal"** means change both ends of the line together.
- **"Less oblique", "steeper"** means a steeper angle. Prefer vertical. Offer a specific change and a measurement.
- **"The same amount"** means apply the same offset to the things that must stay aligned.

### B. Space, overlap, crossing
- **"Spread them out", "they overlap"** at the start of a docking: assign distinct start positions.
- **"They cross while moving"**: reorder start positions so docking paths don't cross (`core/layout.md` §6).
- **"Overlay them at the start"**, when identical assets should start together from the same point and go to different places, is a **divergence**: declare it (`core/ontology.md`).
- **"Taller/wider to fit"**: size the container to what it holds.
- **"Some space under the label"**: padding, and the zone label's clearance.

### C. Enclose or group
**"Draw a box around A and B"**: a zone with those members, plus any asset docked at them, with padding and the intersection rules. Check that no line between non-members crosses it.

### D. Timing
- **"Too fast / slow"**: the whole diagram, or one channel or leg? For the whole diagram, set the descriptor's `pace` (2 is twice as slow), which keeps everything in step. For one, which channel or leg, and by how much? Propose a value.
- **"Finish at the same time"**: convergence. Equal leg durations, so crawler speeds differ with line length. Don't add waits.
- **"Wait N seconds"**: a delay trigger, or a longer narration spacing. Ask which.

### E. Behavior and sequence
- **"Show X the same way as Y"**: find Y's sequence, copy its shape (trigger, assets, effects, closing datum), and change only what differs. Name new datums for their own subject.
- **"When everything is healthy / ready, then …"**: a datum's condition, with the follow-on as the triggers it activates.
- **"Exchanged", "goes back and forth"**: transitions in both directions on one channel.
- **"Only after X"**: a guard on a rule.
- **"Stays hidden until …"**: the reveal effect's trigger.

### F. Effects
**"Glow"**: the closing acknowledgement of a datum, or an acknowledge effect on a rule. **"Appears"**: reveal. **"Hide the label until its line is visible"**: reveal the label together with its line, and keep it hidden otherwise.

### G. Text
Titles, tab names, narration lines, hints and use-case text are content, not animation. Check whether the same text is repeated elsewhere (a heading, a tab, a document) and change them together.

### H. Exports and presentation
**"On the standalone / the blog copy"** is a delivery target. A size, font or colour complaint there is a **presentation parameter** of the target profile, not a change to the diagram (`core/delivery-targets.md`). Say which target and regenerate, and check the diagram itself is unchanged.

### I. Questions about what the animation claims
**"Does X do Y?", "does the browser get custody of …?"** asks what the animation asserts, and whether that is true. Answer from the sequence's `source:` and the code. If the animation implies something the code doesn't do, that is a fidelity bug: fix it or tag it `adapted` with the reason.

### J. "Is there a visual way to …?"
A design question. Offer two or three options with their trade-offs and a recommendation, and let the user choose. Don't pick silently, and don't implement before they answer.

## 4. Units and scope

- **"px" usually means the diagram's own coordinate units,** not screen pixels. The diagram scales, so on screen it won't be literally that many pixels. Say so once if it matters.
- **"Both X and its export / the standalone copy"** means change the diagram and regenerate the export, in one pass. **"Diagrams 2 and 4"** means several diagrams: do each and verify each.
- **A change that the user described for one diagram may belong in its siblings.** Ask, or say what you assumed.
- **A constraint stated as a reason,** such as "because that's what makes them novel", is a requirement. Keep it when you change related things.

## 5. Asking well

Ask only when the request is ambiguous or an escalation applies. Ask one question, say what you would do by default, and give the specifics that make it answerable.

**Overlay precedence** (a shared channel with different assets):

> On the *`<channel>`* line, *`<asset A>`* (*`<lane 1>`*) and *`<asset B>`* (*`<lane 2>`*) can be on screen together. Which should be drawn on top, or can they never coincide? If you don't say, the newest is on top.

**Terminal datum** (a datum with no triggers and no marker):

> "*`<datum>`*" doesn't lead to anything. Is it the end of that flow, or is a step missing after it?

**Export gestures** (a target that can't run a gesture-driven phase):

> *`<target>`* can't take clicks, so *`<phase>`* can't wait for one. Should it be dropped, play in automated mode (the renderer presses for the viewer, with a visible press), or show as a still frame?

**A design choice:**

> Two ways to show *`<X>`*: *`<option 1, cost>`* or *`<option 2, cost>`*. I'd pick *`<one>`* because *`<reason>`*. Which do you want?

## 6. Replying

- **Lead with the result,** in the user's words for what they can see ("the line now glows orange when the OK lands").
- **Say what moved with it,** from the checklist: labels, lines, volume offsets, zones, the export.
- **Report verification in three parts** (`core/verification.md`): checked in the browser, read from the code, not verified.
- **Say when you interpreted a phrase,** for example "I took 30px as 30 diagram units".
- **When you change a rule because the user corrected you,** say what the rule is now, once, without restating their point back to them.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
