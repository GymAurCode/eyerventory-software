const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Resolve Python from the local venv (works on any machine)
const projectRoot = path.join(__dirname, "..");
const pythonWin = path.join(projectRoot, "venv", "Scripts", "python.exe");
const pythonUnix = path.join(projectRoot, "venv", "bin", "python");
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

const args = [
  "-m", "PyInstaller",
  "--noconfirm",
  "--distpath", "dist/backend",
  "backend.spec"
];
const result = spawnSync(python, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status);
