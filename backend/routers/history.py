from fastapi import APIRouter
from ..query.history import query as query_history, clear as clear_history

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def get_history(
    connection_id: str | None = None,
    search: str | None = None,
    since: float | None = None,
    limit: int = 200,
):
    return query_history(connection_id=connection_id, search=search, since=since, limit=limit)


@router.delete("")
async def delete_history():
    clear_history()
    return {"cleared": True}
