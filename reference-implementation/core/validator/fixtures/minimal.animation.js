// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// A small, valid descriptor for testing the validator. Generic on purpose: a client
// connects to a server, and a second client publishes once the first is connected.
export default {
  version: 1,
  diagramLabel: 'mini',
  title: 'Minimal',
  nodes: [
    { name: 'server', element: 'dg-box-server' },
    { name: 'client', element: 'dg-node-client', gesture: true },
    { name: 'other', element: 'dg-box-other' },
  ],
  channels: [
    { name: 'server-client', element: 'dg-line-client', a: 'server', b: 'client', duration: 1000, visibility: 'hidden' },
    { name: 'server-other', element: 'dg-line-other', a: 'server', b: 'other', duration: 1500, visibility: 'hidden' },
  ],
  zones: [], volumes: [],
  durations: { leg: 800 },
  datums: [
    { name: 'started', label: 'Started', when: { start: true } },
    { name: 'client-connected', label: 'Client connected',
      when: { arrival: { channel: 'server-client', direction: 'forward', asset: 'natsOk' } },
      acknowledge: { targets: ['server-client'], duration: 700 }, narrate: 'Client connected' },
    { name: 'other-published', label: 'Other published', terminal: true,
      when: { arrival: { channel: 'server-other', direction: 'return', asset: 'payload' } } },
  ],
  lanes: [
    { name: 'client', subject: "the client's connection", entry: { datum: 'started' },
      phases: [
        { name: 'connect', timebox: 'user-paced', arms: ['client'], exit: 'client-connected' },
        { name: 'steady', timebox: 'open-ended' },
      ] },
    { name: 'other', subject: "the other client's traffic", entry: { datum: 'client-connected' },
      phases: [ { name: 'publish', timebox: 'event-bounded', exit: 'other-published' } ] },
  ],
  sequences: [
    { name: 'connect', lane: 'client', phase: 'connect', fidelity: 'faithful', source: 'the handshake',
      rules: [
        { on: { gesture: 'client' }, do: [
          { reveal: ['server-client'] },
          { move: { asset: 'natsInfoRequest', channel: 'server-client', direction: 'forward', duration: '@leg' } } ] },
        { on: { arrival: { channel: 'server-client', direction: 'forward', asset: 'natsInfoRequest' } }, do: [
          { move: { asset: 'natsOk', channel: 'server-client', direction: 'forward', duration: '@leg' } } ] },
      ] },
    { name: 'publish', lane: 'other', phase: 'publish', fidelity: 'adapted', source: 'core NATS publish', adaptation: 'one payload stands for the stream',
      rules: [
        { on: { datum: 'client-connected' }, do: [
          { reveal: ['server-other'] },
          { move: { asset: 'payload', channel: 'server-other', direction: 'return' } } ] },
      ] },
  ],
  overlays: [],
};
