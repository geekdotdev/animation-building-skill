// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Skeleton descriptor: pairs with diagram.html. Copy both, rename the diagram label, and replace the
// content. The format is core/descriptor.md. This one is small but uses every kind of thing a descriptor names:
// nodes (a box, a gesture node, a group), channels (hidden with a label, and static), a zone, a volume that
// docks, datums, two lanes, sequences, a mode setting, and a composite crawler with a bounding box. The flow
// is a placeholder, not a real system: replace every `source:` with a citation of the code the sequence
// mirrors, and tag each sequence honestly.
export default {
  version: 1,
  diagramLabel: 'skeleton',            // the suffix of every element id in diagram.html
  markup: 'diagram.html',              // the diagram's SVG, relative to this file
  title: 'Skeleton: a client asks a server for a page',

  nodes: [
    { name: 'config-source', element: 'dg-init-source', label: 'Config source', group: true },
    { name: 'server', element: 'dg-box-server', label: 'Server' },
    { name: 'client', element: 'dg-node-client', label: 'Client', gesture: true, hint: 'Click to ask for a page' },
  ],
  channels: [
    // `a` to `b` is `forward`, and the path in the SVG must run from a to b.
    { name: 'source-server', element: 'dg-line-source-server', a: 'config-source', b: 'server', duration: 900, visibility: 'static' },
    { name: 'client-server', element: 'dg-line-client-server', a: 'client', b: 'server', duration: 1200, visibility: 'hidden',
      style: 'mtls', label: { element: 'dg-line-client-server-label', text: 'TLS' } },
  ],
  zones: [
    { name: 'trusted', element: 'dg-zone-trusted', label: 'Trusted network', members: { nodes: ['server'], volumes: ['config'] }, padding: { left: 20, top: 35, right: 30, bottom: 55 } },
    // A watermark's zone has no members: it's an attribution box, not a trust boundary (core/descriptor.md §3.3).
    { name: 'credits', element: 'dg-zone-credits', label: 'Credits', members: { nodes: [], volumes: [] }, padding: { left: 0, top: 0, right: 0, bottom: 0 } },
  ],
  volumes: [
    { name: 'config', element: 'dg-vol-config', label: 'server config', consumer: 'server', offset: { x: 350, y: 30 } },
  ],
  durations: { reveal: 700, acknowledge: 700, dock: 900 },

  // Pace: one factor on every duration and delay above and on every channel's `duration`. 1 is as authored, 2 is
  // twice as slow, 0.5 twice as fast. It scales everything equally, so what should finish together still does.
  pace: 1,

  // Attribution (core/descriptor.md §3.3). `author` is left out on purpose: omitted, it falls back to
  // whatever the host (build-site.mjs, export.mjs) resolves as this machine's git identity (`git var
  // GIT_AUTHOR_IDENT`), so a copy of this skeleton credits whoever's machine built it, with no edit needed.
  // Visible for 8s, then fades.
  watermark: { zone: 'credits', repo: true, fade: 8 },

  datums: [
    // Satisfied when the volume has docked. Its closing acknowledgement is the server's glow, and its triggers
    // (the session lane's entry) fire when the glow completes.
    { name: 'config-loaded', label: 'Server has its configuration', when: { completed: 'dock-config' },
      acknowledge: { targets: ['server'], duration: '@acknowledge' }, narrate: 'The server has loaded its configuration.' },
    { name: 'page-received', label: 'Client has the page', terminal: true,
      when: { arrival: { channel: 'client-server', direction: 'return', asset: 'response' } },
      acknowledge: { targets: ['client-server'], duration: '@acknowledge' }, narrate: 'The client has the page.' },
  ],

  lanes: [
    { name: 'setup', subject: 'the server starting up', entry: { start: true },
      phases: [ { name: 'docking', timebox: 'event-bounded', exit: 'config-loaded' } ] },
    { name: 'session', subject: "the client's request", entry: { datum: 'config-loaded' },
      phases: [ { name: 'request', timebox: 'user-paced', arms: ['client'], exit: 'page-received' } ] },
  ],

  sequences: [
    { name: 'load-config', lane: 'setup', phase: 'docking',
      fidelity: 'metaphor', explains: 'a shared volume as the dependency between where configuration is written and the service that reads it; nothing really moves',
      rules: [
        { on: { start: true }, do: [
          { narrate: 'The server loads its configuration from a shared volume.' },
          { dock: ['config'], duration: '@dock', name: 'dock-config' },
        ] },
      ] },
    { name: 'request-page', lane: 'session', phase: 'request',
      fidelity: 'adapted', source: 'REPLACE: the code that handles this request', adaptation: 'REPLACE: what you simplified, and why',
      rules: [
        { on: { gesture: 'client' }, do: [
          { hint: { node: 'client', text: '' } },
          { narrate: 'The client asks the server for a page, presenting its credential.' },
          { reveal: ['client-server'] },
          // A composite crawler (core/descriptor.md §3.1): the request and the credential travel together,
          // as one frame, rather than picking one icon to stand in for both. `box: true` shows the grouping,
          // and `spacing` (diagram units between each shape's centre) widens the default gap of 11.
          { move: { assets: ['request', 'credential'], channel: 'client-server', direction: 'forward', box: true, spacing: 18 } },
        ] },
        { on: { arrival: { channel: 'client-server', direction: 'forward', assets: ['request', 'credential'] } }, do: [
          { narrate: 'The server answers with the page.' },
          { move: { asset: 'response', channel: 'client-server', direction: 'return' } },
        ] },
      ] },
  ],

  overlays: [],

  // User-driven by default. The viewer may switch to automated, which presses each armed step for them after
  // 800 ms with a short blue glow on the pressed node.
  modes: { default: 'user-driven', toggle: true, simulated: { delay: 800, acknowledge: { color: '#1e88e5', duration: 400 } } },
};
