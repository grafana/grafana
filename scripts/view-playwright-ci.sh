#!/usr/bin/env bash
set -euo pipefail

RUN_NUMBER="${1:-}"

if [ -z "$RUN_NUMBER" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "No run ID provided, looking up latest run for branch '$BRANCH'..."
  RUN_NUMBER="$(gh run list --workflow=pr-e2e-tests.yml --branch="$BRANCH" --limit=1 --json databaseId --jq '.[0].databaseId')"
  if [ -z "$RUN_NUMBER" ]; then
    echo "Error: No runs found for branch '$BRANCH'"
    exit 1
  fi
  echo "Using run $RUN_NUMBER"
fi

DEST="/tmp/playwright-html-${RUN_NUMBER}"

echo "Downloading artifact playwright-html from run $RUN_NUMBER"
gh run download "$RUN_NUMBER"  --name playwright-html --dir "$DEST"

echo "Opening report..."
yarn playwright show-report "$DEST"
