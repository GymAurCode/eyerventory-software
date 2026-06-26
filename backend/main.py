import logging
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=_env_path, override=False)
except ImportError:
    pass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.core.security import get_password_hash
from backend.database import Base, SessionLocal, engine
from backend.initDb import apply_startup_migrations
from backend.models.user import User
from backend.models.owner_share import OwnerShare
from backend.routes import (
    accounting, activities, ai, attendance, auth, credits, customers, devices,
    employees, expenses, finance, hr_payments, import_export, ledger, leaves, partners, payments,
    payroll, pos, product_add, products, purchases, reminders, reports, sales, settings,
    suppliers, users, warehouses,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("inventory-api")

app = FastAPI(title="Inventory API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS — allow_origins=["*"] is required for WebSocket upgrades from Electron.
# Electron sends Origin: null (file:// context) which CORSMiddleware rejects
# when using an explicit origins list. Using "*" makes the middleware skip
# the origin check entirely, which also fixes WS handshake 403s.
# Note: allow_credentials must be False when allow_origins=["*"].
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict:
    """Return CORS headers for error responses."""
    return {
        "Access-Control-Allow-Origin": "*",
    }


# ── Global error handler ──────────────────────────────────────────────────────
# NOTE: This handler fires AFTER the CORS middleware processes the request,
# but the response it returns bypasses the middleware's response processing.
# We manually attach CORS headers so the browser can read the error body.

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": str(exc)},
        headers=_cors_headers(request),
    )


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
        return response
    except Exception:
        import traceback as _tb
        _trace = _tb.format_exc()
        logger.exception("Unhandled API error on %s %s:\n%s", request.method, request.url.path, _trace)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "traceback": _trace},
        )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router,       prefix="/api")
app.include_router(product_add.router, prefix="/api")
app.include_router(products.router,   prefix="/api")
app.include_router(purchases.router,  prefix="/api")
app.include_router(sales.router,      prefix="/api")
app.include_router(customers.router,  prefix="/api")
app.include_router(suppliers.router,  prefix="/api")
app.include_router(credits.router,    prefix="/api")
app.include_router(ledger.router,     prefix="/api")
app.include_router(expenses.router,   prefix="/api")
app.include_router(finance.router,    prefix="/api")
app.include_router(accounting.router, prefix="/api")
app.include_router(users.router,      prefix="/api")
app.include_router(partners.router,   prefix="/api")
app.include_router(settings.router,   prefix="/api")
app.include_router(reports.router,    prefix="/api")
app.include_router(employees.router,  prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(leaves.router,     prefix="/api")
app.include_router(payroll.router,    prefix="/api")
app.include_router(hr_payments.router,prefix="/api")
app.include_router(payments.router,   prefix="/api")
app.include_router(ai.router,         prefix="/api")
app.include_router(reminders.router,  prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(pos.router,        prefix="/api")
app.include_router(devices.router,        prefix="/api")
app.include_router(warehouses.router,    prefix="/api")
app.include_router(import_export.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
def seed_owner_user():
    db: Session = SessionLocal()
    try:
        defaults = [
            {"name": "Owner Admin", "email": "owner@eyerflow.com", "password": "owner123", "role": "owner"},
            {"name": "Staff User",  "email": "staff@eyerflow.com",  "password": "staff123",  "role": "staff"},
        ]
        for item in defaults:
            user = db.query(User).filter(User.email == item["email"]).first()
            if not user:
                db.add(User(
                    username=item["email"], name=item["name"], email=item["email"],
                    hashed_password=get_password_hash(item["password"]),
                    role=item["role"], status="active", is_active=True,
                ))
        db.flush()
        owners = db.query(User).filter(User.role == "owner").all()
        for owner in owners:
            if not db.query(OwnerShare).filter(OwnerShare.user_id == owner.id).first():
                db.add(OwnerShare(user_id=owner.id, ownership_percentage=100.0 / len(owners)))
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    # create_all FIRST so all tables exist before migrations try to alter them
    Base.metadata.create_all(bind=engine)
    apply_startup_migrations()
    seed_owner_user()
    from backend.services.reminder_scheduler import start_scheduler
    start_scheduler()
    from backend.services.backup_service import resume_on_startup
    resume_on_startup()


@app.on_event("shutdown")
def on_shutdown():
    from backend.services.reminder_scheduler import stop_scheduler
    stop_scheduler()
