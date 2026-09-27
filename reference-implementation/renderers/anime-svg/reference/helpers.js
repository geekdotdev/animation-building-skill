// Reference helpers for the anime.js interpreter: the three functions the interpreter is given, plus a small
// generic iconography. This file meets renderers/anime-svg/markup-contract.md section 4, and any application can
// use it as it is or copy it. Its `import` is the convention the test-page builder and the exporter both
// understand: a single line importing anime.js from `/vendor/animejs/anime.es.js`.
import anime from '/vendor/animejs/anime.es.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const DIAGRAM_LOG_MAX_LINES = 40;

// Assets: what a descriptor's `asset` names, and how its crawler is drawn. Add an entry to add an asset. Keep one
// entry per line in this exact layout: the descriptor validator reads the names from it (`--assets`).
// Shapes: circle, square, triangle, x, text. A `fill` draws it solid, and a `stroke` alone draws it hollow.
export const ICONOGRAPHY = {
  request: { shape: 'circle', fill: '#999' }, // gray: a request
  response: { shape: 'square', stroke: '#888', strokeWidth: '1.5' }, // hollow square: a response
  message: { shape: 'circle', fill: '#ff9f1c' }, // orange: a message or payload
  credential: { shape: 'circle', stroke: '#8e44ad', strokeWidth: '2' }, // hollow purple circle: a credential or token
  redirect: { shape: 'triangle', fill: '#e91e63' }, // pink triangle: a redirect
  exchange: { shape: 'text', text: '⇄', fill: '#8e44ad' }, // purple arrows: a request and reply in one
  ok: { shape: 'text', text: 'OK', fill: '#27ae60' }, // green OK: an acceptance
  error: { shape: 'x', stroke: '#c0392b', strokeWidth: '2' }, // red X: a refusal or failure
};

// The crawler for an asset: an SVG element centred on the origin, which the interpreter moves along a channel
// with a transform. It has class `diagram-crawler` (the stylesheet hides that class until it is drawn) and is
// made visible here.
export function createCrawlerElement(type) {
  const def = ICONOGRAPHY[type];
  if (!def) throw new Error(`unknown asset "${type}" (known: ${Object.keys(ICONOGRAPHY).join(', ')})`);
  let el;
  if (def.shape === 'circle') {
    el = document.createElementNS(SVG_NS, 'circle');
    el.setAttribute('r', '6');
    el.setAttribute('cx', '0');
    el.setAttribute('cy', '0');
  } else if (def.shape === 'triangle') {
    el = document.createElementNS(SVG_NS, 'polygon');
    el.setAttribute('points', '-6,-6 -6,6 7,0');
  } else if (def.shape === 'square') {
    el = document.createElementNS(SVG_NS, 'rect');
    el.setAttribute('x', '-6');
    el.setAttribute('y', '-6');
    el.setAttribute('width', '12');
    el.setAttribute('height', '12');
    el.setAttribute('rx', '1');
  } else if (def.shape === 'x') {
    el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', 'M-6,-6 L6,6 M-6,6 L6,-6');
    el.style.strokeLinecap = 'round';
  } else if (def.shape === 'text') {
    el = document.createElementNS(SVG_NS, 'text');
    el.textContent = def.text;
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'central');
    el.setAttribute('font-size', '11');
    el.setAttribute('font-weight', 'bold');
    el.setAttribute('font-family', 'sans-serif');
  } else {
    throw new Error(`asset "${type}" has an unknown shape "${def.shape}"`);
  }
  el.setAttribute('class', 'diagram-crawler');
  el.style.fill = def.fill || 'none';
  if (def.stroke) {
    el.style.stroke = def.stroke;
    el.style.strokeWidth = def.strokeWidth || '1';
  }
  el.style.color = def.stroke || def.fill;
  el.style.opacity = 1;
  return el;
}

// Appends a line to the diagram's event log and scrolls it into view. The text is set as text, not markup, so a
// narration line can't inject HTML. The log keeps its last DIAGRAM_LOG_MAX_LINES lines.
export function logDiagramTransition(logSelector, message) {
  const log = document.querySelector(logSelector);
  if (!log) return;
  const p = document.createElement('p');
  p.textContent = message;
  log.appendChild(p);
  while (log.children.length > DIAGRAM_LOG_MAX_LINES) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

// Slides each volume from where it sits (docked with its source) by its `{ x, y }` delta, together, and calls
// onComplete when they have all arrived. `duration` (ms) is the descriptor's dock duration.
export function playVolumeDocking(volumeSelectors, deltas, onComplete, duration = 900) {
  return anime({
    targets: volumeSelectors,
    translateX: (el, i) => deltas[i].x,
    translateY: (el, i) => deltas[i].y,
    duration,
    easing: 'easeOutQuad',
    complete: onComplete,
  });
}
