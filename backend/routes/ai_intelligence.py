from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.ai_intelligence_service import AIIntelligenceService
from backend.schemas.ai_intelligence import (
    AIQueryRequest,
    AIQueryResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    LowStockResponse,
    AIInsightsResponse
)

router = APIRouter(prefix="/ai", tags=["AI Intelligence"])


@router.get("/low-stock", response_model=LowStockResponse)
def get_low_stock_products(db: Session = Depends(get_db)):
    """Get low stock products"""
    ai_service = AIIntelligenceService(db)
    products = ai_service.get_low_stock_products()
    return {
        "success": True,
        "count": len(products),
        "threshold": ai_service.low_stock_threshold,
        "products": products
    }


@router.get("/duplicates")
def get_duplicate_products(db: Session = Depends(get_db)):
    """Get potential duplicate products"""
    from backend.models.product import Product
    
    # Get all products and find duplicates
    all_products = db.query(Product).all()
    duplicates = []
    
    # Simple duplicate detection by name (case-insensitive)
    seen_names = set()
    for product in all_products:
        name_lower = product.name.lower()
        if name_lower in seen_names:
            duplicates.append({
                "id": product.id,
                "name": product.name,
                "sku": product.sku,
                "category": product.category
            })
        else:
            seen_names.add(name_lower)
    
    return {
        "success": True,
        "count": len(duplicates),
        "duplicates": duplicates
    }


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate_risk(
    request: DuplicateCheckRequest,
    db: Session = Depends(get_db)
):
    """Check if a product might be a duplicate"""
    ai_service = AIIntelligenceService(db)
    result = ai_service.check_duplicate_risk(
        product_name=request.product_name,
        sku=request.sku
    )
    
    return {
        "success": True,
        "is_duplicate_risk": result["is_duplicate_risk"],
        "exact_duplicate": result.get("exact_duplicate", False),
        "similar_products": result.get("similar_products", []),
        "message": result.get("message", "")
    }


@router.get("/insights", response_model=AIInsightsResponse)
def get_ai_insights(db: Session = Depends(get_db)):
    """Get comprehensive AI insights"""
    ai_service = AIIntelligenceService(db)
    insights = ai_service.get_ai_insights()
    
    return {
        "success": True,
        "insights": insights
    }


@router.post("/query", response_model=AIQueryResponse)
def process_natural_query(
    request: AIQueryRequest,
    db: Session = Depends(get_db)
):
    """Process natural language query"""
    ai_service = AIIntelligenceService(db)
    result = ai_service.process_natural_query(request.query)
    
    return {
        "success": True,
        "intent": result["intent"],
        "description": result["description"],
        "data": result["data"],
        "suggestions": result.get("suggestions", [])
    }


@router.get("/dashboard-summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Get AI summary for dashboard widget"""
    ai_service = AIIntelligenceService(db)
    
    low_stock_count = ai_service.get_low_stock_count()
    insights = ai_service.get_ai_insights()
    
    return {
        "success": True,
        "low_stock_count": low_stock_count,
        "duplicate_risks": insights["duplicate_risks"]["count"],
        "total_products": insights["stock_analysis"]["total_products"],
        "total_stock_value": insights["stock_analysis"]["total_stock_value"],
        "recent_alerts": [
            {
                "type": "low_stock",
                "count": low_stock_count,
                "message": f"{low_stock_count} products below threshold"
            },
            {
                "type": "duplicate_risk",
                "count": insights["duplicate_risks"]["count"],
                "message": f"{insights['duplicate_risks']['count']} potential duplicates"
            }
        ]
    }