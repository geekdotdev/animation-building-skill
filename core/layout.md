# Layout and geometry rules

Rules for placing things on a diagram's canvas that hold for any application. Two strengths, marked on every rule:

- **Hard** rules: breaking one makes the animation wrong or broken.
- **Convention** rules: sensible defaults. They can change when the user wants something different.

Terms (node, zone, channel, line, path, asset) are defined in `core/ontology.md`. Rules that come from a particular renderer are in that renderer's layout file (`renderers/anime-svg/layout.md`). The numbers this project uses (sizes, offsets, padding) are in `examples/nats-nkey-demo/conventions.md`.

## 1. Canvas

- **Convention: coordinates are the diagram's own units,** independent of screen pixels, so the diagram scales as a whole. Anything drawn outside the canvas (a log, a control) is sized differently and doesn't scale with it. See section 7.
- **Convention: widen the canvas** when a diagram needs more room, rather than crowding it.

## 2. Identifiers

- **Hard: every id is unique across the whole page.** A page that hosts several diagrams puts their fragments in one document, so a duplicate id makes a selector pick the wrong element. Suffix every id with the diagram's name.
- **Convention: one naming scheme,** and follow it for every element. For the anime.js renderer, the ids and structure a diagram file must meet are its markup contract (`renderers/anime-svg/markup-contract.md`). An id that doesn't fit the scheme forces an explicit mapping in the descriptor (see `core/descriptor.md`).

## 3. Nodes

- **Convention: labels are centered** on their node, with a consistent vertical position. A two-line label suits a long name.
- **Convention: a gesture target has a hint,** and is keyboard-accessible and labelled for assistive technology.
- **Convention: size a container node to fit** what it holds (for example, the stacked volumes of an init-containers box).

## 4. Lines and paths

- **Hard: drawing order is direction.** A path's start is the channel's first endpoint (forward, `a` to `b`). Return runs it the other way. A channel's label is a separate element, not part of the path.
- **Convention: endpoints** start and end on a box's edge, within the edge's extent. They need not be at the center.
- **Convention: shape.** Prefer vertical or horizontal lines, or steep diagonals. Users have asked more than once for a diagonal to be less oblique or made exactly vertical. Use a curve only where a straight line would cross something.
- **Convention: don't cross what the line doesn't connect.** A line shouldn't pass through a box or another element's label. When the user says to keep a line vertical while moving a box, change the x of both ends.
- **Convention: start hidden.** Lines are drawn hidden and revealed by an effect. Keep a line visible from the start only for a permanent connection.

## 5. Zones

A zone is a static, dashed rectangle drawn **first** so it sits under everything else. Its rules are in `core/ontology.md` (members, padding, permitted and forbidden intersections). Placement conventions:

- **Members** are the nodes it encloses **and any asset docked at them, at its final position.** A docked asset's final rectangle is its start plus its docking offset.
- **Padding.** Leave room on every side, and extra above for the label.
- **Clearance from non-members.** Keep some space.
- **A channel between two non-members must not cross the zone.** Reroute it around.
- **A channel between a member and a non-member crosses the edge once.**

## 6. Docked assets (the shared-resource metaphor)

- **Hard: a docking move is defined by a start and a final position.** Recompute the offset whenever a node or its asset moves.
- **Convention: final position** on the consumer's edge, not its center.
- **Convention (learned the hard way): order matters.** Two docked assets must not start on top of each other, and their **paths must not cross en route**, or the animation is hard to read. Assign start positions in the order that avoids crossings, for example by where the targets are.
- **An asset that docks inside a zone belongs to it.** Size the zone accordingly.

## 7. Overlays outside the canvas

- **Convention: keep the region a floating log covers empty.** A log or control drawn in pixels over a diagram that scales covers a different fraction of the canvas at each width.
- **Convention: put controls outside the canvas** (a footer) so they take no canvas space.
- **Convention: hints are canvas text inside their node,** so they scale with it.

## 8. Editing an existing diagram

When something moves, update everything that hangs off it, in one pass:

1. its label(s) and hint;
2. every line that starts or ends on it (endpoints on the new edge);
3. the offset of any asset docking at it;
4. any zone that contains it or must now exclude it;
5. any ids or comments that state coordinates.

Then re-check section 9. Keep other lines vertical or horizontal if the user asked for that.

## 9. Geometry checks

Run these after any layout change, against the rendered diagram:

1. The canvas origin is where the renderer needs it (see the renderer's layout file).
2. All ids are unique.
3. Each zone contains all its members, docked assets included, with the padding you chose. Compare the members' rendered rectangles with the zone's.
4. Non-members clear the zone edge, and no channel between non-members intersects a zone.
5. Every line's endpoints lie on the edges of the boxes it connects.
6. No two docked assets start overlapping, and no docking path crosses another.
7. Nothing sits in a region an overlay covers.
8. Look at a screenshot at a legible size.
9. A line hidden until first use isn't visible in a static check. Force it visible to inspect its geometry, then don't leave it that way.

How to run these in one environment is in `examples/nats-nkey-demo/environment.md`.

---

*Licensed under MIT. © 2026 Charlie Federspiel.*
