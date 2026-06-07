from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import logging
import traceback

from .routers import connections as conn_router
from .routers import query as query_router
from .routers import explorer as explorer_router
from .routers import history as history_router
from .routers import export as export_router
from .routers import stats as stats_router
from .connections import persistence, registry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Restore saved connections on startup
    for info in persistence.load():
        try:
            await registry.add_connection(info)
            logger.info("Restored connection %r (%s)", info.name, info.type)
        except Exception as exc:
            logger.warning("Could not restore connection %r: %s", info.name, exc)
    yield


app = FastAPI(title="SQL Workbench", lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s:\n%s", request.method, request.url.path, traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": str(exc)})

app.include_router(conn_router.router)
app.include_router(query_router.router)
app.include_router(explorer_router.router)
app.include_router(history_router.router)
app.include_router(export_router.router)
app.include_router(stats_router.router)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve frontend if static dir exists (production / Docker)
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str = ""):  # noqa: ARG001
        del full_path
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
