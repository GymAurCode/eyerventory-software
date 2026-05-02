from __future__ import annotations

import json
import logging
import os
import traceback
import urllib.request
from sqlalchemy.orm import Session

from backend.ai.anomaly_service import detect_anomalies
from backend.ai.nlp_service import execute_nl_query
from backend.ai.prediction_service import predict_stock
from backend.ai.reorder_service import suggest_reorders
from backend.ai.data_access import load_products, load_sales_by_product
from backend.ai.observability import log_event, track_latency

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Intent detection — used only to decide which tools to call, NOT for replies
# ---------------------------------------------------------------------------
_INTENT_KEYWORDS = {
    "stock_status":  ["stock", "inventory", "how many", "units", "on hand", "available",
                      "scene", "haal", "kitna", "kitne"],
    "reorder":       ["reorder", "restock", "low stock", "order more", "replenish",
                      "running out", "mangwao", "order karo"],
    "slow_products": ["slow", "slow moving", "not selling", "dead stock", "no sales",
                      "zero sales", "never sold", "dead hai", "nahi bik"],
    "anomalies":     ["anomal", "spike", "drop", "unusual", "weird", "sudden",
                      "unexpected", "ajeeb", "change"],
    "predictions":   ["predict", "forecast", "demand", "stockout", "will run out",
                      "future", "khatam", "kab khatam"],
    "specific_product": [],  # always populated via product name matching
}


def _detect_intent(message: str) -> list[str]:
    msg = message.lower()
    matched = [intent for intent, keywords in _INTENT_KEYWORDS.items()
               if keywords and any(k in msg for k in keywords)]
    if not matched:
        matched = ["stock_status", "reorder"]
    return matched


def _plan_tools(intents: list[str]) -> list[str]:
    tools = []
    if any(i in intents for i in ("predictions", "stock_status", "specific_product")):
        tools.append("get_predictions")
    if "anomalies" in intents:
        tools.append("get_anomalies")
    if "reorder" in intents:
        tools.append("get_reorder_suggestions")
    if "slow_products" in intents:
        tools.append("run_safe_query")
    if "get_predictions" not in tools:
        tools.append("get_predictions")
    if "get_reorder_suggestions" not in tools:
        tools.append("get_reorder_suggestions")
    return list(dict.fromkeys(tools))


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def get_predictions(db: Session):
    result = predict_stock(db, 14)
    return result if isinstance(result, list) else result.get("data", [])


def get_anomalies(db: Session):
    result = detect_anomalies(db)
    return result if isinstance(result, list) else result.get("data", [])


def get_reorder_suggestions(db: Session):
    result = suggest_reorders(db)
    if isinstance(result, dict) and "data" in result:
        return result["data"]
    return result if isinstance(result, list) else result.get("items", [])


def run_safe_query(db: Session, question: str):
    return execute_nl_query(db, question)


# ---------------------------------------------------------------------------
# LLM call — Gemini API, raises on failure, never silently returns None
# ---------------------------------------------------------------------------

def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Call Google Gemini and return the response text.
    Raises RuntimeError with a descriptive message on any failure.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise RuntimeError("GEMINI_API_KEY is not set or is empty.")

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    # Gemini uses a single "contents" array; prepend system instruction as first user turn
    combined_prompt = f"{system_prompt}\n\n{user_prompt}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": combined_prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 600},
    }).encode("utf-8")

    logger.info("[LLM] Sending Gemini request — model: %s, prompt_length: %d chars",
                model, len(combined_prompt))
    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        text = (
            body.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
        )
        if not text:
            raise RuntimeError(f"Gemini returned empty response. Full body: {body}")

        logger.info("[LLM] Gemini response (%d chars): %s", len(text), text[:200])
        return text

    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.error("[LLM] Gemini HTTP error %s:\n%s", exc.code, error_body)
        raise RuntimeError(f"Gemini API HTTP {exc.code}: {error_body}") from exc
    except Exception as exc:
        logger.error("[LLM] Gemini call FAILED:\n%s", traceback.format_exc())
        raise RuntimeError(f"Gemini API error: {exc}") from exc


def _build_llm_answer(message: str, outputs: dict, products: list[dict]) -> str:
    """
    Build prompt and call LLM. Raises on failure — never falls back silently.
    """
    predictions = outputs.get("get_predictions", [])
    reorders = outputs.get("get_reorder_suggestions", [])
    anomalies = outputs.get("get_anomalies", [])
    slow_result = outputs.get("run_safe_query", {})
    slow_items = slow_result.get("rows", []) if isinstance(slow_result, dict) else []

    pred_summary = [
        {
            "name": p.get("product_name"),
            "stock": p.get("current_stock"),
            "days_until_stockout": p.get("days_until_stockout"),
            "predicted_demand": p.get("predicted_demand"),
        }
        for p in predictions[:20]
    ]
    reorder_summary = [
        {
            "name": r.get("product_name"),
            "stock": r.get("current_stock"),
            "recommended_qty": r.get("recommended_quantity"),
            "urgency": r.get("urgency"),
            "days_left": r.get("days_until_stockout"),
        }
        for r in reorders[:15]
    ]
    anomaly_summary = [
        {
            "name": a.get("product_name"),
            "type": a.get("anomaly_type"),
            "deviation": a.get("deviation_value"),
        }
        for a in anomalies[:10]
    ]
    product_summary = [
        {"name": p["name"], "stock": p["stock"]}
        for p in products[:30]
    ]

    system_prompt = (
        "You are a senior inventory management AI assistant. "
        "Your job is to analyze stock, sales, and predict business actions.\n"
        "Rules:\n"
        "- Always mention product names.\n"
        "- Always include numbers (stock levels, sales figures, days until stockout).\n"
        "- Never give generic answers.\n"
        "- Give actionable business advice (e.g. reorder, run promotion, avoid restocking).\n"
        "- If data is insufficient, clearly say so.\n"
        "- Respond in natural conversational tone (Hinglish allowed if user writes in it).\n"
        "- Detect overstock and low stock situations explicitly.\n"
        "- Compare products when relevant.\n"
        "- Explain your reasoning briefly."
    )

    user_prompt = (
        f"User question: {message}\n\n"
        f"Stock predictions (next 14 days): {pred_summary}\n"
        f"Reorder suggestions: {reorder_summary}\n"
        f"Anomalies detected: {anomaly_summary}\n"
        f"Slow-moving items: {slow_items[:10]}\n"
        f"All products snapshot: {product_summary}\n\n"
        "Answer the user's question using the data above."
    )

    # This will raise if anything goes wrong — caller decides what to do
    return _call_llm(system_prompt, user_prompt)


# ---------------------------------------------------------------------------
# Rule-based fallback (used only when no LLM key is configured)
# ---------------------------------------------------------------------------

def _build_fallback_answer(intents: list[str], outputs: dict) -> str:
    parts = []

    if "get_predictions" in outputs:
        predictions = outputs["get_predictions"]
        critical = [p for p in predictions if p.get("days_until_stockout") and p["days_until_stockout"] <= 5]
        warning  = [p for p in predictions if p.get("days_until_stockout") and 5 < p["days_until_stockout"] <= 14]

        if critical:
            names = ", ".join(
                f"{p['product_name']} ({p.get('current_stock', 0)} units, ~{p['days_until_stockout']:.0f}d left)"
                for p in critical[:5]
            )
            parts.append(f"Critical stock alert: {names}. Order immediately.")
        if warning:
            names = ", ".join(
                f"{p['product_name']} ({p.get('current_stock', 0)} units)"
                for p in warning[:5]
            )
            parts.append(f"Running low within 2 weeks: {names}.")
        if not critical and not warning and predictions:
            parts.append("Stock levels look stable across all tracked products.")

    if "get_reorder_suggestions" in outputs:
        reorders = outputs["get_reorder_suggestions"]
        high = [r for r in reorders if r.get("urgency") == "high"]
        if high:
            items = ", ".join(
                f"{r['product_name']} (order {r['recommended_quantity']} units)"
                for r in high[:5]
            )
            parts.append(f"Urgent reorders: {items}.")
        elif reorders:
            items = ", ".join(r["product_name"] for r in reorders[:3])
            parts.append(f"Consider restocking: {items}.")

    if "get_anomalies" in outputs:
        anomalies = outputs["get_anomalies"]
        if anomalies:
            for a in anomalies[:3]:
                parts.append(
                    f"{a['product_name']} shows a {a.get('anomaly_type','anomaly').replace('_',' ')} "
                    f"({a.get('deviation_value', 0):.1f} units deviation)."
                )

    if "run_safe_query" in outputs:
        result = outputs["run_safe_query"]
        rows = result.get("rows", []) if isinstance(result, dict) else []
        if rows:
            names = ", ".join(
                f"{r.get('name', 'Unknown')} (stock: {r.get('stock', 0)})"
                for r in rows[:6]
            )
            parts.append(f"Slow/zero-sales products: {names}.")

    if not parts:
        return (
            "Not enough data to give a strong recommendation. "
            "Please add more sales history for better insights."
        )
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def chat_response(db: Session, message: str) -> dict:
    """Generate a natural, LLM-powered assistant response with real inventory data."""
    with track_latency("chat_response"):
        intents = _detect_intent(message)
        selected_tools = _plan_tools(intents)

        log_event("chat_request", message=message[:100], intents=intents, tools=selected_tools)
        logger.info("[CHAT] intents=%s tools=%s", intents, selected_tools)

        # --- Fetch data from all relevant tools ---
        outputs: dict = {}
        for tool in selected_tools:
            try:
                if tool == "get_predictions":
                    outputs[tool] = get_predictions(db)[:20]
                elif tool == "get_anomalies":
                    outputs[tool] = get_anomalies(db)[:10]
                elif tool == "get_reorder_suggestions":
                    outputs[tool] = get_reorder_suggestions(db)[:15]
                elif tool == "run_safe_query":
                    outputs[tool] = run_safe_query(db, message)
            except Exception as e:
                logger.error("[CHAT] Tool %s failed: %s", tool, traceback.format_exc())
                log_event("chat_tool_error", tool=tool, error=str(e))

        # Load full product list for richer LLM context
        try:
            products = load_products(db)
        except Exception:
            logger.warning("[CHAT] load_products failed: %s", traceback.format_exc())
            products = []

        # --- Try LLM; surface real errors instead of silently falling back ---
        api_key = os.getenv("GEMINI_API_KEY")
        key_present = bool(api_key and api_key.strip())
        logger.info("[CHAT] GEMINI_API_KEY present: %s", key_present)

        try:
            answer = _build_llm_answer(message, outputs, products)
            used_llm = True
            logger.info("[CHAT] Gemini answer obtained successfully.")
        except Exception as exc:
            logger.error("[CHAT] Gemini LLM failed: %s", traceback.format_exc())
            return {
                "error": "GEMINI_FAILED",
                "details": str(exc),
                "answer": "AI service temporarily unavailable. Please try again.",
                "tool_calls": selected_tools,
                "data": outputs,
                "reasoning": f"Gemini error. Intents: {intents}. Tools: {selected_tools}.",
                "factors_used": ["intent_detection", "real_product_data"],
                "confidence": 0.0,
            }

        total_items = sum(
            len(v) if isinstance(v, list) else len(v.get("rows", []) if isinstance(v, dict) else [])
            for v in outputs.values()
        )
        confidence = 0.92 if used_llm else (0.75 if total_items > 3 else 0.5)

        return {
            "answer": answer,
            "tool_calls": selected_tools,
            "data": outputs,
            "reasoning": f"Intents: {intents}. Tools: {selected_tools}. LLM: {used_llm}.",
            "factors_used": ["intent_detection", "real_product_data", "llm_generation" if used_llm else "rule_based"],
            "confidence": round(confidence, 2),
        }