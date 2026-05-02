from fastapi import APIRouter, Depends, HTTPException, status
import logging
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.ai import (
    anomaly_service,
    nlp_service,
    prediction_service,
    reorder_service,
)
from backend.database import get_db
from backend.routes.deps import require_roles

router = APIRouter(prefix="/ai", tags=["ai-intelligence"])
logger = logging.getLogger("ai-routes")


class PredictPayload(BaseModel):
    horizon_days: int = Field(default=14, ge=1, le=90)


class QueryPayload(BaseModel):
    question: str = Field(min_length=3, max_length=500)


@router.post("/predict")
def predict(payload: PredictPayload, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    logger.info("POST /api/ai/predict horizon_days=%s", payload.horizon_days)
    try:
        result = prediction_service.predict_stock(db, payload.horizon_days)
        if isinstance(result, dict) and "data" in result:
            return result
        return {"data": result if isinstance(result, list) else [], "items": result if isinstance(result, list) else []}
    except Exception as exc:
        logger.exception("POST /api/ai/predict failed: %s", exc)
        raise


@router.get("/reorder")
def reorder(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    logger.info("GET /api/ai/reorder")
    try:
        result = reorder_service.suggest_reorders(db)
        if isinstance(result, dict) and "data" in result:
            return result
        return {"data": result if isinstance(result, list) else [], "items": result if isinstance(result, list) else []}
    except Exception as exc:
        logger.exception("GET /api/ai/reorder failed: %s", exc)
        raise


@router.get("/anomaly")
def anomaly(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    logger.info("GET /api/ai/anomaly")
    try:
        result = anomaly_service.detect_anomalies(db)
        if isinstance(result, dict) and "data" in result:
            return result
        return {"data": result if isinstance(result, list) else [], "items": result if isinstance(result, list) else []}
    except Exception as exc:
        logger.exception("GET /api/ai/anomaly failed: %s", exc)
        raise


@router.post("/query")
def query(payload: QueryPayload, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    logger.info("POST /api/ai/query question=%s", payload.question)
    try:
        out = nlp_service.execute_nl_query(db, payload.question)
        return out
    except ValueError as exc:
        logger.exception("POST /api/ai/query validation error: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/health")
def ai_health(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    def check(fn):
        try:
            fn()
            return "ok"
        except Exception:
            return "error"

    return {
        "status": "ok",
        "prediction": check(lambda: prediction_service.predict_stock(db, 7)),
        "reorder": check(lambda: reorder_service.suggest_reorders(db)),
        "anomaly": check(lambda: anomaly_service.detect_anomalies(db)),
        "nlp": check(lambda: nlp_service.execute_nl_query(db, "low stock")),
    }
