#!/usr/bin/env bash
# ship.sh — One command to validate and push your branch
# Usage: ./scripts/ship.sh ["commit message"]
#   or:  npm run ship -- "commit message"
set -euo pipefail

YELLOW='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
CYAN='\033[1;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[ship]${NC} $1"; }
ok()    { echo -e "${GREEN}[ship]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ship]${NC} $1"; }
fail()  { echo -e "${RED}[ship]${NC} $1"; exit 1; }

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree > /dev/null 2>&1 || fail "Not a git repository"

BRANCH=$(git branch --show-current)
[ -z "$BRANCH" ] && fail "Detached HEAD — checkout a branch first"

# Preflight checks
info "Running preflight checks on branch: $BRANCH"

info "Running preflight (lint + test + build)..."
npm run preflight || fail "Preflight failed — fix errors before shipping"

ok "All checks passed!"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-}"
  if [ -z "$MSG" ]; then
    warn "You have uncommitted changes but no commit message provided."
    echo ""
    git status --short
    echo ""
    read -rp "Enter commit message (or Ctrl+C to cancel): " MSG
    [ -z "$MSG" ] && fail "No commit message — aborting"
  fi
  info "Staging and committing..."
  git add -A
  git commit -m "$MSG"
  ok "Committed: $MSG"
else
  ok "Working tree clean — nothing to commit"
fi

# Push with retry logic
MAX_RETRIES=4
RETRY_DELAY=2

for i in $(seq 1 $MAX_RETRIES); do
  info "Pushing to origin/$BRANCH (attempt $i/$MAX_RETRIES)..."
  if git push -u origin "$BRANCH" 2>&1; then
    ok "Successfully pushed to origin/$BRANCH"
    echo ""
    ok "Done! Your branch is ready for a PR."
    exit 0
  fi
  if [ "$i" -lt "$MAX_RETRIES" ]; then
    warn "Push failed — retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
    RETRY_DELAY=$((RETRY_DELAY * 2))
  fi
done

fail "Push failed after $MAX_RETRIES attempts. Check your network/permissions."
