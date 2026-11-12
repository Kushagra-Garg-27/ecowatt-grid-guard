@echo off
echo Starting EcoWatt Grid Guard Backend on http://127.0.0.1:8000...
py -3.12 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
