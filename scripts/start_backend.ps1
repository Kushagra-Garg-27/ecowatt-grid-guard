# Start EcoWatt Grid Guard Backend (FastAPI + CoAP + MQTT + Simulation)
Write-Host "Starting EcoWatt Grid Guard Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
py -3.12 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
