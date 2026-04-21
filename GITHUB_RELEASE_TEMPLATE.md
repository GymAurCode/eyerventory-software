# EyerFlow Release Template

## Use This Template When Creating GitHub Releases

---

## Release Title Example
```
Version 1.0.4 - Stability Improvements
```

## Tag Format (CRITICAL)
```
v1.0.4
```
⚠️ **MUST match package.json version exactly with `v` prefix**

---

## Release Description Template

```markdown
# EyerFlow v1.0.4

## 🎉 What's New
- [List new features]
- [List improvements]
- [List fixes]

## 🐛 Bug Fixes
- [List fixed bugs]
- [List improvements to existing features]

## 📦 Installation

Download the latest installer: **EyerFlow-1.0.4.exe**

### For Existing Users
Auto-update will be available within 2 minutes of this release.
- Keep the app open to receive update notification
- Click "Download" when prompted
- Click "Install & Restart" to complete the update

### For New Installation
1. Download: `EyerFlow-1.0.4.exe`
2. Run the installer
3. Follow the installation wizard

## ⚙️ Technical Details
- **Version**: 1.0.4
- **Release Date**: April 20, 2024
- **Platform**: Windows x64
- **Python Backend**: Included
- **Frontend**: React + Vite

## 📋 Requirements
- Windows 10 or later (x64)
- 500 MB free disk space
- .NET Framework (included in installer)

## ✅ What's Included
- Auto-update system
- Desktop app with native menus
- SQLite database
- Python backend server
- React frontend

## 🆘 Having Issues?

### Update Not Appearing?
1. Ensure the app is **fully closed**
2. Relaunch the app
3. Check for notification (may take up to 2 minutes)

### Need Support?
- Check logs: `%APPDATA%\EyerFlow\logs\main.log`
- Report issues: [GitHub Issues Link]
- Previous versions: [Releases Page]

## 📝 Release Notes Detail

[Add detailed information about what changed]

---

## Assets Upload Checklist

When publishing this release, upload these files as assets:

- [ ] `EyerFlow-1.0.4.exe` (Main installer)
- [ ] `latest.yml` (Metadata file - **CRITICAL**)
- [ ] `EyerFlow-1.0.4.exe.blockmap` (Binary diff file)

⚠️ **Without latest.yml, auto-update will NOT work!**

### How to Upload
1. Click "Attach binaries by dropping them here or selecting them"
2. Select the three files listed above
3. Verify all three files appear in "Assets" section

---

## Quality Assurance

Before publishing, verify:

- [ ] Version in package.json is `1.0.4`
- [ ] Tag is `v1.0.4` (matches version)
- [ ] `npm run build` completed without errors
- [ ] All three files exist in `dist/` folder
- [ ] Release is NOT marked as draft
- [ ] Release notes describe changes accurately

---

## Publish Steps

1. **Write Release Notes** using template above
2. **Upload Assets**:
   - `dist/EyerFlow-1.0.4.exe`
   - `dist/latest.yml`
   - `dist/EyerFlow-1.0.4.exe.blockmap`
3. **Verify**:
   - All 3 files in Assets section
   - Not marked as draft
4. **Publish** the release
5. **Wait** ~2 minutes for GitHub CDN propagation
6. **Test**: Try update on test machine

---

## Version History Reference

Keep this format for all releases for consistency:

- v1.0.4 - 2024-04-20
- v1.0.3 - 2024-04-15
- v1.0.2 - 2024-04-10
- v1.0.1 - 2024-04-05
- v1.0.0 - 2024-04-01

---

## Auto-Update Timeline

Once published:
- **0-2 min**: Release becomes available on GitHub
- **2-5 min**: User's running app detects update
- **5+ min**: Download starts (if user clicks Download)
- **+duration**: Download completes (size/speed dependent)
- **+install**: App restarts and installs update

---

## Important Notes

1. **No Auto-Download**: Users must click "Download" first
2. **No Auto-Install**: Users must click "Install & Restart"
3. **Background**: Update checks happen 2 seconds after app starts
4. **Logs**: All update activity logged to `%APPDATA%\EyerFlow\logs\main.log`
5. **Data Safe**: Database and settings are preserved during update

---

## Emergency Rollback

If release has critical bugs:

1. Delete the bad release on GitHub
2. Users keep previous version (won't update)
3. Create new patch release (e.g., 1.0.4 → 1.0.5)
4. Users will get update notification with new version

---

## Frequently Published Info

Copy this into release description every time:

```
## System Requirements
- Windows 10 or later (64-bit)
- 500 MB available disk space
- Internet connection for auto-updates

## Security
- All downloads verified via SHA-512 checksums
- Installer is signed and validated
- Auto-update checks GitHub for authenticity

## Telemetry
- No data collection or telemetry
- All operations are local and private
- Database never leaves your computer
```

---

**Generated**: April 20, 2024  
**Template Version**: 1.0  
**For**: EyerFlow v1.0.4+
