# EyerFlow Backend Startup - Quick Start Guide

## What Changed?

The backend now uses **dynamic port allocation** instead of hardcoded port 8000. This prevents conflicts and ensures the app always starts successfully.

## For End Users

### Normal Operation
- **No action required** - the app will automatically find an available port
- Backend typically runs on port 8000 (if available)
- If port 8000 is busy, the app will use 8001-8100 automatically

### If Backend Fails to Start
You'll see a dialog with three options:

1. **Retry** - Restarts the app (recommended first step)
2. **View Logs** - Opens the log file for troubleshooting
3. **Exit** - Closes the app

### Common Issues

#### "Port allocation failed"
**Cause**: All ports 8000-8100 are in use  
**Solution**: Close other applications using these ports, or restart your computer

#### "Backend did not start within 90 seconds"
**Cause**: Backend process is slow to start or crashed  
**Solution**: 
1. Click "Retry"
2. If retry fails, click "View Logs" and send to support
3. Restart your computer

## For Developers

### Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Start frontend dev server
npm run dev:frontend

# 3. In another terminal, start Electron
npm run dev:electron
```

### Production Build
```bash
# Full build (frontend + backend + package)
npm run build

# Or step by step:
npm run build:frontend   # Build React app
npm run build:backend    # Build backend.exe and license_service.exe
electron-builder         # Package Electron app
```

### Verify Build Output
After `npm run build:backend`, check:
- ✅ `dist/backend/backend.exe` exists
- ✅ `dist/license_service/license_service.exe` exists

### Testing Port Allocation

#### Test 1: Normal Startup
```bash
npm run dev:electron
# Should start on port 8000
```

#### Test 2: Port Conflict
```bash
# In terminal 1: Block port 8000
python -m http.server 8000

# In terminal 2: Start app
npm run dev:electron
# Should start on port 8001 or next available
```

#### Test 3: Multiple Instances
```bash
# Start first instance
npm run dev:electron

# Start second instance (in new terminal)
npm run dev:electron
# Should start on different port
```

### Debugging

#### View Logs
```bash
# Windows
%APPDATA%\EyerFlow\logs\main.log

# Or from PowerShell
notepad $env:APPDATA\EyerFlow\logs\main.log
```

#### Check Backend Port
Look for this line in logs:
```
[backend] allocated port: 8001
```

#### Check Running Processes
```powershell
# Find backend processes
Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*backend*"}

# Kill stale processes
taskkill /F /IM python.exe
taskkill /F /IM backend.exe
```

### Key Files Modified

| File | Change |
|------|--------|
| `electron/main.js` | Dynamic port allocation, process cleanup |
| `electron/preload.js` | Added `getBackendPort` IPC handler |
| `frontend/src/api/client.js` | Dynamic port resolution |
| `backend_launcher.py` | Accept port from environment |
| `package.json` | New dependencies, license_service packaging |

### New Files

| File | Purpose |
|------|---------|
| `license_service.spec` | PyInstaller config for license service |
| `license_service_launcher.py` | Entry point for license service |
| `BACKEND_STARTUP_REFACTOR.md` | Detailed technical documentation |

## Environment Variables

### Backend Port (Optional)
```bash
# Force specific port (not recommended)
set BACKEND_PORT=8050
npm run dev:electron
```

### License Port (Optional)
```bash
# Change license service port
set LICENSE_PORT=8002
npm run dev:electron
```

## Troubleshooting Commands

### Clear All Stale Processes
```powershell
# Kill all Python processes
Get-Process python | Stop-Process -Force

# Kill all backend processes
Get-Process backend | Stop-Process -Force

# Kill processes on specific port (e.g., 8000)
$port = 8000
$processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
if ($processId) { Stop-Process -Id $processId -Force }
```

### Check Port Usage
```powershell
# See what's using port 8000
netstat -ano | findstr :8000

# Or with PowerShell
Get-NetTCPConnection -LocalPort 8000 | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

### Reset Everything
```powershell
# 1. Kill all processes
Get-Process python,backend -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Clear app data (WARNING: deletes database)
Remove-Item -Recurse -Force $env:APPDATA\EyerFlow

# 3. Restart app
npm run dev:electron
```

## API Changes

### Frontend API Client
The frontend now automatically detects the backend port:

```javascript
// Old (hardcoded)
const BASE_URL = "http://127.0.0.1:8000/api";

// New (dynamic)
const port = await window.electron.getBackendPort();
const BASE_URL = `http://127.0.0.1:${port}/api`;
```

### IPC Handlers
New IPC handler available:

```javascript
// In renderer process
const port = await window.electron.getBackendPort();
console.log(`Backend running on port ${port}`);
```

## Performance Notes

- **Startup Time**: +1-2 seconds (process cleanup + port allocation)
- **Memory Usage**: +5MB (process management libraries)
- **Disk Space**: +2MB (license_service.exe)

## Known Limitations

1. **Port Range**: Limited to 8000-8100 (100 ports)
2. **Windows Only**: Process cleanup optimized for Windows
3. **Single Backend**: Each app instance runs its own backend

## Support

### For Users
If you encounter issues:
1. Try the "Retry" button first
2. Restart your computer
3. Contact support with log file from "View Logs" button

### For Developers
If you encounter build issues:
1. Check `npm install` completed successfully
2. Verify Python venv is activated
3. Run `npm run build:backend` separately to see errors
4. Check logs in `%APPDATA%\EyerFlow\logs\main.log`

## Additional Resources

- **Full Technical Docs**: See `BACKEND_STARTUP_REFACTOR.md`
- **Build Script**: See `scripts/build-backend.js`
- **Main Process**: See `electron/main.js`
