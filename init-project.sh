#!/usr/bin/env bash
# Copyright (c) 2026 Charlie Federspiel
# SPDX-License-Identifier: MIT
#
# The entry point for starting a project for animated diagrams (step 2 of README.md "Getting started"). It only
# forwards to the renderer's own script, which holds the logic and the tests:
#   reference-implementation/renderers/anime-svg/init/init-project.sh
# The script lives under the renderer because it is specific to it (it copies that renderer's skeleton, installs
# anime.js, and writes an export.sh for that renderer's exporter). This file is here so the command people run
# first has a short path that doesn't change when a renderer is added.
#
# Usage: init-project.sh <project-dir> [options]      (-h lists the options)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$HERE/reference-implementation/renderers/anime-svg/init/init-project.sh" "$@"
