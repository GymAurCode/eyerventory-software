#!/usr/bin/env python
"""
Entry point for PyInstaller to build the backend executable.
This script starts the FastAPI application with uvicorn.
"""

import sys
from pathlib import Path

# Add the project root to the path so imports work correctly
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.main import app
import uvicorn


def main():
    """Start the FastAPI application."""
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )


if __name__ == "__main__":
    main()
