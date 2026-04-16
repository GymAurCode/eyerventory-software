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
from backend.routes import auth, expenses, finance, partners, products, reports, sales, settings, users

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
            {"name": "Owner Admin", "email": "owner@inventory.local", "password": "owner123", "role": "owner"},
            {"name": "Staff User", "email": "staff@inventory.local", "password": "staff123", "role": "staff"},
        ]
        for item in defaults:
            user = db.query(User).filter(User.email == item["email"]).first()
            hashed = get_password_hash(item["password"])
            if not user:
                db.add(
                    User(
                        username=item["email"],
                        name=item["name"],
                        email=item["email"],
                        hashed_password=hashed,
                        role=item["role"],
                        status="active",
                        is_active=True,
                    )
                )
            else:
                user.username = item["email"]
                user.name = item["name"]
                user.email = item["email"]
                user.hashed_password = hashed
                user.role = item["role"]
                user.status = "active"
                user.is_active = True
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
app.include_router(users.router, prefix="/api")
app.include_router(partners.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}
