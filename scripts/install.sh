#!/usr/bin/env bash
set -euo pipefail
tesslane_repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$tesslane_repo/scripts/runtime.sh"
exec node "$tesslane_repo/scripts/install-skill.mjs" "${1:-codex}"
