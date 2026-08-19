#!/bin/bash
set -e

BRANCH=$(git branch --show-current)

if [ "$BRANCH" != "main" ]; then
  echo "Error: current branch is '$BRANCH'. Switch to main before pushing."
  exit 1
fi

echo "Switching GitHub account to Suryatejaa..."
gh auth switch --user Suryatejaa

echo "Pushing main to origin..."
git push origin main

echo "Personal repository push complete."