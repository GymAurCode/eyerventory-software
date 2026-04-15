from sqlalchemy.orm import Session

from backend.models.app_setting import AppSetting
from backend.models.expense import Expense
from backend.models.product import Product
from backend.models.sale import Sale

DONATION_ENABLED = "donation_enabled"
DONATION_PERCENTAGE = "donation_percentage"
COMPANY_NAME = "company_name"
PASSWORD_RECOVERY_KEY = "password_recovery_key"
DEFAULT_COMPANY_NAME = "Inventory Management System"


def _get_setting(db: Session, key: str, default: str) -> str:
    item = db.query(AppSetting).filter(AppSetting.key == key).first()
    return item.value if item else default


def _set_setting(db: Session, key: str, value: str) -> None:
    item = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not item:
        item = AppSetting(key=key, value=value)
        db.add(item)
    else:
        item.value = value


def get_donation_settings(db: Session) -> dict:
    enabled = _get_setting(db, DONATION_ENABLED, "false") == "true"
    percentage = float(_get_setting(db, DONATION_PERCENTAGE, "0"))
    return {
        "enabled": enabled,
        "percentage": percentage,
    }


def update_donation_settings(db: Session, enabled: bool, percentage: float) -> dict:
    _set_setting(db, DONATION_ENABLED, "true" if enabled else "false")
    _set_setting(db, DONATION_PERCENTAGE, str(percentage))
    db.commit()
    return get_donation_settings(db)


def get_company_name(db: Session) -> str:
    return _get_setting(db, COMPANY_NAME, DEFAULT_COMPANY_NAME)


def update_company_name(db: Session, company_name: str) -> str:
    _set_setting(db, COMPANY_NAME, company_name.strip())
    db.commit()
    return get_company_name(db)


def get_password_recovery_key(db: Session) -> str:
    return _get_setting(db, PASSWORD_RECOVERY_KEY, "umx")


def clear_operational_data(db: Session) -> dict:
    deleted_sales = db.query(Sale).delete()
    deleted_expenses = db.query(Expense).delete()
    deleted_products = db.query(Product).delete()
    db.commit()
    return {
        "sales": deleted_sales,
        "expenses": deleted_expenses,
        "products": deleted_products,
    }
