from fastapi import APIRouter, HTTPException
from ..explorer.introspection import get_databases, get_schemas, get_tables, get_columns

router = APIRouter(prefix="/api/connections/{connection_id}/explorer", tags=["explorer"])


@router.get("/databases")
async def databases(connection_id: str):
    try:
        return await get_databases(connection_id)
    except KeyError:
        raise HTTPException(404, "Connection not found")


@router.get("/databases/{database}/schemas")
async def schemas(connection_id: str, database: str):
    try:
        return await get_schemas(connection_id, database)
    except KeyError:
        raise HTTPException(404, "Connection not found")


@router.get("/databases/{database}/schemas/{schema}/tables")
async def tables(connection_id: str, database: str, schema: str):
    try:
        return await get_tables(connection_id, database, schema)
    except KeyError:
        raise HTTPException(404, "Connection not found")


@router.get("/databases/{database}/schemas/{schema}/tables/{table}/columns")
async def columns(connection_id: str, database: str, schema: str, table: str):
    try:
        return await get_columns(connection_id, database, schema, table)
    except KeyError:
        raise HTTPException(404, "Connection not found")
