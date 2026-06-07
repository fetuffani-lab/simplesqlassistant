import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator

from ..connections.registry import get_connection


class ExecStatus(str, Enum):
    RUNNING = "running"
    DONE = "done"
    CANCELLED = "cancelled"
    ERROR = "error"


@dataclass
class ExecutionInfo:
    execution_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    connection_id: str = ""
    sql: str = ""
    status: ExecStatus = ExecStatus.RUNNING
    rows_fetched: int = 0
    elapsed_ms: float = 0
    message: str = ""
    started_at: float = field(default_factory=time.time)


# Global registry of running executions
_executions: dict[str, ExecutionInfo] = {}


def get_execution(execution_id: str) -> ExecutionInfo | None:
    return _executions.get(execution_id)


def list_running(connection_id: str) -> list[ExecutionInfo]:
    return [e for e in _executions.values() if e.connection_id == connection_id and e.status == ExecStatus.RUNNING]


async def execute(
    connection_id: str,
    sql: str,
    params: dict | None = None,
) -> AsyncGenerator[tuple[ExecutionInfo, list[dict[str, Any]]], None]:
    connector = get_connection(connection_id)
    info = ExecutionInfo(connection_id=connection_id, sql=sql)
    _executions[info.execution_id] = info

    try:
        batch: list[dict[str, Any]] = []
        async for row in connector.execute(sql, params, execution_id=info.execution_id):
            batch.append(row)
            info.rows_fetched += 1
            if len(batch) >= 100:
                info.elapsed_ms = (time.time() - info.started_at) * 1000
                yield info, batch
                batch = []

        if batch:
            info.elapsed_ms = (time.time() - info.started_at) * 1000
            yield info, batch

        info.status = ExecStatus.DONE
        info.elapsed_ms = (time.time() - info.started_at) * 1000
        yield info, []
    except asyncio.CancelledError:
        info.status = ExecStatus.CANCELLED
        info.elapsed_ms = (time.time() - info.started_at) * 1000
        yield info, []
    except Exception as exc:
        info.status = ExecStatus.ERROR
        info.message = str(exc)
        info.elapsed_ms = (time.time() - info.started_at) * 1000
        yield info, []
    finally:
        # Keep finished executions briefly for status polling, then clean up
        asyncio.get_event_loop().call_later(300, _executions.pop, info.execution_id, None)


async def cancel(execution_id: str) -> bool:
    info = _executions.get(execution_id)
    if not info or info.status != ExecStatus.RUNNING:
        return False
    try:
        connector = get_connection(info.connection_id)
        await connector.cancel(execution_id)
        info.status = ExecStatus.CANCELLED
        return True
    except Exception:
        return False
