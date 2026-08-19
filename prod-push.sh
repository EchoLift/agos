#!/bin/bash
set -e

BRANCH=$(git branch --show-current)

if [ "$BRANCH" != "main" ]; then
  echo "Error: current branch is '$BRANCH'. Switch to main before pushing."
  exit 1
fi

echo "Switching GitHub account to EchoLift..."
gh auth switch --user EchoLift

echo "Pushing main to prod..."
git push prod main

echo "Production push complete."