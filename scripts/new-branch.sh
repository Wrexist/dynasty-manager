#!/usr/bin/env bash
# new-branch.sh — Create a feature branch from latest origin/main
# Usage: ./scripts/new-branch.sh <branch-name>
#   or:  npm run branch -- my-feature
set -euo pipefail

GREEN='\033[1;32m'
RED='\033[1;31m'
CYAN='\033[1;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[branch]${NC} $1"; }
ok()   { echo -e "${GREEN}[branch]${NC} $1"; }
fail() { echo -e "${RED}[branch]${NC} $1"; exit 1; }

BRANCH_NAME="${1:-}"
[ -z "$BRANCH_NAME" ] && fail "Usage: npm run branch -- <branch-name>"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  fail "You have uncommitted changes. Commit or stash them first."
fi

# Fetch latest main
info "Fetching latest origin/main..."
MAX_RETRIES=4
RETRY_DELAY=2
FETCHED=false

for i in $(seq 1 $MAX_RETRIES); do
  if git fetch origin main 2>&1; then
    FETCHED=true
    break
  fi
  if [ "$i" -lt "$MAX_RETRIES" ]; then
    info "Fetch failed — retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
    RETRY_DELAY=$((RETRY_DELAY * 2))
  fi
done

$FETCHED || fail "Could not fetch origin/main after $MAX_RETRIES attempts"

# Create branch from origin/main
info "Creating branch '$BRANCH_NAME' from origin/main..."
git checkout -b "$BRANCH_NAME" origin/main

ok "Branch '$BRANCH_NAME' created and checked out!"
ok "It's based on the latest origin/main — PRs will compare cleanly."
