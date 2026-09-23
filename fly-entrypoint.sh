#!/bin/sh
set -e

command -v pg_ctl >/dev/null 2>&1 || export PATH="$PATH:/usr/libexec/postgresql16:/usr/lib/postgresql/16/bin"

# Always on the mounted volume (the postgis image sets PGDATA to an ephemeral path).
PGDATA=/data/pg
export PGDATA
LOGFILE="${PGDATA}/postgres.log"

mkdir -p "$PGDATA"
chown -R postgres:postgres /data

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Initializing PostgreSQL data directory..."
  gosu postgres initdb -D "$PGDATA" -U doch1 --auth-local=trust --auth-host=trust
fi

gosu postgres pg_ctl -D "$PGDATA" -l "$LOGFILE" \
  -o "-c listen_addresses=127.0.0.1 -c shared_buffers=128MB -c max_connections=60 -c fsync=on" \
  -w start

until pg_isready -h 127.0.0.1 -p 5432 -q; do sleep 1; done

gosu postgres psql -U doch1 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='doch1'" | grep -q 1 \
  || gosu postgres createdb -U doch1 -O doch1 doch1

cd /backend
export PATH="/backend/.venv/bin:$PATH"

echo "Running migrations..."
alembic upgrade head
echo "Seeding reasons + roster (no-op if users already exist)..."
python -m app.cli seed

uvicorn app.main:app --host 127.0.0.1 --port 8000 &
UVICORN_PID=$!

mkdir -p /run/nginx
nginx

term_handler() {
  nginx -s quit 2>/dev/null || true
  kill "$UVICORN_PID" 2>/dev/null || true
  gosu postgres pg_ctl -D "$PGDATA" -m fast -w stop || true
  exit 0
}
trap term_handler TERM INT

wait "$UVICORN_PID"
