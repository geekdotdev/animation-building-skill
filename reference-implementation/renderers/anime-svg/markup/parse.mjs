// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// A small parser for the HTML and SVG of a diagram file. No dependencies, and no DOM: it builds a tree of
// { tag, attrs, children, parent } from start and end tags, which is all the markup checks need. Text is
// ignored. It is not a general HTML parser: it doesn't handle unquoted `>` in attributes, `<script>` bodies
// containing tags, or optional end tags. A diagram file is written by hand as well-formed markup, and a
// problem it can't parse is reported, not guessed at.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

// tag name, then attributes (quoted values may contain `>`), then an optional `/`
const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

export function parseAttrs(text) {
  const attrs = {};
  for (const m of text.matchAll(ATTR)) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

// Returns { roots, all, byId, duplicates, errors }.
//   all         every element in document order
//   byId        Map id -> the first element with it
//   duplicates  ids used more than once
//   errors      unmatched or unclosed tags
export function parseMarkup(html) {
  const src = html.replace(/<!--[\s\S]*?-->/g, (c) => " ".repeat(c.length)).replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (c) => " ".repeat(c.length));
  const roots = [], all = [], errors = [], stack = [];
  const byId = new Map(), seen = new Map();
  TAG.lastIndex = 0;
  for (let m; (m = TAG.exec(src)); ) {
    const [, closing, name, attrText, selfClose] = m;
    const tag = name; // SVG tag names are case-sensitive (`linearGradient`), so they are kept as written
    if (closing) {
      const i = stack.findLastIndex((e) => e.tag === tag);
      if (i < 0) { errors.push(`unmatched </${tag}> at offset ${m.index}`); continue; }
      for (let j = stack.length - 1; j > i; j--) errors.push(`<${stack[j].tag}> at offset ${stack[j].start} is never closed`);
      stack.length = i;
      continue;
    }
    const el = { tag, attrs: parseAttrs(attrText), children: [], parent: stack.at(-1) ?? null, start: m.index };
    (el.parent ? el.parent.children : roots).push(el);
    all.push(el);
    if (el.attrs.id !== undefined) { seen.set(el.attrs.id, (seen.get(el.attrs.id) ?? 0) + 1); if (!byId.has(el.attrs.id)) byId.set(el.attrs.id, el); }
    if (!selfClose && !VOID.has(tag)) stack.push(el);
  }
  for (const e of stack) errors.push(`<${e.tag}> at offset ${e.start} is never closed`);
  return { roots, all, byId, duplicates: [...seen].filter(([, n]) => n > 1).map(([id]) => id), errors };
}

export const classes = (el) => (el.attrs.class ?? "").split(/\s+/).filter(Boolean);
export const hasClass = (el, c) => classes(el).includes(c);
export function* descendants(el) { for (const c of el.children) { yield c; yield* descendants(c); } }
export const isInside = (el, ancestor) => { for (let p = el.parent; p; p = p.parent) if (p === ancestor) return true; return false; };
