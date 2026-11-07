#!/usr/bin/env bash
set -euo pipefail
tesslane_repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tesslane_project="${1:-$PWD}"
source "$tesslane_repo/scripts/runtime.sh"
cd "$tesslane_repo"
node scripts/prepare.mjs
exec node scripts/launch.mjs "$tesslane_project"
