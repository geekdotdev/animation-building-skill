# This project's environment: commands and pitfalls

How to run the generic verification procedure (`core/verification.md`) in `nats-nkey-demo-priv`, and the environment-specific things that have gone wrong. Every command here was used in this project. `<lab>` is a lab's id suffix, such as `callout-pop-zero-permission`. The app is at `https://localhost:3001` (use `-k` with `curl`). **These are examples for one environment, not a specification.**

## Commands, by step of the procedure

**1. Confirm the change is being served.**

```bash
curl -sk https://localhost:3001/gateways/<lab>-gateway.js | grep -c "<a new identifier from your change>"
```

A count of 0 means it isn't served. See "Seeing your changes" below.

**2. Load fresh.** In the browser pane, call `location.reload()` after navigating. Activate the lab's tab: `document.querySelector('[data-tab="<lab>"]').click()`. In this app the diagrams start at load.

**3. Read the narration.**

```js
[...document.querySelectorAll('#diagram-<lab>-log p')].map((p) => p.textContent.trim())
```

Startup takes about 12 seconds in lab 5, so wait. To wait for a specific line:

```js
const el = document.getElementById('diagram-<lab>-log'), t0 = Date.now();
while (!el.textContent.includes('<a line you expect>') && Date.now() - t0 < 60000)
  await new Promise((r) => setTimeout(r, 100));
```

**4. Unreachable flows.** Flows behind a Keycloak sign-in.

**5. Timing.** Timestamp the log lines:

```js
const stamps = [];
new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) =>
  stamps.push([performance.now(), n.textContent.trim()]))))
  .observe(document.getElementById('diagram-<lab>-log'), { childList: true });
// click Replay, wait, then compare the timestamps of paired lines
```

Convergent sequences (auth-callout and logging-client handshakes) should differ by **0 ms** at INFO, CONNECT, OK and "authenticated". All the labs' diagrams start at load and ran together when this was measured, so a lab's timing doesn't need its tab to be visible.

**6. Geometry.**

```js
const r = (id) => document.getElementById(id).getBoundingClientRect();
const zone = r('dg-zone-privatenet-<lab>'), m = r('dg-vol-authkeys-<lab>');
({ inside: m.left >= zone.left && m.right <= zone.right && m.bottom <= zone.bottom,
   gapToNeighbour: r('dg-vol-opjwt-<lab>').left - zone.right })
```

To look at a hidden line, set `style.opacity = '1'` on it in the console, and undo that afterwards.

**7. Screenshot.** Emulate about **900 px** wide with the pane's `resize_window`, and set it again after a reload. Scroll the diagram into view: `document.getElementById('diagram-<lab>').scrollIntoView({ block: 'center' })`. To catch a crawler, wait in the console for the log line that starts it (the loop in step 3), then screenshot at once.

**8. Replay.**

```js
document.getElementById('diagram-<lab>-replay').click();
// wait for the flow to finish, then:
document.querySelectorAll('#diagram-<lab> svg .diagram-crawler').length   // expect only the steady-state payloads, at most one per autonomous client
```

**9. Other labs.** The labs are hand-kept copies. Read each lab's log after load (step 3).

**10. Clean up.** Remove any temporary file you added to `spa-server/public`, remove any element you injected into the page, undo forced styles, and reset the viewport (`resize_window` with the `desktop` preset).

## Seeing your changes

- **A hard refresh shows no change.** Check whether the running container bind-mounts `spa-server/public` before blaming the browser cache. A plain `podman compose up --build` doesn't mount it; the dev overlay (`compose.dev.yaml`, used by `launch-demo-stack.sh`) does. Confirm with the `curl` above. Static files copied into the image need a rebuild.
- **The page still shows the old diagram after navigating.** Going to a URL that differs only by its hash doesn't reload the page. Call `location.reload()` first.

## Browser-pane limits

- **Screenshots are unreadably small** at a wide emulated viewport. Emulate about 900 px wide, and set it again after any reload, which clears the emulation.
- **The pane can't inspect a local file.** Page tools don't act on `file://`. Serve the file from the running app, or load its markup into an isolated `iframe` (`srcdoc`) in a page of the app. That verifies styling only: the app's security policy (`script-src 'self'`) blocks external scripts (`examples/nats-nkey-demo/ghost-export.md`).
- **`zoom` doesn't crop.** The pane returns the whole screenshot. Measure with `getBoundingClientRect` instead.
- **A scripted click on an SVG `<g>` does nothing.** SVG groups have no `.click()`. Dispatch `new MouseEvent('click', { bubbles: true })`.
- **A hidden line can't be inspected** without forcing it visible.

## Pitfalls in this project's scripts

- **New state survives Replay.** Every new flag, hint and glowable element must be added to the Replay handler. The auth-callout handshake needed `authCalloutAuthenticated = false` and `resetBox` on its line, and it is easy to forget one.
- **A hint shows the wrong text after Replay.** Replay must restore the first hint (`Click to request login form` in lab 5).
- **A new branch never runs, or an old flow is hijacked.** The gateway scripts' `beadArrived` is an `if / else if` chain matched on (channel, direction, asset type), and the first match wins. Before adding a branch, search the chain for that triple. Two flows can legitimately share it: auth-callout's own handshake and its delegation response both send the open-padlock asset on the same channel and direction. The current workaround is a `tag` argument. Lane-scoped arrival triggers are the fix (`core/ontology.md`, `core/descriptor.md`).
- **Only some labs changed.** The labs are hand-kept copies. When a change belongs in every lab that has the feature, apply it to each and check with a search across `gateways/*-gateway.js`. A scripted edit that asserts each anchor matches exactly once fails loudly instead of silently missing one.
- **Text is injected as HTML.** `logDiagramTransition` sets `innerHTML` so a message can hold `<i>`. It is safe only because every call passes a static string. Never pass anything derived from user input.

## Working in the shell

- **`no matches found` on a `grep --include=*.go`.** zsh expands an unquoted glob before grep sees it. Quote it, or use `--exclude-dir`.
- **A variable holding several arguments is passed as one.** zsh doesn't split an unquoted variable. Pass the arguments explicitly, or use an array. This made a test run produce no summary at all until the cause was found.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
