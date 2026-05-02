import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.models.product import Product
from backend.models.sale import Sale

logger = logging.getLogger("inventory-ai")

# Import rapidfuzz for fuzzy matching if available, fallback to difflib
try:
    from rapidfuzz import fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    import difflib
    HAS_RAPIDFUZZ = False
    logger.warning("rapidfuzz not installed, using difflib for fuzzy matching (slower)")


class AIIntelligenceService:
    """Lightweight AI Intelligence Engine for inventory system"""
    
    def __init__(self, db: Session):
        self.db = db
        self._load_settings()
    
    def _load_settings(self):
        """Load AI settings from database"""
        from backend.models.ai_setting import AISetting
        
        # Default settings
        self.low_stock_threshold = 5
        self.duplicate_similarity_threshold = 0.85
        self.enable_ai_duplicate_check = True
        self.enable_low_stock_alerts = True
        self.ai_cache_ttl_minutes = 5
        
        # Try to load from database
        try:
            settings = self.db.query(AISetting).all()
            for setting in settings:
                if setting.setting_key == 'low_stock_threshold':
                    self.low_stock_threshold = int(setting.setting_value)
                elif setting.setting_key == 'duplicate_similarity_threshold':
                    self.duplicate_similarity_threshold = float(setting.setting_value)
                elif setting.setting_key == 'enable_ai_duplicate_check':
                    self.enable_ai_duplicate_check = setting.setting_value.lower() == 'true'
                elif setting.setting_key == 'enable_low_stock_alerts':
                    self.enable_low_stock_alerts = setting.setting_value.lower() == 'true'
                elif setting.setting_key == 'ai_cache_ttl_minutes':
                    self.ai_cache_ttl_minutes = int(setting.setting_value)
        except Exception as e:
            logger.warning(f"Failed to load AI settings: {e}. Using defaults.")
    
    def set_low_stock_threshold(self, threshold: int):
        """Set the low stock threshold"""
        self.low_stock_threshold = threshold
    
    # --- Duplicate / Anomaly Detection ---
    
    def find_similar_products(self, product_name: str, min_similarity: float = None) -> List[Dict[str, Any]]:
        """
        Find products with similar names using fuzzy matching.
        Returns list of similar products with similarity scores.
        """
        if min_similarity is None:
            min_similarity = self.duplicate_similarity_threshold
            
        all_products = self.db.query(Product).all()
        similar = []
        
        for product in all_products:
            if HAS_RAPIDFUZZ:
                similarity = fuzz.ratio(product_name.lower(), product.name.lower()) / 100.0
            else:
                similarity = difflib.SequenceMatcher(
                    None, product_name.lower(), product.name.lower()
                ).ratio()
            
            if similarity >= min_similarity:
                similar.append({
                    "id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "category": product.category,
                    "similarity": round(similarity, 3)
                })
        
        # Sort by similarity (highest first)
        similar.sort(key=lambda x: x["similarity"], reverse=True)
        return similar
    
    def check_duplicate_risk(self, product_name: str, sku: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if a new product might be a duplicate.
        Returns risk assessment with similar products.
        """
        result = {
            "is_duplicate_risk": False,
            "similar_products": [],
            "exact_duplicate": False,
            "message": ""
        }
        
        # Check exact name match
        exact_match = self.db.query(Product).filter(
            func.lower(Product.name) == product_name.lower()
        ).first()
        
        if exact_match:
            result["exact_duplicate"] = True
            result["message"] = f"Exact duplicate found: {exact_match.name}"
            result["similar_products"].append({
                "id": exact_match.id,
                "name": exact_match.name,
                "sku": exact_match.sku,
                "similarity": 1.0
            })
            result["is_duplicate_risk"] = True
            return result
        
        # Check SKU match if provided
        if sku:
            sku_match = self.db.query(Product).filter(Product.sku == sku).first()
            if sku_match:
                result["is_duplicate_risk"] = True
                result["message"] = f"SKU already exists: {sku}"
                return result
        
        # Check fuzzy matches
        similar = self.find_similar_products(product_name)
        if similar:
            result["similar_products"] = similar
            result["is_duplicate_risk"] = True
            result["message"] = f"Found {len(similar)} similar product(s)"
        
        return result
    
    # --- Low Stock Intelligence ---
    
    def get_low_stock_products(self) -> List[Dict[str, Any]]:
        """
        Get products with stock at or below threshold.
        """
        products = self.db.query(Product).filter(
            Product.stock <= self.low_stock_threshold
        ).order_by(Product.stock.asc()).all()
        
        return [{
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "stock": p.stock,
            "threshold": self.low_stock_threshold,
            "selling_price": p.selling_price,
            "cost_price": p.cost_price
        } for p in products]
    
    def get_low_stock_count(self) -> int:
        """Get count of low stock products"""
        return self.db.query(Product).filter(
            Product.stock <= self.low_stock_threshold
        ).count()
    
    # --- Natural Language Query System ---
    
    def process_natural_query(self, query: str) -> Dict[str, Any]:
        """
        Process natural language query and map to appropriate function.
        Uses keyword-based intent detection.
        """
        query_lower = query.lower().strip()
        
        # Intent mapping
        if any(word in query_lower for word in ["low stock", "running out", "out of stock", "stock low"]):
            return {
                "intent": "low_stock",
                "description": "Get low stock products",
                "data": self.get_low_stock_products()
            }
        
        elif any(word in query_lower for word in ["duplicate", "similar", "same product"]):
            # Get all products and find duplicates
            all_products = self.db.query(Product).all()
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
                "intent": "duplicates",
                "description": "Find duplicate products",
                "data": duplicates
            }
        
        elif any(word in query_lower for word in ["top selling", "best seller", "popular", "sales"]):
            # Get top selling products (simplified - by sales count)
            top_products = self.db.query(
                Sale.product_id,
                Product.name,
                func.count(Sale.id).label('sales_count'),
                func.sum(Sale.quantity).label('total_quantity')
            ).join(Product, Sale.product_id == Product.id)\
             .group_by(Sale.product_id, Product.name)\
             .order_by(func.count(Sale.id).desc())\
             .limit(10)\
             .all()
            
            return {
                "intent": "top_selling",
                "description": "Top selling products",
                "data": [{
                    "product_id": row.product_id,
                    "name": row.name,
                    "sales_count": row.sales_count,
                    "total_quantity": row.total_quantity
                } for row in top_products]
            }
        
        elif any(word in query_lower for word in ["insight", "summary", "overview", "dashboard"]):
            # Generate insights
            total_products = self.db.query(Product).count()
            low_stock_count = self.get_low_stock_count()
            total_stock_value = self.db.query(
                func.sum(Product.stock * Product.cost_price)
            ).scalar() or 0
            
            return {
                "intent": "insights",
                "description": "System insights summary",
                "data": {
                    "total_products": total_products,
                    "low_stock_count": low_stock_count,
                    "low_stock_threshold": self.low_stock_threshold,
                    "total_stock_value": round(total_stock_value, 2),
                    "alerts": low_stock_count
                }
            }
        
        else:
            return {
                "intent": "unknown",
                "description": "Query not understood",
                "data": [],
                "suggestions": [
                    "Try: 'low stock items'",
                    "Try: 'duplicate products'",
                    "Try: 'top selling products'",
                    "Try: 'system insights'"
                ]
            }
    
    # --- AI Insights Dashboard ---
    
    def get_ai_insights(self) -> Dict[str, Any]:
        """
        Generate comprehensive AI insights for dashboard.
        """
        # Low stock analysis
        low_stock_products = self.get_low_stock_products()
        
        # Duplicate risk analysis
        all_products = self.db.query(Product).all()
        potential_duplicates = []
        
        # Check for potential duplicates (names that are very similar)
        for i, p1 in enumerate(all_products):
            for p2 in all_products[i+1:]:
                if HAS_RAPIDFUZZ:
                    similarity = fuzz.ratio(p1.name.lower(), p2.name.lower()) / 100.0
                else:
                    similarity = difflib.SequenceMatcher(
                        None, p1.name.lower(), p2.name.lower()
                    ).ratio()
                
                if similarity >= 0.85:  # 85% similarity threshold
                    potential_duplicates.append({
                        "product1": {"id": p1.id, "name": p1.name, "sku": p1.sku},
                        "product2": {"id": p2.id, "name": p2.name, "sku": p2.sku},
                        "similarity": round(similarity, 3)
                    })
        
        # Stock value analysis
        stock_value_by_category = self.db.query(
            Product.category,
            func.sum(Product.stock * Product.cost_price).label('total_value')
        ).filter(Product.category.isnot(None))\
         .group_by(Product.category)\
         .all()
        
        return {
            "low_stock": {
                "count": len(low_stock_products),
                "products": low_stock_products[:5],  # Top 5
                "threshold": self.low_stock_threshold
            },
            "duplicate_risks": {
                "count": len(potential_duplicates),
                "risks": potential_duplicates[:5]  # Top 5
            },
            "stock_analysis": {
                "total_products": len(all_products),
                "total_stock_value": round(sum(
                    p.stock * p.cost_price for p in all_products
                ), 2),
                "value_by_category": [
                    {"category": row[0], "value": round(row[1], 2)}
                    for row in stock_value_by_category
                ]
            },
            "timestamp": func.now()
        }