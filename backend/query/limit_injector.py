import re

_HAS_LIMIT = re.compile(r'\bLIMIT\b', re.IGNORECASE)
_IS_SELECT = re.compile(r'^\s*(SELECT|WITH)\b', re.IGNORECASE)


def inject_limit(sql: str, limit: int) -> str:
    """Append LIMIT N to SELECT queries that don't already have one."""
    if not _IS_SELECT.match(sql):
        return sql
    if _HAS_LIMIT.search(sql):
        return sql
    return sql.rstrip().rstrip(';') + f'\nLIMIT {limit}'
