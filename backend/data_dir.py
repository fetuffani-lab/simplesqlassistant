import os
from pathlib import Path


def get_data_dir() -> Path:
    """
    Returns ~/.sqlworkbench, resolving HOME robustly.
    Priority: SQLWORKBENCH_DATA env var > HOME env var > /root (container default).
    """
    if custom := os.environ.get("SQLWORKBENCH_DATA"):
        return Path(custom)
    home = os.environ.get("HOME", "").strip()
    if home and home != "/":
        return Path(home) / ".sqlworkbench"
    # Running as root in a container without HOME set
    return Path("/root/.sqlworkbench")
