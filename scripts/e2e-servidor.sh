#!/usr/bin/env bash
# Playwright's web server for e2e: one build+server per checkout at a time.
# Two runs at once used to rebuild .next under each other's `next start`, and server actions hung.
# A second run waits here (or, once the first server answers on the port, Playwright just reuses it).
set -euo pipefail
cd "$(dirname "$0")/.."
TRAVA=.e2e-trava
PORTA=${PORTA:-3100}

until mkdir "$TRAVA" 2>/dev/null; do
  dono=$(cat "$TRAVA/pid" 2>/dev/null || true)
  if [ -n "$dono" ] && ! kill -0 "$dono" 2>/dev/null; then rm -rf "$TRAVA"; continue; fi # previous run died
  echo "e2e: outra rodada usa este checkout (pid ${dono:-?}); esperando…" >&2
  sleep 5
done
echo $$ > "$TRAVA/pid"
trap 'rm -rf "$TRAVA"' EXIT
trap 'exit 143' INT TERM # Playwright stops the server with a signal: release the lock on the way out

npm run build
npx next start -p "$PORTA" &
wait $!
