# Backend Startup System - Quick Start Guide

## For Developers

### Setup

```bash
# Install dependencies
npm install

# The system now includes get-port for dynamic port allocation
```

### Development

```bash
# Run in development mode (uses Python venv)
npm run electron

# Backend will automatically:
# - Find available port (8000-8100)
# - Clean up stale processes
# - Retry on failure (up to 3 times)
# - Log everything to userData/logs/main.log
```

### Building

```bash
# Build backend executables
npm run build:backend
# Creates: dist/backend/backend.exe
# Creates: dist/backend/license_service.exe (if license_service/ exists)

# Build full application
npm run build
# Creates: dist/EyerFlow-1.0.8.exe
```

## For End Users

### Installation

1. Run `EyerFlow-1.0.8.exe`
2. Follow installer prompts
3. Launch EyerFlow

**That's it!** No manual configuration needed.

### Multiple Instances

You can run multiple instances of EyerFlow simultaneously:

- Instance 1: Uses port 8000
- Instance 2: Uses port 8001
- Instance 3: Uses port 8002
- ... and so on up to port 8100

### Troubleshooting

#### App won't start

1. **Check logs**:
   - Location: `C:\Users\YourName\AppData\Roaming\EyerFlow\logs\main.log`
   - Look for `[backend-manager]` entries

2. **Common issues**:
   - Antivirus blocking: Add EyerFlow to exclusions
   - All ports busy: Close other instances or restart computer
   - Corrupted installation: Reinstall application

#### Backend connection error

1. **Wait 10 seconds** - backend might still be starting
2. **Restart app** - automatic retry will fix most issues
3. **Check Task Manager** - kill any stale `backend.exe` processes

#### License service not working

Non-critical - main app will work fine:

- License features may be limited
- Check logs for `[license-backend-manager]` entries
- Reinstall if needed

## Key Changes from Previous Version

### What Changed

| Old System | New System |
|------------|------------|
| Hardcoded port 8000 | Dynamic ports 8000-8100 |
| Skipped if port busy | Finds alternative port |
| No process cleanup | Auto-kills stale processes |
| No retry logic | 3 retries with backoff |
| Silent failures | Clear error messages |

### Benefits

✅ **Zero port conflicts** - Multiple instances work out of the box  
✅ **Self-healing** - Automatic retry and cleanup  
✅ **Better errors** - Know exactly what went wrong  
✅ **Production ready** - No manual intervention needed  

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Electron Main                        │
│                                                          │
│  ┌────────────────────┐      ┌─────────────────────┐   │
│  │  BackendManager    │      │ LicenseBackendMgr   │   │
│  │                    │      │                     │   │
│  │ • Find free port   │      │ • Start on 8001     │   │
│  │ • Kill stale procs │      │ • Verify exe exists │   │
│  │ • Spawn backend    │      │ • Non-blocking      │   │
│  │ • Health check     │      │                     │   │
│  │ • Retry on fail    │      │                     │   │
│  └────────┬───────────┘      └──────────┬──────────┘   │
│           │                             │              │
└───────────┼─────────────────────────────┼──────────────┘
            │                             │
            ▼                             ▼
    ┌───────────────┐           ┌──────────────────┐
    │  backend.exe  │           │ license_service  │
    │  (port 8000+) │           │  (port 8001)     │
    └───────────────┘           └──────────────────┘
            │
            │ HTTP API
            ▼
    ┌───────────────┐
    │   Frontend    │
    │  (React App)  │
    └───────────────┘
```

## Files Modified

### New Files
- `electron/backend-manager.js` - Backend lifecycle management
- `electron/license-backend-manager.js` - License service management
- `license_service.spec` - PyInstaller config for license service
- `BACKEND_STARTUP_SYSTEM.md` - Full documentation
- `QUICK_START_BACKEND.md` - This file

### Modified Files
- `electron/main.js` - Uses new managers
- `electron/preload.js` - Added backend info IPC
- `backend_launcher.py` - Accepts dynamic port
- `frontend/src/api/client.js` - Dynamic backend URL
- `scripts/build-backend.js` - Builds both executables
- `package.json` - Added get-port dependency

## API Reference

### IPC Handlers

```javascript
// Get backend info
const info = await window.desktop.getBackendInfo();
// Returns: { running: true, port: 8000, host: "127.0.0.1", pid: 12345, url: "http://127.0.0.1:8000" }

// Get license backend info
const licenseInfo = await window.desktop.getLicenseBackendInfo();
// Returns: { running: true, port: 8001, host: "127.0.0.1", pid: 12346, url: "http://127.0.0.1:8001" }
```

### Backend Manager Methods

```javascript
// Start backend (with retry)
await backendManager.start();
// Returns: { port: 8000, host: "127.0.0.1" }

// Stop backend
backendManager.stop();

// Get status
const info = backendManager.getInfo();
```

## Configuration

### Port Range

Edit `electron/backend-manager.js`:

```javascript
this.portRange = { min: 8000, max: 8100 };
```

### Retry Count

Edit `electron/backend-manager.js`:

```javascript
this.maxRetries = 3;
```

### Health Check Timeout

Edit `electron/backend-manager.js`:

```javascript
async waitForBackend(maxWaitMs = 90000, intervalMs = 600)
```

## Logs

All logs in: `%APPDATA%/EyerFlow/logs/main.log`

### Successful Startup

```
[backend-manager] ========== BACKEND STARTUP ==========
[backend-manager] startup attempt 1/3
[backend-manager] found available port: 8000
[backend-manager] spawning backend on port 8000
[backend-manager] started with PID: 12345
[backend-manager] health check passed after 15 attempts
[backend-manager] ========== BACKEND READY ==========
```

### Port Conflict Resolution

```
[backend-manager] found available port: 8000
[backend-manager] checking for stale processes on port 8000
[backend-manager] killing stale process PID 9876
[backend-manager] successfully killed PID 9876
[backend-manager] spawning backend on port 8000
```

### Retry After Failure

```
[backend-manager] attempt 1 failed: Backend process exited unexpectedly
[backend-manager] waiting 2000ms before retry...
[backend-manager] startup attempt 2/3
[backend-manager] found available port: 8001
```

## Support

**Logs location**: `C:\Users\YourName\AppData\Roaming\EyerFlow\logs\main.log`

**Common issues**: See BACKEND_STARTUP_SYSTEM.md

**Contact**: Include log file when reporting issues
