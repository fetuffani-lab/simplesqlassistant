import asyncio
import uuid
from typing import Any, AsyncGenerator

import boto3
import pyathena
from pyathena import connect as athena_connect

from .base import BaseConnector, ConnectionInfo, ConnectionStatus


class AthenaConnector(BaseConnector):
    def __init__(self, connection_info: ConnectionInfo):
        super().__init__(connection_info)
        self._conn: Any = None
        self._athena_client: Any = None
        # Maps execution_id -> Athena QueryExecutionId
        self._active: dict[str, str] = {}

    def _make_session(self) -> boto3.Session:
        import os
        cfg = self.info.config
        auth = cfg.get("auth", "sso")

        if auth == "credentials":
            return boto3.Session(
                aws_access_key_id=cfg["aws_access_key_id"],
                aws_secret_access_key=cfg["aws_secret_access_key"],
                region_name=cfg.get("region", "us-east-1"),
            )

        if auth == "env":
            # Reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN,
            # and AWS_DEFAULT_REGION from the process environment
            return boto3.Session(
                aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
                aws_session_token=os.environ.get("AWS_SESSION_TOKEN"),
                region_name=os.environ.get("AWS_DEFAULT_REGION", cfg.get("region", "us-east-1")),
            )

        # sso / instance profile — let boto3 resolve automatically
        return boto3.Session(
            profile_name=cfg.get("profile_name") or None,
            region_name=cfg.get("region", "us-east-1"),
        )

    async def connect(self) -> None:
        cfg = self.info.config
        try:
            session = self._make_session()
            region = session.region_name or cfg.get("region", "us-east-1")

            # Resolve credentials eagerly — PyAthena may not honour boto3_session
            # in all versions, so we pass explicit keys instead.
            creds = await asyncio.to_thread(
                lambda: session.get_credentials().get_frozen_credentials()
            )

            self._athena_client = session.client("athena", region_name=region)

            connect_kwargs: dict = dict(
                region_name=region,
                schema_name=cfg.get("schema_name", "default"),
                aws_access_key_id=creds.access_key,
                aws_secret_access_key=creds.secret_key,
                aws_session_token=creds.token,
            )
            if cfg.get("s3_staging_dir"):
                connect_kwargs["s3_staging_dir"] = cfg["s3_staging_dir"]
            if cfg.get("work_group"):
                connect_kwargs["work_group"] = cfg["work_group"]

            self._conn = await asyncio.to_thread(athena_connect, **connect_kwargs)
            # Smoke-test
            await asyncio.to_thread(self._athena_client.list_work_groups)
            self.info.status = ConnectionStatus.CONNECTED
            self.info.error = None
        except Exception as exc:
            self.info.status = ConnectionStatus.ERROR
            self.info.error = str(exc)
            self._conn = None
            self._athena_client = None
            raise

    async def disconnect(self) -> None:
        if self._conn:
            try:
                await asyncio.to_thread(self._conn.close)
            except Exception:
                pass
            self._conn = None
        self.info.status = ConnectionStatus.DISCONNECTED

    async def execute(
        self, sql: str, params: dict | None = None, execution_id: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        if not self._conn:
            raise RuntimeError("Not connected")

        eid = execution_id or str(uuid.uuid4())
        cur = await asyncio.to_thread(self._conn.cursor)

        # Intercept the Athena QueryExecutionId so we can cancel it
        original_execute = cur.execute

        def tracked_execute(query, *args, **kwargs):
            result = original_execute(query, *args, **kwargs)
            if hasattr(cur, "query_id"):
                self._active[eid] = cur.query_id
            return result

        try:
            await asyncio.to_thread(tracked_execute, sql)
            description = cur.description or []
            columns = [col[0] for col in description]
            while True:
                rows = await asyncio.to_thread(cur.fetchmany, 500)
                if not rows:
                    break
                for row in rows:
                    yield dict(zip(columns, row))
        finally:
            self._active.pop(eid, None)

    async def cancel(self, execution_id: str) -> None:
        query_execution_id = self._active.get(execution_id)
        if query_execution_id and self._athena_client:
            await asyncio.to_thread(
                self._athena_client.stop_query_execution,
                QueryExecutionId=query_execution_id,
            )

    async def get_databases(self) -> list[str]:
        if not self._athena_client:
            return []
        response = await asyncio.to_thread(self._athena_client.list_data_catalogs)
        catalogs = [c["CatalogName"] for c in response.get("DataCatalogsSummary", [])]
        return catalogs or ["AwsDataCatalog"]

    async def get_schemas(self, database: str) -> list[str]:
        if not self._athena_client:
            return []
        response = await asyncio.to_thread(
            self._athena_client.list_databases,
            CatalogName=database,
        )
        return [db["Name"] for db in response.get("DatabaseList", [])]

    async def get_tables(self, database: str, schema: str) -> list[dict]:
        if not self._athena_client:
            return []
        paginator = self._athena_client.get_paginator("list_table_metadata")
        tables = []
        pages = await asyncio.to_thread(
            lambda: list(paginator.paginate(CatalogName=database, DatabaseName=schema))
        )
        for page in pages:
            for t in page.get("TableMetadataList", []):
                tables.append({"name": t["Name"], "type": t.get("TableType", "TABLE")})
        return tables

    async def get_columns(self, database: str, schema: str, table: str) -> list[dict]:
        if not self._athena_client:
            return []
        response = await asyncio.to_thread(
            self._athena_client.get_table_metadata,
            CatalogName=database,
            DatabaseName=schema,
            TableName=table,
        )
        cols = response.get("TableMetadata", {}).get("Columns", [])
        return [{"name": c["Name"], "type": c["Type"], "nullable": "YES"} for c in cols]
