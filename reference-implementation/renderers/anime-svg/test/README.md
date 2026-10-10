# Interpreter test page

A static page that runs one diagram with the interpreter and a descriptor, so you can try it in a browser. `index.html` contains only the `<div class="diagram">` block (the SVG, the event log and the Replay button), copied from the app's page, inside the two wrappers that give it the app's layout. The diagram's headings, text and navigation buttons are left out, and the page has no title or other text of its own. The behavior comes only from the descriptor: the diagram's own script isn't loaded. It is run by hand, so it is a **procedure**, not an automated suite.

1. Build the site, then serve the folder it wrote. The build first checks the diagram file, the stylesheet and the helpers against the markup contract (`renderers/anime-svg/markup-contract.md`), shows warnings, and **refuses** a diagram that breaks it.
   ```bash
   node build-site.mjs --descriptor <file.animation.js> --out <dir> \
       [--css <shared.css> --helpers <diagram-shared.js> --anime <anime.es.js> | --app <repo>] [--markup <file>]
   python3 -m http.server 8765 --directory <dir>
   ```
   The descriptor names its diagram (`markup`, relative to the descriptor) and its id suffix (`diagramLabel`), so neither is a flag. `--markup` overrides the path. `--app` supplies the example project's stylesheet, helpers and anime.js, or give each file yourself.
2. Open `http://localhost:8765/`.

**Pace.** The descriptor's `settings.paceMultiplier` scales every duration and delay. Add `?pace=2` to the URL to run twice as slow, or `?pace=0.5` for twice as fast, replacing the descriptor's value for that page. `__interp.pace()` shows the pace in use.

**Interaction mode.** The mode belongs to the descriptor (`settings.interactionModes`), not to the test page. The page starts in the descriptor's default and shows a switch beside Replay when the descriptor sets `interactionModes.toggle`. Add `?mode=automated` or `?mode=user-driven` to override the default. In automated mode the interpreter presses each armed gesture after `interactionModes.simulated.delayMs` ms, with the declared acknowledgement (example diagram 5: a short blue glow on the pressed node), and reports it as `by: 'simulated'`. Your own clicks are `by: 'user'`.

**What is recorded.** `window.__run` has `log` (each line's text and time), `events` (every datum, move, arrival, press and gesture), `clicks` (each gesture with who performed it) and `done` (set 8 s after a gesture in a phase named `interactive`, if the diagram has one). `__interp.state()` shows the satisfied datums and each lane's phase, and `__interp.mode()` the current mode.

**What to check** after a change to the interpreter or a descriptor:
1. **The run.** Step through, or use `?mode=automated`. The log lines come in the order the descriptor's narrations and datums imply, and the console has no errors.
2. **Reset.** Press Replay mid-run and twice in a row. After each: the log is one line, no crawlers, the hint is back to its first text, nothing glows, and after a wait no line appears twice.
3. **Mode.** Idle in user-driven mode: no presses. Switch to automated: a press `delay` ms later with the acknowledgement, then the gesture `duration` ms after that. Switch back while a press is pending: it never fires. Replay in automated mode keeps the mode.
4. **Layout.** The page uses the app's own `shared.css` unchanged, so it shows what the app shows: the diagram, the log and the Replay button fit any window width.

**Clicking in the browser pane.** The Claude browser pane maps mouse clicks to the wrong coordinates when its viewport is emulated, and in its default narrow width the app's log can cover a node. To test a click there, send a `click` event to the node from the console. The page can't tell that from a user's click.

## How it was validated (history)

The interpreter was checked once against example diagram 5's hand-written script, by running both versions with the same click driver and comparing them. That comparison, and the code that ran the script, has been removed: future descriptors have no script to compare with.
- The same 31 log lines, in the same order, with identical text. Timing was within 22 ms up to the first gesture. In automated mode the interpreter then ran 300 to 400 ms behind per gesture, which was its 400 ms press glow, and the script had none.
- The two handshakes logged at the same millisecond in both runs.
- Differences by design: the browser node is clickable only while a phase arms it and its step isn't consumed (the script left it clickable once ready), a datum counts as satisfied for guards once its acknowledgement completes, and the delegation to auth-callout waits for auth-callout to be authenticated, which the script never checked (FINDING F14).
- Not compared: crawler positions frame by frame, glow appearance, and the payload traffic after the last click.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
