import json
from fastapi import WebSocket, WebSocketDisconnect

from ..query import executor, templating
from ..query.history import save as save_history
from ..query.limit_injector import inject_limit
from ..query.row_serializer import serialize_row
from ..connections.registry import get_connection
from ..config import RESULTS_PREVIEW_LIMIT, HISTORY_MAX_ENTRIES, QUERY_DEFAULT_LIMIT


async def handle_query_ws(websocket: WebSocket, connection_id: str) -> None:
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        msg = json.loads(raw)
        sql_template: str = msg["sql"]
        params = msg.get("params")  # None | dict | list

        # Expand template → may produce multiple (sql, params) pairs
        pairs = templating.expand(sql_template, params)

        all_rows: list[dict] = []
        last_info = None

        for rendered_sql, _bound_params in pairs:
            rows_this_run: list[dict] = []
            limited_sql = inject_limit(rendered_sql, QUERY_DEFAULT_LIMIT)
            async for info, batch in executor.execute(connection_id, limited_sql, None):
                last_info = info
                for row in batch:
                    rows_this_run.append(serialize_row(row))

                await websocket.send_json({
                    "execution_id": info.execution_id,
                    "status": info.status,
                    "rows_fetched": info.rows_fetched,
                    "elapsed_ms": info.elapsed_ms,
                    "message": info.message,
                })

            all_rows.extend(rows_this_run)

        # Persist to history before sending rows (client refreshes history on "rows" message)
        if last_info:
            try:
                conn_info = get_connection(connection_id).info
                save_history(
                    connection_id=connection_id,
                    connection_name=conn_info.name,
                    sql=sql_template,
                    status=last_info.status,
                    duration_ms=last_info.elapsed_ms,
                    rows_returned=last_info.rows_fetched,
                    max_entries=HISTORY_MAX_ENTRIES,
                )
            except Exception:
                pass

        # Send preview rows (capped)
        preview = all_rows[:RESULTS_PREVIEW_LIMIT]
        await websocket.send_json({"type": "rows", "rows": preview, "total": len(all_rows)})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"status": "error", "message": str(exc)})
        except Exception:
            pass
