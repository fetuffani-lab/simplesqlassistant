import sqlite3
import time
from typing import Any

from ..data_dir import get_data_dir

DB_PATH = get_data_dir() / "saved.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sql TEXT NOT NULL,
            connection_id TEXT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    conn.commit()
    return conn


def list_saved(search: str | None = None) -> list[dict[str, Any]]:
    args: list[Any] = []
    where = ""
    if search:
        where = "WHERE name LIKE ? OR sql LIKE ?"
        args = [f"%{search}%", f"%{search}%"]
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM saved_queries {where} ORDER BY name COLLATE NOCASE",
            args,
        ).fetchall()
    return [dict(r) for r in rows]


def create(name: str, sql: str, connection_id: str | None) -> dict[str, Any]:
    now = time.time()
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO saved_queries (name, sql, connection_id, created_at, updated_at) VALUES (?,?,?,?,?)",
            (name.strip(), sql, connection_id, now, now),
        )
        row = conn.execute("SELECT * FROM saved_queries WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


def update(id: int, name: str | None, sql: str | None, connection_id: str | None) -> dict[str, Any] | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM saved_queries WHERE id = ?", (id,)).fetchone()
        if not row:
            return None
        current = dict(row)
        new_name = name.strip() if name is not None else current["name"]
        new_sql = sql if sql is not None else current["sql"]
        new_conn = connection_id if connection_id is not None else current["connection_id"]
        conn.execute(
            "UPDATE saved_queries SET name=?, sql=?, connection_id=?, updated_at=? WHERE id=?",
            (new_name, new_sql, new_conn, time.time(), id),
        )
        row = conn.execute("SELECT * FROM saved_queries WHERE id = ?", (id,)).fetchone()
    return dict(row)


def delete(id: int) -> bool:
    with _conn() as conn:
        cur = conn.execute("DELETE FROM saved_queries WHERE id = ?", (id,))
    return cur.rowcount > 0
