// Descriptor interpreter for anime.js v3 and inline SVG: the shared renderer described by
// core/descriptor.md section 9. It reads a descriptor (a data-only module) and animates a diagram
// whose markup already exists, so geometry stays in the SVG.
//
//   import anime from '/vendor/animejs/anime.es.js';
//   import { createCrawlerElement, logDiagramTransition, playVolumeDocking } from '/diagram-shared.js';
//   import descriptor from './diagram.animation.js';
//   const run = createInterpreter(descriptor, { anime, createCrawlerElement, logDiagramTransition, playVolumeDocking });
//   run.start();          // Replay calls run.reset()
//
// Dependencies are injected so this file imports nothing and works with any project's helpers.
// `onEvent(e)` is optional and receives { t, type, ... } for every datum, narration, move and
// arrival: it is how the test page in ./test/ observes a run.
//
// Interaction mode (core/ontology.md rules 17 to 19; descriptor `modes`): 'user-driven' or 'automated'.
// In automated mode the interpreter presses each armed gesture node on the viewer's behalf: after
// `modes.simulated.delay` it plays `modes.simulated.acknowledge` (a short coloured glow) on the node,
// then performs the gesture through the same path as a click, so gating, consumption, hints and
// datums behave exactly as they do for a user. `modes.toggle` puts a switch beside Replay.
// `env.mode` overrides the descriptor's default (a host decision, e.g. a test URL).
//
// Pace (the descriptor's `pace`, overridden by `env.pace`): a factor on every duration and delay. 2 is twice as
// slow, 0.5 twice as fast. It scales moves, reveals, glows, docking, `after` delays, `repeat` intervals, `delay`
// conditions, the crawler fade-out and the simulated press, all by the same factor.
//
// What this renderer does NOT do, by design (core/descriptor.md section 5): it doesn't validate
// lanes, phases or overlays (run the validator first), and it doesn't apply overlay precedence.
// Crawlers are appended to the <svg> last, so the newest is on top, which is the fallback the
// ontology gives when the user names no precedence.
//
// Element naming: an element's id is `<element>-<diagram-label>` (the descriptor's `diagramLabel`), with `element` written in the descriptor.
// Class and helper names are the example project's (`diagram-glow`, `diagram-clickable`,
// `.diagram-hint`, `#diagram-<diagram-label>-log`, `#diagram-<diagram-label>-replay`).

export function createInterpreter(d, env) {
  const { anime, createCrawlerElement, logDiagramTransition, playVolumeDocking, onEvent = () => {} } = env;
  const doc = env.document ?? document;
  const LABEL = d.diagramLabel;
  const id = (element) => `#${element}-${LABEL}`;
  const svgSel = `#diagram-${LABEL} svg`, logSel = `#diagram-${LABEL}-log`;

  const nodes = new Map(d.nodes.map((n) => [n.name, n]));
  const chans = new Map(d.channels.map((c) => [c.name, c]));
  const vols = new Map(d.volumes.map((v) => [v.name, v]));
  const datumBy = new Map(d.datums.map((x) => [x.name, x]));
  const laneBy = new Map(d.lanes.map((l) => [l.name, l]));

  // every rule, flattened, with the lane and phase of its sequence
  const rules = d.sequences.flatMap((s) => s.rules.map((r) => ({ lane: s.lane, phase: s.phase, seq: s.name, ...r })));

  // ---- names to selectors and durations ------------------------------------
  const sel = (name) => { const e = chans.get(name) ?? nodes.get(name); return id(e.element); };
  const selWithLabel = (name) => { const c = chans.get(name); return c?.label ? [id(c.element), id(c.label.element)] : [sel(name)]; };
  // Pace: one factor on every time in the run (2 is twice as slow, 0.5 twice as fast). It multiplies every
  // duration and delay by the same amount, so relationships between them (two legs of equal length that
  // finish together) are unchanged. `env.pace` overrides the descriptor's `pace`.
  let PACE = 1;
  for (const v of [d.pace, env.pace]) {
    if (v === undefined) continue;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) PACE = v; else console.warn(`pace must be a positive number, got ${JSON.stringify(v)}: ignored`);
  }
  const scaled = (ms) => Math.round(ms * PACE);
  // Every time value from the descriptor goes through here, so pace is applied once and in one place.
  const dur = (v, fallback) => {
    if (v === undefined) return scaled(fallback);
    if (typeof v === 'number') return scaled(v);
    const named = d.durations[v.slice(1)];
    if (typeof named === 'number') return scaled(named);
    return scaled(chans.get(named.link.replace('channel:', '')).duration);
  };
  const REVEAL = () => dur('@reveal', 700), ACK = () => dur('@acknowledge', 700);

  // ---- run state (everything Reset has to return to its start) ---------------
  let gen = 0;
  let t0 = 0;
  let timers = new Set();
  let satisfied, pending, leaves, lanes;
  const M = d.modes ?? { default: 'user-driven', toggle: false };
  let mode = env.mode ?? M.default ?? 'user-driven';
  if (mode === 'automated' && !M.simulated) { console.warn('automated mode needs modes.simulated: staying user-driven'); mode = 'user-driven'; }
  let simPending = new Map(), simDone = new Set(), pressAnims = new Set(); // simulated gestures: scheduled, already performed, and in progress
  const emit = (type, data) => onEvent({ t: Math.round(performance.now() - t0), type, ...data });
  // every deferred behavior carries the generation it started in and stops if Reset has happened
  const later = (ms, fn) => { const g = gen; const h = setTimeout(() => { timers.delete(h); if (g === gen) fn(); }, ms); timers.add(h); };
  const guard = (fn) => { const g = gen; return (...a) => { if (g === gen) return fn(...a); }; };

  // ---- conditions ----------------------------------------------------------
  const leafKey = (c, datum) =>
    c.arrival ? `arrival:${c.arrival.channel}/${c.arrival.direction}/${c.arrival.asset}`
      : c.gesture !== undefined ? `gesture:${c.gesture}`
        : c.completed !== undefined ? `completed:${c.completed}`
          : c.delay !== undefined ? `delay:${datum}`
            : c.start ? 'start' : null;
  const evalCond = (c, datum) => {
    if (!c) return true;
    if (c.all) return c.all.every((x) => evalCond(x, datum));
    if (c.any) return c.any.some((x) => evalCond(x, datum));
    if (c.datum !== undefined) return satisfied.has(c.datum);
    return leaves.has(leafKey(c, datum));
  };
  const collect = (c, out = []) => { if (!c) return out; if (c.all) c.all.forEach((x) => collect(x, out)); else if (c.any) c.any.forEach((x) => collect(x, out)); else out.push(c); return out; };

  // ---- datums ---------------------------------------------------------------
  // A datum is satisfied when its condition holds, plays its closing acknowledgement, and only when
  // that completes is it "closed": guards see it as true and the rules that react to it fire.
  function checkDatums() {
    for (const x of d.datums) {
      if (satisfied.has(x.name) || pending.has(x.name) || !evalCond(x.when, x.name)) continue;
      pending.add(x.name);
      emit('datum-satisfied', { datum: x.name });
      const close = guard(() => {
        satisfied.add(x.name); pending.delete(x.name);
        if (x.narrate) narrate(x.narrate);
        emit('datum', { datum: x.name });
        onDatum(x.name);
      });
      if (x.acknowledge) glow(x.acknowledge.targets, dur(x.acknowledge.duration, ACK()), close); else close();
    }
  }

  function onDatum(name) {
    const active = new Set(); // lane/phase pairs whose rules may fire: the phase just exited and the one entered
    for (const l of d.lanes) {
      const st = lanes[l.name];
      if (!st.entered && l.entry.datum === name) enterLane(l);
      if (!st.entered) continue;
      const ph = l.phases[st.phase];
      if (ph.exit === name) { active.add(`${l.name}/${ph.name}`); if (st.phase < l.phases.length - 1) { st.phase++; st.consumed = new Set(); } }
      active.add(`${l.name}/${l.phases[st.phase].name}`);
    }
    for (const r of rules) if (r.on.datum === name && active.has(`${r.lane}/${r.phase}`)) runRule(r);
    checkDatums(); refreshClickable();
  }

  // ---- lanes and phases -----------------------------------------------------
  function enterLane(l) {
    const st = lanes[l.name]; st.entered = true; st.phase = 0; st.consumed = new Set();
    emit('lane-enter', { lane: l.name });
    // a `delay` condition is measured from the start of the lane whose phase it ends
    for (const p of l.phases) {
      const x = p.exit && datumBy.get(p.exit);
      for (const c of collect(x?.when)) if (c.delay !== undefined) later(scaled(c.delay), () => { leaves.add(`delay:${x.name}`); checkDatums(); });
    }
  }

  // ---- gestures --------------------------------------------------------------
  const armedNow = (nodeName) => d.lanes.flatMap((l) => {
    const st = lanes[l.name]; if (!st.entered) return [];
    const p = l.phases[st.phase];
    // a user-paced step is consumed by its click; an open-ended phase can be clicked again and again
    return (p.arms || []).includes(nodeName) && (p.timebox === 'open-ended' || !st.consumed.has(p.name)) ? [{ l, p, st }] : [];
  });
  function refreshClickable() {
    for (const n of d.nodes) if (n.gesture) doc.querySelector(id(n.element))?.classList.toggle('diagram-clickable', armedNow(n.name).length > 0);
    scheduleSimulated();
  }
  function onClick(nodeName, by = 'user') {
    for (const { l, p, st } of armedNow(nodeName)) {
      st.consumed.add(p.name);
      emit('gesture', { node: nodeName, lane: l.name, phase: p.name, by });
      leaves.add(`gesture:${nodeName}`);
      for (const r of rules) if (r.lane === l.name && r.phase === p.name && r.on.gesture === nodeName) runRule(r);
    }
    checkDatums(); refreshClickable();
  }

  // ---- interaction mode ------------------------------------------------------
  // Automated mode performs each armed gesture for the viewer. It is the same trigger (rule 17): press() ends in onClick().
  function scheduleSimulated() {
    if (mode !== 'automated') return;
    for (const n of d.nodes) {
      if (!n.gesture) continue;
      for (const { l, p } of armedNow(n.name)) {
        const key = `${n.name}|${l.name}/${p.name}`;
        if (simDone.has(key) || simPending.has(key)) continue;
        const g = gen;
        const h = setTimeout(() => { simPending.delete(key); if (g === gen) press(n, l, p, key); }, scaled(M.simulated.delay));
        simPending.set(key, h);
      }
    }
  }
  // The press: a short glow on the node, then the gesture, unless it stopped being armed meanwhile
  // (the viewer clicked first, the mode changed, or Reset).
  function press(n, l, p, key) {
    const stillArmed = () => mode === 'automated' && armedNow(n.name).some((x) => x.l === l && x.p === p);
    if (!stillArmed()) return;
    const g = gen, el = doc.querySelector(id(n.element)), { color } = M.simulated.acknowledge, duration = scaled(M.simulated.acknowledge.duration);
    const shadow = `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 8px ${color})`;
    emit('press', { node: n.name });
    const a = el.animate([{ filter: 'none' }, { filter: shadow, offset: 0.4 }, { filter: 'none' }], { duration, easing: 'ease-out' });
    pressAnims.add(a);
    a.onfinish = () => {
      pressAnims.delete(a);
      if (g !== gen) return;
      if (stillArmed()) { simDone.add(key); onClick(n.name, 'simulated'); }
    };
  }
  function cancelSimulated() { for (const h of simPending.values()) clearTimeout(h); simPending = new Map(); for (const a of pressAnims) a.cancel(); pressAnims = new Set(); }
  function setMode(next) {
    if (!M.toggle || next === mode || !['user-driven', 'automated'].includes(next) || (next === 'automated' && !M.simulated)) return false;
    mode = next; emit('mode', { mode });
    if (mode === 'user-driven') cancelSimulated(); else scheduleSimulated();
    if (toggleBox) toggleBox.checked = mode === 'automated';
    return true;
  }

  // ---- rules and actions -----------------------------------------------------
  function runRule(r) {
    if (r.when && !evalCond(r.when)) return; // a guard
    run(r.do, 0, r.lane);
  }
  // Actions run in order. reveal, hide, acknowledge and dock block until they finish. narrate and hint
  // are instant. A move starts and doesn't block: what follows a move is a rule triggered by its arrival.
  // `after` delays an action from the moment the previous one finished.
  function run(list, i, lane, done) {
    if (i >= list.length) { if (done) done(); return; }
    const a = list[i], next = guard(() => run(list, i + 1, lane, done));
    const go = () => exec(a, lane, next);
    a.after !== undefined ? later(dur(a.after), go) : go();
  }
  function exec(a, lane, next) {
    if (a.narrate !== undefined) { narrate(a.narrate); next(); }
    else if (a.hint) { setHint(a.hint.node, a.hint.text); next(); }
    else if (a.reveal) reveal(a.reveal, next);
    else if (a.hide) fade(a.hide, dur(a.duration, 600), next);
    else if (a.acknowledge) glow(a.acknowledge.targets, dur(a.acknowledge.duration, ACK()), next);
    else if (a.move) { sendBead(a.move.channel, a.move.direction, a.move.asset, lane, a.move.duration); next(); }
    else if (a.dock) dock(a, next);
    else if (a.divergence) { for (const b of a.divergence.branches) sendBead(b.channel, b.direction, a.divergence.asset, lane, b.duration); next(); }
    else if (a.repeat) {
      const g = gen, tick = () => { if (g === gen) run(a.repeat.do, 0, lane); };
      tick(); const h = setInterval(tick, dur(a.repeat.every)); timers.add(h); next();
    } else next();
  }

  const narrate = (text) => { logDiagramTransition(logSel, text); emit('narrate', { text }); };
  const setHint = (node, text) => { const el = doc.querySelector(`${id(nodes.get(node).element)} .diagram-hint`); if (el) el.textContent = text; };

  function reveal(names, done) {
    const targets = names.flatMap((n) => (chans.has(n) ? selWithLabel(n) : [sel(n)]));
    anime.remove(targets);
    anime({ targets, opacity: [0, 1], duration: REVEAL(), easing: 'easeOutQuad', complete: guard(done) });
  }
  function fade(names, duration, done) {
    const targets = names.map(sel);
    anime.remove(targets);
    anime({ targets, opacity: [1, 0], duration, easing: 'easeOutQuad', complete: guard(done) });
  }
  // The orange glow: an outline pulse on a box, a line or any stroked element. All targets pulse together
  // and `done` runs once, when they finish.
  function glow(names, duration, done) {
    const targets = names.map(sel);
    for (const s of targets) { anime.remove(s); doc.querySelector(s).classList.add('diagram-glow'); }
    anime({
      targets, stroke: ['#999', '#ff9f1c', '#999'], strokeWidth: [1.5, 3, 1.5], duration, easing: 'easeOutQuad',
      complete: guard(() => { for (const s of targets) doc.querySelector(s).classList.remove('diagram-glow'); done(); }),
    });
  }
  function dock(a, done) {
    const names = a.dock, deltas = names.map((n) => vols.get(n).offset);
    playVolumeDocking(names.map((n) => id(vols.get(n).element)), deltas, guard(() => {
      if (a.name) { leaves.add(`completed:${a.name}`); emit('completed', { name: a.name }); }
      checkDatums(); done();
    }), dur(a.duration, 900)); // the descriptor's duration; a helper that ignores a fourth argument keeps its own
  }

  function sendBead(channel, direction, asset, lane, duration) {
    const g = gen, c = chans.get(channel), path = id(c.element);
    const bead = createCrawlerElement(asset);
    doc.querySelector(svgSel).appendChild(bead);
    const p = anime.path(path);
    emit('move', { channel, direction, asset, lane });
    anime({
      targets: bead, translateX: p('x'), translateY: p('y'), easing: 'linear', duration: dur(duration, c.duration),
      direction: direction === 'forward' ? 'normal' : 'reverse',
      complete: () => {
        if (g !== gen) { bead.remove(); return; }
        anime({ targets: bead, opacity: [1, 0], duration: scaled(350), easing: 'easeOutQuad', complete: () => bead.remove() });
        arrived(channel, direction, asset, lane);
      },
    });
  }
  // An arrival fires the datums that wait for it (from any lane) and the rules that wait for it in the
  // lane that sent it: two lanes can send the same asset on the same channel without colliding.
  function arrived(channel, direction, asset, lane) {
    emit('arrival', { channel, direction, asset, lane });
    leaves.add(`arrival:${channel}/${direction}/${asset}`);
    for (const r of rules) {
      const t = r.on.arrival;
      if (t && r.lane === lane && t.channel === channel && t.direction === direction && t.asset === asset) runRule(r);
    }
    checkDatums();
  }

  // ---- start and reset -------------------------------------------------------
  function initial() {
    gen++; // invalidate everything pending BEFORE touching state (core/descriptor.md 9.7)
    t0 = performance.now();
    cancelSimulated(); simDone = new Set();
    satisfied = new Set(); pending = new Set(); leaves = new Set();
    lanes = Object.fromEntries(d.lanes.map((l) => [l.name, { entered: false, phase: 0, consumed: new Set() }]));
  }
  function start() {
    initial();
    // volumes are docked with their source from the first frame
    anime.set(d.volumes.map((v) => id(v.element)), { scale: 1, opacity: 1, translateX: 0, translateY: 0 });
    for (const n of d.nodes) if (n.hint !== undefined) setHint(n.name, n.hint);
    for (const l of d.lanes) if (l.entry.start) {
      enterLane(l);
      for (const r of rules) if (r.lane === l.name && r.phase === l.phases[0].name && r.on.start) runRule(r);
    }
    refreshClickable();
    checkDatums();
  }
  function reset() {
    gen++;
    for (const h of timers) { clearTimeout(h); clearInterval(h); }
    timers = new Set();
    doc.querySelectorAll(`${svgSel} .diagram-crawler`).forEach((b) => { anime.remove(b); b.remove(); });
    // everything the run can have changed: lines, labels, boxes, volumes, groups, glows, hints, the log
    const all = [...d.nodes.map((n) => id(n.element)), ...d.channels.flatMap((c) => selWithLabel(c.name)), ...d.volumes.map((v) => id(v.element)), ...d.zones.map((z) => id(z.element))];
    for (const s of all) anime.remove(s);
    for (const c of d.channels) for (const s of selWithLabel(c.name)) { const el = doc.querySelector(s); if (c.visibility === 'hidden') el.style.opacity = ''; el.classList.remove('diagram-glow'); el.style.stroke = ''; el.style.strokeWidth = ''; }
    for (const n of d.nodes) { const el = doc.querySelector(id(n.element)); el.classList.remove('diagram-glow', 'diagram-clickable'); el.style.stroke = ''; el.style.strokeWidth = ''; if (n.group) anime.set(id(n.element), { opacity: 1 }); }
    doc.querySelector(logSel).innerHTML = '';
    start();
  }

  // ---- wiring (once) ---------------------------------------------------------
  for (const n of d.nodes) if (n.gesture) doc.querySelector(id(n.element)).addEventListener('click', () => onClick(n.name));
  doc.getElementById(`diagram-${LABEL}-replay`)?.addEventListener('click', reset);
  // the mode toggle, beside Replay, only when the descriptor allows the viewer to switch
  let toggleBox = null;
  if (M.toggle) {
    const footer = doc.querySelector(`#diagram-${LABEL} .diagram-footer`);
    if (!footer) console.warn('modes.toggle is set but the diagram has no .diagram-footer: no toggle shown');
    else {
      const label = doc.createElement('label');
      label.className = 'diagram-mode-toggle';
      label.style.cssText = 'margin-right:1rem;font-size:0.9rem;cursor:pointer;user-select:none';
      label.innerHTML = '<input type="checkbox"> Automated';
      toggleBox = label.querySelector('input'); toggleBox.checked = mode === 'automated';
      toggleBox.addEventListener('change', () => { if (!setMode(toggleBox.checked ? 'automated' : 'user-driven')) toggleBox.checked = mode === 'automated'; });
      footer.insertBefore(label, footer.firstChild);
    }
  }

  return { start, reset, mode: () => mode, setMode, pace: () => PACE, state: () => ({ gen, satisfied: [...satisfied], lanes: JSON.parse(JSON.stringify(lanes)) }) };
}
