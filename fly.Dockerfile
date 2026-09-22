# syntax=docker/dockerfile:1
# Single-VM image: PostgreSQL 16 + PostGIS 3.4, FastAPI backend, nginx-served frontend.

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.12-alpine AS backend-build
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
WORKDIR /backend
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ .

FROM postgis/postgis:16-3.4-alpine
RUN apk add --no-cache nginx libstdc++ libgcc \
    && rm -f /etc/nginx/http.d/default.conf

COPY --from=backend-build /usr/local /usr/local
COPY --from=backend-build /backend /backend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.fly.conf /etc/nginx/http.d/default.conf
COPY fly-entrypoint.sh /usr/local/bin/fly-entrypoint.sh
RUN chmod +x /usr/local/bin/fly-entrypoint.sh

ENV APP_ENV=development \
    DEV_LOGIN_ENABLED=true \
    DATABASE_URL=postgresql+psycopg://doch1@127.0.0.1:5432/doch1 \
    TIMEZONE=Asia/Jerusalem \
    DAILY_JOB_HOUR=8 \
    SCHEDULER_ENABLED=true \
    SESSION_TTL_HOURS=12

EXPOSE 8080
ENTRYPOINT ["fly-entrypoint.sh"]
