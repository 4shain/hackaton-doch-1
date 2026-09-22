import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db import SessionLocal
from app.errors import AppError, app_error_handler
from app.routers import auth, checkins, commander, hr, notifications, soldier
from app.services.daily_job import scheduler_loop

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(scheduler_loop()) if get_settings().scheduler_enabled else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Doch 1 API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(AppError, app_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "invalid request", "details": {"errors": exc.errors()[:5]}}},
    )


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    code = "DUPLICATE_REPORT" if "uq_report_soldier_date" in str(exc.orig) else "CONFLICT"
    return JSONResponse(status_code=409, content={"error": {"code": code, "message": code, "details": {}}})


for r in (auth.router, soldier.router, commander.router, hr.router, checkins.router, notifications.router):
    app.include_router(r)


@app.get("/api/health")
def health() -> dict:
    with SessionLocal() as db:
        postgis = db.execute(text("SELECT postgis_version()")).scalar()
    return {"ok": True, "postgis": postgis}
