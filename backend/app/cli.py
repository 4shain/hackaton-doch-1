"""Developer commands.

    uv run python -m app.cli seed [--reset]
    uv run python -m app.cli run-daily-job [--date YYYY-MM-DD]
    uv run python -m app.cli run-anomaly-scan [--date YYYY-MM-DD] [--unit UNIT_ID]
"""

import argparse
import asyncio
import json
from datetime import date

from app.db import SessionLocal
from app.seed import seed
from app.services.anomaly import run_anomaly_scan
from app.services.daily_job import run_daily_job
from app.timeutil import local_today


def main() -> None:
    parser = argparse.ArgumentParser(prog="doch1")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seed", help="load attendance reasons + the roster (ROSTER_PATH)")
    s.add_argument("--reset", action="store_true", help="wipe ALL data first (users, reports, everything)")
    j = sub.add_parser("run-daily-job", help="run the 08:00 processing for a date")
    j.add_argument("--date", type=date.fromisoformat, default=None)
    a = sub.add_parser("run-anomaly-scan", help="run the nightly Jev anomaly scan now")
    a.add_argument("--date", type=date.fromisoformat, default=None, help="scan the days before this date")
    a.add_argument("--unit", type=int, default=None, help="only this unit (manual run)")
    args = parser.parse_args()

    if args.cmd == "run-anomaly-scan":
        trigger = "manual" if args.unit else "nightly"
        result = asyncio.run(run_anomaly_scan(args.date or local_today(), args.unit, trigger))
        print(json.dumps(result, ensure_ascii=False, default=str) if result else "nightly run already done for that date")
        return

    with SessionLocal() as db:
        if args.cmd == "seed":
            created = seed(db, force=args.reset)
            print("seeded reasons + roster" if created else "data already present (use --reset to reseed)")
        elif args.cmd == "run-daily-job":
            print(json.dumps(run_daily_job(db, args.date or local_today()), ensure_ascii=False))


if __name__ == "__main__":
    main()
