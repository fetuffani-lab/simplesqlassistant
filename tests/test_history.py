import pytest
from backend.query import history


@pytest.fixture(autouse=True)
def tmp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "history.db")


def test_save_and_query():
    history.save("conn-1", "prod", "SELECT 1", "done", 100, 1)
    rows = history.query()
    assert len(rows) == 1
    assert rows[0]["sql"] == "SELECT 1"


def test_filter_by_connection():
    history.save("conn-1", "prod", "SELECT 1", "done", 100, 1)
    history.save("conn-2", "dev", "SELECT 2", "done", 50, 0)
    rows = history.query(connection_id="conn-1")
    assert all(r["connection_id"] == "conn-1" for r in rows)


def test_search():
    history.save("c", "c", "SELECT foo FROM bar", "done", 1, 0)
    history.save("c", "c", "SELECT baz", "done", 1, 0)
    rows = history.query(search="foo")
    assert len(rows) == 1


def test_clear():
    history.save("c", "c", "SELECT 1", "done", 1, 0)
    history.clear()
    assert history.query() == []


def test_max_entries():
    for i in range(5):
        history.save("c", "c", f"SELECT {i}", "done", 1, 0)
    history.query(limit=10)
    # trim to 3
    history.save("c", "c", "SELECT final", "done", 1, 0, max_entries=3)
    rows = history.query(limit=10)
    assert len(rows) == 3
