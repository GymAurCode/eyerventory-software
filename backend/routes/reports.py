from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/data")
def report_data(
    report_type: str = Query(pattern="^(products|sales|expenses|finance|partner_profit)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        payload = report_service.get_report_payload(db, report_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return payload


@router.get("/export")
def export_report(
    report_type: str = Query(pattern="^(products|sales|expenses|finance|partner_profit)$"),
    fmt: str = Query(pattern="^(excel)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        data = report_service.generate_excel(db, report_type)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{report_type}.xlsx"
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
