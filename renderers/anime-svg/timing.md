# Timing rules that come from anime.js

Rules for timing in a diagram built on **anime.js v3**. The general rules are in `core/timing.md`.

## Hard

- **Timers that a Reset must cancel are `setTimeout` or `setInterval`, guarded by a generation counter** (the example project's `payloadGeneration`): compare it when the timer fires and do nothing if it changed. Not anime's own `delay`: `anime.remove` doesn't cancel a pending delay countdown, so a stale one fires after Reset.
- **An animation that completes after a Reset must check the generation too,** or its arrival starts the next hop inside the new run. Remove the moving asset and stop.
- **An arrival fires when the moving asset's animation completes,** before its fade-out finishes. The next hop starts at that instant. Don't wait for the fade.
- **Call `anime.remove(target)` before starting a new animation on an element,** so two animations don't fight over the same property.

## Convention

- **Moving assets use `easing: 'linear'`** (constant speed). Reveals, glows and docking use `easeOutQuad`.
- **A moving asset fades out for about 350 ms after it arrives,** and is then removed.
