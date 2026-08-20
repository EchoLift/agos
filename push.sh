#!/bin/bash
set -e

echo "================================"
echo "Pushing AGENCIE repositories..."
echo "================================"

echo ""
echo "1/2 → Personal repository"
sh ./personal-push.sh

echo ""
echo "2/2 → Production repository"
sh ./prod-push.sh

echo ""
echo "================================"
echo "✓ All repositories pushed."
echo "================================"