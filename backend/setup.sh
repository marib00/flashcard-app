#!/bin/bash

# Store the current directory
CURRENT_DIR=$(pwd)

# Change to the backend directory
cd "$(dirname "$0")"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
if ! pip install -r requirements.txt; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

# Import questions
echo "Importing questions..."
# Set PYTHONPATH to include the current directory
if ! PYTHONPATH=$PYTHONPATH:. python -m app.db.import_questions; then
    echo "Error: Failed to import questions"
    exit 1
fi

# Return to the original directory
cd "$CURRENT_DIR"

echo "Backend setup complete!" 