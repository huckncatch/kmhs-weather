#!/bin/bash
# Self-contained setup: installs dependencies, provisions .env.local,
# installs the LaunchAgent, and starts the dev server.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_NAME=com.local.kmhs-weather.plist
PLIST_SRC="$APP_DIR/launchagents/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

cd "$APP_DIR"

echo "Installing dependencies..."
pnpm install

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo
  echo "Created .env.local from .env.example."
  echo "Fill in your API credentials, then re-run this script:"
  echo "  $0"
  exit 0
fi

echo "Installing LaunchAgent..."
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DEST"
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "Starting server..."
"$APP_DIR/bin/start.sh"

echo "Done. Open http://localhost:3000"
