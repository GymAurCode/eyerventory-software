# PowerShell script to restart the backend server

Write-Host "==================================="
Write-Host "Restarting Backend Server"
Write-Host "==================================="
Write-Host ""

# Stop existing uvicorn/python processes running the backend
Write-Host "Stopping existing backend processes..."
Get-Process | Where-Object {$_.ProcessName -eq "uvicorn" -or ($_.ProcessName -eq "python" -and $_.CommandLine -like "*backend*")} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Start the backend
Write-Host "Starting backend server..."
Write-Host "Backend will run on http://127.0.0.1:8000"
Write-Host ""

# Activate virtual environment and start backend
if (Test-Path ".venv\Scripts\Activate.ps1") {
    & .venv\Scripts\Activate.ps1
    python backend_launcher.py
} elseif (Test-Path "venv\Scripts\Activate.ps1") {
    & venv\Scripts\Activate.ps1
    python backend_launcher.py
} else {
    Write-Host "ERROR: Virtual environment not found!"
    Write-Host "Please create a virtual environment first:"
    Write-Host "  python -m venv .venv"
    Write-Host "  .venv\Scripts\Activate.ps1"
    Write-Host "  pip install -r requirements.txt"
}
