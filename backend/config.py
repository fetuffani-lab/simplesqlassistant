import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", 8000))
RESULTS_PREVIEW_LIMIT = int(os.getenv("RESULTS_PREVIEW_LIMIT", 1000))
QUERY_DEFAULT_LIMIT = int(os.getenv("QUERY_DEFAULT_LIMIT", 100))
HISTORY_MAX_ENTRIES = int(os.getenv("HISTORY_MAX_ENTRIES", 10000))
DB_STATS_POLL_INTERVAL_SECONDS = int(os.getenv("DB_STATS_POLL_INTERVAL_SECONDS", 30))
DEFAULT_CONNECTIONS_FILE = os.getenv("DEFAULT_CONNECTIONS_FILE", "connections.json")
