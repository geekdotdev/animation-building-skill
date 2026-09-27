# This project's conventions and values

The sizes, offsets, durations and timeline that `nats-nkey-demo-priv`'s labs use. **These are examples, not a specification**: measured or read from the labs (mostly lab 5) as they stood, and free to change when the user wants something different. The general rules they instantiate are in `core/layout.md` and `core/timing.md`.

## Layout

**Canvas.** `0 0 920 450` for labs 2 to 4 and `0 0 980 450` for lab 5, which needed the extra width for its private-network box. Lab 5's coordinates are shifted +70 in y to keep the `viewBox` origin at zero (`renderers/anime-svg/layout.md`).

**Identifiers** (`core/layout.md` §2): `dg-box-<name>-<lab>`, `dg-line-<name>-<lab>`, `dg-vol-<name>-<lab>`, `dg-node-<name>-<lab>` (a gesture target), `dg-zone-<name>-<lab>`, `dg-init-containers-<lab>`, and a `-label` suffix for a line's label. Not every id follows it. The browser-to-broker line is `dg-line-<lab>` with no name segment, and the other lines are named after one end. A descriptor therefore names each element explicitly.

**Nodes.**
- Size 150 × 60, corner radius 8. Narrower (140) for a short name, wider (190) for a long one.
- A single-line label is centered at the box's center x, baseline at box y + 34.
- A two-line label has baselines at box y + 26 and y + 42.
- A gesture target's label is at box y + 27 and its hint at box y + 44, both centered. The rect and texts are wrapped in a `<g tabindex="0" role="button" aria-label="…">`.
- The init-containers box is sized so the stacked volumes fit: 144 high in lab 2, 182 in labs 4 and 5.

**Lines.** Endpoints on a box's edge, not necessarily its center: the broker-to-browser line in lab 5 is vertical at x = 705, off-center on both boxes and inside both. Lines use the `diagram-line` class (opacity 0) and are revealed by an effect. A cubic `C` curve is used only where a straight line would cross something, as for the browser-to-Keycloak line.

**Zones.** About 16 padding on the left and right of the members' outer extent, 26 above (room for the label), 12 to 15 below. The label is italic at (zone x + 8, zone y + 13). Lab 2's box clears its neighbor (the "operator jwt" volume) by about 11. Lab 2's spa-server to Keycloak line is a curve so it doesn't cross the box.

**Volumes.** Stacked in a column straddling the init-containers box's right edge, 22 high on a 38 pitch, each visible and docked from the first frame. Each docks on its consumer's edge, not its center.

**Overlays outside the SVG.** The event log is an HTML box over the diagram's bottom-left (left 1rem, bottom 2.75rem, 500 px wide, up to 110 px high; the Ghost export uses 640 and 150). The labs place nothing below the init-containers box on the left, so the log covers empty canvas. The Replay button is in a footer under the SVG.

## Timing

### Base values (lab 5)

| Value | Use |
|---|---|
| 700 ms | line reveal, acknowledge glow (`LINE_ACK_DURATION`) |
| 350 ms | moving asset's fade-out after arrival |
| 900 ms | volume docking |
| 2000 ms | spacing between narration lines |
| 2000 ms then 600 ms | Init Containers box: hold after docking, then fade |
| 3000 ms | steady-state traffic interval |
| 40 lines | log cap |

### Channel durations (lab 5)

Hand-picked, not derived. Speeds differ about fourfold, from a short slow line to a long fast one:

| Channel | Length (units) | Duration (ms) | Speed (units/ms) |
|---|---|---|---|
| `ch1` browser ↔ broker | 220 | 1300 | 0.17 |
| `ch2` browser ↔ spa-server | 67 | 900 | 0.075 |
| `ch3` broker ↔ logging client | 78 | 1200 | 0.065 |
| `ch7` broker ↔ auth-callout | 212 | 800 | 0.27 |
| `ch8` spa-server ↔ signing service | 58 | 800 | 0.072 |
| `ch4` browser ↔ Keycloak | a long curve | 1800 | not computed |

### The convergent handshakes

The two autonomous handshakes start at the same instant, so every leg of auth-callout's handshake uses `HANDSHAKE_LEG_DURATION`, which is the logging line's duration (1200 ms). Auth-callout's line is 212 units and the logging line 78, so its crawlers move about 2.7× faster in the same time. Delegation on `ch7` keeps its own 800 ms.

A handshake takes reveal + 3 × leg + glow: 700 + 3 × 1200 + 700 = 5000 ms from "ready". The log's "INFO sent" to "authenticated" span is 3 × leg + glow, 4300 ms, and was measured at about 4350 ms.

### Startup timeline (lab 5)

Cumulative time from load or Replay. The start of the first handshake (about 12 s) and the handshake's length (about 4.35 s) were measured in the browser. The other rows are computed from the script's constants.

| t | Event |
|---|---|
| 0 s | first narration line |
| 8 s | fifth narration line |
| 10 s | "Init container completed" (internal), volumes start sliding |
| 10.9 s | all volumes docked, every service box starts its glow together |
| 11.6 s | "All services are ready" (glows done, the browser becomes clickable), autonomous handshakes start |
| about 12 s | first handshake INFO (700 ms reveal first) |
| about 16.7 s | both autonomous clients authenticated |

The viewer waits about 12 seconds before the first interaction. Extra narration lines add 2 s each.
