const { spawnSync } = require("child_process");

const python = process.env.PYTHON_EXECUTABLE || "python";
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
      `Set PYTHON_EXECUTABLE to a Python install with the requirements from requirements.txt.`
  );
  process.exit(1);
}

const args = ["-m", "PyInstaller", "backend.spec"];
const result = spawnSync(python, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status);
