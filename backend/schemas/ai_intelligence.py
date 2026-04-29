from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class DuplicateCheckRequest(BaseModel):
    product_name: str
    sku: Optional[str] = None


class SimilarProduct(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    category: Optional[str]
    similarity: float


class DuplicateCheckResponse(BaseModel):
    success: bool
    is_duplicate_risk: bool
    exact_duplicate: bool
    similar_products: List[SimilarProduct]
    message: str


class LowStockProduct(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    category: Optional[str]
    stock: int
    threshold: int
    selling_price: float
    cost_price: float


class LowStockResponse(BaseModel):
    success: bool
    count: int
    threshold: int
    products: List[LowStockProduct]


class AIQueryRequest(BaseModel):
    query: str


class AIQueryResponse(BaseModel):
    success: bool
    intent: str
    description: str
    data: Any
    suggestions: List[str] = []


class StockAnalysis(BaseModel):
    total_products: int
    total_stock_value: float
    value_by_category: List[Dict[str, Any]]


class DuplicateRisk(BaseModel):
    count: int
    risks: List[Dict[str, Any]]


class LowStockAnalysis(BaseModel):
    count: int
    products: List[LowStockProduct]
    threshold: int


class AIInsights(BaseModel):
    low_stock: LowStockAnalysis
    duplicate_risks: DuplicateRisk
    stock_analysis: StockAnalysis
    timestamp: Any


class AIInsightsResponse(BaseModel):
    success: bool
    insights: AIInsights


class DashboardAlert(BaseModel):
    type: str
    count: int
    message: str


class DashboardSummaryResponse(BaseModel):
    success: bool
    low_stock_count: int
    duplicate_risks: int
    total_products: int
    total_stock_value: float
    recent_alerts: List[DashboardAlert]