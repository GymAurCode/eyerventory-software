from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.orm import Session

SAFE_TABLES = {"products", "sales", "expenses"}
SAFE_CLAUSES = {"select", "from", "where", "group", "order", "limit", "join", "left", "inner", "having", "asc", "desc"}

_RULE_INTENTS = [
    "zero sales", "no sales", "never sold", "not sold", "no purchases",
    "slow moving", "low stock", "top selling", "high value", "out of stock",
    "recent sales", "expenses",
]


def _rule_based_sql(question: str) -> str:
    q = question.lower().strip()

    if any(p in q for p in ["zero sales", "no sales", "never sold", "not sold", "no purchases"]):
        return (
            "SELECT p.id, p.name, p.stock "
            "FROM products p "
            "LEFT JOIN sales s ON s.product_id = p.id "
            "GROUP BY p.id, p.name, p.stock "
            "HAVING COALESCE(SUM(s.quantity), 0) = 0 "
            "ORDER BY p.id"
        )
    if "slow moving" in q:
        return (
            "SELECT p.id, p.name, p.stock, COALESCE(SUM(s.quantity), 0) AS sold_last_30_days "
            "FROM products p LEFT JOIN sales s ON s.product_id = p.id "
            "AND s.created_at >= datetime('now', '-30 day') "
            "GROUP BY p.id, p.name, p.stock ORDER BY sold_last_30_days ASC LIMIT 50"
        )
    if "out of stock" in q:
        return "SELECT id, name, stock FROM products WHERE stock = 0 ORDER BY name"
    if "low stock" in q:
        return "SELECT id, name, stock FROM products WHERE stock > 0 ORDER BY stock ASC LIMIT 50"
    if "top selling" in q:
        return (
            "SELECT p.id, p.name, COALESCE(SUM(s.quantity), 0) AS total_sold "
            "FROM products p LEFT JOIN sales s ON s.product_id = p.id "
            "GROUP BY p.id, p.name ORDER BY total_sold DESC LIMIT 20"
        )
    if "high value" in q:
        return "SELECT id, name, cost_price, stock FROM products ORDER BY cost_price DESC LIMIT 20"
    if "recent sales" in q:
        return (
            "SELECT s.id, p.name, s.quantity, s.revenue AS total_price, s.created_at "
            "FROM sales s JOIN products p ON p.id = s.product_id "
            "ORDER BY s.created_at DESC LIMIT 50"
        )
    if "expense" in q:
        return "SELECT id, description, amount, created_at FROM expenses ORDER BY created_at DESC LIMIT 50"
    # default
    return "SELECT id, name, stock, cost_price FROM products ORDER BY id DESC LIMIT 25"


def _rule_based_explanation(question: str) -> str:
    q = question.lower().strip()
    if any(p in q for p in ["zero sales", "no sales", "never sold", "not sold", "no purchases"]):
        return "Products with zero sales history — never purchased since records began."
    if "slow moving" in q:
        return "Products with the lowest sold quantity in the last 30 days."
    if "out of stock" in q:
        return "Products with zero stock currently."
    if "low stock" in q:
        return "Products with the lowest current stock levels."
    if "top selling" in q:
        return "Top-selling products by total quantity sold."
    if "high value" in q:
        return "Products sorted by highest cost price."
    if "recent sales" in q:
        return "Most recent sales transactions."
    if "expense" in q:
        return "Most recent expense records."
    return "Recent product inventory snapshot."


def validate_sql(sql: str) -> str:
    cleaned = sql.strip().rstrip(";")
    lowered = cleaned.lower()
    if ";" in cleaned:
        raise ValueError("Multiple SQL statements are not allowed")
    if not lowered.startswith("select "):
        raise ValueError("Only SELECT queries are allowed")
    if re.search(r"\b(drop|delete|update|insert|alter|create|attach|pragma)\b", lowered):
        raise ValueError("Potentially unsafe SQL detected")
    if "--" in cleaned or "/*" in cleaned:
        raise ValueError("Comments are not allowed in SQL")
    if re.search(r"\(\s*select\b", lowered):
        raise ValueError("Subqueries are blocked for safety")
    tables = set(re.findall(r"\b(?:from|join)\s+([a-z_]+)\b", lowered))
    if tables and not tables.issubset(SAFE_TABLES):
        raise ValueError("Query references disallowed tables")
    tokens = set(re.findall(r"\b[a-z_]+\b", lowered))
    disallowed = tokens & {"union", "intersect", "except", "into", "vacuum", "replace", "with", "recursive"}
    if disallowed:
        raise ValueError(f"Unsupported clause(s): {', '.join(sorted(disallowed))}")
    if " limit " not in f" {lowered} ":
        cleaned = f"{cleaned} LIMIT 200"
    return cleaned


def execute_nl_query(db: Session, question: str) -> dict:
    sql = _rule_based_sql(question)
    safe_sql = validate_sql(sql)
    # Syntax safety gate via query planner
    db.execute(text(f"EXPLAIN QUERY PLAN {safe_sql}")).all()
    rows = db.execute(text(safe_sql)).mappings().all()
    return {
        "sql": safe_sql,
        "rows": [dict(row) for row in rows[:200]],
        "explanation": _rule_based_explanation(question),
        "confidence": 0.95,
    }
