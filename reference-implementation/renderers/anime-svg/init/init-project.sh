#!/usr/bin/env bash
# Copyright (c) 2026 Charlie Federspiel
# SPDX-License-Identifier: MIT
#
# Starts a project for animated diagrams: a new git repo holding a first diagram (copied from the skeleton
# and renamed), anime.js, and an export.sh that runs the exporter with this project's paths. See
# AUTHORING-WORKFLOW.md, "Set up per project".
#
# Usage: init-project.sh <project-dir> [options]
#   <project-dir>       a new folder, an empty one, or one holding only a .git folder (a fresh clone of an empty
#                       remote: its remote and settings are kept). Anything else in it is refused.
#   --diagram <label>   the first diagram's folder and id suffix: lowercase letters, digits, hyphens.
#                       Default: taken from the project folder's name.
#   --css <file>        your application's stylesheet, instead of the reference one
#   --helpers <file>    your application's helpers file (diagram-shared.js), instead of the reference one.
#                       Give it with --css: it holds the iconography the descriptor's assets are checked against.
#   --anime <file>      a copy of anime.es.js to use, instead of installing one into the project
#   --app <repo>        an application laid out like the example project (spa-server/public/shared.css and
#                       diagram-shared.js, anime.js under spa-server/node_modules): supplies all three
#   --no-install        don't run npm (anime.js then comes from --anime or --app, or you install it yourself)
#   -h, --help          this text
set -euo pipefail

die() { echo "init-project: $*" >&2; exit 1; }
warn() { echo "init-project: warning: $*" >&2; }

usage() { sed -n '/^# Usage: init-project/,/^#   -h, --help/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

abspath_file() { [ -f "$1" ] || die "no such file: $1"; (cd "$(dirname "$1")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")"); }
abspath_dir() { [ -d "$1" ] || die "no such folder: $1"; (cd "$1" && pwd -P); }
# Escapes a value for use inside double quotes in the generated script.
dq() { printf '%s' "$1" | sed -e 's/[\\"$`]/\\&/g'; }

PROJECT="" LABEL="" CSS="" HELPERS="" ANIME="" APP="" INSTALL=1
while [ $# -gt 0 ]; do
  case "$1" in
    --diagram) [ $# -ge 2 ] || die "--diagram needs a label"; LABEL="$2"; shift 2 ;;
    --css) [ $# -ge 2 ] || die "--css needs a file"; CSS="$(abspath_file "$2")"; shift 2 ;;
    --helpers) [ $# -ge 2 ] || die "--helpers needs a file"; HELPERS="$(abspath_file "$2")"; shift 2 ;;
    --anime) [ $# -ge 2 ] || die "--anime needs a file"; ANIME="$(abspath_file "$2")"; shift 2 ;;
    --app) [ $# -ge 2 ] || die "--app needs a folder"; APP="$(abspath_dir "$2")"; shift 2 ;;
    --no-install) INSTALL=0; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option $1 (see --help)" ;;
    *) [ -z "$PROJECT" ] || die "more than one project folder given"; PROJECT="$1"; shift ;;
  esac
done
[ -n "$PROJECT" ] || { usage >&2; exit 64; }

command -v git >/dev/null || die "git is required"
command -v node >/dev/null || die "node is required (Node 18 or later)"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ] || die "Node 18 or later is required"

if [ -z "$LABEL" ]; then
  LABEL="$(basename "$PROJECT" | tr 'A-Z' 'a-z' | sed -e 's/[^a-z0-9]\{1,\}/-/g' -e 's/^-//' -e 's/-$//')"
  [ -n "$LABEL" ] || LABEL="diagram"
fi
case "$LABEL" in
  *[!a-z0-9-]*|-*|*-|"") die "the diagram label \"$LABEL\" must be lowercase letters, digits and hyphens, not starting or ending with one" ;;
esac

[ -z "$CSS" ] || [ -n "$HELPERS" ] || warn "--css without --helpers: the reference helpers will check your descriptor's assets, so assets that only your application defines will fail the checks. Give both."
[ -z "$HELPERS" ] || [ -n "$CSS" ] || warn "--helpers without --css: the reference stylesheet will be used."

# Where the skill lives: this script is in <skill>/reference-implementation/renderers/anime-svg/init/. pwd -P resolves
# a symlinked install, so what gets recorded is the real folder (SKILL_REPO overrides it in the generated script).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ANIME_SVG="$(cd "$SCRIPT_DIR/.." && pwd -P)"
REF_IMPL="$(cd "$ANIME_SVG/../.." && pwd -P)"
SKILL_REPO="$(cd "$REF_IMPL/.." && pwd -P)"
[ -f "$ANIME_SVG/skeleton/diagram.html" ] || die "can't find the skeleton under $ANIME_SVG"

# The folder may be new, empty, or hold only a .git folder (a fresh clone of an empty remote): that repo, its remote
# and its settings are kept. Anything else in it is refused.
HAD_GIT=0
if [ -e "$PROJECT" ]; then
  [ -d "$PROJECT" ] || die "$PROJECT already exists and isn't a folder"
  [ -d "$PROJECT/.git" ] && HAD_GIT=1
  [ -z "$(ls -A "$PROJECT" | grep -v '^\.git$' || true)" ] || die "$PROJECT already exists and isn't an empty folder (a folder holding only a .git folder is fine)"
fi
mkdir -p "$PROJECT"
PROJECT="$(cd "$PROJECT" && pwd -P)"
cd "$PROJECT"

# git init is safe on an existing repo: it changes neither the remote nor the config.
git init -q
if [ "$HAD_GIT" = 1 ]; then echo "using the existing git repo in $PROJECT"; else echo "created a git repo in $PROJECT"; fi

# ---- package.json, .gitignore --------------------------------------------------------------------------------
PKG_NAME="$(basename "$PROJECT" | tr 'A-Z' 'a-z' | sed -e 's/[^a-z0-9._-]\{1,\}/-/g' -e 's/^[-._]*//')"
[ -n "$PKG_NAME" ] || PKG_NAME="animations"
# "type": "module" because the descriptors are ES modules; without it Node warns each time it loads one.
printf '{\n  "name": "%s",\n  "private": true,\n  "type": "module"\n}\n' "$PKG_NAME" > package.json

cat > .gitignore <<'EOF'
node_modules
# export/ and export.sh are deliberately NOT ignored: exports are derived from the diagrams, but they are what
# gets published, and their history shows what changed.
EOF

if [ -z "$ANIME" ] && [ -z "$APP" ] && [ "$INSTALL" = 1 ]; then
  if command -v npm >/dev/null; then
    # Pinned: the exporter's CDN import is built from the installed version.
    npm install animejs@3.2.2 --save-exact --silent >/dev/null 2>&1 \
      && echo "installed anime.js 3.2.2 (node_modules/animejs/lib/anime.es.js)" \
      || warn "npm install failed: install anime.js yourself, or pass --anime <anime.es.js>"
  else
    warn "npm not found: install anime.js yourself, or pass --anime <anime.es.js>"
  fi
fi

# ---- the first diagram -----------------------------------------------------------------------------------------
mkdir "$LABEL"
# Every element id ends in the label: replace the one "skeleton" in each id attribute, and the descriptor's diagramLabel.
sed -E "s/(id=\"[^\"]*)skeleton/\1${LABEL}/g" "$ANIME_SVG/skeleton/diagram.html" > "$LABEL/diagram.html"
sed "s/diagramLabel: 'skeleton'/diagramLabel: '${LABEL}'/" "$ANIME_SVG/skeleton/diagram.animation.js" > "$LABEL/diagram.animation.js"
! grep -q 'id="[^"]*skeleton' "$LABEL/diagram.html" || die "could not rename the skeleton's ids"
grep -q "diagramLabel: '${LABEL}'" "$LABEL/diagram.animation.js" || die "could not rename the skeleton's diagramLabel"
echo "created $LABEL/diagram.html and $LABEL/diagram.animation.js from the skeleton"

# ---- export.sh -----------------------------------------------------------------------------------------------------
{
  printf '#!/usr/bin/env bash\n'
  cat <<'EOF'
# Exports one of this project's diagrams to a delivery target, with the paths this project was set up with.
# Generated by diagram-animation's init-project.sh. Edit the values below if things move (each can also be set in
# the environment). Neither this script nor the export/ folder is git-ignored, on purpose: exports are derived from
# the diagrams, but they are what gets published, and their history shows what changed.
#
# Usage: ./export.sh [--diagram <folder>] [--profile <name or file>] [export.mjs options, e.g. --check, --allow-open]
#   --diagram  the diagram's folder (default below)
#   --profile  ghost-html-card (default), standalone-page, or the path to a profile file
# Writes export/<diagram>-<profile>.html, creating export/ if it isn't there.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
EOF
  printf 'SKILL_REPO="${SKILL_REPO:-%s}"\n' "$(dq "$SKILL_REPO")"
  printf 'APP_REPO="${APP_REPO:-%s}"\n' "$(dq "$APP")"
  printf 'CSS="${CSS:-%s}"\n' "$(dq "$CSS")"
  printf 'HELPERS="${HELPERS:-%s}"\n' "$(dq "$HELPERS")"
  printf 'ANIME="${ANIME:-%s}"\n' "$(dq "$ANIME")"
  printf 'DIAGRAM="%s"\n' "$LABEL"
  printf 'PROFILE="ghost-html-card"\n'
  cat <<'EOF'

R="$SKILL_REPO/reference-implementation"
EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --diagram) DIAGRAM="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

# The reference stylesheet and helpers unless this project uses an application's; anime.js from this project.
if [ -z "$APP_REPO" ]; then
  : "${CSS:=$R/renderers/anime-svg/reference/diagram.css}"
  : "${HELPERS:=$R/renderers/anime-svg/reference/helpers.js}"
  : "${ANIME:=$HERE/node_modules/animejs/lib/anime.es.js}"
fi
INPUTS=()
[ -z "$APP_REPO" ] || INPUTS+=(--app "$APP_REPO")
[ -z "$CSS" ] || INPUTS+=(--css "$CSS")
[ -z "$HELPERS" ] || INPUTS+=(--helpers "$HELPERS")
[ -z "$ANIME" ] || INPUTS+=(--anime "$ANIME")

case "$PROFILE" in
  */*|*.js) PROFILE_FILE="$PROFILE" ;;
  *) PROFILE_FILE="$R/renderers/anime-svg/export/profiles/$PROFILE.target.js" ;;
esac
PROFILE_NAME="$(basename "$PROFILE_FILE" .js)"
PROFILE_NAME="${PROFILE_NAME%.target}"

mkdir -p "$HERE/export"
exec node "$R/renderers/anime-svg/export/export.mjs" \
  --descriptor "$HERE/$DIAGRAM/diagram.animation.js" \
  --profile "$PROFILE_FILE" \
  --out "$HERE/export/$DIAGRAM-$PROFILE_NAME.html" \
  "${INPUTS[@]}" \
  ${EXTRA[@]+"${EXTRA[@]}"}
EOF
} > export.sh
chmod +x export.sh
echo "created export.sh"

# ---- a first check, so a wrong path shows up now ---------------------------------------------------------------------
EFF_CSS="$CSS" EFF_HELPERS="$HELPERS"
[ -n "$EFF_CSS" ] || { [ -n "$APP" ] && EFF_CSS="$APP/spa-server/public/shared.css" || EFF_CSS="$REF_IMPL/renderers/anime-svg/reference/diagram.css"; }
[ -n "$EFF_HELPERS" ] || { [ -n "$APP" ] && EFF_HELPERS="$APP/spa-server/public/diagram-shared.js" || EFF_HELPERS="$REF_IMPL/renderers/anime-svg/reference/helpers.js"; }
summary() { grep -E '[0-9]+ errors?' | tail -1 || true; }
echo
echo "checking the new diagram against $(basename "$EFF_CSS") and $(basename "$EFF_HELPERS"):"
v_out="$(node "$REF_IMPL/core/validator/validate.mjs" "$LABEL/diagram.animation.js" --assets "$EFF_HELPERS" 2>&1)" && v_ok=1 || v_ok=0
m_out="$(node "$ANIME_SVG/markup/check.mjs" "$LABEL/diagram.animation.js" --css "$EFF_CSS" --helpers "$EFF_HELPERS" 2>&1)" && m_ok=1 || m_ok=0
# With your own helpers, the skeleton's placeholder sequence uses assets (request, response, credential) that only the
# reference iconography defines, so the validator reports them as unknown. That is not a wrong path: they go away when the
# real sequence replaces the placeholder, using your helpers' assets. Errors of only that kind are not treated as failure.
v_errors="$(printf '%s\n' "$v_out" | sed -n -E 's/^([0-9]+) errors?,.*/\1/p' | tail -1)"
v_unknown="$(printf '%s\n' "$v_out" | grep -c '\[unknown-asset\]' || true)"
skeleton_assets_unknown=0
if [ "$v_ok" = 0 ] && [ -n "$HELPERS$APP" ] && [ -n "$v_errors" ] && [ "$v_errors" = "$v_unknown" ]; then
  v_ok=1
  skeleton_assets_unknown=1
fi
echo "  descriptor: $(printf '%s\n' "$v_out" | summary)"
echo "  drawing:    $(printf '%s\n' "$m_out" | summary)"
if [ "$skeleton_assets_unknown" = 1 ]; then
  echo "  (the descriptor's errors are the skeleton's placeholder assets, which your helpers don't define: expected, and gone once"
  echo "   the placeholder sequence is replaced with one that uses the assets in $(basename "$EFF_HELPERS"))"
fi
if [ "$v_ok" = 0 ] || [ "$m_ok" = 0 ]; then
  warn "a check reported errors: look at the paths you gave"
  printf '%s\n%s\n' "$v_out" "$m_out" >&2
fi

cat <<EOF

Done. The warnings above are the skeleton's REPLACE placeholders: describing your animation replaces them.
Next, in $PROJECT:
  1. Ask the agent to draft the descriptor in $LABEL/diagram.animation.js (see AUTHORING-WORKFLOW.md, step 1).
  2. Check it and try it (steps 4 and 5).
  3. ./export.sh   writes export/$LABEL-ghost-html-card.html (--profile standalone-page for a full page).
Nothing is committed yet: review, then commit.
EOF
