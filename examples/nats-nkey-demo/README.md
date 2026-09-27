# Example: `nats-nkey-demo-priv`

The project this skill was first written from. It is here as a **worked example**: real values, real commands and a real lab to imitate. Nothing in this folder is a specification, and none of the other layers depend on it.

## What the project is

An educational NATS and Keycloak demo run under Podman. A Deno `spa-server`, Go services, and five animated SVG lab diagrams (anime.js v3) served at `https://localhost:3001`. Each lab's diagram is a hand-kept copy: `spa-server/public/gateways/<lab>-gateway.{html,js}`, with shared pieces in `spa-server/public/diagram-shared.js` and `shared.css`.

| Lab (tab) | id suffix |
|---|---|
| Static Demo User | `demo` |
| Auth-Callout: Pre-Signed Zero Permission | `callout` |
| Role-Mapper: PoP Signed Identity | `callout-pop-signed` |
| Auth-Callout: Pure SPA Login, PoP Zero Permission | `callout-spa-login` |
| Auth-Callout: BFF-Initiated SPA Login, PoP Zero Permission | `callout-pop-zero-permission` |

## Files in this folder

| File | What it is |
|---|---|
| `conventions.md` | This project's layout numbers, durations and lab 5's startup timeline. |
| `environment.md` | The commands for each verification step, the environment's pitfalls, the browser pane's limits, and shell notes. |
| `phrases.md` | Real requests from this project, in the user's words, mapped to constructs and to what was done. |
| `ghost-export.md` | The Ghost blog export profile for lab 5: what the extractor changes, the presentation parameters, and how to verify it here. |

## Other layers this project uses

- **Renderer:** `renderers/anime-svg/` (anime.js and SVG).
- **Domain pack:** `domains/nats-oidc/` (NATS and OIDC assets and flows).

## A worked descriptor

Lab 5's animation descriptor, written by hand from its script in the draft format of `core/descriptor.md`, is in a separate project directory next to this repository: `lab5-animation-descriptor/` (in the same parent folder as `nats-nkey-demo-priv`). Its `FINDINGS.md` records where the format needed additions, and its `check.mjs` is a structural check that seeds the validator.

## Existing code does not conform yet

`shared.css` uses literal values, `scripts/build_lab5_standalone.py` applies exact-string replacements, and the gateway scripts still hard-code their flows in `beadArrived` chains. The skill describes how new or changed work should be done. Don't refactor existing diagrams or scripts to conform unless the user asks.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
