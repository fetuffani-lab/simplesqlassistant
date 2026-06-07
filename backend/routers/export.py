from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any

from ..export.exporter import to_csv, to_xlsx
from ..query.executor import execute
from ..query.templating import expand
from ..query.row_serializer import serialize_row

router = APIRouter(prefix="/api/connections/{connection_id}/export", tags=["export"])


class ExportRequest(BaseModel):
    sql: str
    params: Any = None
    format: str = "csv"        # "csv" | "xlsx"
    separator: str = ","
    decimal_separator: str = "."  # "." or ","
    encoding: str = "utf-8"
    include_header: bool = True


@router.post("")
async def export_data(connection_id: str, body: ExportRequest):
    pairs = expand(body.sql, body.params)
    all_rows: list[dict] = []
    try:
        for rendered_sql, bound_params in pairs:
            async for _info, batch in execute(connection_id, rendered_sql, bound_params):
                all_rows.extend(serialize_row(row) for row in batch)
    except KeyError:
        raise HTTPException(404, "Connection not found")
    except Exception as exc:
        raise HTTPException(400, str(exc))

    if body.format == "xlsx":
        data = to_xlsx(all_rows, decimal_separator=body.decimal_separator, include_header=body.include_header)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=export.xlsx"},
        )

    data = to_csv(
        all_rows,
        separator=body.separator,
        decimal_separator=body.decimal_separator,
        encoding=body.encoding,
        include_header=body.include_header,
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )
