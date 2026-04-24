import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.security import get_password_hash
from backend.database import Base, SessionLocal, engine
from backend.initDb import apply_startup_migrations
from backend.models import OwnerShare, User
from backend.routes import (
    accounting,
    attendance,
    auth,
    employees,
    expenses,
    finance,
    hr_payments,
    leaves,
    partners,
    payroll,
    products,
    reports,
    sales,
    settings,
    users,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("inventory-api")

app = FastAPI(title="Inventory API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    # "null" covers Electron's file:// origin in production builds
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "null"],
    allow_origin_regex=r"file://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
        return response
    except Exception:
        logger.exception("Unhandled API error")
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def seed_owner_user():
    db: Session = SessionLocal()
    try:
        defaults = [
            {"name": "Owner Admin", "email": "owner@eyerflow.com", "password": "owner123", "role": "owner"},
            {"name": "Staff User", "email": "staff@eyerflow.com", "password": "staff123", "role": "staff"},
        ]
        for item in defaults:
            user = db.query(User).filter(User.email == item["email"]).first()
            if not user:
                # Only create if truly missing (migration didn't find old user either)
                db.add(
                    User(
                        username=item["email"],
                        name=item["name"],
                        email=item["email"],
                        hashed_password=get_password_hash(item["password"]),
                        role=item["role"],
                        status="active",
                        is_active=True,
                    )
                )
            # Existing users: do NOT touch password or any other field
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
    Base.metadata.create_all(bind=engine)
    apply_startup_migrations()
    seed_owner_user()


app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(accounting.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(partners.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
# HR Module
app.include_router(employees.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(leaves.router, prefix="/api")
app.include_router(payroll.router, prefix="/api")
app.include_router(hr_payments.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}
