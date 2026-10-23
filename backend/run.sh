#!/usr/bin/env bash
# Starts the API on http://127.0.0.1:8000 (Aer needs the TLS tunable on Python 3.14 / glibc)
cd "$(dirname "$0")/.."
export GLIBC_TUNABLES=glibc.rtld.optional_static_tls=16384
exec .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
