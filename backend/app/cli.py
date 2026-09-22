"""Developer commands.

    uv run python -m app.cli seed [--reset]
    uv run python -m app.cli run-daily-job [--date YYYY-MM-DD]
"""

import argparse
import json
from datetime import date

from app.db import SessionLocal
from app.seed import seed
from app.services.daily_job import run_daily_job
from app.timeutil import local_today


def main() -> None:
    parser = argparse.ArgumentParser(prog="doch1")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seed", help="load fictional demo data")
    s.add_argument("--reset", action="store_true", help="wipe all data first")
    j = sub.add_parser("run-daily-job", help="run the 08:00 processing for a date")
    j.add_argument("--date", type=date.fromisoformat, default=None)
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.cmd == "seed":
            created = seed(db, force=args.reset)
            print("seeded demo data" if created else "data already present (use --reset to reseed)")
        elif args.cmd == "run-daily-job":
            print(json.dumps(run_daily_job(db, args.date or local_today()), ensure_ascii=False))


if __name__ == "__main__":
    main()
