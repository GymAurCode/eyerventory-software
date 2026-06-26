import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.services import import_export_service

router = APIRouter(prefix="/io", tags=["import-export"])


@router.get("/templates")
def list_templates():
    return {"templates": list(import_export_service.IMPORT_TEMPLATES.keys())}


@router.get("/templates/{template_key}/columns")
def get_template_columns(template_key: str):
    tpl = import_export_service.IMPORT_TEMPLATES.get(template_key)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{template_key}' not found")
    return tpl


@router.post("/import/validate")
def validate_import(
    file: UploadFile = File(...),
    template_key: str = Form(...),
):
    try:
        rows, columns = import_export_service.parse_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    result = import_export_service.validate_import_rows(rows, template_key)
    return {
        "columns": columns,
        "template": template_key,
        **result,
    }


@router.post("/import/execute")
def execute_import(
    file: UploadFile = File(...),
    template_key: str = Form(...),
    dry_run: bool = Form(False),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    try:
        rows, columns = import_export_service.parse_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    result = import_export_service.validate_import_rows(rows, template_key)
    if not result["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Validation failed", "errors": result["errors"]},
        )

    return import_export_service.import_validated_rows(db, template_key, result["rows"], dry_run=dry_run)


@router.get("/export/{data_type}")
def export_data(
    data_type: str,
    format: str = Query("csv"),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    if data_type == "products":
        columns, rows = import_export_service.get_products_export_rows(db)
    elif data_type == "warehouse_stock":
        columns, rows = import_export_service.get_warehouse_export_rows(db)
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown data type: {data_type}")

    if format == "csv":
        content = import_export_service.export_to_csv(columns, rows)
        return Response(content=content, media_type="text/csv",
                        headers={"Content-Disposition": f"attachment; filename={data_type}.csv"})
    elif format in ("xlsx", "excel"):
        content = import_export_service.export_to_excel(columns, rows, sheet_name=data_type)
        return Response(content=content, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f"attachment; filename={data_type}.xlsx"})
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported format: {format}")
