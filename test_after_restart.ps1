# Quick test script to verify the backend is working after restart

Write-Host "==================================="
Write-Host "Testing Backend After Restart"
Write-Host "==================================="
Write-Host ""

# Test 1: Check if backend is running
Write-Host "1. Checking if backend process is running..."
$uvicorn = Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue
if ($uvicorn) {
    Write-Host "   ✓ Backend process found (PID: $($uvicorn.Id))" -ForegroundColor Green
} else {
    Write-Host "   ✗ Backend process NOT running!" -ForegroundColor Red
    Write-Host "   Please start the backend first." -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Health endpoint
Write-Host "2. Testing health endpoint..."
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method GET -UseBasicParsing
    if ($health.status -eq "ok") {
        Write-Host "   ✓ Health endpoint OK" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Health endpoint returned unexpected response" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Purchases endpoint (should return 401 without auth)
Write-Host "3. Testing purchases endpoint..."
try {
    $purchases = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/purchases" -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✗ Unexpected success (should require authentication)" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✓ Purchases endpoint responding (401 Unauthorized - correct)" -ForegroundColor Green
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   ✗ Purchases endpoint returning 500 error!" -ForegroundColor Red
        Write-Host "   Check backend logs for details." -ForegroundColor Yellow
    } else {
        Write-Host "   ? Purchases endpoint returned: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 4: Check CORS headers
Write-Host "4. Checking CORS headers..."
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -Method GET -UseBasicParsing
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader) {
        Write-Host "   ✓ CORS headers present: $corsHeader" -ForegroundColor Green
    } else {
        Write-Host "   ✗ CORS headers missing!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Failed to check CORS headers" -ForegroundColor Red
}
Write-Host ""

Write-Host "==================================="
Write-Host "Test Complete"
Write-Host "==================================="
Write-Host ""
Write-Host "If all tests passed, the backend is ready!"
Write-Host "You can now use the frontend to access /api/purchases"
