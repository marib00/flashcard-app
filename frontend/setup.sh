#!/bin/bash

# Store the current directory
CURRENT_DIR=$(pwd)

# Check if we're running in a Docker container
if [ -f /.dockerenv ]; then
    echo "Running in Docker container..."
    # Install Node.js and npm using apt-get
    apt-get update
    apt-get install -y curl
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed."
        echo "Please install Node.js from https://nodejs.org/"
        echo "For Ubuntu/Debian, you can use:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        echo "For macOS, you can use:"
        echo "  brew install node"
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo "Error: npm is not installed."
        echo "Please install npm (it usually comes with Node.js)."
        echo "If you have Node.js installed but not npm, try:"
        echo "  curl -L https://www.npmjs.com/install.sh | sh"
        exit 1
    fi
fi

# Change to the frontend directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Return to the original directory
cd "$CURRENT_DIR"

echo "Frontend setup complete!" 