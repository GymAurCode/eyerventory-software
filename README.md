# EyerFlow

Production Inventory Management System — desktop app with FastAPI backend, React frontend, and Electron shell.

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **Virtual environment** at `venv/` or `venv_311/`

## Quick Start

```bash
# 1. Copy environment file (edit with your keys)
cp .env.example .env

# 2. Install Python dependencies
venv_311\Scripts\pip install -r requirements.txt

# 3. Install Node dependencies
npm install
npm --prefix frontend install

# 4. Run (backend + frontend + Electron)
```

Or run only the web UI without Electron:

```bash
npm run dev
```
npm run electron

This starts the FastAPI backend on `http://127.0.0.1:8000` and the Vite frontend on `http://localhost:5173`.

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI assistant |
| `LICENSE_SERVER_URL` | License validation server URL |
| `VITE_LICENSE_SERVER_URL` | Same URL, exposed to Vite frontend |
| `LICENSE_SECRET` | HMAC signing secret for license tokens |
| `LICENSE_ADMIN_SECRET` | Admin password for license endpoints |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Backend + frontend (no Electron) |
| `npm run electron` | Backend + frontend + Electron desktop window |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:backend` | Backend only |
| `npm run build` | Build for distribution (frontend + backend + electron-builder) |

## Project Structure

```
├── backend/          # FastAPI Python API
│   ├── ai/           # AI / ML modules
│   ├── models/       # SQLAlchemy models
│   ├── routes/       # API route handlers
│   ├── schemas/      # Pydantic schemas
│   ├── services/     # Business logic
│   └── main.py       # App entry point
├── frontend/         # React + Vite SPA
│   └── src/          # React components & pages
├── electron/         # Electron main process
│   ├── main.js       # Window management
│   └── preload.js    # Context bridge
├── scripts/          # Build & utility scripts
└── package.json      # Root orchestration scripts
```

## Database

SQLite. The database file (`inventory.db`) is auto-created in the project root during development. Migrations run automatically on startup via `backend/initDb.py`.
