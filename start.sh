#!/bin/bash

# Store the current directory
CURRENT_DIR=$(pwd)

# Function to check if a port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Clear any previous log files
rm -f backend/backend.log frontend/frontend.log backend/detailed_debug.log

# Check if backend port (8000) is available
if check_port 8000; then
    echo "Port 8000 is already in use. Please make sure no other backend server is running."
    exit 1
fi

# Check if frontend port (3000) is available
if check_port 3000; then
    echo "Port 3000 is already in use. Please make sure no other frontend server is running."
    exit 1
fi

# Start backend server
echo "Starting backend server..."
cd backend
if [ ! -d "venv" ]; then
    echo "Error: Virtual environment not found. Please run ./backend/setup.sh first."
    exit 1
fi
source venv/bin/activate

# # Use a simple and explicit approach to start the backend
# echo "Running diagnostic check on database first..."
# python diagnose_db.py || { echo "Database diagnostic failed."; exit 1; }

# Run the backend with full output to console
echo "Starting Uvicorn with app.main:app..."
PYTHONPATH=. python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"

# Give the server a moment to start
sleep 3

# Check if the backend is running by testing its health
echo "Testing backend connection..."
if ! curl -s http://localhost:8000/docs > /dev/null; then
    echo "ERROR: Backend server not responding at http://localhost:8000/docs"
    echo "Check backend.log for details:"
    tail -n 20 backend.log
    exit 1
else
    echo "Backend server is running and responding at http://localhost:8000"
fi

cd "$CURRENT_DIR"

# Start frontend server
echo "Starting frontend server..."
cd frontend
(export REACT_APP_API_URL="$BACKEND_URL" && export NODE_OPTIONS=--openssl-legacy-provider && npm start > frontend.log 2>&1) &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"
cd "$CURRENT_DIR"

# Function to handle script termination
cleanup() {
    echo "Shutting down servers..."
    # Check if PIDs exist before killing
    if kill -0 $BACKEND_PID > /dev/null 2>&1; then kill $BACKEND_PID; fi
    if kill -0 $FRONTEND_PID > /dev/null 2>&1; then kill $FRONTEND_PID; fi
    exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

echo -e "\n====== App Started Successfully ======"
echo "Backend: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both servers"
echo "Check backend.log and frontend.log for any error messages"

# Keep the script running and wait for background processes
wait $BACKEND_PID $FRONTEND_PID 