@echo off
:: =================================================
:: StartServer.bat - RoadTrip API Server (Final Version)
:: 🚀 UTF-8 + English + Auto-path + Safe execution + Colors
:: =================================================

:: ===== Set UTF-8 =====
chcp 65001 >nul

:: ===== Define colors =====
set "COLOR_SUCCESS=0A"
set "COLOR_ERROR=0C"
set "COLOR_WARNING=0E"
set "COLOR_NORMAL=07"

:: ===== Detect project folder =====
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:START
echo.
echo ================= STARTING SERVER =================
echo Project folder: %PROJECT_DIR%
echo.

:: ===== Check Node.js =====
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found! Please install Node.js from https://nodejs.org/
    pause
    exit /b
)
for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo ✅ Node.js version: %NODE_VERSION%

:: ===== Check npm =====
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found! Please install npm
    pause
    exit /b
)

:: ===== Check server.js =====
if not exist "server.js" (
    echo ❌ server.js not found in %PROJECT_DIR%
    pause
    exit /b
)

:: ===== Check node_modules =====
if not exist "node_modules" (
    echo 🔄 node_modules not found, installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies!
        pause
        exit /b
    )
)

:: ===== Run server safely =====
echo ✅ Starting RoadTrip API Server...
echo.

node server.js
if %errorlevel% neq 0 (
    echo ❌ Server exited with errors!
    echo Please check server.js or log files.
)

echo.
echo Server stopped. Press any key to restart or Ctrl+C to exit...
pause >nul
goto START
