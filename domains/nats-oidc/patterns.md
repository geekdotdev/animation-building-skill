# Pattern catalog (example seed, NATS and OIDC domain pack)

This is the **domain pack** for diagrams about NATS messaging and OIDC login: recurring flows in this domain. Another domain would have its own catalog with the same structure.

A **pattern** is a named, reusable sequence: the shape of a recurring flow, with the parameters that change from use to use. **This is an example seed, not a specification.** It was written from the example diagrams as they stand and describes what they do today. Use it to start a new diagram from a known-good shape, and adapt it, or drop it, when the user wants something else.

**Patterns are recipes, not DSL templates.** An agent expands a pattern into ordinary sequences, triggers and effects (see `core/ontology.md`). Once the descriptor exists, a pattern used in two diagrams is a candidate for promotion to a template. Until then, nothing in a descriptor refers to a pattern by name. That is an assumption to confirm with the user.

**Using a pattern.**
1. Instantiate it with your parameters, and give every datum a name specific to its subject, such as "Logging client authenticated", not "Client authenticated".
2. Tag each resulting sequence with a fidelity (`faithful`, `adapted`, `metaphor`), and cite its `source:`. The tag suggested under each pattern is a starting point. The author decides it.
3. Assign each pattern instance to a lane. Avoid two sequences of one lane and phase sharing a channel. If two lanes end up on one channel with **different** assets, that is an escalation: ask the user for the overlay precedence (identical assets, like event payloads, need none).
4. Assets are the ones in `domains/nats-oidc/iconography.md`. Behavior and parameters are in `renderers/anime-svg/concept-map.md`.

## 1. Connect handshake

**Intent.** A NATS client authenticates with the broker.
**Fidelity (suggested).** `faithful`: INFO with a nonce, then CONNECT with a JWT and the signed nonce, then `+OK`. The OK is real because the demo's clients connect with `verbose: true`.
**Lane and timebox.** The client's own connection is the subject. Event-bounded: it ends at "*<client>* is NATS authenticated".

**Steps.**
1. Trigger (start, datum or gesture). Reveal the client's line. Narrate "Broker sends a NATS INFO request to *<client>*".
2. `natsInfoRequest`, broker → client. On arrival narrate "*<client>* responds with a signed NATS CONNECT request".
3. `natsConnectRequest`, client → broker. On arrival narrate "Broker sends OK to *<client>*".
4. `natsOk`, broker → client. On arrival, acknowledge (glow) the line.
5. When the glow ends, set the datum, narrate "*<client>* is NATS authenticated", and activate the next triggers, such as starting its traffic.

**Parameters.** Channel, client name, leg duration, log wording, which triggers the datum activates.
**Notes.** The line stays hidden until the handshake begins, so the client doesn't seem to connect before it needs to. Autonomous clients start at "All services are ready". The browser starts on a gesture.
**In the code today.** `beadArrived` branches: `ch3` (logging client) and `ch1` (browser) in every example diagram; `ch7` (auth-callout) only in the example diagrams that have an auth-callout, 2, 4 and 5.

## 2. Convergent handshakes

**Intent.** Two or more independent clients connect at the same moment, and are seen to finish together.
**Fidelity (suggested).** `adapted`: real clients don't synchronize. The symmetry is a visual choice that makes "these connect on their own once the stack is up" easy to see.
**Lane and timebox.** One lane per client, started by the same datum.

**Steps.**
1. Start pattern 1 for each client from the same datum.
2. Give every leg of every handshake the **same duration**, not the same crawler speed. The crawler on the longer line moves proportionately faster.
3. Both glows then start and end together.

**Parameters.** The instances, and the common leg duration (in the example diagrams, the logging line's, `HANDSHAKE_LEG_DURATION`).
**Verify.** Timestamp the log lines of a replay. In the example diagrams the auth-callout and logging-client lines differed by 0ms at each of INFO, CONNECT, OK and "authenticated".
**In the code today.** `HANDSHAKE_LEG_DURATION` in example diagrams 2, 4 and 5.

## 3. Authorization delegation (auth-callout)

**Intent.** The broker hands a connecting client's authorization decision to a service that mints the permissions.
**Fidelity (suggested).** `adapted`: the authorization response reuses the `natsConnectRequest` asset. It stands for the signed authorization response the real auth-callout returns.
**Lane and timebox.** The user session's NATS-connect phase, crossing into the auth-callout lane. It depends on the datum "auth-callout authenticated". **No example diagram enforces that dependency today.**

**Steps.**
1. The browser answers the broker's INFO with its zero-permission JWT and the access token (`zeroPermissionJwt`, browser → broker). Narrate "Broker delegates the decision to auth-callout".
2. `accessToken`, broker → auth-callout. Narrate that auth-callout re-verifies the token against Keycloak's keys, maps realm and roles to permissions and mints a connection-scoped JWT.
3. `natsConnectRequest` (the authorization response), auth-callout → broker. Narrate "Broker accepts the authorization response and sends OK to the browser".
4. `natsOk`, broker → browser. On arrival acknowledge the browser's line.
5. Datum "Browser is NATS authenticated". Update the hint.

**Escalation.** Steps 2 and 3 use the channel that auth-callout's own handshake (pattern 1) also uses, so this pattern shares a channel with another lane. The `accessToken` differs from the handshake's padlocks, so ask the user for the overlay precedence. (The `natsConnectRequest` on both is the same asset and needs none.) The current code separates the two with a `tag` argument, which the lane-scoped arrival triggers would replace.
**In the code today.** `beadArrived` `ch1` and `ch7` branches in example diagrams 2, 4 and 5.

## 4. OIDC login

Two variants. Only the steps differ.

**4a. BFF-initiated (example diagram 5).** Fidelity (suggested): `adapted`, because the code comment says it is "simplified: really via the redirect + spa-server's /auth/callback".
1. Gesture: the browser requests spa-server's login start (`anonymousRequest`, browser → spa-server).
2. spa-server answers with a `redirect` to Keycloak.
3. The browser requests the login form from Keycloak (`anonymousRequest`), and Keycloak serves it (`pageServe`).
4. Gesture: `signInRequest`, browser → Keycloak. Keycloak answers `tokenResponse`.
5. Acknowledge the Keycloak line. Datum "OIDC authenticated". Hint: "Initiate Session".

**4b. Pure SPA (example diagram 4).** Fidelity (suggested): `adapted`, because the authorize redirect is shown as a request and a page. Author's call.
1. The browser requests the login form from Keycloak (`anonymousRequest`), and Keycloak serves it (`pageServe`).
2. Gesture: `signInRequest`. Keycloak answers with a `redirect` carrying the code and the state.
3. The browser checks the state, then sends `tokenExchange` (code and verifier) **directly to Keycloak**, with no spa-server callback.
4. Keycloak answers `tokenResponse`. Acknowledge the line. Datum "OIDC authenticated".

**Parameters.** Which variant, the Keycloak channel, the spa-server channel (4a only), the hints.
**In the code today.** `beadArrived` `ch2` and `ch4` branches in example diagrams 4 and 5. Example diagrams 2 and 3 also use the login assets (`signInRequest`, `redirect`), but I haven't compared their steps.

## 5. Key-bound JWT issuance (proof of possession)

**Intent.** The browser gets a NATS JWT bound to a key it holds and never reveals.
**Fidelity (suggested).** `faithful`. Source: spa-server's `/api/zero-permission-user-identity` route and the zero-permission signing service.
**Lane and timebox.** The user session. It is user-paced: it starts on a gesture and its exit datum is "Browser holds a zero-permission JWT".

**Steps (example diagram 5).**
1. Gesture ("Initiate Session"): the browser generates a non-extractable Ed25519 key pair and sends only the public key (`publicKey`, browser → spa-server).
2. spa-server relays the public key and access token to the signing service. Reveal the mTLS line and its label with the first relayed request (`authenticatedRequest`, spa-server → service).
3. The service re-verifies the token and signs a zero-permission JWT naming the key (`zeroPermissionJwt`, service → spa-server).
4. spa-server relays it (`zeroPermissionJwt`, spa-server → browser).
5. Datum "Browser holds a zero-permission JWT". Hint: "Click to Subscribe".

**In the code today.** `beadArrived` `ch2` and `ch8` branches, example diagram 5. Example diagram 4 shows a simpler variant where spa-server itself signs and answers, with no signing-service line.

## 6. Relay through the broker

**Intent.** A message published by one client reaches another subscriber.
**Fidelity (suggested).** `faithful`: core NATS delivers only to subscribers that are connected at that moment and does not queue for absent ones.

**Steps.**
1. A `payload` crawls from the publisher to the broker.
2. On arrival, if the subscriber's datum "authenticated" is true, a `payload` crawls from the broker to the subscriber. If not, stop. The message has nowhere to go.

**Parameters.** Publisher, subscriber, and the gating datum. Fanning out to several subscribers would be a **divergence** and must be declared as one.
**Notes.** Don't narrate every message. The 3-second loop would drown the one-time handshake and login story in the log.
**In the code today.** `beadArrived` `ch3`-reverse to `ch1`-normal, and back.

## 7. Steady-state traffic

**Intent.** A connected client is visibly alive.
**Fidelity (suggested).** `adapted`: the 3-second cadence is chosen for legibility, not the application's real rate.
**Lane and timebox.** The client's lane, open-ended. Started by the client's "authenticated" datum, and stopped by Reset.

**Steps.** On the datum, send one `payload` at once, then one every 3000ms (`setInterval`). Clear the interval on Reset.
**In the code today.** `startLoggingClientTraffic`, and `clearInterval` in the Replay handler.

## 8. Volume docking (shared dependency)

**Intent.** Show that services depend on what an init container produced.
**Fidelity (suggested).** `metaphor`. **Explains:** a shared volume as the dependency between an init container's output and the service that consumes it. Nothing really moves.
**Lane and timebox.** The setup lane: a timed phase (narration), then event-bounded (docking) that ends at "All services are ready".

**Steps.**
1. From the first frame, the volumes are visible and docked at the Init Containers box.
2. Narrate what the init containers did, one line each, 2000ms apart. Then the internal datum "Init container completed" (no log line).
3. Each volume slides to its consumer over 900ms (`easeOutQuad`).
4. When all the volumes have docked, the datum "All services are ready" is satisfied. Its **closing acknowledgement** is every service box glowing at once, including spa-server, which has no volume. (It isn't one glow per volume as each docks.)
5. When that acknowledgement completes, the datum's triggers activate. (In example diagram 5 Keycloak also glows.) The browser becomes clickable. Two seconds later the Init Containers box fades over 600ms.

**Parameters.** The volumes, each one's consumer and offset, and the narration lines.
**Notes.** A volume that docks inside a zone is a member of that zone: size the zone so it stays inside its padding, and don't let a channel between two non-members cross it.
**In the code today.** `logInitContainerSequence`, `playVolumeDocking`, and `startPayloadFlows` (the counter behind "All services are ready").

## 9. Gated gesture step (click to advance)

**Intent.** The viewer drives a multi-step flow one click at a time.
**Fidelity (suggested).** `adapted`: real clients do not wait for a click.
**Lane and timebox.** The user session, user-paced.

**Steps.**
1. Arm the browser node only after "All services are ready".
2. On each click, the handler checks the state in order and starts the matching step. It clears the hint as it starts.
3. When a step's datum is set, it writes the next hint: "Click to request login form", then "Click to submit login form", "Initiate Session", "Click to Subscribe", "Click to Send".
4. Reset restores the first hint.

**Parameters.** The ordered list of (state, action, hint text).
**Notes.** Keep the hint equal to the currently armed gesture. In a scripted test an SVG group has no `.click()`, so dispatch a `MouseEvent`.
**In the code today.** The click handler in `initDiagram` and the hint updates in `beadArrived`, in example diagrams 2, 4 and 5. The hint texts above are example diagram 5's.

## Composing patterns

- A diagram is mostly a few lanes made of patterns. Example diagram 5, for example: the setup lane is pattern 8; the logging client and auth-callout lanes are pattern 1, started together as pattern 2, then pattern 7; the user session lane is 9 wrapped around 4, 5 and 3, with 6 relaying messages.
- Patterns don't own lanes or datums: the diagram does. Name datums per subject.
- Two instances that share a channel with **different** assets need an overlay precedence, which is an escalation. Identical assets (payloads) don't.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
