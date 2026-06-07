import sqlite3
import time
from typing import Any

from ..data_dir import get_data_dir

DB_PATH = get_data_dir() / "history.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            connection_id TEXT,
            connection_name TEXT,
            sql TEXT NOT NULL,
            status TEXT,
            duration_ms REAL,
            rows_returned INTEGER
        )
    """)
    conn.commit()
    return conn


def save(
    connection_id: str,
    connection_name: str,
    sql: str,
    status: str,
    duration_ms: float,
    rows_returned: int,
    max_entries: int = 10000,
) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO history (timestamp, connection_id, connection_name, sql, status, duration_ms, rows_returned) VALUES (?,?,?,?,?,?,?)",
            (time.time(), connection_id, connection_name, sql, status, duration_ms, rows_returned),
        )
        # Trim excess
        conn.execute(
            "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY timestamp DESC LIMIT ?)",
            (max_entries,),
        )


def query(
    connection_id: str | None = None,
    search: str | None = None,
    since: float | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    filters = []
    args: list[Any] = []
    if connection_id:
        filters.append("connection_id = ?")
        args.append(connection_id)
    if search:
        filters.append("sql LIKE ?")
        args.append(f"%{search}%")
    if since:
        filters.append("timestamp >= ?")
        args.append(since)

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    args.append(limit)
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM history {where} ORDER BY timestamp DESC LIMIT ?", args
        ).fetchall()
    return [dict(r) for r in rows]


def clear() -> None:
    with _conn() as conn:
        conn.execute("DELETE FROM history")
