"""
Admin utility: seed a license key into the license DB.
Usage:
    python scripts/seed-license.py <license_key> [expiry_date YYYY-MM-DD]

Example:
    python scripts/seed-license.py EYRF-2024-ABCD-1234
    python scripts/seed-license.py EYRF-2024-ABCD-1234 2027-01-01
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Point at the userData license DB (same path Electron uses)
import pathlib
userdata = pathlib.Path.home() / "AppData" / "Roaming" / "EyerFlow"
userdata.mkdir(parents=True, exist_ok=True)
os.environ["LICENSE_DB_PATH"] = str(userdata / "license.db")

from license_service.database import Base, SessionLocal, engine
from license_service.service import seed_license, _ADMIN_SECRET

Base.metadata.create_all(bind=engine)

key = sys.argv[1] if len(sys.argv) > 1 else "EYRF-0000-TEST-0001"
expiry = sys.argv[2] if len(sys.argv) > 2 else None

db = SessionLocal()
try:
    result = seed_license(db, key, _ADMIN_SECRET, expiry_date=expiry)
    print(f"Created license: {result}")
except ValueError as e:
    print(f"Error: {e}")
finally:
    db.close()
