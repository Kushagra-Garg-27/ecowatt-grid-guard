# Launch both Backend and Frontend in separate windows
Write-Host "Launching EcoWatt Grid Guard Full System..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start_backend.ps1"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\start_frontend.ps1"

Write-Host "Services started:" -ForegroundColor Cyan
Write-Host "  Backend API & Swagger: http://127.0.0.1:8000/docs"
Write-Host "  React Dashboard:       http://localhost:5173"

