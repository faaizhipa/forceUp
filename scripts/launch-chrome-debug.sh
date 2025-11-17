#!/bin/bash
# Launch Chrome with remote debugging enabled for MCP integration
# Usage: ./launch-chrome-debug.sh

DEBUG_PORT=9222
PROFILE_DIR="chrome-debug-profile"

# Detect OS and Chrome path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_PATH="google-chrome"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Create profile directory if it doesn't exist
mkdir -p "$PROFILE_DIR"

echo "Launching Chrome with remote debugging on port $DEBUG_PORT..."
echo "Profile directory: $PROFILE_DIR"
echo ""
echo "To connect MCP, use port $DEBUG_PORT"
echo ""

# Launch Chrome
"$CHROME_PATH" --remote-debugging-port=$DEBUG_PORT --user-data-dir="$PROFILE_DIR" &

echo "Chrome launched with PID: $!"
echo "Press Ctrl+C to stop"

