from .base import ConnectionInfo, BaseConnector
from .postgres import PostgresConnector
from .athena import AthenaConnector
from . import persistence

_connectors: dict[str, BaseConnector] = {}


def _make_connector(info: ConnectionInfo) -> BaseConnector:
    if info.type == "postgres":
        return PostgresConnector(info)
    if info.type == "athena":
        return AthenaConnector(info)
    raise ValueError(f"Unknown connector type: {info.type}")


def _save() -> None:
    try:
        persistence.save(list_connections())
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to persist connections: %s", exc)


async def add_connection(info: ConnectionInfo) -> BaseConnector:
    connector = _make_connector(info)
    try:
        await connector.connect()
    except Exception:
        pass  # connection saved in error state; caller checks info.status
    _connectors[info.id] = connector
    _save()
    return connector


async def remove_connection(connection_id: str) -> None:
    connector = _connectors.pop(connection_id, None)
    if connector is None:
        raise KeyError(connection_id)
    await connector.disconnect()
    _save()


def get_connection(connection_id: str) -> BaseConnector:
    conn = _connectors.get(connection_id)
    if not conn:
        raise KeyError(f"Connection {connection_id!r} not found")
    return conn


def list_connections() -> list[ConnectionInfo]:
    return [c.info for c in _connectors.values()]
