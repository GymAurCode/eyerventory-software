const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const python = "D:\\inventroy-system\\eyerventory-software\\venv\\Scripts\\python.exe";
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

console.log("\n========== Building Main Backend (backend.exe) ==========");
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

console.log("\n========== Building License Service (license_service.exe) ==========");
const licenseArgs = [
  "-m", "PyInstaller",
  "--noconfirm",
  "--distpath", "dist/license_service",
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

console.log("\n========== Build Complete ==========");
console.log("Backend executable:", path.join("dist", "backend", "backend.exe"));
console.log("License service executable:", path.join("dist", "license_service", "license_service.exe"));

// Verify both executables exist
const backendExe = path.join("dist", "backend", "backend.exe");
const licenseExe = path.join("dist", "license_service", "license_service.exe");

if (!fs.existsSync(backendExe)) {
  console.error("\nERROR: backend.exe was not created!");
  process.exit(1);
}

if (!fs.existsSync(licenseExe)) {
  console.error("\nERROR: license_service.exe was not created!");
  process.exit(1);
}

console.log("\n✓ Both executables built successfully");
process.exit(0);
