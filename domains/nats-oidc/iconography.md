# Iconography dictionary (example seed, NATS and OIDC domain pack)

This is the **domain pack** for diagrams about NATS messaging and OIDC login: the assets and what they mean. Another domain would have its own pack with the same structure, using the ontology and renderer files unchanged.

**This is an example, not a specification.** It was seeded from `ICONOGRAPHY` in `spa-server/public/diagram-shared.js` and the diagram rules in `spa-server/public/shared.css` as they stood at the time of writing. Use it to see how meaning is attached to a visual and to pick or extend assets consistently. A new project, a new diagram or the user's own preference may reasonably differ. When it conflicts with what the user wants, the user wins, and this file should then be updated to match, not the reverse.

The reference helpers (`reference-implementation/renderers/anime-svg/reference/helpers.js`) ship a small generic set of assets (`request`, `response`, `message`, `ok`, `error`, ...). The assets below are this domain's, from the example project, and would be added to that iconography, along with any richer shapes they need (the padlocks).

The ontology defines the terms (**asset**, **node**, **channel**, **zone**, **effect**). This file is only the visual vocabulary.

## Assets (things that travel a channel)

Defined in `ICONOGRAPHY`; drawn by `createCrawlerElement`. "Used in" lists the example diagrams whose script references the type today: **D** Static Demo, **2** Pre-Signed Zero Permission, **3** Role-Mapper, **4** Pure SPA Login, **5** BFF-Initiated SPA Login.

| Asset | Visual | Meaning (what it depicts) | Used in |
|---|---|---|---|
| `payload` | filled orange circle `#ff9f1c` | A NATS message | D 2 3 4 5 |
| `anonymousRequest` | filled gray circle `#999` | A request with no identity attached yet | D 2 3 4 5 |
| `signInRequest` | filled dark blue circle `#1a5fb4` | The browser's sign-in request to the identity provider | 2 3 4 5 |
| `redirect` | filled pink triangle `#e91e63` | An HTTP redirect, e.g. Keycloak sending the browser back to the app with an authorization code | 2 3 4 5 |
| `tokenExchange` | purple `⇄` text `#8e44ad` | An authorization-code-for-tokens exchange request | 2 3 4 |
| `tokenResponse` | filled purple circle `#8e44ad` | The whole OIDC token response (id, access and refresh tokens) | 2 3 4 5 |
| `accessToken` | hollow purple circle | A single OIDC access token presented on its own | 2 4 5 |
| `natsUserJwt` | filled gold circle `#d4a017` | A minted, per-connection NATS user JWT | 3 |
| `zeroPermissionJwt` | hollow gold circle | A NATS user JWT carrying no permissions of its own | 2 4 5 |
| `authenticatedRequest` | filled teal square `#00838f` | A request carrying the caller's verified session or access token (spa-server relaying it to a back-end service) | 5 |
| `publicKey` | filled teal circle `#00838f` | A browser-generated public key submitted for signing | 3 4 5 |
| `pageServe` | hollow gray square `#888` | An HTML page being served | 2 3 4 5 |
| `natsInfoRequest` | black closed padlock | The broker's NATS INFO frame, which carries the nonce to sign: nothing proven yet | D 2 3 4 5 |
| `natsConnectRequest` | black open padlock, tilted, with a yellow key `#f1c40f` | A NATS CONNECT frame carrying a user JWT and the signed nonce: proof of possession presented | D 2 3 4 5 |
| `natsOk` | green `OK` text `#27ae60` | The broker's `+OK` acceptance of a signed CONNECT | D 2 3 4 5 |

**Defined but not used by any example diagram today:** `nonceChallenge` (light green circle), `signedNonceChallenge` (dark green circle), `authChallenge` (red X, a 401 challenge), `natsAuthFailed` (red X, the broker rejecting a CONNECT).

## Other visual vocabulary (from `shared.css`)

| Element | Visual | Meaning |
|---|---|---|
| Node (`.diagram-box`) | rounded rect, fill `#f8f8f8`, gray outline | A component |
| Key store (`.diagram-keystore`) | rounded rect, fill `#eef6ff`, light blue outline | A store of keys or credentials inside a node, such as init-operator and init-users |
| Volume (`.diagram-volume`) | small rounded rect, fill `#ffe9b3`, gold outline, small label | A shared volume. It is a metaphor: it slides from its producer to its consumer to show a shared dependency, though nothing really moves |
| Line (`.diagram-line`) | 2px dark line, hidden until revealed | A channel. `.diagram-line-static` is always visible |
| mTLS line (`.diagram-line-mtls`) | teal `#00838f`, with an italic teal label that fades in with it | A hop whose transport differs from ordinary lines |
| Zone (`.diagram-zone`) | dashed gray outline, no fill, italic label | A spatial trust boundary, such as a private network |
| Acknowledge glow (`.diagram-glow`, `glowBox`) | orange outline pulse, about 700ms | A closing acknowledgement on a node or line |
| Hint (`.diagram-hint`) | small italic gray text under a node label | A prompt for the user's next gesture |
| Label, sub-label | 12px bold, 10px | Names for nodes and their parts |

## Conventions the seed happens to follow (observed, not required)

- **Colour families.** Purple is OIDC tokens. Gold is NATS user JWTs. Teal is the spa-server or back-end path. Blue is the sign-in request. Black is NATS protocol frames. Gray is anonymous or pending. Orange is a NATS message. Red is failure.
- **Hollow means a reduced form of the filled concept.** `accessToken` is a single token where `tokenResponse` is the whole set. `zeroPermissionJwt` is a JWT without permissions where `natsUserJwt` is the full one. This is not uniform: `pageServe` and the X shapes are also hollow, with a different meaning.
- **Shape carries kind.** Circles are data or credentials, the triangle is an HTTP redirect, the square is a request or page, the padlock is a protocol frame, and X is failure.
- **A handshake reads as three assets in order:** closed padlock, then open padlock with key, then `OK`.

## Things worth noticing when you extend it

- **A payload carrying more than one object is a composite crawler, not a new shape.** `zeroPermissionJwt` (hollow gold circle) and `signedNonceChallenge` (dark green circle, unused) merely share the circle shape, which isn't itself a problem — most single-token assets here are colour-coded circles. But this domain does have a real multi-object case: the CONNECT frame that carries both the zero-permission JWT and the access token was once drawn with the JWT's icon standing in for both, silently dropping the second object. Naming both assets on the move (`assets: [...]`, core/descriptor.md §3.1) instead is the fix; see FINDING F18 in the worked example's `FINDINGS.md`. Don't invent a new combined icon for a pairing that already has two icons of its own.
- **Orange is used twice.** It is the `payload` asset and also the acknowledge glow. They are different kinds of thing (an asset and an effect), which is fine as long as they never appear as the same element.
- **Teal is used for two ideas:** the spa-server request path, and the mTLS line. The seed treats them as related, but a new project might not.
- **Four entries are unused.** Defining an asset before anything uses it is cheap. Whether to keep unused ones is a project decision.

## Adding an asset (an example procedure)

1. Look for an existing asset that already means it. Reuse before adding.
2. Choose a shape and colour that fit a family above, or state why it starts a new one.
3. Add it to `ICONOGRAPHY` with a one-line comment that says what it depicts.
4. Add a row here, with a real use if there is one.
5. If it needs a shape `createCrawlerElement` doesn't draw, add that shape there first.
