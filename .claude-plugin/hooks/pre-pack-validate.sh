#!/usr/bin/env bash
# Pre-pack validation hook — runs before any pack operation.
set -e
SOURCE_DIR="${1:-_extracted}"
echo "[pre-pack] Validating $SOURCE_DIR..."
node src/index.js validate "$SOURCE_DIR"
echo "[pre-pack] Validation passed."
