"""
PyInstaller entry point for the backend server.
Imports the app object directly (not as a string) so uvicorn
doesn't need dynamic module loading, which breaks in frozen builds.
"""
import os
import sys
import logging

# Set up logging for frozen builds
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Ensure _MEIPASS is on path before any backend imports
if hasattr(sys, "_MEIPASS") and sys._MEIPASS not in sys.path:
    sys.path.insert(0, sys._MEIPASS)
    logging.info(f"Added _MEIPASS to sys.path: {sys._MEIPASS}")

try:
    import uvicorn
    from backend.main import app  # noqa: E402  direct import — no string lookup
    logging.info("Backend imports successful")
except Exception as e:
    logging.error(f"Failed to import backend modules: {e}")
    sys.exit(1)

if __name__ == "__main__":
    try:
        port = int(os.environ.get("BACKEND_PORT", "8000"))
        logging.info(f"Starting backend on port {port}")
        uvicorn.run(
            app,                  # pass object, not "backend.main:app" string
            host="127.0.0.1",
            port=port,
            log_level="info",
        )
    except Exception as e:
        logging.error(f"Failed to start backend: {e}")
        sys.exit(1)
