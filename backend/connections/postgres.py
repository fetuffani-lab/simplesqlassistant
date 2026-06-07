import asyncio
import uuid
from typing import Any, AsyncGenerator

import psycopg2
import psycopg2.extras
from psycopg2 import pool

from .base import BaseConnector, ConnectionInfo, ConnectionStatus


class PostgresConnector(BaseConnector):
    def __init__(self, connection_info: ConnectionInfo):
        super().__init__(connection_info)
        self._pool: pool.ThreadedConnectionPool | None = None
        # Maps execution_id -> psycopg2 connection used for that query
        self._active: dict[str, Any] = {}

    async def connect(self) -> None:
        cfg = self.info.config
        try:
            self._pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=5,
                host=cfg["host"],
                port=cfg.get("port", 5432),
                dbname=cfg["database"],
                user=cfg["user"],
                password=cfg.get("password", ""),
            )
            # Smoke-test the connection
            conn = self._pool.getconn()
            self._pool.putconn(conn)
            self.info.status = ConnectionStatus.CONNECTED
            self.info.error = None
        except Exception as exc:
            self.info.status = ConnectionStatus.ERROR
            self.info.error = str(exc)
            raise

    async def disconnect(self) -> None:
        if self._pool:
            self._pool.closeall()
            self._pool = None
        self.info.status = ConnectionStatus.DISCONNECTED

    async def execute(
        self, sql: str, params: dict | None = None, execution_id: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        if not self._pool:
            raise RuntimeError("Not connected")

        eid = execution_id or str(uuid.uuid4())
        conn = await asyncio.to_thread(self._pool.getconn)
        self._active[eid] = conn
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            await asyncio.to_thread(cur.execute, sql, params or {})
            if cur.description:
                while True:
                    rows = await asyncio.to_thread(cur.fetchmany, 500)
                    if not rows:
                        break
                    for row in rows:
                        yield dict(row)
            conn.commit()
        except psycopg2.extensions.QueryCanceledError:
            conn.rollback()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._active.pop(eid, None)
            await asyncio.to_thread(self._pool.putconn, conn)

    async def cancel(self, execution_id: str) -> None:
        conn = self._active.get(execution_id)
        if conn:
            # pg_cancel_backend via a separate connection
            cancel_conn = await asyncio.to_thread(
                psycopg2.connect,
                host=self.info.config["host"],
                port=self.info.config.get("port", 5432),
                dbname=self.info.config["database"],
                user=self.info.config["user"],
                password=self.info.config.get("password", ""),
            )
            try:
                pid = conn.get_backend_pid()
                cur = cancel_conn.cursor()
                await asyncio.to_thread(cur.execute, "SELECT pg_cancel_backend(%s)", (pid,))
                cancel_conn.commit()
            finally:
                cancel_conn.close()

    async def get_databases(self) -> list[str]:
        rows = []
        async for row in self.execute("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"):
            rows.append(row["datname"])
        return rows

    async def get_schemas(self, database: str = "") -> list[str]:  # noqa: ARG002
        _ = database
        rows = []
        async for row in self.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name"
        ):
            rows.append(row["schema_name"])
        return rows

    async def get_tables(self, database: str, schema: str) -> list[dict]:  # noqa: ARG002
        _ = database
        rows = []
        async for row in self.execute(
            "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = %(schema)s ORDER BY table_name",
            {"schema": schema},
        ):
            rows.append({"name": row["table_name"], "type": row["table_type"]})
        return rows

    async def get_columns(self, database: str, schema: str, table: str) -> list[dict]:  # noqa: ARG002
        _ = database
        rows = []
        async for row in self.execute(
            "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
            "WHERE table_schema = %(schema)s AND table_name = %(table)s ORDER BY ordinal_position",
            {"schema": schema, "table": table},
        ):
            rows.append({"name": row["column_name"], "type": row["data_type"], "nullable": row["is_nullable"]})
        return rows
