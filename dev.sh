#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"
DATA_DIR="$ROOT/data" venv/bin/python run.py > "$ROOT/backend.log" 2>&1 &
echo "Backend PID: $!"
cd "$ROOT/frontend"
REACT_APP_API_BASE_URL=http://localhost:5001 npm start > "$ROOT/frontend.log" 2>&1 &
echo "Frontend PID: $!"
echo ""
echo "Backend:  http://localhost:5001"
echo "Frontend: http://localhost:3000"
wait
