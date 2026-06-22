from pathlib import Path

from barcode import Code128
from barcode.writer import ImageWriter

BARCODE_DIR = Path("barcodes")


def generate_barcode(item_id: int, item_name: str = "") -> tuple[str, str]:
    code = str(item_id).zfill(8)
    BARCODE_DIR.mkdir(exist_ok=True)
    filename = BARCODE_DIR / code
    filepath = str(filename) + ".png"
    with open(filepath, "wb") as f:
        Code128(code, writer=ImageWriter()).write(f)
    return code, filepath
