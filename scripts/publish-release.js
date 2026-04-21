#!/usr/bin/env node

/**
 * EyerFlow Auto-Update Release Publisher
 * 
 * This script assists with publishing a new release to GitHub.
 * It validates the build artifacts and provides instructions for GitHub.
 * 
 * Usage: node scripts/publish-release.js [version]
 * Example: node scripts/publish-release.js 1.0.4
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, msg) {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function checkFile(filePath, label) {
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    const sizeStr = (size / (1024 * 1024)).toFixed(2);
    log("green", `✓ ${label}: ${path.basename(filePath)} (${sizeStr} MB)`);
    return true;
  } else {
    log("red", `✗ ${label}: MISSING - ${filePath}`);
    return false;
  }
}

function main() {
  log("cyan", "=========================================");
  log("cyan", "  EyerFlow Auto-Update Release Check");
  log("cyan", "=========================================\n");

  // Read package.json version
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
  const version = packageJson.version;

  log("blue", `Current Package Version: ${version}\n`);

  // Check if dist folder exists
  const distDir = path.join(__dirname, "..", "dist");
  if (!fs.existsSync(distDir)) {
    log(
      "red",
      "ERROR: dist/ folder not found!"
    );
    log("yellow", "Run: npm run build");
    process.exit(1);
  }

  // Check for required files
  log("blue", "Checking build artifacts...\n");
  const requiredFiles = [
    {
      path: path.join(distDir, `EyerFlow-${version}.exe`),
      label: "Installer",
    },
    {
      path: path.join(distDir, "latest.yml"),
      label: "Metadata (latest.yml)",
    },
    {
      path: path.join(distDir, `EyerFlow-${version}.exe.blockmap`),
      label: "Blockmap",
    },
  ];

  let allFilesExist = true;
  const filesToUpload = [];

  for (const file of requiredFiles) {
    if (checkFile(file.path, file.label)) {
      filesToUpload.push(file.path);
    } else {
      allFilesExist = false;
    }
  }

  log("blue", "\n");

  if (!allFilesExist) {
    log("red", "ERROR: Missing required files!");
    log("yellow", "\nPlease run: npm run build");
    process.exit(1);
  }

  // All files exist - show instructions
  log("green", "✓ All required files are present!\n");

  log("blue", "========== GITHUB RELEASE CHECKLIST ==========\n");

  log("cyan", "1. CREATE GITHUB RELEASE:");
  log("yellow", `   Tag: v${version}`);
  log("yellow", `   Title: Version ${version}`);
  log("yellow", "   Release type: Release (NOT draft)\n");

  log("cyan", "2. UPLOAD THESE FILES AS ASSETS:\n");
  filesToUpload.forEach((file) => {
    const filename = path.basename(file);
    const size = (fs.statSync(file).size / (1024 * 1024)).toFixed(2);
    log("yellow", `   • ${filename} (${size} MB)`);
  });

  log("cyan", "\n3. VERIFY ON GITHUB:");
  log("yellow", "   • Release is NOT marked as draft");
  log("yellow", "   • Tag matches version (v" + version + ")");
  log("yellow", "   • All three files are uploaded");
  log("yellow", "   • Files are visible in release assets\n");

  log("cyan", "4. TEST UPDATE DETECTION:");
  log("yellow", "   • Install previous app version");
  log("yellow", "   • Launch installed app");
  log("yellow", "   • Check logs: %APPDATA%\\EyerFlow\\logs\\main.log");
  log(
    "yellow",
    "   • Look for: [updater] UPDATE AVAILABLE with version " + version
  );
  log("yellow", "   • Click 'Download' in notification");
  log("yellow", "   • Click 'Install & Restart' when done\n");

  log("cyan", "5. GITHUB RELEASE URL:");
  log("yellow", `   https://github.com/GymAurCode/eyerflow-software/releases/tag/v${version}\n`);

  // Optional: Check for GitHub token
  if (process.env.GH_TOKEN) {
    log("green", "✓ GitHub token found in environment (GH_TOKEN)");
    log("cyan", "   You can auto-publish using: npm run build\n");
  } else {
    log("yellow", "⚠ GitHub token not set (GH_TOKEN)");
    log("cyan", "   For automatic publishing, set: set GH_TOKEN=your_token");
    log("cyan", "   Then run: npm run build\n");
  }

  log("green", "========================================");
  log("green", "  Release artifacts are ready!");
  log("green", "========================================\n");
}

main();
