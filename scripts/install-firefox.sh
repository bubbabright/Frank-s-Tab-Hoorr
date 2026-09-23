#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/build.sh"

echo
echo "Firefox build complete."
echo "Install the generated XPI from:"
echo "  $ROOT/dist/tab-hoor-*.xpi"
echo "Use Firefox Add-ons > gear > Install Add-on From File, or about:debugging"
echo "for temporary development installation. No profile or launcher changes were made."
