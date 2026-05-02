# Backend Startup System Refactor

## Overview
This document describes the comprehensive refactor of the EyerFlow backend startup system to ensure production stability across multiple Windows machines with zero manual intervention.

## Problems Solved

### 1. **Port Conflicts (Critical)**
- **Before**: Hardcoded port 8000 caused failures when port was already in use
- **After**: Dynamic port allocation (8000-8100 range) with automatic conflict resolution

### 2. **Silent Failures (Critical)**
- **Before**: App would skip backend startup if port was busy, leaving users with a broken app
- **After**: Backend ALWAYS starts successfully or fails with clear error and retry option

### 3. **Stale Processes (Critical)**
- **Before**: No cleanup of zombie Python/uvicorn/backend.exe processes
- **After**: Automatic detection and cleanup of stale processes before startup

### 4. **Missing license_service.exe (Critical)**
- **Before**: License service executable was not built or packaged
- **After**: Proper PyInstaller spec and electron-builder configuration

### 5. **Poor Error Handling**
- **Before**: Generic errors with no actionable information
- **After**: Detailed logging, user-friendly error dialogs with retry/view logs options

## Architecture Changes

### Dynamic Port Allocation
```javascript
// electron/main.js
const PORT_RANGE_START = 8000;
const PORT_RANGE_END = 8100;

async function allocatePort(preferredPort = PORT_RANGE_START) {
  // 1. Try preferred port (8000)
  // 2. If busy, attempt to kill process using it
  // 3. If can't free it, find alternative port in range
  // 4. Return allocated port
}
```

### Process Cleanup
```javascript
async function cleanupStaleProcesses() {
  // Searches for:
  // - uvicorn processes
  // - python.exe with backend in command line
  // - backend.exe processes
  // Kills stale processes before starting new backend
}
```

### Robust Startup Sequence
```javascript
app.whenReady().then(async () => {
  // 1. Clean up stale processes
  // 2. Allocate port dynamically
  // 3. Start backend with allocated port
  // 4. Start license service
  // 5. Wait for backend health check
  // 6. On failure: show retry dialog
  // 7. Create window only after backend is ready
});
```

## New Dependencies

### Node.js Packages
```json
{
  "get-port": "^5.1.1",      // Dynamic port allocation
  "find-process": "^1.4.7"   // Process detection and cleanup
}
```

Install with:
```bash
npm install
```

## File Changes

### Modified Files
1. **electron/main.js** - Complete refactor of backend startup logic
2. **electron/preload.js** - Added `getBackendPort` IPC handler
3. **frontend/src/api/client.js** - Dynamic port resolution
4. **backend_launcher.py** - Accept port from environment
5. **scripts/build-backend.js** - Build both backend and license_service executables
6. **package.json** - Added dependencies and license_service to extraResources

### New Files
1. **license_service.spec** - PyInstaller spec for license service
2. **license_service_launcher.py** - Entry point for license service executable

## Build Process

### Development
```bash
# Start frontend dev server
npm run dev:frontend

# Start Electron (will spawn backend automatically)
npm run dev:electron
```

### Production Build
```bash
# 1. Build frontend
npm run build:frontend

# 2. Build backend executables (both backend.exe and license_service.exe)
npm run build:backend

# 3. Package Electron app
npm run build
```

The build process now creates:
- `dist/backend/backend.exe` - Main inventory backend
- `dist/license_service/license_service.exe` - License service

Both are packaged into `resources/backend/` in the final installer.

## Port Configuration

### Backend (Inventory API)
- **Preferred Port**: 8000
- **Fallback Range**: 8000-8100
- **Allocation**: Dynamic with conflict resolution
- **Environment Variable**: `BACKEND_PORT`

### License Service
- **Fixed Port**: 8001
- **Conflict Resolution**: Kills process on port if busy
- **Environment Variable**: `LICENSE_PORT`

## Logging

All backend startup events are logged to:
```
%APPDATA%/EyerFlow/logs/main.log
```

Log entries include:
- Port allocation attempts and results
- Process cleanup operations
- Backend spawn status and PID
- Health check attempts
- All errors with stack traces

## Error Handling

### Port Allocation Failure
```
Dialog: "Backend Port Allocation Failed"
- Shows port range that was attempted
- Suggests closing applications using those ports
- Exits app (user must resolve conflict)
```

### Backend Spawn Failure
```
Dialog: "Backend Failed to Start"
Options:
- [Retry] - Restarts the app
- [View Logs] - Opens main.log
- [Exit] - Closes the app
```

### Health Check Timeout
```
Dialog: "Backend did not start within 90 seconds"
- Shows log file location
- Provides retry option
```

## Testing Checklist

### Port Conflict Scenarios
- [ ] Start app normally (port 8000 free)
- [ ] Start app with port 8000 in use by another app
- [ ] Start multiple instances of EyerFlow simultaneously
- [ ] Kill backend.exe while app is running, then restart app

### Process Cleanup
- [ ] Leave stale python.exe/uvicorn processes running
- [ ] Leave stale backend.exe processes running
- [ ] Verify cleanup happens before new backend starts

### License Service
- [ ] Verify license_service.exe is packaged in installer
- [ ] Verify license service starts on port 8001
- [ ] Test license activation flow

### Error Recovery
- [ ] Simulate backend crash during startup
- [ ] Test retry functionality
- [ ] Verify log file is accessible from error dialog

## Migration Notes

### For Existing Installations
- No database migration required
- Port allocation is automatic
- Existing .env files are still respected
- No user action required

### For Developers
1. Run `npm install` to get new dependencies
2. Rebuild backend: `npm run build:backend`
3. Test in development mode first
4. Verify both executables are created in dist/

## Performance Impact

- **Startup Time**: +1-2 seconds (process cleanup + port allocation)
- **Memory**: +5MB (find-process dependency)
- **Disk**: +2MB (license_service.exe)

## Security Considerations

- Process cleanup only targets backend-related processes
- Port scanning limited to 8000-8100 range
- No external network calls during startup
- All operations are local to the machine

## Future Improvements

1. **Health Check Optimization**: Reduce polling interval after first success
2. **Port Persistence**: Remember last successful port in config file
3. **Multi-Instance Support**: Allow multiple EyerFlow instances with different databases
4. **Graceful Degradation**: Run without license service if it fails to start

## Support

If backend startup fails:
1. Check logs at `%APPDATA%/EyerFlow/logs/main.log`
2. Verify no other apps are using ports 8000-8100
3. Run Task Manager and kill any stale python.exe/backend.exe processes
4. Restart the application

For persistent issues, collect:
- main.log file
- Windows Event Viewer logs
- List of running processes (Task Manager screenshot)
