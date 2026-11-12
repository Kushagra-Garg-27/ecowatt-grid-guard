# Run automated pytest test suite
Write-Host "Running EcoWatt Grid Guard Automated Pytest Suite..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\.."
py -3.12 -m pytest tests -v

