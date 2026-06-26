@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies (one-time, downloads Electron ~100MB)...
  call npm install --no-audit --no-fund
)
echo Starting The Forge...
call npm start
