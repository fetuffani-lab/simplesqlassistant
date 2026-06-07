import csv
import decimal
import io
from typing import Any

import openpyxl


def _fmt(value: Any, decimal_sep: str) -> Any:
    """Replace decimal point in numeric strings when decimal_sep != '.'."""
    if decimal_sep == ".":
        return value
    if isinstance(value, float):
        return str(value).replace(".", decimal_sep)
    if isinstance(value, decimal.Decimal):
        return str(value).replace(".", decimal_sep)
    return value


def _apply_decimal(rows: list[dict[str, Any]], decimal_sep: str) -> list[dict[str, Any]]:
    if decimal_sep == ".":
        return rows
    return [{k: _fmt(v, decimal_sep) for k, v in row.items()} for row in rows]


def to_csv(
    rows: list[dict[str, Any]],
    separator: str = ",",
    decimal_separator: str = ".",
    encoding: str = "utf-8",
    include_header: bool = True,
) -> bytes:
    buf = io.StringIO()
    if not rows:
        return buf.getvalue().encode(encoding)
    rows = _apply_decimal(rows, decimal_separator)
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), delimiter=separator)
    if include_header:
        writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode(encoding)


def to_xlsx(
    rows: list[dict[str, Any]],
    decimal_separator: str = ".",
    include_header: bool = True,
) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    if not rows:
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    rows = _apply_decimal(rows, decimal_separator)
    col_names = list(rows[0].keys())
    if include_header:
        ws.append(col_names)
    for row in rows:
        ws.append([row.get(c) for c in col_names])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
