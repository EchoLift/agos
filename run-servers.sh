#!/bin/bash

# Navigate to backend and start the api in the background
cd backend && npm run dev:api &

# Navigate back to root and start frontend in the foreground
cd ../frontend && npm run dev

