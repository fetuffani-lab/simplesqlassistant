from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..query.saved import list_saved, create, update, delete

router = APIRouter(prefix="/api/saved", tags=["saved"])


class CreateBody(BaseModel):
    name: str
    sql: str
    connection_id: str | None = None


class UpdateBody(BaseModel):
    name: str | None = None
    sql: str | None = None
    connection_id: str | None = None


@router.get("")
async def get_saved(search: str | None = None):
    return list_saved(search=search)


@router.post("", status_code=201)
async def create_saved(body: CreateBody):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="name is required")
    if not body.sql.strip():
        raise HTTPException(status_code=422, detail="sql is required")
    return create(body.name, body.sql, body.connection_id)


@router.put("/{id}")
async def update_saved(id: int, body: UpdateBody):
    row = update(id, body.name, body.sql, body.connection_id)
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return row


@router.delete("/{id}", status_code=204)
async def delete_saved(id: int):
    if not delete(id):
        raise HTTPException(status_code=404, detail="not found")
