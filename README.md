# SQL Workbench

SQL client web para PostgreSQL e AWS Athena. Substituto do 

## Funcionalidades

- Editor SQL com syntax highlighting, autocomplete e Ctrl+Enter para executar
- Múltiplas abas de query renomeáveis
- Explorer de banco de dados com navegação por conexão → database → schema → tabela → coluna
- Double-click em tabela insere `schema.tabela` no editor; double-click em coluna insere o nome
- Histórico de queries com filtro e replay
- Suporte a parâmetros Jinja (`{{ variavel }}`) com arrays e loops
- LIMIT automático configurável (padrão 100 linhas)
- Export para CSV e XLSX com separador de colunas e separador decimal configuráveis
- Conexões persistidas entre sessões
- Suporte a múltiplos databases PostgreSQL via conexão secundária inline
- AWS Athena com autenticação SSO, chave de acesso ou variáveis de ambiente

---

## Requisitos

| Componente | Versão mínima |
|---|---|
| Python | 3.11 |
| Node.js | 18 |
| npm | 9 |

Para rodar via Docker: apenas Docker Desktop.

---

## Instalação — Linux / macOS

```bash
# 1. Clonar o repositório
git clone <url> simplesqlassistant
cd simplesqlassistant

# 2. Variáveis de ambiente
cp .env.example .env
# edite .env se necessário

# 3. Ambiente virtual Python
python3 -m venv .venv
source .venv/bin/activate

# 4. Dependências Python
pip install -r requirements.txt

# 5. Build do frontend (necessário apenas uma vez, ou após atualizações)
cd frontend
npm install
npm run build
cd ..

# 6. Executar
python3 main.py
```

Abre automaticamente em `http://localhost:8000`.

---

## Instalação — Windows

```bat
:: 1. Clonar o repositório
git clone <url> simplesqlassistant
cd simplesqlassistant

:: 2. Variáveis de ambiente
copy .env.example .env

:: 3. Ambiente virtual Python
python -m venv .venv
.venv\Scripts\activate

:: 4. Dependências Python
pip install -r requirements.txt

:: 5. Build do frontend
cd frontend
npm install
npm run build
cd ..

:: 6. Executar
python main.py
```

---

## Instalação — Docker

```bash
# Subir
docker compose up --build

# Parar
docker compose down
```

Os dados (conexões salvas, histórico) são persistidos em `~/.sqlworkbench/`.

No Windows, edite `docker-compose.yml` e troque o volume:
```yaml
volumes:
  - ${USERPROFILE}/.sqlworkbench:/root/.sqlworkbench
```

---

## Configuração (.env)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8000` | Porta do servidor |
| `QUERY_DEFAULT_LIMIT` | `100` | Linhas máximas retornadas por query |
| `SQLWORKBENCH_DATA` | `~/.sqlworkbench` | Diretório para conexões salvas e histórico |

---

## Adicionar conexões

### PostgreSQL

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "meu_banco",
  "user": "postgres",
  "password": "senha"
}
```

### AWS Athena — SSO / perfil AWS

```json
{
  "region": "us-east-1",
  "s3_staging_dir": "s3://meu-bucket/athena/",
  "schema_name": "default",
  "auth": "sso"
}
```

### AWS Athena — chave de acesso

```json
{
  "region": "us-east-1",
  "s3_staging_dir": "s3://meu-bucket/athena/",
  "schema_name": "default",
  "auth": "credentials",
  "aws_access_key_id": "AKIA...",
  "aws_secret_access_key": "..."
}
```

### AWS Athena — variáveis de ambiente

```json
{
  "s3_staging_dir": "s3://meu-bucket/athena/",
  "schema_name": "default",
  "auth": "env"
}
```

Variáveis lidas do ambiente:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (opcional)
- `AWS_DEFAULT_REGION`

---

## Uso

### Executar query
- Selecione a conexão no dropdown do editor
- Escreva o SQL e pressione **Ctrl+Enter** ou clique em **▶ Run**

### Parâmetros Jinja
```sql
SELECT * FROM orders WHERE status = {{ status }}
```
No painel de parâmetros (abaixo do editor), informe:
```json
{ "status": "pending" }
```

Para arrays (gera múltiplas execuções):
```sql
SELECT * FROM orders WHERE region = {{ region }}
```
```json
{ "region": ["SP", "RJ", "MG"] }
```

### Explorer
- Expanda uma conexão para ver os databases disponíveis
- Clique em **connect** ao lado de um database para conectar inline
- Double-click em uma tabela insere `schema.tabela` no editor ativo
- Double-click em uma coluna insere o nome da coluna

### Export
Após executar uma query, clique em **Export…** no painel de resultados. Escolha CSV ou XLSX, separador de colunas e separador decimal.

---

## Atualizar

```bash
git pull
source .venv/bin/activate       # Linux/macOS
# ou .venv\Scripts\activate     # Windows

pip install -r requirements.txt

cd frontend
npm install
npm run build
cd ..

python3 main.py
```

---

## Estrutura do projeto

```
simplesqlassistant/
├── backend/
│   ├── connections/     # Conectores PostgreSQL e Athena
│   ├── query/           # Executor, templating, histórico, serialização
│   ├── routers/         # Endpoints FastAPI
│   ├── ws/              # Handler WebSocket para queries
│   └── export/          # Exportação CSV/XLSX
├── frontend/
│   └── src/
│       ├── components/  # UI React
│       ├── store/       # Estado Zustand
│       ├── hooks/       # WebSocket hook
│       └── lib/         # Registry do editor, cache de schema
├── tests/
├── main.py              # Entrypoint (abre browser + uvicorn)
├── requirements.txt
└── .env
```
