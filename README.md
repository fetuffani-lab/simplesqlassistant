# SQL Workbench

[![tests](https://github.com/fetuffani-lab/simplesqlassistant/actions/workflows/tests.yml/badge.svg)](https://github.com/fetuffani-lab/simplesqlassistant/actions/workflows/tests.yml)
[![docker](https://img.shields.io/github/actions/workflow/status/fetuffani-lab/simplesqlassistant/tests.yml?label=docker%20build&logo=docker)](https://github.com/fetuffani-lab/simplesqlassistant/pkgs/container/simplesqlassistant)

A web-based SQL client for PostgreSQL and AWS Athena.

## Features

**Editor**
- SQL editor with syntax highlighting and smart autocomplete (tables, columns, keywords)
- Multiple tabs — renameable by double-clicking the tab title
- Ctrl+Enter to run, ■ Stop button to cancel a running query
- Jinja-style parameters (`{{ variable }}`) with array expansion for batch execution
- Configurable automatic LIMIT injection (default 100 rows)
- **Save button** — name and persist any query for later reuse

**Explorer**
- Four-tier tree: connection → database → schema → tables/views → columns
- Multiple PostgreSQL connections to the same server are grouped under one root node
- Click **connect** next to a database to browse its schemas on the fly
- Double-click a table → inserts `schema.table` into the active editor
- Double-click a column → inserts the column name
- ↺ button to refresh a connection tree

**Saved queries**
- Save the current query with a custom name
- Browse, search, rename, and delete saved queries from the **Saved** panel
- Click ↗ or double-click a saved query to open it in a new editor tab
- Creation date shown for each entry (`yyyy/mm/dd hh:mm:ss`)

**History**
- Full query history with status (done / error / cancelled), duration, and row count
- Search by SQL text or connection
- Running queries shown at the top with a ■ Stop button
- Color-coded status: green = done, red = error, yellow = running, grey = cancelled
- Click any entry to replay it in a new tab

**Results**
- Sortable results grid
- Long strings (> 1 000 chars) truncated in the grid with full value on hover
- Binary columns displayed as `[blob]` and excluded from exports
- Export to CSV or XLSX with configurable column and decimal separators

**Connections**
- Structured form with per-field hints — no raw JSON required
- PostgreSQL and AWS Athena (SSO / access key / environment variables)
- Connections persisted across sessions
- Inline error display with retry button

---

## Requirements

| Component | Minimum version |
|---|---|
| Python | 3.11 |
| Node.js | 20 |
| npm | 9 |

To run via Docker: Docker Desktop only, no Python or Node required.

---

## Installation — Linux / macOS

```bash
# 1. Clone the repository
git clone https://github.com/fetuffani-lab/simplesqlassistant.git
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
git clone https://github.com/fetuffani-lab/simplesqlassistant.git
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

Pull the pre-built image from GitHub Container Registry:

```bash
docker pull ghcr.io/fetuffani-lab/simplesqlassistant:latest
docker run -p 8000:8000 -v ~/.sqlworkbench:/root/.sqlworkbench ghcr.io/fetuffani-lab/simplesqlassistant:latest
```

Or build locally with Docker Compose:

```bash
# Start
docker compose up --build

# Stop
docker compose down
```

Connections, history, and saved queries are persisted in `~/.sqlworkbench/`.

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
| `SQLWORKBENCH_DATA` | `~/.sqlworkbench` | Directory for connections, history, and saved queries |

---

## Adding connections

Connections are configured through the UI — open the **Connections** panel and fill in the form. No raw JSON required. Below are the available parameters for reference.

### PostgreSQL

| Field | Required | Description |
|---|---|---|
| Host | yes | Hostname or IP of the server |
| Port | no | Defaults to `5432` |
| Database | yes | Database name |
| User | yes | Login username |
| Password | no | Leave empty if not required |

### AWS Athena — SSO / AWS profile

| Field | Required | Description |
|---|---|---|
| Region | no | AWS region (e.g. `us-east-1`) |
| Profile name | no | Named profile from `~/.aws/config`; leave empty for the default profile |
| Default schema | no | Athena database selected by default |
| S3 staging dir | no | Output location (e.g. `s3://my-bucket/athena/`); can be omitted if set on the workgroup |
| Workgroup | no | Defaults to `primary` |

### AWS Athena — access key

| Field | Required | Description |
|---|---|---|
| Region | yes | AWS region |
| Access Key ID | yes | Starts with `AKIA` (long-term) or `ASIA` (temporary) |
| Secret Access Key | yes | Associated secret key |
| Default schema | no | Athena database selected by default |
| S3 staging dir | no | Output location |
| Workgroup | no | Defaults to `primary` |

### AWS Athena — environment variables

Reads credentials from the process environment. Set the following before starting the app:

| Variable | Required | Description |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | yes | Access key ID |
| `AWS_SECRET_ACCESS_KEY` | yes | Secret access key |
| `AWS_SESSION_TOKEN` | no | Session token (temporary credentials) |
| `AWS_DEFAULT_REGION` | no | Region — falls back to `us-east-1` |

---

## Usage

### Running a query

1. Select a connection from the dropdown in the editor toolbar
2. Write your SQL
3. Press **Ctrl+Enter** or click **▶ Run**

To stop a running query, click **■ Stop**.

### Query parameters (Jinja)

Use `{{ variable }}` placeholders in SQL and provide values in the parameters panel below the editor:

```sql
SELECT * FROM orders WHERE status = {{ status }}
```
```json
{ "status": "pending" }
```

Array values run the query once per element and collect all results:

```sql
SELECT * FROM orders WHERE region = {{ region }}
```
```json
{ "region": ["SP", "RJ", "MG"] }
```

### Saving a query

1. Write SQL in the editor
2. Click **Save** in the toolbar
3. Enter a name and press **Enter**

The query appears in the **Saved** panel. From there you can open it (↗ or double-click), rename (✎ or double-click the name), or delete (×).

### Explorer

- Expand a server node to see all available databases
- Click **connect** next to a database to load its schemas and tables
- Double-click a table → inserts `schema.table` into the active editor
- Double-click a column → inserts the column name
- Click ↺ on any node to refresh

### Exporting results

After running a query, click **Export…** in the results panel toolbar. Select format (CSV or XLSX), column separator, and decimal separator.

Binary columns are excluded from exports and shown as `[blob]` in the grid.

---

## Updating

```bash
git pull

source .venv/bin/activate      # Linux/macOS
# or: .venv\Scripts\activate   # Windows

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
│   ├── query/           # Executor, templating, history, saved queries, row serialization
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
