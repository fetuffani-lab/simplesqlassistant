"""Fast API smoke tests (no real DB connection required)."""
import pytest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_connections_empty():
    r = client.get("/api/connections")
    assert r.status_code == 200
    assert r.json() == []


def test_create_connection_bad_type():
    r = client.post("/api/connections", json={"name": "test", "type": "unknown", "config": {}})
    assert r.status_code == 400


def test_delete_missing_connection():
    r = client.delete("/api/connections/nonexistent")
    assert r.status_code == 404


def test_history_empty():
    r = client.get("/api/history")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
