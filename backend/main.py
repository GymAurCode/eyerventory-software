import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from backend.database import Base, engine
from backend.initDb import apply_startup_migrations
from backend.routes import (
    accounting,
    attendance,
    auth,
    credit,
    employees,
    expenses,
    finance,
    hr_payments,
    leaves,
    partners,
    payments,
    payroll,
    products,
    purchases,
    reports,
    sales,
    settings,
    users,
    ai_intelligence,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("inventory-api")

app = FastAPI(title="Inventory API", version="1.0.0")

# CORS must be added before any middleware or exception handlers so that
# error responses also carry the correct headers.
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "null"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"file://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict:
    """Return CORS headers matching the request origin so error responses aren't blocked."""
    origin = request.headers.get("origin", "")
    allowed = origin if origin in CORS_ORIGINS else (CORS_ORIGINS[0] if CORS_ORIGINS else "*")
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Credentials": "true",
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
    except Exception as exc:
        logger.exception("Unhandled middleware error")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
            headers=_cors_headers(request),
        )


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    # Run file-based migrations then seed default data
    apply_startup_migrations()
    # Create any tables still missing (safety net for models not yet in migrations)
    Base.metadata.create_all(bind=engine)
    # Dispose the connection pool so all subsequent requests get fresh connections
    # that reflect the final schema — avoids stale "no such column" errors.
    engine.dispose()


# ── Routes ────────────────────────────────────────────────────────────────────

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
app.include_router(purchases.router, prefix="/api")
app.include_router(credit.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(leaves.router, prefix="/api")
app.include_router(payroll.router, prefix="/api")
app.include_router(hr_payments.router, prefix="/api")
app.include_router(ai_intelligence.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}
