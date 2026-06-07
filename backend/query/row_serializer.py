from __future__ import annotations
import datetime
import decimal
import math
import uuid
from typing import Any


def serialize_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, decimal.Decimal):
        if v.is_nan() or v.is_infinite():
            return str(v)
        return float(v)
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return v.isoformat()
    if isinstance(v, datetime.timedelta):
        return str(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return "[blob]"
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return str(v)
        return v
    if isinstance(v, (int, str)):
        return v
    # fallback: anything else becomes its string representation
    return str(v)


def serialize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {k: serialize_value(v) for k, v in row.items()}
