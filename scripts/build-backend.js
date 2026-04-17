const { spawnSync } = require("child_process");

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

const args = [
  "-m", "PyInstaller",
  "--onefile",
  "--noconfirm",
  "--runtime-hook", "pyinstaller_hooks/runtime_hook.py",
  "backend/main.py",
  "--distpath", "dist/backend",
  "--name", "backend"
];
const result = spawnSync(python, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status);
