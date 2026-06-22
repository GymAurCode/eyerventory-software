const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Resolve Python from the local venv (works on any machine)
const projectRoot = path.join(__dirname, "..");
const pythonWin = path.join(projectRoot, ".venv", "Scripts", "python.exe");
const pythonUnix = path.join(projectRoot, ".venv", "bin", "python");
const python = fs.existsSync(pythonWin) ? pythonWin : pythonUnix;

if (!fs.existsSync(python)) {
  console.error(`\nPython venv not found. Expected at:\n  ${pythonWin}\n\nRun: python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt`);
  process.exit(1);
}

const requiredPackages = [
  "uvicorn",
  "fastapi",
  "sqlalchemy",
  "pydantic",
  "passlib",
  "jose",
  "reportlab",
  "xlsxwriter",
  "email_validator",
];

console.log(`Using Python: ${python}`);
console.log("Checking backend dependencies...");

const check = spawnSync(
  python,
  ["-c", `import ${requiredPackages.join(",")}`],
  { stdio: "inherit" }
);

if (check.error || check.status !== 0) {
  console.error(
    `\nThe selected Python interpreter cannot import all backend dependencies.\n` +
      `Ensure the venv at ${python} has the requirements from requirements.txt installed.`
  );
  process.exit(1);
}

console.log("\n========== Building backend.exe ==========");
const backendArgs = [
  "-m", "PyInstaller",
  "--noconfirm",
  "--distpath", "dist/backend",
  "backend.spec"
];
const backendResult = spawnSync(python, backendArgs, { stdio: "inherit" });

if (backendResult.error) {
  console.error("Backend build error:", backendResult.error);
  process.exit(1);
}

if (backendResult.status !== 0) {
  console.error("Backend build failed with status:", backendResult.status);
  process.exit(backendResult.status);
}

console.log("✓ backend.exe built successfully");

// Build license_service.exe if license_service directory exists
const licenseServiceDir = path.join(projectRoot, "license_service");
if (fs.existsSync(licenseServiceDir)) {
  console.log("\n========== Building license_service.exe ==========");
  
  const licenseArgs = [
    "-m", "PyInstaller",
    "--noconfirm",
    "--distpath", "dist/backend",
    "license_service.spec"
  ];
  const licenseResult = spawnSync(python, licenseArgs, { stdio: "inherit" });

  if (licenseResult.error) {
    console.error("License service build error:", licenseResult.error);
    process.exit(1);
  }

  if (licenseResult.status !== 0) {
    console.error("License service build failed with status:", licenseResult.status);
    process.exit(licenseResult.status);
  }

  console.log("✓ license_service.exe built successfully");
} else {
  console.log("\n⚠ license_service directory not found, skipping license_service.exe build");
}

console.log("\n========== Build Complete ==========");
console.log("Output directory: dist/backend/");
process.exit(0);
