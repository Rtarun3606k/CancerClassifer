#!/usr/bin/env bash
#
# Starts the Metro bundler (if it is not already running) and then builds,
# installs and launches the Android app on the connected device/emulator.
#
# Usage:
#   ./scripts/dev.sh
#   npm run dev
#   METRO_PORT=8082 ./scripts/dev.sh --deviceId RZCX51CB20B
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${METRO_PORT:-8081}"
METRO_LOG="${TMPDIR:-/tmp}/oralscan-metro.log"
METRO_PID=""
STARTED_METRO=0

metro_is_ready() {
  curl -fsS "http://127.0.0.1:${PORT}/status" 2>/dev/null |
    grep -q "packager-status:running"
}

cleanup() {
  if [[ "$STARTED_METRO" == "1" && -n "$METRO_PID" ]]; then
    if kill -0 "$METRO_PID" 2>/dev/null; then
      echo ""
      echo "Stopping Metro (pid ${METRO_PID})..."
      kill "$METRO_PID" 2>/dev/null || true
      wait "$METRO_PID" 2>/dev/null || true
    fi
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -d node_modules ]]; then
  echo "node_modules is missing. Run: npm ci" >&2
  exit 1
fi

RN_CLI="${ROOT_DIR}/node_modules/react-native/cli.js"

if [[ ! -f "$RN_CLI" ]]; then
  echo "React Native CLI not found at ${RN_CLI}. Run: npm ci" >&2
  exit 1
fi

if metro_is_ready; then
  echo "Metro is already running on port ${PORT}."
else
  echo "Starting Metro on port ${PORT} (log: ${METRO_LOG})..."
  # Launch the CLI directly (not through npx) so $! is the actual Metro
  # process and can be stopped reliably by the cleanup trap.
  node "$RN_CLI" start --port "$PORT" >"$METRO_LOG" 2>&1 &
  METRO_PID=$!
  STARTED_METRO=1

  for _ in $(seq 1 120); do
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
      echo "Metro exited unexpectedly. Last log lines:" >&2
      tail -40 "$METRO_LOG" >&2 || true
      exit 1
    fi

    if metro_is_ready; then
      break
    fi

    sleep 1
  done

  if ! metro_is_ready; then
    echo "Metro did not become ready on port ${PORT}. Last log lines:" >&2
    tail -40 "$METRO_LOG" >&2 || true
    exit 1
  fi

  echo "Metro is ready."
fi

if command -v adb >/dev/null 2>&1; then
  adb reverse "tcp:${PORT}" "tcp:${PORT}" >/dev/null 2>&1 || true
fi

echo "Building and launching the Android app..."
npm run android -- --port "$PORT" "$@"
