import os
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def _resolve_db_path() -> str:
    """
    Resolve the database path with the following priority:
    1. DB_PATH environment variable (set by Electron before spawning the exe)
    2. Alongside the executable (works for PyInstaller one-file builds)
    3. Current working directory fallback
    """
    env_path = os.getenv("DB_PATH")
    if env_path:
        # Ensure the parent directory exists
        Path(env_path).parent.mkdir(parents=True, exist_ok=True)
        return env_path

    # When frozen by PyInstaller, use the directory of the exe itself
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).parent
        return str(exe_dir / "inventory.db")

    return os.path.join(os.getcwd(), "inventory.db")


DB_PATH = _resolve_db_path()
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
