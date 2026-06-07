from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..connections.base import ConnectionInfo
from ..connections import registry

router = APIRouter(prefix="/api/connections", tags=["connections"])


class CreateConnectionRequest(BaseModel):
    name: str
    type: str  # "postgres" | "athena"
    config: dict


@router.get("")
async def list_connections():
    return [_serialize(info) for info in registry.list_connections()]


@router.post("", status_code=201)
async def create_connection(body: CreateConnectionRequest):
    if body.type not in ("postgres", "athena"):
        raise HTTPException(status_code=400, detail=f"Unknown connection type: {body.type!r}")
    info = ConnectionInfo(name=body.name, type=body.type, config=body.config)
    connector = await registry.add_connection(info)
    return _serialize(connector.info)


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(connection_id: str):
    try:
        await registry.remove_connection(connection_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Connection not found")


@router.post("/{connection_id}/fork")
async def fork_connection(connection_id: str, body: dict):
    """Create a new connection based on an existing one, overriding specific config keys."""
    try:
        source = registry.get_connection(connection_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Connection not found")

    overrides: dict = body.get("config", {})
    new_config = {**source.info.config, **overrides}
    # Build a readable name from the override, e.g. "prod-postgres/mydb"
    db_suffix = overrides.get("database", "")
    new_name = f"{source.info.name}/{db_suffix}" if db_suffix else source.info.name

    info = ConnectionInfo(name=new_name, type=source.info.type, config=new_config)
    connector = await registry.add_connection(info)
    return _serialize(connector.info)


@router.post("/{connection_id}/reconnect")
async def reconnect(connection_id: str):
    try:
        connector = registry.get_connection(connection_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        await connector.connect()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _serialize(connector.info)


def _serialize(info: ConnectionInfo) -> dict:
    # Expose config without password so the frontend can read e.g. the database name
    safe_config = {k: v for k, v in info.config.items() if k not in ("password", "aws_secret_access_key")}
    return {
        "id": info.id,
        "name": info.name,
        "type": info.type,
        "status": info.status,
        "error": info.error,
        "config": safe_config,
    }
