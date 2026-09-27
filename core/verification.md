# Verification recipe

How to check a change to a diagram, as one procedure, for any application. It pulls together checks that live elsewhere (`core/layout.md` §9, `core/timing.md` §7) in the order to run them. The commands for one environment are in `examples/nats-nkey-demo/environment.md`.

**Principle: say what you actually verified.** A check that ran in the browser, a fact read from the code, and something you couldn't verify are three different things. Report them separately (section 10).

## Which steps to run

| Change | Steps |
|---|---|
| Geometry: a box, line, zone or docked asset moved or added | 1, 2, 3, 6, 7, 9, 10 |
| Timing: a duration, delay or cadence | 1, 2, 3, 5, 8, 9, 10 |
| A flow: new or edited rules, triggers or effects | 1 to 10 |
| Style only | 1, 2, 7, 10 |
| Applied to several diagrams | run the steps for each, then step 9 |
| An export | `core/delivery-targets.md`, "Verifying an export" |

## 1. Confirm the change is being served

Before trusting anything you see, confirm the running application serves your edit. A change that isn't served produces a false pass. Fetch the served file and search it for something only your change contains.

## 2. Load fresh, and check for errors

Load the page from scratch (a reload, not a navigation that keeps the page), and read the console for errors. If the diagrams start at load, a syntax error in one shows immediately. Make the diagram you changed visible before looking at it.

## 3. Check the narration (the state trace)

The event log is the cheapest full trace of the flow. Wait for the part you changed to finish, then read the lines and compare them with what you expect, in order. Wait for a specific line rather than polling once.

## 4. Check what a scripted run can't reach

Flows behind a login, and any gesture chain that needs real credentials, need a human or a real session. Don't fake them. Note in your report which steps of the flow were not exercised.

## 5. Measure timing

Timestamp the log lines, replay, and compare paired events (`core/timing.md` §7). For convergent sequences the differences must be **0 ms**. Run it with the change, and if you can, against the version before it, to prove the check can fail.

## 6. Measure geometry

Don't judge geometry by eye. Measure the rendered elements (`core/layout.md` §9): containment of a zone's members, and the gap to a neighbor. A line that is hidden until first use has no visible geometry: force it visible to look, and undo that afterwards.

## 7. Look at it

Use a screenshot to confirm what the measurements can't: that it reads well.

- Capture at a legible size. An emulated viewport that is wider than the capture area is scaled down until unreadable.
- To catch a transient moving asset, wait for the log line that starts it, then capture at once. An asset crosses a line in about a second.
- Some capture tools can't crop or zoom a region. Measure instead.

## 8. Check Reset

Reset is where forgotten state shows up. Trigger it and check:

- the log restarted, the hint is back to its first text, nothing is still glowing, and no moving asset is left over from the old run (steady-state traffic is legitimately in flight);
- the flow runs to the same end state as the first time.

Run it **twice**. A stale timer or a leftover flag often shows on the second reset, not the first. Check the console again for errors.

## 9. Check the other diagrams

Diagrams that were made as copies of each other need checking together. After changing several, check each, and check one you did **not** intend to change still works. Read each one's log after load, not the code.

## 10. Clean up and report

**Clean up.** Remove any temporary file you added to the served directory, remove any element you injected into the page, undo forced styles, and restore the viewport.

**Report in three parts:**

1. **Verified in the browser:** each check you ran and its result, with numbers where there are numbers (timing differences, measured gaps).
2. **Read from the code:** anything you concluded without running it, and say so.
3. **Not verified:** what you couldn't reach (flows behind a login, the real host of an export, a hidden state) and why.

## Known limits

- **Login-gated flows** can't be exercised without real credentials.
- **Some browser tooling** can't inspect local files, can't crop a screenshot, or clears an emulated viewport on reload. See the example environment file for one tool's limits.
- **Exports** can often only have their styling checked, when the environment's policy blocks the export's scripts (`core/delivery-targets.md`).
- **A screenshot captures one frame,** so it can miss a fast moving asset.
- **Once a validator exists** (`core/descriptor.md` §8), run it first: it catches structural mistakes before any of these steps.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
