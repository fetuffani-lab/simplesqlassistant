import json

from .base import ConnectionInfo
from ..data_dir import get_data_dir

CONNECTIONS_FILE = get_data_dir() / "connections.json"


def save(connections: list[ConnectionInfo]) -> None:
    CONNECTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = [
        {"id": c.id, "name": c.name, "type": c.type, "config": c.config}
        for c in connections
    ]
    CONNECTIONS_FILE.write_text(json.dumps(data, indent=2))


def load() -> list[ConnectionInfo]:
    if not CONNECTIONS_FILE.exists():
        return []
    try:
        data = json.loads(CONNECTIONS_FILE.read_text())
        return [ConnectionInfo(id=d["id"], name=d["name"], type=d["type"], config=d["config"]) for d in data]
    except Exception:
        return []
