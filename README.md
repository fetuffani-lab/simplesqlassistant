# SQL Workbench

A web-based SQL client for PostgreSQL and AWS Athena.

## Features

- SQL editor with syntax highlighting, autocomplete, and Ctrl+Enter to run
- Multiple renameable query tabs
- Database explorer: connection → database → schema → table → column
- Double-click a table to insert `schema.table` into the active editor; double-click a column to insert its name
- Query history with search and replay
- Jinja-style parameters (`{{ variable }}`) with array expansion for batch execution
- Configurable automatic LIMIT injection (default 100 rows)
- Export to CSV and XLSX with configurable column and decimal separators
- Connections persisted across sessions
- Multi-database PostgreSQL browsing via inline secondary connections
- AWS Athena with SSO, access key, or environment variable authentication

---

## Requirements

| Component | Minimum version |
|---|---|
| Python | 3.11 |
| Node.js | 18 |
| npm | 9 |

To run via Docker: Docker Desktop only, no Python or Node required.

---

## Installation — Linux / macOS

```bash
# 1. Clone the repository
git clone <url> simplesqlassistant
cd simplesqlassistant

# 2. Environment variables
cp .env.example .env
# edit .env if needed

# 3. Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 4. Python dependencies
pip install -r requirements.txt

# 5. Frontend build (required once, and after updates)
cd frontend
npm install
npm run build
cd ..

# 6. Run
python3 main.py
```

Opens automatically at `http://localhost:8000`.

---

## Installation — Windows

```bat
:: 1. Clone the repository
git clone <url> simplesqlassistant
cd simplesqlassistant

:: 2. Environment variables
copy .env.example .env

:: 3. Python virtual environment
python -m venv .venv
.venv\Scripts\activate

:: 4. Python dependencies
pip install -r requirements.txt

:: 5. Frontend build
cd frontend
npm install
npm run build
cd ..

:: 6. Run
python main.py
```

Opens automatically at `http://localhost:8000`.

---

## Installation — Docker

```bash
# Start
docker compose up --build

# Stop
docker compose down
```

Connections and history are persisted in `~/.sqlworkbench/`.

On Windows, edit `docker-compose.yml` and replace the volume mapping:
```yaml
volumes:
  - ${USERPROFILE}/.sqlworkbench:/root/.sqlworkbench
```

---

## Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server port |
| `QUERY_DEFAULT_LIMIT` | `100` | Maximum rows returned per query |
| `RESULTS_PREVIEW_LIMIT` | `1000` | Maximum rows shown in the results grid |
| `HISTORY_MAX_ENTRIES` | `10000` | Maximum query history entries kept |
| `SQLWORKBENCH_DATA` | `~/.sqlworkbench` | Directory for saved connections and history |

---

## Adding connections

### PostgreSQL

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "postgres",
  "password": "secret"
}
```

### AWS Athena — SSO / AWS profile

```json
{
  "region": "us-east-1",
  "s3_staging_dir": "s3://my-bucket/athena/",
  "schema_name": "default",
  "auth": "sso"
}
```

### AWS Athena — access key

```json
{
  "region": "us-east-1",
  "s3_staging_dir": "s3://my-bucket/athena/",
  "schema_name": "default",
  "auth": "credentials",
  "aws_access_key_id": "AKIA...",
  "aws_secret_access_key": "..."
}
```

### AWS Athena — environment variables

```json
{
  "s3_staging_dir": "s3://my-bucket/athena/",
  "schema_name": "default",
  "auth": "env"
}
```

Environment variables read from the process:

| Variable | Required |
|---|---|
| `AWS_ACCESS_KEY_ID` | yes |
| `AWS_SECRET_ACCESS_KEY` | yes |
| `AWS_SESSION_TOKEN` | no (for temporary credentials) |
| `AWS_DEFAULT_REGION` | no (falls back to `us-east-1`) |

---

## Usage

### Running a query

1. Select a connection from the dropdown in the editor toolbar
2. Write your SQL
3. Press **Ctrl+Enter** or click **▶ Run**

### Query parameters (Jinja)

```sql
SELECT * FROM orders WHERE status = {{ status }}
```

In the parameters panel below the editor:
```json
{ "status": "pending" }
```

Array values run the query once per element:
```sql
SELECT * FROM orders WHERE region = {{ region }}
```
```json
{ "region": ["SP", "RJ", "MG"] }
```

### Explorer

- Expand a connection to see all available databases
- Click **connect** next to a database to browse its schemas inline
- Double-click a table → inserts `schema.table` into the active editor
- Double-click a column → inserts the column name
- Click ↺ on a connection to refresh its tree

### Exporting results

After running a query, click **Export…** in the results panel. Choose format (CSV or XLSX), column separator, and decimal separator.

---

## Updating

```bash
git pull

source .venv/bin/activate      # Linux/macOS
# or .venv\Scripts\activate    # Windows

pip install -r requirements.txt

cd frontend
npm install
npm run build
cd ..

python3 main.py
```

---

## Project structure

```
simplesqlassistant/
├── backend/
│   ├── connections/     # PostgreSQL and Athena connectors
│   ├── query/           # Executor, templating, history, row serialization
│   ├── routers/         # FastAPI endpoints
│   ├── ws/              # WebSocket handler for query streaming
│   └── export/          # CSV / XLSX export
├── frontend/
│   └── src/
│       ├── components/  # React UI components
│       ├── store/       # Zustand state
│       ├── hooks/       # WebSocket hook
│       └── lib/         # Editor registry, schema cache
├── tests/
├── main.py              # Entry point (starts server + opens browser)
├── requirements.txt
└── .env
```
