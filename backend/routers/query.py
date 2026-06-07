from fastapi import APIRouter, HTTPException, WebSocket
from pydantic import BaseModel

from ..query import executor
from ..ws.handlers import handle_query_ws

router = APIRouter(prefix="/api", tags=["query"])


class CancelRequest(BaseModel):
    execution_id: str


@router.websocket("/ws/{connection_id}/query")
async def ws_query(websocket: WebSocket, connection_id: str):
    await handle_query_ws(websocket, connection_id)


@router.post("/connections/{connection_id}/cancel")
async def cancel_query(connection_id: str, body: CancelRequest):  # noqa: ARG001
    _ = connection_id
    ok = await executor.cancel(body.execution_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Execution not found or already finished")
    return {"cancelled": True}


@router.get("/connections/{connection_id}/executions")
async def running_executions(connection_id: str):
    return [
        {
            "execution_id": e.execution_id,
            "status": e.status,
            "rows_fetched": e.rows_fetched,
            "elapsed_ms": e.elapsed_ms,
            "sql": e.sql[:200],
        }
        for e in executor.list_running(connection_id)
    ]
