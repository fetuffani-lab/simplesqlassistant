from fastapi import APIRouter, HTTPException
from ..connections.registry import get_connection
from ..connections.base import ConnectionStatus

router = APIRouter(prefix="/api/connections/{connection_id}/stats", tags=["stats"])

_PG_STATS_SQL = """
SELECT
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') AS active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%') AS running_queries,
    (SELECT sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0) FROM pg_statio_user_tables) AS cache_hit_ratio,
    pg_database_size(current_database()) AS db_size_bytes,
    (SELECT checkpoints_timed + checkpoints_req FROM pg_stat_bgwriter) AS total_checkpoints
"""


@router.get("")
async def get_stats(connection_id: str):
    try:
        connector = get_connection(connection_id)
    except KeyError:
        raise HTTPException(404, "Connection not found")

    if connector.info.status != ConnectionStatus.CONNECTED:
        raise HTTPException(400, "Connection not active")

    conn_type = connector.info.type

    if conn_type == "postgres":
        rows = []
        async for row in connector.execute(_PG_STATS_SQL):
            rows.append(row)
        return {"type": "postgres", "metrics": rows[0] if rows else {}}

    if conn_type == "athena":
        # Athena doesn't expose server-side metrics via SQL
        return {"type": "athena", "metrics": {"note": "Server metrics not available for Athena"}}

    return {"type": conn_type, "metrics": {}}


@router.get("/running")
async def running_in_db(connection_id: str):
    """Queries actually running in the database (not just this app's executions)."""
    try:
        connector = get_connection(connection_id)
    except KeyError:
        raise HTTPException(404, "Connection not found")

    conn_type = connector.info.type

    if conn_type == "postgres":
        rows = []
        async for row in connector.execute(
            "SELECT pid, usename, application_name, state, query, query_start "
            "FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid() ORDER BY query_start"
        ):
            rows.append(row)
        return rows

    if conn_type == "athena":
        from ..connections.athena import AthenaConnector
        if not isinstance(connector, AthenaConnector):
            return []
        client = connector._athena_client
        if not client:
            return []
        import asyncio
        response = await asyncio.to_thread(
            client.list_query_executions,
        )
        ids = response.get("QueryExecutionIds", [])[:20]
        if not ids:
            return []
        details = await asyncio.to_thread(client.batch_get_query_execution, QueryExecutionIds=ids)
        return [
            {
                "id": q["QueryExecutionId"],
                "status": q["Status"]["State"],
                "sql": q.get("Query", "")[:200],
                "submitted": str(q["Status"].get("SubmissionDateTime", "")),
            }
            for q in details.get("QueryExecutions", [])
            if q["Status"]["State"] == "RUNNING"
        ]

    return []
