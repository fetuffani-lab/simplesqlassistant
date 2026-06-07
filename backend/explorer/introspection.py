from ..connections.registry import get_connection


async def get_databases(connection_id: str) -> list[str]:
    return await get_connection(connection_id).get_databases()


async def get_schemas(connection_id: str, database: str) -> list[str]:
    return await get_connection(connection_id).get_schemas(database)


async def get_tables(connection_id: str, database: str, schema: str) -> list[dict]:
    return await get_connection(connection_id).get_tables(database, schema)


async def get_columns(connection_id: str, database: str, schema: str, table: str) -> list[dict]:
    return await get_connection(connection_id).get_columns(database, schema, table)
