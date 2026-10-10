// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
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
// Interaction mode (core/ontology.md rules 17 to 19; descriptor `settings.interactionModes`): 'user-driven' or 'automated'.
// In automated mode the interpreter presses each armed gesture node on the viewer's behalf: after
// `settings.interactionModes.simulated.delayMs` it plays `settings.interactionModes.simulated.acknowledge` (a short coloured glow) on the node,
// then performs the gesture through the same path as a click, so gating, consumption, hints and
// datums behave exactly as they do for a user. `settings.interactionModes.toggle` puts a switch beside Replay.
// `env.mode` overrides the descriptor's default (a host decision, e.g. a test URL).
//
// Composite crawlers (core/ontology.md, Composite crawler; core/descriptor.md section 3.1): a move or
// divergence names `asset` (one) or `assets` (two or more, travelling together as one crawler, `spacing`
// diagram units apart, default 11), optionally in a bounding box via `box: true`). No helper change is
// needed: each icon is drawn exactly as it would be alone, one call to createCrawlerElement per name.
//
// Pace (the descriptor's `settings.paceMultiplier`, overridden by `env.pace`): a factor on every duration and delay. 2 is twice as
// slow, 0.5 twice as fast. It scales moves, reveals, glows, docking, `after` delays, `repeat` intervals, `delay`
// conditions, the crawler fade-out and the simulated press, all by the same factor.
//
// Local storage (core/ontology.md "Local storage"; core/descriptor.md section 3.2): each node accumulates the
// assets it holds — added when one arrives there (any channel ending at that node) or a `store` action names
// it — tracked whether or not the descriptor's `strict` is set (that only affects the validator's check, run
// before this ever loads). A node's `showLocalStorage` displays its current holdings as small icons, `overlay`
// centred on the node's own box or `adjacent` in a small bounding box at an offset from it. Storage only grows;
// nothing is removed on send.
//
// What this renderer does NOT do, by design (core/descriptor.md section 5): it doesn't validate
// lanes, phases or overlays (run the validator first), and it doesn't apply overlay precedence.
// Crawlers are appended to the <svg> last, so the newest is on top, which is the fallback the
// ontology gives when the user names no precedence.
//
// Element naming: an element's id is `<element>-<diagram-label>` (the descriptor's `diagramLabel`), with `element` written in the descriptor.
// Class and helper names are the example project's (`diagram-glow`, `diagram-clickable`,
// `.diagram-hint`, `#diagram-<diagram-label>-log`, `#diagram-<diagram-label>-replay`).

// ---- icons on a box (core/descriptor.md section 3.5) --------------------------------------------------------
// A node's `icons` stand still along the inside top edge of its box, in a row centered on the box. The box's label
// (and hint) are shifted down to make room, and must still leave padding under the text. This is the one place
// the numbers live: the interpreter uses it to draw, and markup/check.mjs uses it to tell an author, before
// anything runs, that a box is too small. Pure, so it can be tested without a DOM.
//   box: { x, y, width, height }.  widths: each icon's width at ICON_LAYOUT.size.
//   texts: the label/hint lines inside the box, each { y (baseline), fontSize }.
// Returns { icons: [{ cx, cy }], shift (how far every text line moves down), bottomPadding, rowWidth, fits }.
export const ICON_LAYOUT = {
  size: 24,          // an icon's height in diagram units
  padTop: 6,         // from the box's inside top edge to the icons
  gap: 6,            // between icons in the row
  gapBelow: 4,       // from the icons to the top of the text beneath them
  padBottom: 6,      // the least that must remain between the text's bottom and the box's bottom
  padSide: 6,        // the least between the row's ends and the box's sides
  labelFontSize: 13, // what the label and hint are assumed to measure when the real size isn't known
  hintFontSize: 10,
  ascent: 0.8,       // a text line spans y - ascent*fontSize to y + descent*fontSize
  descent: 0.25,
};
export function planBoxIcons(box, widths, texts = []) {
  const L = ICON_LAYOUT;
  const rowWidth = widths.reduce((a, b) => a + b, 0) + L.gap * Math.max(0, widths.length - 1);
  let x = box.x + (box.width - rowWidth) / 2;
  const cy = box.y + L.padTop + L.size / 2;
  const icons = widths.map((w) => { const c = { cx: x + w / 2, cy }; x += w + L.gap; return c; });
  let shift = 0, bottomPadding = box.height;
  if (texts.length) {
    const top = Math.min(...texts.map((t) => t.y - L.ascent * t.fontSize));
    shift = Math.max(0, box.y + L.padTop + L.size + L.gapBelow - top);
    bottomPadding = box.y + box.height - Math.max(...texts.map((t) => t.y + L.descent * t.fontSize + shift));
  }
  return { icons, shift, bottomPadding, rowWidth, fits: bottomPadding >= L.padBottom && rowWidth <= box.width - 2 * L.padSide };
}

// A volume is only about 22 units tall, so its icons don't go along the top edge. The icons and the volume's label
// form one group, the icons first and the label a few units after them, and that group is centered in the box. The
// icons are as tall as the box less a little margin (16 on a 22-unit volume), and the box must be wide enough for
// the whole group.
//   box: { x, y, width, height }.  widths: each icon's width at `volumeIconSize(box)`.
//   text: { chars, fontSize } of the label (its width is estimated, as sans-serif text at that size).
// Returns { size, icons: [{ cx, cy }], textX (the label's center), available, textWidth, fits }.
export const VOLUME_ICON_LAYOUT = {
  padV: 3,          // above and below the icons
  padLeft: 4,       // the least between the box's left edge and the group
  padRight: 4,      // the least between the group and the box's right edge
  gap: 3,           // between icons, and between the last icon and the label
  charWidth: 0.54,  // an average character of the label is this many font sizes wide (0.53 to 0.55 measured on the example labels)
  fontSize: 8.5,    // the label's size in the stylesheet, when the real one isn't known
};
export const volumeIconSize = (box) => box.height - 2 * VOLUME_ICON_LAYOUT.padV;
export function planVolumeIcons(box, widths, text) {
  const V = VOLUME_ICON_LAYOUT, size = volumeIconSize(box);
  const iconsWidth = widths.reduce((a, b) => a + b, 0) + V.gap * Math.max(0, widths.length - 1);
  const textWidth = text.chars * text.fontSize * V.charWidth;
  let x = box.x + Math.max(V.padLeft, (box.width - (iconsWidth + V.gap + textWidth)) / 2);
  const cy = box.y + box.height / 2;
  const icons = widths.map((w) => { const c = { cx: x + w / 2, cy }; x += w + V.gap; return c; });
  const available = box.width - V.padLeft - V.padRight - iconsWidth - V.gap; // x is now where the label starts
  return { size, icons, textX: x + textWidth / 2, available, textWidth, fits: textWidth <= available };
}

// Draws `types` as static icons inside a volume's <g>, one group with its label, centered in the box. The
// interpreter calls this for a descriptor volume's `icons`; a hand-written diagram script (one that does not use
// the interpreter) can call it directly. Returns the plan, or null if the <g> has no <rect> and <text>.
export function placeIconsOnVolume(g, types, createIconElement, name = 'volume') {
  const rect = g?.querySelector('rect'), label = g?.querySelector('text');
  if (!rect || !label) { console.warn(`${name} has icons but its <g> has no <rect> and <text>: none drawn`); return null; }
  const num = (e, a) => parseFloat(e.getAttribute(a));
  const box = { x: num(rect, 'x'), y: num(rect, 'y'), width: num(rect, 'width'), height: num(rect, 'height') };
  const icons = types.map((type) => createIconElement(type, { size: volumeIconSize(box) }));
  const plan = planVolumeIcons(box, icons.map((i) => i.iconWidth ?? volumeIconSize(box)), { chars: (label.textContent || '').length, fontSize: VOLUME_ICON_LAYOUT.fontSize });
  if (!plan.fits) console.warn(`${name}: its box is too narrow for its icons and label (needs about ${Math.round(plan.textWidth)}, has ${Math.round(plan.available)})`);
  label.setAttribute('x', String(plan.textX));
  icons.forEach((icon, i) => {
    icon.place(plan.icons[i].cx, plan.icons[i].cy);
    icon.setAttribute('pointer-events', 'none');
    g.appendChild(icon);
  });
  return plan;
}

export function createInterpreter(d, env) {
  const { anime, createCrawlerElement, createIconElement, logDiagramTransition, playVolumeDocking, onEvent = () => {} } = env;
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
  // What a move, divergence or arrival condition carries: `assets` (a composite, in order) or one `asset`.
  const assetsOf = (x) => x.assets ?? [x.asset];
  const assetKey = (x) => assetsOf(x).join('+');
  // Pace: one factor on every time in the run (2 is twice as slow, 0.5 twice as fast). It multiplies every
  // duration and delay by the same amount, so relationships between them (two legs of equal length that
  // finish together) are unchanged. `env.pace` overrides the descriptor's `settings.paceMultiplier`.
  const S = d.settings ?? {}; // the four run-time switches (core/descriptor.md section 2.1)
  let PACE = 1;
  for (const v of [S.paceMultiplier, env.pace]) {
    if (v === undefined) continue;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) PACE = v; else console.warn(`the pace multiplier must be a positive number, got ${JSON.stringify(v)}: ignored`);
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
  const M = S.interactionModes ?? { default: 'user-driven', toggle: false };
  let mode = env.mode ?? M.default ?? 'user-driven';
  if (mode === 'automated' && !M.simulated) { console.warn('automated mode needs settings.interactionModes.simulated: staying user-driven'); mode = 'user-driven'; }
  let simPending = new Map(), simDone = new Set(), pressAnims = new Set(); // simulated gestures: scheduled, already performed, and in progress
  const emit = (type, data) => onEvent({ t: Math.round(performance.now() - t0), type, ...data });
  // every deferred behavior carries the generation it started in and stops if Reset has happened
  const later = (ms, fn) => { const g = gen; const h = setTimeout(() => { timers.delete(h); if (g === gen) fn(); }, ms); timers.add(h); };
  const guard = (fn) => { const g = gen; return (...a) => { if (g === gen) return fn(...a); }; };

  // ---- conditions ----------------------------------------------------------
  const leafKey = (c, datum) =>
    c.arrival ? `arrival:${c.arrival.channel}/${c.arrival.direction}/${assetKey(c.arrival)}`
      : c.gesture !== undefined ? `gesture:${c.gesture}`
        : c.channel !== undefined ? `authenticated:${c.channel}`
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
        const h = setTimeout(() => { simPending.delete(key); if (g === gen) press(n, l, p, key); }, scaled(M.simulated.delayMs));
        simPending.set(key, h);
      }
    }
  }
  // The press: a short glow on the node, then the gesture, unless it stopped being armed meanwhile
  // (the viewer clicked first, the mode changed, or Reset).
  function press(n, l, p, key) {
    const stillArmed = () => mode === 'automated' && armedNow(n.name).some((x) => x.l === l && x.p === p);
    if (!stillArmed()) return;
    const g = gen, el = doc.querySelector(id(n.element)), { color } = M.simulated.acknowledge, duration = scaled(M.simulated.acknowledge.durationMs);
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
    else if (a.move) { sendBead(a.move.channel, a.move.direction, assetsOf(a.move), lane, a.move.duration, a.move.box, a.move.spacing); next(); }
    else if (a.dock) dock(a, next);
    else if (a.divergence) { for (const b of a.divergence.branches) sendBead(b.channel, b.direction, assetsOf(a.divergence), lane, b.duration, a.divergence.box, a.divergence.spacing); next(); }
    // Local storage (core/descriptor.md section 3.2): an instant fact, not an animation.
    else if (a.store) { storeAt(a.store.at, assetsOf(a.store)); next(); }
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
      complete: guard(() => {
        for (const s of targets) doc.querySelector(s).classList.remove('diagram-glow');
        // A channel's authenticated state (core/ontology.md, Channel): this glow completing sets it true, for
        // any target that's a channel declaring `authenticated`. Nothing reacts to it unless a datum's `when`
        // names it (core/descriptor.md section 2) — declaring it doesn't gate anything by itself.
        let authChanged = false;
        for (const n of names) { const c = chans.get(n); if (c?.authenticated !== undefined && !leaves.has(`authenticated:${n}`)) { leaves.add(`authenticated:${n}`); authChanged = true; } }
        if (authChanged) checkDatums();
        done();
      }),
    });
  }
  function dock(a, done) {
    const names = a.dock, deltas = names.map((n) => vols.get(n).offset);
    playVolumeDocking(names.map((n) => id(vols.get(n).element)), deltas, guard(() => {
      if (a.name) { leaves.add(`completed:${a.name}`); emit('completed', { name: a.name }); }
      checkDatums(); done();
    }), dur(a.duration, 900)); // the descriptor's duration; a helper that ignores a fourth argument keeps its own
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  // One icon per asset, `spacing` diagram units apart, centred on (0, 0). Shared by a moving composite
  // crawler and the stationary local-storage display: both are just "a cluster of icons".
  function layoutIcons(assetList, spacing) {
    const start = -((assetList.length - 1) * spacing) / 2;
    return assetList.map((type, i) => {
      const el = createCrawlerElement(type);
      el.classList.remove('diagram-crawler'); // the group is the crawler (or the display); sub-icons are its parts
      el.setAttribute('transform', `translate(${start + i * spacing}, 0)`);
      return el;
    });
  }
  // A light rect sized to enclose `count` icons `spacing` apart, centred on (0, 0).
  function clusterBox(count, spacing, pad = 6) {
    const start = -((count - 1) * spacing) / 2, w = (count - 1) * spacing + 2 * pad, h = 2 * pad + 8;
    const rect = doc.createElementNS(SVGNS, 'rect');
    rect.setAttribute('class', 'diagram-crawler-box');
    rect.setAttribute('x', String(start - pad)); rect.setAttribute('y', String(-h / 2));
    rect.setAttribute('width', String(w)); rect.setAttribute('height', String(h)); rect.setAttribute('rx', '3');
    return rect;
  }
  // A single asset is drawn exactly as before: createCrawlerElement's own element, unwrapped. A composite
  // (two or more) is a small <g> holding one icon per asset, that moves as one unit — the same way this
  // renderer already moves a compound icon (a lock-and-key drawn as one <g>). `box` adds the cluster box.
  function buildCrawler(assetList, box, spacing = 11) {
    if (assetList.length === 1) return createCrawlerElement(assetList[0]);
    const group = doc.createElementNS(SVGNS, 'g');
    group.setAttribute('class', 'diagram-crawler diagram-crawler-composite');
    group.style.opacity = 1;
    if (box) group.appendChild(clusterBox(assetList.length, spacing));
    layoutIcons(assetList, spacing).forEach((el) => group.appendChild(el));
    return group;
  }
  function sendBead(channel, direction, assetList, lane, duration, box, spacing) {
    const g = gen, c = chans.get(channel), path = id(c.element);
    const bead = buildCrawler(assetList, box, spacing);
    doc.querySelector(svgSel).appendChild(bead);
    const p = anime.path(path);
    emit('move', { channel, direction, assets: assetList, lane });
    anime({
      targets: bead, translateX: p('x'), translateY: p('y'), easing: 'linear', duration: dur(duration, c.duration),
      direction: direction === 'forward' ? 'normal' : 'reverse',
      complete: () => {
        if (g !== gen) { bead.remove(); return; }
        anime({ targets: bead, opacity: [1, 0], duration: scaled(350), easing: 'easeOutQuad', complete: () => bead.remove() });
        arrived(channel, direction, assetList, lane);
      },
    });
  }
  // An arrival fires the datums that wait for it (from any lane) and the rules that wait for it in the
  // lane that sent it: two lanes can send the same asset(s) on the same channel without colliding.
  function arrived(channel, direction, assetList, lane) {
    emit('arrival', { channel, direction, assets: assetList, lane });
    const key = assetList.join('+');
    leaves.add(`arrival:${channel}/${direction}/${key}`);
    const c = chans.get(channel);
    storeAt(direction === 'forward' ? c.b : c.a, assetList); // "received from another channel"
    for (const r of rules) {
      const t = r.on.arrival;
      if (t && r.lane === lane && t.channel === channel && t.direction === direction && assetKey(t) === key) runRule(r);
    }
    checkDatums();
  }

  // ---- local storage (core/descriptor.md section 3.2) ------------------------
  // `storage`: node name -> Set of assets it holds (tracked regardless of `strict`, and of display).
  // `storageGroups`: node name -> its display <g>, created and positioned once its node first gets something
  // worth showing, then just repopulated. Position is measured from the node's own box, which this renderer
  // never moves, so it's safe to cache.
  let storage = {}, storageGroups = {};
  function storeAt(nodeName, list) {
    if (!nodeName || !list?.length) return;
    const s = (storage[nodeName] ||= new Set());
    let changed = false;
    for (const a of list) if (!s.has(a)) { s.add(a); changed = true; }
    if (changed) refreshStorageDisplay(nodeName);
  }
  function refreshStorageDisplay(nodeName) {
    const n = nodes.get(nodeName), cfg = n?.showLocalStorage;
    if (!cfg) return; // tracked either way; only shown when the descriptor asks
    let group = storageGroups[nodeName];
    if (!group) {
      group = doc.createElementNS(SVGNS, 'g');
      group.setAttribute('class', `diagram-storage-display diagram-storage-${cfg.position}`);
      doc.querySelector(svgSel).appendChild(group);
      const box = doc.querySelector(id(n.element)).getBBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const x = cfg.position === 'adjacent' ? cx + cfg.offset.x : cx;
      const y = cfg.position === 'adjacent' ? cy + cfg.offset.y : cy;
      group.setAttribute('transform', `translate(${x}, ${y})`);
      storageGroups[nodeName] = group;
    }
    while (group.firstChild) group.removeChild(group.firstChild);
    const list = [...(storage[nodeName] ?? [])];
    if (!list.length) return; // nothing to show (yet)
    if (cfg.position === 'adjacent') group.appendChild(clusterBox(list.length, 11));
    layoutIcons(list, 11).forEach((el) => group.appendChild(el));
  }

  // ---- attribution metadata (core/descriptor.md section 3.3) -----------------------------
  // Attribution to the skill and, optionally, the developer. Its box is a zone (no members) named by
  // `settings.attributionMetadata.zone`; the credit lines are injected here. The author name is only ever `settings.attributionMetadata.author` —
  // the agent authoring the descriptor states it explicitly (core/ontology.md section E, explicit intent);
  // the interpreter does no host-environment interpolation to fill it in.
  let attributionGroup = null;
  function startAttribution() {
    const w = S.attributionMetadata;
    if (!w) return;
    const zone = d.zones.find((z) => z.name === w.zone);
    const rect = doc.querySelector(id(zone.element));
    const x = parseFloat(rect.getAttribute('x')), y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width')), height = parseFloat(rect.getAttribute('height'));
    const author = w.author;
    const lines = [];
    // "Coordinated by Claude": Claude authors within a fixed, developer-defined format and rule set
    // (the ontology, the validator, this interpreter's own contract) — not a free-form "AI-generated"
    // claim, since the process and its constraints are the skill's, not the model's own invention.
    if (w.repo !== false) lines.push({ text: 'Coordinated by Claude, built with diagram-animation skill', href: 'https://github.com/geekdotdev/animation-building-skill' });
    if (author) lines.push({ text: `Authored By: ${author}`, href: w.website });
    attributionGroup = doc.createElementNS(SVGNS, 'g');
    attributionGroup.setAttribute('class', 'diagram-watermark');
    const lineHeight = 12, top = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, i) => {
      const text = doc.createElementNS(SVGNS, 'text');
      text.setAttribute('class', 'diagram-watermark-text');
      text.setAttribute('x', String(x + width / 2));
      text.setAttribute('y', String(top + i * lineHeight));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = ln.text;
      if (ln.href) {
        const a = doc.createElementNS(SVGNS, 'a');
        a.setAttributeNS('http://www.w3.org/1999/xlink', 'href', ln.href);
        a.setAttribute('href', ln.href);
        a.appendChild(text);
        attributionGroup.appendChild(a);
      } else attributionGroup.appendChild(text);
    });
    rect.parentNode.insertBefore(attributionGroup, rect.nextSibling); // paint order: right after its own box
    // Permanently static (ontology rule 25): position never changes; only opacity ever animates, once.
    if (typeof w.fadeAfterSeconds === 'number') {
      const g = gen;
      later(scaled(w.fadeAfterSeconds * 1000), () => {
        anime.remove([rect, attributionGroup]);
        anime({ targets: [rect, attributionGroup], opacity: [1, 0], duration: scaled(600), easing: 'easeOutQuad' });
      });
    }
  }

  // ---- icons on a box (core/descriptor.md section 3.5) ---------------------------------------------------------
  // Drawn once, here, because they are static: no crawler class, so Reset leaves them. The geometry comes from the
  // SVG (the box's rect, the label's position) and the rules from planBoxIcons above.
  function placeNodeIcons() {
    for (const n of d.nodes) {
      if (!n.icons?.length) continue;
      if (typeof createIconElement !== 'function') { console.warn(`node ${n.name} has icons but the helpers have no createIconElement: no icons drawn`); return; }
      const el = doc.querySelector(id(n.element));
      const rect = el?.tagName === 'rect' ? el : el?.querySelector('rect');
      if (!rect) { console.warn(`node ${n.name} has icons but no box <rect> was found: none drawn`); continue; }
      const num = (e, a) => parseFloat(e.getAttribute(a));
      const box = { x: num(rect, 'x'), y: num(rect, 'y'), width: num(rect, 'width'), height: num(rect, 'height') };
      const lines = [...doc.querySelectorAll(`${svgSel} text.diagram-label, ${svgSel} text.diagram-hint`)]
        .filter((t) => { const tx = num(t, 'x'), ty = num(t, 'y'); return tx >= box.x && tx <= box.x + box.width && ty >= box.y && ty <= box.y + box.height; });
      const icons = n.icons.map((type) => createIconElement(type, { size: ICON_LAYOUT.size }));
      const plan = planBoxIcons(box, icons.map((i) => i.iconWidth ?? ICON_LAYOUT.size),
        lines.map((t) => ({ y: num(t, 'y'), fontSize: t.classList.contains('diagram-hint') ? ICON_LAYOUT.hintFontSize : ICON_LAYOUT.labelFontSize })));
      if (!plan.fits) console.warn(`node ${n.name}: its box is too small for its icons and label (${Math.round(plan.bottomPadding)} units left under the text, ${Math.round(plan.rowWidth)} wide row in ${box.width})`);
      for (const t of lines) t.setAttribute('y', String(num(t, 'y') + plan.shift));
      // paint order: just above the box, below its text and everything drawn after it
      let anchor = rect;
      icons.forEach((icon, i) => {
        icon.place(plan.icons[i].cx, plan.icons[i].cy);
        icon.setAttribute('pointer-events', 'none');
        icon.setAttribute('data-icon-of', n.name);
        anchor.parentNode.insertBefore(icon, anchor.nextSibling);
        anchor = icon;
      });
    }
  }

  // Icons on a volume (core/descriptor.md section 3.5): the icons and the label form one group, centered in the box.
  // They are children of the volume's <g>, so docking carries them along.
  function placeVolumeIcons() {
    for (const v of d.volumes) {
      if (!v.icons?.length) continue;
      if (typeof createIconElement !== 'function') { console.warn(`volume ${v.name} has icons but the helpers have no createIconElement: no icons drawn`); return; }
      placeIconsOnVolume(doc.querySelector(id(v.element)), v.icons, createIconElement, `volume ${v.name}`);
    }
  }

  // ---- grid layer (core/descriptor.md section 3.4) ------------------------------------
  // An authoring aid, not part of the diagram: `settings.gridLayer: { enabled: true, stepUserUnits: 50 }` draws a line every `stepUserUnits`
  // user units across the whole canvas, numbered with the user-space coordinate (so a number read off the
  // drawing is the number to write in the SVG). The origin is the canvas's native one: the numbers are the
  // viewBox's own coordinates, so a viewBox that starts at 0,0 has its 0 at the top-left corner, and one
  // with a negative min-x or min-y shows negative numbers. Column numbers sit just inside the top edge, row
  // numbers just inside the left edge. Drawn once, ignored by the pointer, and above the diagram's boxes but
  // below every crawler (crawlers are appended later). Turn it off (`enabled: false`, or delete `gridLayer`)
  // before exporting; the exporter warns if it is still on.
  function drawGrid() {
    const g = S.gridLayer;
    if (!g || g.enabled !== true) return;
    const svg = doc.querySelector(svgSel);
    if (!svg) return;
    const vb = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    const [minX, minY, w, h] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, parseFloat(svg.getAttribute('width')) || 0, parseFloat(svg.getAttribute('height')) || 0];
    if (!(w > 0 && h > 0)) { console.warn('gridLayer is enabled but the svg has no viewBox or width/height: no grid drawn'); return; }
    const step = g.stepUserUnits ?? 50;
    const group = doc.createElementNS(SVGNS, 'g');
    group.setAttribute('class', 'diagram-grid');
    group.setAttribute('pointer-events', 'none');
    const line = (x1, y1, x2, y2, major) => {
      const l = doc.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', '#d33'); l.setAttribute('stroke-width', major ? '0.6' : '0.4'); l.setAttribute('stroke-opacity', major ? '0.5' : '0.3');
      group.appendChild(l);
    };
    const label = (x, y, text) => {
      const t = doc.createElementNS(SVGNS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('font-size', '8'); t.setAttribute('font-family', 'sans-serif'); t.setAttribute('fill', '#c00');
      t.textContent = String(text);
      group.appendChild(t);
    };
    const first = (min) => Math.ceil(min / step) * step;
    for (let x = first(minX); x <= minX + w; x += step) {
      line(x, minY, x, minY + h, x % (step * 2) === 0);
      label(x + 2, minY + 8, x);
    }
    for (let y = first(minY); y <= minY + h; y += step) {
      line(minX, y, minX + w, y, y % (step * 2) === 0);
      if (y !== minY) label(minX + 2, y - 2, y);
    }
    svg.appendChild(group);
  }

  // ---- start and reset -------------------------------------------------------
  function initial() {
    gen++; // invalidate everything pending BEFORE touching state (core/descriptor.md 9.7)
    t0 = performance.now();
    cancelSimulated(); simDone = new Set();
    satisfied = new Set(); pending = new Set(); leaves = new Set();
    lanes = Object.fromEntries(d.lanes.map((l) => [l.name, { entered: false, phase: 0, consumed: new Set() }]));
    for (const g of Object.values(storageGroups)) g.remove();
    storage = {}; storageGroups = {};
    if (attributionGroup) { attributionGroup.remove(); attributionGroup = null; }
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
    startAttribution();
  }
  function reset() {
    gen++;
    for (const h of timers) { clearTimeout(h); clearInterval(h); }
    timers = new Set();
    doc.querySelectorAll(`${svgSel} .diagram-crawler`).forEach((b) => { anime.remove(b); b.remove(); });
    // everything the run can have changed: lines, labels, boxes, volumes, groups, glows, hints, the log
    const all = [...d.nodes.map((n) => id(n.element)), ...d.channels.flatMap((c) => selWithLabel(c.name)), ...d.volumes.map((v) => id(v.element)), ...d.zones.map((z) => id(z.element))];
    for (const s of all) anime.remove(s);
    // permanently static, but a fade can still leave it at opacity 0: Reset returns it to visible
    if (S.attributionMetadata) { const w = d.zones.find((z) => z.name === S.attributionMetadata.zone); if (w) doc.querySelector(id(w.element)).style.opacity = ''; }
    for (const c of d.channels) for (const s of selWithLabel(c.name)) { const el = doc.querySelector(s); if (c.visibility === 'hidden') el.style.opacity = ''; el.classList.remove('diagram-glow'); el.style.stroke = ''; el.style.strokeWidth = ''; }
    for (const n of d.nodes) { const el = doc.querySelector(id(n.element)); el.classList.remove('diagram-glow', 'diagram-clickable'); el.style.stroke = ''; el.style.strokeWidth = ''; if (n.group) anime.set(id(n.element), { opacity: 1 }); }
    doc.querySelector(logSel).innerHTML = '';
    start();
  }

  // ---- wiring (once) ---------------------------------------------------------
  for (const n of d.nodes) if (n.gesture) doc.querySelector(id(n.element)).addEventListener('click', () => onClick(n.name));
  doc.getElementById(`diagram-${LABEL}-replay`)?.addEventListener('click', reset);
  placeNodeIcons();
  placeVolumeIcons();
  drawGrid();
  // the mode toggle, beside Replay, only when the descriptor allows the viewer to switch
  let toggleBox = null;
  if (M.toggle) {
    const footer = doc.querySelector(`#diagram-${LABEL} .diagram-footer`);
    if (!footer) console.warn('settings.interactionModes.toggle is set but the diagram has no .diagram-footer: no toggle shown');
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
