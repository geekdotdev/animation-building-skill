# Real requests from this project, mapped

Requests the user actually made while building `nats-nkey-demo-priv`'s labs, quoted from the conversation (trimmed), with the kind of request they are (the section of `core/phrasebook.md`), the constructs they touch, and what was done. **These are examples of how phrasing maps to constructs, not a script.** Another user, or the same one later, will word things differently.

## Geometry (§A, §B, §C)

| The user said | Kind | Constructs and what was done |
|---|---|---|
| "move nats broker box and logging clients to the right and shift the browser-nats connection line right the same amount so it stays vertical" | move | Two nodes moved; the channel between broker and browser had both endpoints shifted by the same offset. Their docked volumes' offsets were recomputed. Applied to the lab and regenerated for the standalone export. |
| "move the line connecting web browser to nats broker left 30px without moving the boxes, keeping the line vertical" | move | Only the channel's two endpoints changed, both by the same amount, and both stayed inside the boxes' edges. Taken as **30 diagram units**, not screen pixels. |
| "Shift the web browser left so its connecting line to spa-server isn't so oblique and keep the line to nats broker vertical" | move | One node moved. Its other channel was kept vertical by adjusting both ends. "Less oblique" meant a steeper diagonal. |
| "Draw a bounding box representing a private network around auth-callout and the user-signing-service." | enclose | A **zone** with those two nodes (and any docked volume) as members, a label, and padding. Checked that no line between non-members crossed it. |
| "move auth-callout box down so it has some space underneath the "Private Network" label" | space | A node moved within the zone; the zone's top padding and label clearance. |
| "Overlay the nats-user-creds volumes at start" (two identical volumes going to two targets) | overlay | Identical assets starting together, then taking different paths: a **divergence**. |
| "Lab 3 starts with 2 different volumes overlapping. spread them out vertically and make the init-container taller to fit them." | overlap | Distinct start positions for the docked volumes, and the container node sized to fit. |
| "two volume boxes cross while shifting to their target boxes" | crossing | The docking paths crossed; start positions were swapped so they don't. |
| "Add that same volume to lab 2, making init-containers taller to fit it and follow the same docking sequence as labs 4 and 5." | copy a shape | Instantiate the docking sequence of the other labs (a pattern), size the container to fit, and add the docking offset. |

## Timing and behavior (§D, §E, §F)

| The user said | Kind | Constructs and what was done |
|---|---|---|
| "auth-callout authentication with the broker should be shown in the same way logging-clients is: as soon as all services are healthy, the connecting line should appear and the lock, unlocked lock, and OK crawlers should be exchanged." | same as X | The connect-handshake pattern instantiated for a second client. Triggered by the datum "All services are ready". Assets: closed padlock (INFO), open padlock with key (CONNECT) and the green OK, in both directions on the line. The line is revealed first. |
| "The symmetry with logging-clients is conveyed best if both complete at the same time … not by anchoring them but by either making the line lengths and crawler rates the same or if line lengths must be different, the crawler rate should be faster proportionate to the relative line length" | convergence | Equal leg durations for both handshakes, so crawler speeds differ with line length. No waits. Verified by timestamping log lines: 0 ms apart. |
| "the five glowing boxes are triggered by the "All services ready" datum being satisfied" | datum | Restated the behavior in primitives: a datum, with its closing acknowledgement, whose triggers fire when that completes. Not a counter of finished glows. |
| "In the lab 5 diagram hide the mTLs label until its connecting line is visible" | reveal | The label is revealed together with its line, and hidden otherwise. |
| "Is there a visual way to represent mTLs between the spa-server and the user-signing-service?" | design question (§J) | Two or three options with trade-offs were offered; the user chose one (a distinct line colour with a label). |

## Escalations and rules the user set (§5)

| The user said | Consequence |
|---|---|
| "Crawlers of the same type and color do not require escalation since they are identical, their order precedence has no impact anyway." | Identical assets on a shared channel are exempt from the overlay-precedence escalation. |
| "shared channels in the same lane and phase is to be avoided. Escalation is required unless the shapes in conflict are the same, like event payloads." | Two sequences in one lane and phase should not share a channel. Different shapes from two lanes need a declared overlay precedence. |
| "The lane concept is guidance for the agent creating the animation." | Lanes and phases are recorded in the descriptor but not validated by the renderer. |

## Export and presentation (§H)

| The user said | Kind | Constructs and what was done |
|---|---|---|
| "The Replay button appears too small on the standalone copy of the lab 5 diagram." | export presentation | A target-profile parameter for the blog copy. The lab's own CSS was left alone, and the export was regenerated. |
| "make the standalone canvas wider and increase the font size in the inset log window" | export presentation | Container width and log font size, for the blog target only. |
| "why is the font in the standalone event log grey or faded? it should be black" | export presentation | A colour override at higher specificity than the host theme's paragraph rule. |

## Questions about what the animation claims (§I)

| The user said | What it asked |
|---|---|
| "In lab 2 does the web browser get custody of the pre-signed nats jwt?" | Whether the animation's claim is true. Answered from the code, and it is a fidelity question: if the diagram implied otherwise it would be a bug. |

## Naming and constraints (§G)

| The user said | Note |
|---|---|
| "Lab 4 tab should indicate "Pure SPA Login" while lab 5 tab should indicate "BFF-initiated SPA Login" or similar" | Content, not animation: the tab label, the page heading and the references were changed together. |
| "Keep "PoP Zero Permission" in both because thats what makes them novel" | A stated reason is a requirement. It constrained the names. |

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
