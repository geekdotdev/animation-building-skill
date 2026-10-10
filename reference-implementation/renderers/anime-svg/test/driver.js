// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// Observes a diagram's page and records what it does, in window.__run:
//   { log: [{t, text}], events: [...], clicks: [{t, node, phase, by}], done }
// It never acts: the interaction mode belongs to the descriptor and the interpreter (`settings.interactionModes`, ontology
// rules 17 to 19). `clicks` lists each gesture with who performed it (by: 'user' or 'simulated').
// `done` is set 8 s after the interactive phase's gesture, so a payload has crossed.
export async function startDriver(label, boot) {
  const run = (window.__run = { log: [], events: [], clicks: [], done: false });
  const t0 = performance.now(), now = () => Math.round(performance.now() - t0);
  const log = document.getElementById(`diagram-${label}-log`);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) run.log.push({ t: now(), text: n.textContent }); }).observe(log, { childList: true });
  await boot((e) => {
    run.events.push(e);
    if (e.type === 'gesture') { run.clicks.push({ t: e.t, node: e.node, phase: e.phase, by: e.by }); if (e.phase === 'interactive') setTimeout(() => { run.done = true; }, 8000); }
  });
}
