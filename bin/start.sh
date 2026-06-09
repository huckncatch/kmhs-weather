#!/bin/sh
# Starts kmhs-weather dev server in a detached tmux session. Safe to run multiple times.
# Uses Homebrew Node explicitly — launchd has no shell rc, so zsh-nvm never loads.
# Update this path after any two-node consolidation work.
TMUX=/opt/homebrew/bin/tmux
PNPM=/opt/homebrew/bin/pnpm

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

$TMUX has-session -t kmhs-weather 2>/dev/null || \
  $TMUX new-session -d -s kmhs-weather "$PNPM --dir /Users/soob/Developer/kmhs-weather dev"
