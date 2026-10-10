#!/usr/bin/env bash
# Copyright (c) 2026 Charlie Federspiel
# SPDX-License-Identifier: MIT
#
# Checks one diagram with the diagram-animation skill's tools, then brings the application's copies into step
# with this project. init-project.sh copies this file into a new project (as sync-to-app.sh) and sets the
# settings below; edit them by hand if things move. The animation project is the source: the application holds
# copies, and nothing is ever edited in them, with ONE exception that DIAGRAM_SOURCE controls.
#
#   DIAGRAM_SOURCE=local   The drawing's source is this project's <diagram>/diagram.html. The application's gateway
#                          page holds a COPY of it (its diagram block, with prose and a Continue button around it).
#   DIAGRAM_SOURCE=app     The drawing's source is the application's gateway page. This project holds no copy; the
#                          page is only checked, and the descriptor's `markup` should point at it.
#
#   1. The validator (the descriptor, its assets against the app's helpers, its elements against the drawing).
#   2. The markup check (the drawing, the app's stylesheet and helpers, against the markup contract).
#   3. Copies the descriptor to <app>/<APP_DESCRIPTOR> and the skill's interpreter.js to <app>/<APP_PUBLIC>/interpreter.js
#      (a vendored copy), and checks both byte for byte. Nothing is copied unless both checks pass.
#   4. local only: compares the diagram block in the app's gateway page with diagram.html's. A difference exits 3;
#      --update-block replaces the app's block with this project's. (With `app`, --update-block is refused: the
#      page is the source, so there is nothing to push.)
#
# Usage: ./sync-to-app.sh [--update-block]
# Exit: 0 in step, 1 a check found errors, 2 a file or a setting is missing, 3 the app's diagram block differs
# (local) or is missing, 64 usage. SKILL_REPO, APP_REPO and DIAGRAM_SOURCE can be set in the environment instead.
set -euo pipefail

# ---- settings (init-project.sh sets the first four; each of those can also be set in the environment) -----------------------
SKILL_REPO="${SKILL_REPO:-../animation-building-skill}"      # the diagram-animation skill (relative to this script, or absolute)
APP_REPO="${APP_REPO:-}"                                      # the application these copies are published to
DIAGRAM_SOURCE="${DIAGRAM_SOURCE:-local}"                     # local | app: where the drawing's source of truth is (see above)
DIAGRAM="${DIAGRAM:-skeleton}"                                # this diagram's folder in the project, and its id suffix
APP_PUBLIC="spa-server/public"                                # the app's served folder, relative to APP_REPO (holds shared.css, diagram-shared.js)
DESCRIPTOR="$DIAGRAM/diagram.animation.js"                    # relative to this script
DIAGRAM_HTML="$DIAGRAM/diagram.html"                          # relative to this script; the source when DIAGRAM_SOURCE=local
APP_PAGE="$APP_PUBLIC/gateways/$DIAGRAM-gateway.html"         # the app's gateway page, relative to APP_REPO
APP_DESCRIPTOR="$APP_PUBLIC/gateways/$DIAGRAM.descriptor.js"  # where the app keeps its copy of the descriptor, relative to APP_REPO
# ---------------------------------------------------------------------------------------------------------------------

UPDATE_BLOCK=0
case "${1:-}" in
  "") ;;
  --update-block) UPDATE_BLOCK=1 ;;
  -h|--help) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "usage: $0 [--update-block]" >&2; exit 64 ;;
esac
case "$DIAGRAM_SOURCE" in
  local|app) ;;
  *) echo "sync-to-app: DIAGRAM_SOURCE must be \"local\" or \"app\", not \"$DIAGRAM_SOURCE\"" >&2; exit 64 ;;
esac
if [ "$DIAGRAM_SOURCE" = app ] && [ "$UPDATE_BLOCK" = 1 ]; then
  echo "sync-to-app: --update-block does nothing with DIAGRAM_SOURCE=app: the app's page is the source of the drawing, so there is no local copy to push." >&2
  echo "             Edit the page in the app. To make this project the source instead, set DIAGRAM_SOURCE=local." >&2
  exit 64
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
case "$SKILL_REPO" in /*) ;; *) SKILL_REPO="$HERE/$SKILL_REPO" ;; esac
[ -n "$APP_REPO" ] || { echo "sync-to-app: no application to publish to: set APP_REPO (here or in the environment) to the application's folder" >&2; exit 2; }
case "$APP_REPO" in /*) ;; *) APP_REPO="$HERE/$APP_REPO" ;; esac
R="$SKILL_REPO/reference-implementation"
PUBLIC="$APP_REPO/$APP_PUBLIC"

for f in "$HERE/$DESCRIPTOR" "$R/core/validator/validate.mjs" "$PUBLIC/diagram-shared.js" "$PUBLIC/shared.css"; do
  [ -f "$f" ] || { echo "sync-to-app: missing $f (SKILL_REPO=$SKILL_REPO, APP_REPO=$APP_REPO)" >&2; exit 2; }
done
if [ "$DIAGRAM_SOURCE" = local ]; then
  MARKUP="$HERE/$DIAGRAM_HTML"
else
  MARKUP="$APP_REPO/$APP_PAGE"
fi
[ -f "$MARKUP" ] || { echo "sync-to-app: missing the drawing, $MARKUP (DIAGRAM_SOURCE=$DIAGRAM_SOURCE)" >&2; exit 2; }

echo "== validator =="
node "$R/core/validator/validate.mjs" "$HERE/$DESCRIPTOR" --assets "$PUBLIC/diagram-shared.js" --markup "$MARKUP"
echo
echo "== markup check =="
node "$R/renderers/anime-svg/markup/check.mjs" "$HERE/$DESCRIPTOR" --markup "$MARKUP" --app "$APP_REPO"

echo
echo "== copying into the app =="
mkdir -p "$(dirname "$APP_REPO/$APP_DESCRIPTOR")"
cp "$HERE/$DESCRIPTOR" "$APP_REPO/$APP_DESCRIPTOR"
cp "$R/renderers/anime-svg/interpreter.js" "$PUBLIC/interpreter.js"
cmp "$HERE/$DESCRIPTOR" "$APP_REPO/$APP_DESCRIPTOR"
cmp "$R/renderers/anime-svg/interpreter.js" "$PUBLIC/interpreter.js"
echo "descriptor and interpreter.js copied, byte for byte"

echo
if [ "$DIAGRAM_SOURCE" = app ]; then
  echo "== the diagram =="
  echo "DIAGRAM_SOURCE=app: the app's page ($APP_PAGE) is the source of the drawing; it was checked above, not copied"
  exit 0
fi
echo "== the diagram block in the app's gateway page =="
[ -f "$APP_REPO/$APP_PAGE" ] || { echo "no gateway page at $APP_REPO/$APP_PAGE: create it with the diagram block followed by a <button class=\"continue-btn\">" >&2; exit 3; }
UPDATE_BLOCK="$UPDATE_BLOCK" DIAGRAM_HTML="$HERE/$DIAGRAM_HTML" APP_PAGE="$APP_REPO/$APP_PAGE" node --input-type=module -e '
import fs from "node:fs";
const block = (text, end) => {
  const a = text.indexOf("<div class=\"diagram\"");
  if (a < 0) return null;
  const b = end ? text.indexOf(end, a) : text.length;
  return b < 0 ? null : { a, b, text: text.slice(a, b).trim() };
};
const mine = block(fs.readFileSync(process.env.DIAGRAM_HTML, "utf8"), null);
const page = fs.readFileSync(process.env.APP_PAGE, "utf8");
const theirs = block(page, "<button class=\"continue-btn\"");
if (!mine) { console.error("diagram.html has no diagram block"); process.exit(2); }
const button = page.indexOf("<button class=\"continue-btn\"");
if (!theirs && button < 0) { console.error("the gateway page has no diagram block and no <button class=\"continue-btn\"> to put one before: add the button, or the block, by hand"); process.exit(3); }
if (!theirs) {
  if (process.env.UPDATE_BLOCK === "1") { fs.writeFileSync(process.env.APP_PAGE, page.slice(0, button) + mine.text + "\n" + page.slice(button)); console.log("the page had no diagram block: inserted diagram.html\x27s before its Continue button"); process.exit(0); }
  console.error("the gateway page has no diagram block: run ./sync-to-app.sh --update-block to insert one before its Continue button"); process.exit(3);
}
if (mine.text === theirs.text) { console.log("current"); process.exit(0); }
if (process.env.UPDATE_BLOCK === "1") {
  fs.writeFileSync(process.env.APP_PAGE, page.slice(0, theirs.a) + mine.text + "\n" + page.slice(theirs.b));
  console.log("differed: replaced the app\x27s block with diagram.html\x27s");
  process.exit(0);
}
console.error("DIFFERS from diagram.html: run ./sync-to-app.sh --update-block, or replace it by hand");
process.exit(3);
'
