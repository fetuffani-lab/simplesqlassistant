import re
from typing import Any


def render(sql: str, params: dict[str, Any]) -> str:
    """Replace {{ var }} placeholders with param values."""
    def replacer(m: re.Match) -> str:
        key = m.group(1).strip()
        if key not in params:
            raise KeyError(f"Template variable '{key}' not found in params")
        return str(params[key])

    return re.sub(r"\{\{\s*(\w+)\s*\}\}", replacer, sql)


def expand(sql: str, params: dict | list | None) -> list[tuple[str, dict]]:
    """
    Returns a list of (rendered_sql, param_dict) pairs.
    - None / {} → single execution with empty params
    - dict      → single execution with substitution
    - list      → one execution per item
    """
    if not params:
        return [(sql, {})]
    if isinstance(params, dict):
        return [(render(sql, params), params)]
    # list of dicts
    return [(render(sql, p), p) for p in params]
