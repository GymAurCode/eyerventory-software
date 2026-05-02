#!/usr/bin/env python
"""
Entry point for PyInstaller to build the license_service executable.
This script starts the License Service FastAPI application with uvicorn.
"""

import sys
import os
import logging
from pathlib import Path

# Add the license_service directory to the path
license_service_dir = Path(__file__).parent / "license_service"
sys.path.insert(0, str(license_service_dir))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("license-service-launcher")

# Log the environment
license_db_path = os.getenv("LICENSE_DB_PATH", "<not set>")
logger.info(f"[launcher] LICENSE_DB_PATH env = {license_db_path}")
logger.info(f"[launcher] sys.executable = {sys.executable}")
logger.info(f"[launcher] frozen = {getattr(sys, 'frozen', False)}")

from main import app
import uvicorn


def main():
    """Start the License Service FastAPI application."""
    # Get port from environment or use default 8001
    port = int(os.getenv("LICENSE_PORT", "8001"))
    logger.info(f"[launcher] starting license service on port {port}")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
