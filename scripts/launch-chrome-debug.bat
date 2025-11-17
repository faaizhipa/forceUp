@echo off
REM Launch Chrome with remote debugging enabled for MCP integration
REM Usage: launch-chrome-debug.bat

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set DEBUG_PORT=9222
set PROFILE_DIR=chrome-debug-profile

if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

echo Launching Chrome with remote debugging on port %DEBUG_PORT%...
echo Profile directory: %PROFILE_DIR%
echo.
echo To connect MCP, use port %DEBUG_PORT%
echo.

start "" %CHROME_PATH% --remote-debugging-port=%DEBUG_PORT% --user-data-dir="%CD%\%PROFILE_DIR%"

echo Chrome launched. Press any key to exit...
pause >nul

