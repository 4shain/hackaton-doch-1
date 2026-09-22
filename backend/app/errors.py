from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Domain error with a stable machine-readable code. The frontend translates codes to Hebrew."""

    def __init__(self, code: str, status_code: int = 400, message: str | None = None, details: dict | None = None):
        super().__init__(message or code)
        self.code = code
        self.status_code = status_code
        self.message = message or code
        self.details = details or {}


def not_found(code: str = "NOT_FOUND") -> AppError:
    return AppError(code, 404)


def forbidden(code: str = "FORBIDDEN") -> AppError:
    return AppError(code, 403)


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )
