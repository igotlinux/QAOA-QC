#!/usr/bin/env bash
# Starts the QAOA engine (port 8000) and the web UI (port 3000). Ctrl+C stops both.
cd "$(dirname "$0")"
bash backend/run.sh &
API=$!
trap 'kill $API 2>/dev/null' EXIT
cd web && npm run dev
