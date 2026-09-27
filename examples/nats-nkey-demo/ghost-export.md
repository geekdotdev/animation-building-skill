# Ghost export (this project's example profile)

The concrete delivery-target profile for lab 5 of this project, exported to a Ghost blog's HTML card. The general method is in `core/delivery-targets.md`. **This is an example, not a specification.**

Source: `scripts/build_lab5_standalone.py`, which today applies these as regex replacements. This document is their documentation. The script does not read it. The same profile now also exists as data, `reference-implementation/renderers/anime-svg/export/profiles/ghost-html-card.target.js`, which the generic exporter reads. The two differ: the script ships the lab's own gateway script, while the exporter ships the interpreter and the lab 5 descriptor, so its behavior comes from the descriptor (with the mode toggle, and the differences in `reference-implementation/renderers/anime-svg/test/README.md`). Existing code does not conform to the parameterization method yet: `shared.css` uses literal values, and the script applies exact-string replacements. Don't refactor them unless the user asks.

## Ghost profile (as of writing)

| Aspect | Value | Reason |
|---|---|---|
| Packaging | One HTML fragment: markup, `<style>`, `<script type="module">`, pasted into a Ghost HTML card. The diagram-shared and gateway script bodies are unchanged except for imports and export keywords. | A Ghost post has one HTML card to paste into. |
| Asset loading | anime.js import rewritten to `https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.es.js`, the exact version the app vendors. The two local import lines are removed. | The app's `/vendor/...` paths don't exist in a post. |
| Container | `.diagram` is 100% wide, max 1400px, margin `1.5rem auto`. The app's breakout (1.5x the 720px column, capped at the viewport, centered) is dropped. Tested at 1250px. | That breakout assumes the app's 720px column. |
| Log | Width 500 → 640px, max-height 110 → 150px, font-size 0.8rem → 1.1rem. | The SVG scales with the container and page text does not. |
| Log colour | Forced `#000`, opacity 1, at `.diagram .diagram-log p` specificity. | Ghost themes style paragraphs. |
| Replay button | Padding `0.3rem 0.85rem` → `0.55rem 1.4rem`, font-size 0.8rem → 1.1rem, selector `.diagram-footer .diagram-replay`. | It doesn't scale with the SVG, and the selector beats a theme's `button` rules. |
| Armed gestures | All. The script is unchanged and a Ghost post is a live page. | |
| Unverified | Whether the HTML card preserves the module script and the CDN import. Whether a given theme overrides the sizes. | Never tested against a real Ghost site. |

## Presentation parameters (derived from the Ghost tweaks)

Defaults must equal the app's values at implementation time, so re-verify them then.

| Parameter | App default | Ghost value |
|---|---|---|
| `--diagram-width` | `min(150%, calc(100vw - 5rem))` | `100%` |
| `--diagram-max-width` | none | `1400px` |
| `--diagram-margin` | `3rem 0 1.5rem calc((100% - var(--diagram-w)) / 2)` (centers on the column) | `1.5rem auto` |
| `--log-width` | `500px` | `640px` |
| `--log-max-height` | `110px` | `150px` |
| `--log-padding` | `0.4rem 0.55rem` | `0.5rem 0.7rem` |
| `--log-font-size` | `0.8rem` | `1.1rem` |
| `--log-color` | `#444` (lab 5's log is already `#000` in the app) | `#000`, opacity 1 |
| `--replay-padding` | `0.3rem 0.85rem` | `0.55rem 1.4rem` |
| `--replay-font-size` | `0.8rem` | `1.1rem` |

## Verifying this export here

The general steps are in `core/delivery-targets.md`. In this environment:

- The browser pane can't inspect a local file, and the app's security policy (`script-src 'self'`) blocks the CDN script. Copy the exported file into `spa-server/public` temporarily, fetch it from a page of the running app, load it into an isolated `iframe` (`srcdoc`) at the Ghost column width (1250px), and measure computed styles. That verifies **styling only**. Remove the copy afterwards.
- Animation behavior is verified in the app itself, since the export's script is the gateway script unchanged apart from imports.

## Pitfalls specific to this export

- **The extractor breaks on an unrelated edit.** It applies exact-string replacements and asserts each matches once, so a change to the source styling can break it. Then re-run and fix the replacement, or better, move that difference onto the parameter surface.
- **A source file's own import line survives.** `diagram-shared.js`'s `import anime` isn't its first line, so a "strip the first line" approach misses it. Strip by pattern and assert the result.
- **The exported copy is stale.** Regenerate it after any diagram change. Nothing detects drift automatically.
- **A Ghost theme overrides the sizes.** Its own paragraph and button rules can beat yours. Use higher specificity, and note that the HTML card's handling of the module script was never tested against a real Ghost site.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
