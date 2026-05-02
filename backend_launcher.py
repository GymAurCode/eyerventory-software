#!/usr/bin/env python
"""
Entry point for PyInstaller to build the backend executable.
This script starts the FastAPI application with uvicorn.
"""

import sys
import os
import logging
from pathlib import Path

# Add the project root to the path so imports work correctly
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backend-launcher")

# Log the DB path being used so it's visible in Electron logs
db_path = os.getenv("DB_PATH", "<not set — will auto-resolve>")
logger.info(f"[launcher] DB_PATH env = {db_path}")
logger.info(f"[launcher] sys.executable = {sys.executable}")
logger.info(f"[launcher] frozen = {getattr(sys, 'frozen', False)}")

from backend.main import app
import uvicorn


def main():
    """Start the FastAPI application."""
    # Re-log after imports so database.py has already resolved the path
    from backend.database import DB_PATH
    logger.info(f"[launcher] resolved DB_PATH = {DB_PATH}")

    # Get port from environment variable (set by Electron), default to 8000
    port = int(os.getenv("BACKEND_PORT", "8000"))
    logger.info(f"[launcher] starting on port {port}")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
