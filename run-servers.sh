#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the API app in the background from the backend package.
(cd "$ROOT_DIR/backend" && npm run dev:api) &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT

# Start the frontend in the foreground.
cd "$ROOT_DIR/frontend"
npm run dev
