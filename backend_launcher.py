"""
PyInstaller entry point for the backend server.
Imports the app object directly (not as a string) so uvicorn
doesn't need dynamic module loading, which breaks in frozen builds.
"""
import os
import sys

# Ensure _MEIPASS is on path before any backend imports
if hasattr(sys, "_MEIPASS") and sys._MEIPASS not in sys.path:
    sys.path.insert(0, sys._MEIPASS)

import uvicorn
from backend.main import app  # noqa: E402  direct import — no string lookup

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8000"))
    uvicorn.run(
        app,                  # pass object, not "backend.main:app" string
        host="127.0.0.1",
        port=port,
        log_level="info",
    )
