"""
Voice command parsing and execution service.

Flow:
  1. Frontend uses Web Speech API to get transcript (no audio upload needed)
  2. POST /api/ai/voice  { "text": "add 20 units of pepsi" }
     → returns parsed intent + action_preview (NO DB changes)
  3. User confirms in UI
  4. POST /api/ai/voice/execute  { "intent": ..., "product": ..., "quantity": ..., "price": ... }
     → executes the action and returns result
"""

from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.sale import Sale

logger = logging.getLogger("voice-service")

# ---------------------------------------------------------------------------
# Number word → int
# ---------------------------------------------------------------------------
_NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100,
}


def _to_int(text: str) -> int | None:
    text = text.strip().lower()
    if re.fullmatch(r"\d+", text):
        return int(text)
    total, current = 0, 0
    for token in re.findall(r"[a-z]+", text):
        val = _NUMBER_WORDS.get(token)
        if val is None:
            continue
        if val == 100:
            current = max(current, 1) * 100
        else:
            current += val
    total += current
    return total if total > 0 else None


# ---------------------------------------------------------------------------
# Intent patterns
# ---------------------------------------------------------------------------
# Each pattern: (intent_name, compiled_regex)
# Groups expected: quantity (optional), product, price (optional)

_PATTERNS: list[tuple[str, re.Pattern]] = [
    # "add 20 units of pepsi" / "increase stock of pepsi by 50"
    (
        "add_stock",
        re.compile(
            r"(?:add|increase|restock|stock up|put)\s+"
            r"(?:(?P<qty>[\w ]+?)\s+(?:units?|pcs?|pieces?)\s+(?:of|to|for)\s+)?"
            r"(?P<product>[a-z0-9 _-]+?)"
            r"(?:\s+(?:by|with)\s+(?P<qty2>[\w]+))?"
            r"\s*$",
            re.IGNORECASE,
        ),
    ),
    # "sell 10 pepsi at 200" / "record sale of 5 cola at 150"
    (
        "record_sale",
        re.compile(
            r"(?:sell|sold|sale|record sale of?)\s+"
            r"(?P<qty>[\w]+)\s+"
            r"(?P<product>[a-z0-9 _-]+?)"
            r"(?:\s+(?:at|for|@)\s+(?P<price>[\d.]+))?"
            r"\s*$",
            re.IGNORECASE,
        ),
    ),
    # "reduce stock of pepsi by 30" / "remove 10 units of cola"
    (
        "reduce_stock",
        re.compile(
            r"(?:reduce|remove|decrease|deduct|subtract)\s+"
            r"(?:(?P<qty>[\w]+)\s+(?:units?|pcs?)?\s+(?:of|from)\s+)?"
            r"(?P<product>[a-z0-9 _-]+?)"
            r"(?:\s+by\s+(?P<qty2>[\w]+))?"
            r"\s*$",
            re.IGNORECASE,
        ),
    ),
]

_ACTION_LABELS = {
    "add_stock":    "Add {qty} units to {product} stock",
    "reduce_stock": "Remove {qty} units from {product} stock",
    "record_sale":  "Record sale of {qty} units of {product} at {price} each",
}


def parse_command(text: str) -> dict:
    """
    Parse a voice/text command into a structured intent dict.
    Never touches the database.
    Returns dict with keys: intent, product, quantity, price, action_preview,
                            requires_confirmation, raw, error (if failed)
    """
    raw = text.strip()
    cmd = raw.lower()

    logger.info("voice parse: %r", raw[:120])

    for intent, pattern in _PATTERNS:
        m = pattern.search(cmd)
        if not m:
            continue

        groups = m.groupdict()
        product_raw = (groups.get("product") or "").strip().strip("-").strip()

        # Quantity: try named group, then qty2 fallback
        qty_raw = (groups.get("qty") or groups.get("qty2") or "").strip()
        quantity = _to_int(qty_raw) if qty_raw else None

        # Price (record_sale only)
        price_raw = (groups.get("price") or "").strip()
        price = float(price_raw) if price_raw else None

        if not product_raw:
            continue

        # Build human-readable preview
        preview = _ACTION_LABELS[intent].format(
            qty=quantity or "?",
            product=product_raw.title(),
            price=price or "?",
        )

        result = {
            "intent": intent,
            "product": product_raw,
            "quantity": quantity,
            "price": price,
            "action_preview": preview,
            "requires_confirmation": True,
            "raw": raw,
        }
        logger.info("voice parsed: intent=%s product=%r qty=%s", intent, product_raw, quantity)
        return result

    # Nothing matched
    logger.warning("voice parse failed for: %r", raw[:120])
    return {
        "intent": "unknown",
        "product": None,
        "quantity": None,
        "price": None,
        "action_preview": None,
        "requires_confirmation": False,
        "raw": raw,
        "error": "Could not understand command. Try: 'add 20 units of pepsi' or 'sell 10 cola at 150'.",
    }


# ---------------------------------------------------------------------------
# Execution (called only after user confirms)
# ---------------------------------------------------------------------------

def _find_product(db: Session, name: str) -> Product | None:
    """Case-insensitive product lookup with partial match fallback."""
    name_clean = name.strip().lower()
    # Exact match first
    product = db.query(Product).filter(
        Product.name.ilike(name_clean)
    ).first()
    if product:
        return product
    # Partial match
    return db.query(Product).filter(
        Product.name.ilike(f"%{name_clean}%")
    ).first()


def execute_command(db: Session, intent: str, product_name: str,
                    quantity: int, price: float | None = None) -> dict:
    """
    Execute a confirmed voice command against the database.
    Returns { success, message, product_name, new_stock }
    """
    logger.info("voice execute: intent=%s product=%r qty=%s price=%s",
                intent, product_name, quantity, price)

    if not product_name or quantity is None or quantity <= 0:
        return {"success": False, "message": "Invalid product or quantity."}

    product = _find_product(db, product_name)
    if not product:
        return {"success": False, "message": f"Product '{product_name}' not found in inventory."}

    try:
        if intent == "add_stock":
            product.stock = (product.stock or 0) + quantity
            db.commit()
            db.refresh(product)
            msg = f"Added {quantity} units to {product.name}. New stock: {product.stock}."

        elif intent == "reduce_stock":
            if (product.stock or 0) < quantity:
                return {
                    "success": False,
                    "message": f"Not enough stock. {product.name} only has {product.stock} units.",
                }
            product.stock = product.stock - quantity
            db.commit()
            db.refresh(product)
            msg = f"Removed {quantity} units from {product.name}. New stock: {product.stock}."

        elif intent == "record_sale":
            if (product.stock or 0) < quantity:
                return {
                    "success": False,
                    "message": f"Cannot sell {quantity} units — only {product.stock} in stock.",
                }
            sell_price = price if price else float(product.cost_price or 0)
            cost = float(product.cost_price or 0) * quantity
            revenue = sell_price * quantity
            sale = Sale(
                product_id=product.id,
                quantity=quantity,
                selling_price=sell_price,
                revenue=revenue,
                cost=cost,
                profit=revenue - cost,
            )
            db.add(sale)
            product.stock = product.stock - quantity
            db.commit()
            db.refresh(product)
            msg = (
                f"Sale recorded: {quantity} × {product.name} @ {sell_price:.2f}. "
                f"Revenue: {revenue:.2f}. Remaining stock: {product.stock}."
            )

        else:
            return {"success": False, "message": f"Unknown intent '{intent}'."}

        logger.info("voice execute success: %s", msg)
        return {"success": True, "message": msg, "product_name": product.name, "new_stock": product.stock}

    except Exception as exc:
        db.rollback()
        logger.exception("voice execute error: %s", exc)
        return {"success": False, "message": "Database error. Please try again."}
