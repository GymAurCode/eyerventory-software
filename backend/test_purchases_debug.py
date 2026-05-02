"""
Debug script to test purchases endpoint and database integrity.
Run this to diagnose the 500 error.
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import inspect, text
from database import SessionLocal, engine
from models.purchase import Purchase, PurchaseItem
from models.supplier import Supplier
from models.product import Product


def check_tables():
    """Verify all required tables exist."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    required = ["purchases", "purchase_items", "suppliers", "products"]
    print("=== Table Check ===")
    for table in required:
        exists = table in tables
        print(f"  {table}: {'✓' if exists else '✗ MISSING'}")
        
        if exists:
            columns = [col['name'] for col in inspector.get_columns(table)]
            print(f"    Columns: {', '.join(columns)}")
    print()


def check_data():
    """Check if there's any data in purchases table."""
    db = SessionLocal()
    try:
        print("=== Data Check ===")
        
        # Count records
        purchase_count = db.query(Purchase).count()
        supplier_count = db.query(Supplier).count()
        product_count = db.query(Product).count()
        
        print(f"  Purchases: {purchase_count}")
        print(f"  Suppliers: {supplier_count}")
        print(f"  Products: {product_count}")
        print()
        
        # Try to fetch purchases with relationships
        print("=== Fetching Purchases ===")
        purchases = db.query(Purchase).limit(5).all()
        
        if not purchases:
            print("  No purchases found (empty table)")
        else:
            for p in purchases:
                print(f"  Purchase #{p.id}:")
                print(f"    Invoice: {p.invoice_number}")
                print(f"    Supplier ID: {p.supplier_id}")
                
                # Test relationship access
                try:
                    supplier_name = p.supplier.name if p.supplier else "NULL"
                    print(f"    Supplier: {supplier_name}")
                except Exception as e:
                    print(f"    Supplier: ERROR - {e}")
                
                # Test items
                try:
                    print(f"    Items: {len(p.items)}")
                    for item in p.items:
                        try:
                            product_name = item.product.name if item.product else "NULL"
                            print(f"      - Product: {product_name}, Qty: {item.quantity}")
                        except Exception as e:
                            print(f"      - Product: ERROR - {e}")
                except Exception as e:
                    print(f"    Items: ERROR - {e}")
        print()
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def test_eager_loading():
    """Test eager loading of relationships."""
    from sqlalchemy.orm import joinedload
    
    db = SessionLocal()
    try:
        print("=== Testing Eager Loading ===")
        
        purchases = (
            db.query(Purchase)
            .options(
                joinedload(Purchase.supplier),
                joinedload(Purchase.items).joinedload(PurchaseItem.product)
            )
            .limit(3)
            .all()
        )
        
        if not purchases:
            print("  No purchases to test")
        else:
            for p in purchases:
                print(f"  Purchase #{p.id}: {p.invoice_number}")
                print(f"    Supplier: {p.supplier.name if p.supplier else 'NULL'}")
                print(f"    Items: {len(p.items)}")
                for item in p.items:
                    print(f"      - {item.product.name if item.product else 'NULL'}: {item.quantity}")
        print()
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("PURCHASES MODULE DEBUG")
    print("=" * 60)
    print()
    
    check_tables()
    check_data()
    test_eager_loading()
    
    print("=" * 60)
    print("Debug complete. Check output above for issues.")
    print("=" * 60)
