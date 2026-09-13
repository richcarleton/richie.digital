@echo off
cd /d "%~dp0"
start "" code .
start "http" cmd /k python -m http.server 8000
timeout /t 2 >nul
start "tunnel" cmd /k cloudflared tunnel --url http://localhost:8000
echo Two windows opened. Grab the trycloudflare URL from the tunnel window.