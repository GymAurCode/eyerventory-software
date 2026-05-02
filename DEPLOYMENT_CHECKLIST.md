# EyerFlow Backend Refactor - Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] Review all changes in `electron/main.js`
- [ ] Review changes in `frontend/src/api/client.js`
- [ ] Review new build scripts in `scripts/build-backend.js`
- [ ] Review new PyInstaller specs (backend.spec, license_service.spec)
- [ ] Verify no hardcoded ports remain in codebase

### Dependencies
- [ ] Run `npm install` to install new dependencies
- [ ] Verify `get-port` package installed (v5.1.1)
- [ ] Verify `find-process` package installed (v1.4.7)
- [ ] Check for any dependency conflicts
- [ ] Run `npm audit` and address critical issues

### Build Process
- [ ] Run `npm run build:frontend` - verify success
- [ ] Run `npm run build:backend` - verify both executables created:
  - [ ] `dist/backend/backend.exe` exists
  - [ ] `dist/license_service/license_service.exe` exists
- [ ] Run `npm run build` - verify installer created
- [ ] Check installer size (should be ~180-200MB)

## Testing Phase 1: Development Environment

### Basic Functionality
- [ ] Start app in dev mode: `npm run dev:electron`
- [ ] Verify backend starts on port 8000
- [ ] Verify license service starts on port 8001
- [ ] Check logs at `%APPDATA%\EyerFlow\logs\main.log`
- [ ] Verify app loads and login works
- [ ] Test basic CRUD operations (products, sales, etc.)

### Port Conflict Testing
- [ ] Block port 8000 with another app
- [ ] Start EyerFlow - should use port 8001
- [ ] Verify app works normally on alternate port
- [ ] Check logs show port allocation message
- [ ] Close blocking app and restart EyerFlow
- [ ] Verify returns to port 8000

### Process Cleanup Testing
- [ ] Start app normally
- [ ] Kill backend.exe via Task Manager (simulate crash)
- [ ] Restart app
- [ ] Verify stale process cleanup in logs
- [ ] Verify app starts successfully

### Multiple Instance Testing
- [ ] Start first instance of EyerFlow
- [ ] Note which port it uses (check logs)
- [ ] Start second instance
- [ ] Verify second instance uses different port
- [ ] Verify both instances work independently
- [ ] Close both instances cleanly

## Testing Phase 2: Production Build

### Installation Testing
- [ ] Uninstall any existing EyerFlow installation
- [ ] Install from new installer
- [ ] Verify installation completes without errors
- [ ] Check installation directory contains:
  - [ ] `resources/backend/backend.exe`
  - [ ] `resources/backend/license_service.exe`

### First Launch
- [ ] Launch app from Start Menu
- [ ] Verify backend starts (check logs)
- [ ] Verify license service starts (check logs)
- [ ] Complete initial setup (login/register)
- [ ] Test basic functionality

### Error Recovery Testing
- [ ] Simulate port conflict (block 8000-8010)
- [ ] Start app
- [ ] Verify error dialog appears
- [ ] Click "Retry" - verify works
- [ ] Simulate backend crash
- [ ] Verify error dialog with retry option
- [ ] Click "View Logs" - verify opens correct file

### Performance Testing
- [ ] Measure startup time (should be 3-5 seconds)
- [ ] Check memory usage (Task Manager)
- [ ] Verify no memory leaks after 1 hour
- [ ] Test with large database (1000+ products)

## Testing Phase 3: Real-World Scenarios

### Clean Machine Testing
- [ ] Test on Windows 10 machine (never had EyerFlow)
- [ ] Test on Windows 11 machine (never had EyerFlow)
- [ ] Verify no manual configuration needed
- [ ] Verify all features work out of box

### Upgrade Testing
- [ ] Install old version of EyerFlow
- [ ] Create test data (products, sales, etc.)
- [ ] Install new version (upgrade)
- [ ] Verify data preserved
- [ ] Verify app works with new backend system

### Network Environment Testing
- [ ] Test on machine with firewall enabled
- [ ] Test on machine with antivirus active
- [ ] Test on corporate network
- [ ] Verify no network-related issues

### Edge Cases
- [ ] Test with all ports 8000-8100 blocked
- [ ] Verify clear error message
- [ ] Test with Python installed globally
- [ ] Verify doesn't interfere with bundled backend
- [ ] Test with multiple users on same machine
- [ ] Verify each user has separate database

## Testing Phase 4: Stress Testing

### Concurrent Operations
- [ ] Start 5 instances simultaneously
- [ ] Verify all start on different ports
- [ ] Perform operations in all instances
- [ ] Verify no conflicts or crashes

### Long-Running Stability
- [ ] Run app for 8 hours continuously
- [ ] Perform periodic operations
- [ ] Check for memory leaks
- [ ] Verify backend doesn't crash

### Rapid Restart Testing
- [ ] Start app
- [ ] Close immediately
- [ ] Repeat 10 times rapidly
- [ ] Verify no zombie processes
- [ ] Verify clean startup each time

## Documentation Review

### User Documentation
- [ ] Review `QUICK_START_GUIDE.md` for accuracy
- [ ] Verify troubleshooting steps work
- [ ] Check all commands are correct
- [ ] Verify log file paths are correct

### Developer Documentation
- [ ] Review `BACKEND_STARTUP_REFACTOR.md` for completeness
- [ ] Verify all code examples work
- [ ] Check architecture diagrams are accurate
- [ ] Verify build instructions are correct

### Support Documentation
- [ ] Review `REFACTOR_SUMMARY.md`
- [ ] Verify support scenarios are covered
- [ ] Check log entry examples are accurate
- [ ] Verify rollback plan is complete

## Pre-Release Checklist

### Code Quality
- [ ] All tests passing
- [ ] No console errors in production build
- [ ] No TypeScript/ESLint errors
- [ ] Code reviewed by at least 2 developers

### Security
- [ ] No secrets in code or logs
- [ ] Process cleanup doesn't affect other apps
- [ ] Port allocation is secure
- [ ] No remote code execution vulnerabilities

### Performance
- [ ] Startup time < 5 seconds
- [ ] Memory usage < 200MB
- [ ] No memory leaks detected
- [ ] CPU usage normal during idle

### Compatibility
- [ ] Works on Windows 10 (64-bit)
- [ ] Works on Windows 11 (64-bit)
- [ ] Works with various antivirus software
- [ ] Works on corporate networks

## Release Preparation

### Version Bump
- [ ] Update version in `package.json`
- [ ] Update version in `electron/main.js` if needed
- [ ] Create git tag for release
- [ ] Update CHANGELOG.md

### Build Artifacts
- [ ] Create production installer
- [ ] Test installer on clean machine
- [ ] Create checksums for installer
- [ ] Upload to release server

### Communication
- [ ] Prepare release notes
- [ ] Notify support team of changes
- [ ] Update user documentation
- [ ] Prepare announcement email

## Post-Deployment Monitoring

### Week 1
- [ ] Monitor error logs daily
- [ ] Track startup failure rate
- [ ] Collect user feedback
- [ ] Address critical issues immediately

### Week 2-4
- [ ] Monitor error logs weekly
- [ ] Analyze support tickets
- [ ] Identify common issues
- [ ] Plan improvements

### Success Metrics
- [ ] Startup failure rate < 5%
- [ ] Support tickets reduced by 50%
- [ ] User satisfaction improved
- [ ] No critical bugs reported

## Rollback Procedure

If critical issues are found:

1. **Immediate Actions**
   - [ ] Stop new installations
   - [ ] Notify users of issue
   - [ ] Prepare rollback installer

2. **Rollback Steps**
   - [ ] Revert to previous version
   - [ ] Test rollback installer
   - [ ] Deploy to affected users
   - [ ] Verify data integrity

3. **Post-Rollback**
   - [ ] Analyze root cause
   - [ ] Fix issues in development
   - [ ] Re-test thoroughly
   - [ ] Plan new deployment

## Sign-Off

### Development Team
- [ ] Lead Developer: _________________ Date: _______
- [ ] Backend Developer: _________________ Date: _______
- [ ] Frontend Developer: _________________ Date: _______

### QA Team
- [ ] QA Lead: _________________ Date: _______
- [ ] QA Tester 1: _________________ Date: _______
- [ ] QA Tester 2: _________________ Date: _______

### Management
- [ ] Product Manager: _________________ Date: _______
- [ ] Technical Lead: _________________ Date: _______

### Final Approval
- [ ] Ready for Beta Release: ☐ Yes ☐ No
- [ ] Ready for Production Release: ☐ Yes ☐ No

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

---

**Deployment Date**: _________________  
**Deployed By**: _________________  
**Rollback Plan Verified**: ☐ Yes ☐ No
