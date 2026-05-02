from __future__ import annotations

import io
import re


def extract_invoice_fields(file_bytes: bytes) -> dict:
    text = ""
    confidence = 0.0
    try:
        import pytesseract  # Optional dependency.
        from PIL import Image

        image = Image.open(io.BytesIO(file_bytes))
        gray = image.convert("L")
        bw = gray.point(lambda p: 255 if p > 145 else 0)
        text = pytesseract.image_to_string(bw)
        data = pytesseract.image_to_data(bw, output_type=pytesseract.Output.DICT)
        conf_values = [float(v) for v in data.get("conf", []) if str(v).strip() not in {"-1", ""}]
        confidence = (sum(conf_values) / len(conf_values) / 100.0) if conf_values else 0.0
    except Exception:
        return {
            "text_preview": "",
            "parsed": {"product": "Sample Item", "quantity": 1, "price": 100.0},
            "confidence": 0.4,
            "reasoning": "pytesseract unavailable or OCR failed; returning fallback extraction for testing.",
            "manual_correction_required": True,
            "factors_used": ["fallback"],
        }

    quantity = None
    price = None
    product_name = None

    qty_match = re.search(r"(?:qty|quantity)\s*[:\-]?\s*(\d+)", text, flags=re.I)
    price_match = re.search(r"(?:price|rate|amount)\s*[:\-]?\s*([\d.]+)", text, flags=re.I)
    product_match = re.search(r"(?:item|product)\s*[:\-]?\s*([A-Za-z0-9 _-]{2,80})", text, flags=re.I)
    if qty_match:
        quantity = int(qty_match.group(1))
    if price_match:
        price = float(price_match.group(1))
    if product_match:
        product_name = product_match.group(1).strip()

    return {
        "text_preview": text[:1000],
        "parsed": {"product": product_name, "quantity": quantity, "price": price},
        "confidence": round(confidence, 3),
        "reasoning": "OCR used grayscale + threshold preprocessing; fields extracted via invoice label matching.",
        "manual_correction_required": bool(confidence < 0.65 or not product_name or quantity is None or price is None),
        "factors_used": ["image_preprocessing", "ocr_text", "field_pattern_matching"],
    }

