# Pitfalls with anime.js v3 and inline SVG

Things that went wrong with this renderer, each with its cause and fix. Every entry was hit in practice or is stated in the code's own comments. This is an example list from experience, not an exhaustive one. Project-specific pitfalls are in `examples/nats-nkey-demo/environment.md`.

## Canvas and geometry

- **Every crawler is offset from its line.** The `viewBox` has a negative origin. anime.js v3's `path()` helper offsets by exactly the negative min-y. Use a zero-based `viewBox` and shift the coordinates. (`renderers/anime-svg/layout.md`)
- **A crawler won't follow a line, or `anime.path()` throws.** The selector matched several elements, or the line isn't a single `<path>`. One `<path>` per channel. Put a line's label in a separate element and reveal both by passing an array of targets to the reveal helper.
- **A volume lands in the wrong place after a node moves.** Docking uses fixed offsets from a start position, not coordinates of the target. Recompute the offset whenever the node or the volume's start moves. (`core/layout.md` §6)
- **Volumes cross or overlap while docking.** Assign start positions in the order that avoids crossings.
- **A line reads as passing through a zone.** A channel between two non-members crosses it. Reroute the line around the zone. (`core/layout.md` §5)

## Animation and timers

- **A stale animation fires after Reset.** anime's own `delay` isn't cancelled by `anime.remove`. Use `setTimeout` or `setInterval` and compare a generation counter before acting. (`renderers/anime-svg/timing.md`)
- **A hop from the old run starts inside the new one.** A moving asset that finishes after Reset must check the generation counter, or its arrival starts the next hop. Keep that check in anything you add.
- **Two animations on one element can fight.** Call `anime.remove(target)` before starting a new one on it.
- **A glow stays after Reset.** The glow helper adds a class and animates the stroke. Reset must clear it (and reset a hidden line) for every element that can glow, lines included.

## Styling

- **A colour set on the log container doesn't show.** The host page's own rule for `p` styles the log's `<p>` lines directly and wins over an inherited colour. Style the `<p>`, not just the container. (This applies to any theme paragraph rule in an export too.)

## Scripting and testing

- **A scripted click on an SVG `<g>` does nothing.** SVG groups have no `.click()`. Dispatch `new MouseEvent('click', { bubbles: true })`.
