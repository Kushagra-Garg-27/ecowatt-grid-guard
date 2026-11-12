@echo off
echo Launching EcoWatt Grid Guard Full System...
start "EcoWatt Backend" cmd /k "cd /d %~dp0 && call start_backend.bat"
timeout /t 2 /nobreak >nul
start "EcoWatt Frontend" cmd /k "cd /d %~dp0 && call start_frontend.bat"
echo Services launched.
echo Backend API: http://127.0.0.1:8000/docs
echo Frontend:    http://localhost:5173
pause
