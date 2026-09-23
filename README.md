# hackaton-doch-1

## Entities
### Unit
Each unit has a single commander, and possibly some HRs.

Each unit has the following attributes:
1. ID;
2. Name;
3. Parent unit (with the exception of the "top" unit);
4. Commander;
5. HRs.

### User
A user is a soldier. Every soldier has the following attributes:
1. Personal number (ID);
2. Full name;
3. Commander (with the exception of the "top" soldier);
4. Unit.

#### Roles
There are a few roles a soldier can have:
1. commander;
2. human resources (HR).

Every soldier is a soldier, and a soldier being a commander or an HR is independent. You can have four kinds of soldiers:
1. a simple soldier;
2. a commander (also a soldier), e.g. a team commander;
3. an HR (also a soldier), e.g. a soldier in the HR office;
4. an HR and a commander, e.g. the commander of the HR office.

A soldier has the role of a commander if it is defined as the commander of another soldier. A soldier has the roler of an HR if it is defined as an HR of their unit.

### Attendence Report
Each day every soldier can submit an attedence report, or their commander or unit's HR can submit on their behalf.

Every attendence report has the following attributes:
1. Date;
2. Soldier ID;
3. Soldier reported status;
4. Soldier reported notes;
5. Commander reported status;
6. Commander reported notes;
7. HR reported status;
8. HR reported notes.


### "Yarok Ba'enyim" Report
This part is currently left unspecified.

## Requirements
### Soldier
Must have: As a soldier I can report my status.
Must have: As a soldier I can report my future statuses.
Must have: As a soldier I can answer "Yarok Ba'enayim."
Should have: As a soldier I get notifications when I get "Yarok Ba'enayim."
Nice to have: As a soldier I can see my past statuses.
Nice to have: As a soldier I can write to a chatbot to report my statuses.
Nice to have: As a soldier I get a notification when I need to report my status.
Nice to have: As a soldier I see when the report is frozen and becomes a status.

### Commander
Must have: As a commander I can see my soldiers' status reports.
Must have: As a commander I can change my soldiers' status reports.
Must have: As a commander I can see my soldiers' past statuses.
Must have: As a commander I can request "Yarok Ba'enayim" for all my transitive soldiers.
Must have: As a commander I can see "Yarok Ba'enayim" reports for all my transitive soldiers.
Nice to have: As a commander I can export my soldiers' past statuses as a CSV.
Nice to have: As a commander I get an AI summary of my soldiers' statuses and reports every morning and on demand.
Nice to have: Request a change to my soldiers' past statuses from the HR.

### Human Resources (HR)
Must have: As an HR I have a unit I am assigned to.
Must have: As an HR I can change the unit's soldiers' status reports.
Must have: As an HR I can change the unit's soldiers' past statuses.
Must have: As an HR I can export the unit's soldiers' past statuses as a CSV.
Nice to have: As an HR I see commanders' requests.
Nice to have: As an HR I can get an AI summary of any part of the unit's soldiers' past statuses including insights.

---

# Implementation (MVP)

Full-stack MVP of **דו״ח 1**: a Hebrew, RTL, mobile-first app for daily attendance reports, commander review, HR management and **ירוק בעיניים** check-ins.

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, TypeScript, MUI 7 (RTL via `stylis-plugin-rtl`), Axios, Rubik font |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| Database | PostgreSQL 16 + PostGIS 3.4 (extension enabled by the first migration) |
| Local deploy | Docker Compose (`db`, `backend`, `frontend` served by nginx) |

The visual design follows `design/stitch_1` ("Tactical Blue Command").

## Quick start (Docker)

```bash
docker compose up -d --build
open http://localhost:5173
```

The backend container runs migrations, loads the attendance reasons and the roster (see **Users** below) if the DB has no users, and starts the API plus the in-process 08:00 scheduler.

- App: http://localhost:5173
- API docs: http://localhost:8000/docs
- DB: `localhost:5433` (user/pass/db: `doch1`)

Useful commands:

```bash
docker compose exec backend python -m app.cli seed --reset             # wipe everything and reload the roster
docker compose exec backend python -m app.cli run-daily-job --date 2026-09-23   # run 08:00 processing for a date
```

## Local development (without the app containers)

```bash
docker compose up -d db
cd backend && cp .env.example .env && uv sync
uv run alembic upgrade head && uv run python -m app.cli seed
uv run uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev      # proxies /api to :8000
```

## Users (real roster, not in git)

There is no fictional data. Users come from a roster CSV at `ROSTER_PATH` (default `backend/data/roster.csv`). It holds real names and ID numbers, so `backend/data/` is **gitignored** (this repo is public). It is copied into the Fly image at deploy time. Columns:

```
full_name,id_number,team,role,role_title,hr
```

- `role` is `course_commander` (exactly one: the מק״ס), `team_commander` (one per team) or `soldier`.
- `hr=1` makes the person HR (שלישות) for the whole course.

The import builds this tree. **Units:** `קורס` → `צוות N`. **Command:** מק״ס → team commanders → their soldiers. The מק״ס is the commander of all team commanders, so a ירוק בעיניים request from them reaches everyone. HR scope is the assigned unit **and every unit under it**.

**Login** is by ת״ז only (`POST /api/auth/login`; leading zeros and separators are optional). There is no password, so anyone who knows an ID number can log in as that person. Turn it off with `ID_LOGIN_ENABLED=false`, which also rejects existing sessions. The fictional demo data now exists only for the backend tests (`backend/tests/demo_seed.py`).

## Walkthrough

1. **Soldier**: the home page asks "האם אתה בבסיס?" for today's report. **לוח שנה** shows every report by month; future days (up to a week ahead) can be selected and reported together.
2. **Team commander / מק״ס** → **החיילים שלי**: the latest ירוק בעיניים request with every subordinate's answer. A "טרם הזינו" filter shows only the ones still missing, and **מילוי** fills in the location for a soldier (marked "מולא ע״י …"). Below that are the soldier cards: approve, correct and approve, or report on a soldier's behalf.
3. **HR** → **ניהול שלישות**: soldiers who haven't reported or aren't approved yet. Search by name or ת״ז. HR can edit current and historical reports and see the audit log. **אפשרויות מתקדמות** holds the CSV export and the anomaly scan.

## Design decisions and MVP assumptions

**Hierarchies.** The unit hierarchy (`units.parent_id`, one commander per unit, cycles rejected) and the reporting hierarchy (`users.commander_id`) are separate. Commander scope comes from the reporting hierarchy; HR scope from the unit.

**Roles.** Every user is a soldier. *Commander* = has direct reports. *HR* = has a row in `hr_assignments` (one unit per HR user, many HR users per unit). Capabilities add up and are computed on the server on every request. Clients never send role claims.

**Scopes.**
- Soldier: their own reports and check-ins.
- Commander attendance: direct reports only.
- Commander ירוק בעיניים: all recursive subordinates.
- HR: members of the assigned unit only, not child units.

Every endpoint enforces its scope, including CSV export.

**Reports.** There is one row per soldier per date (`UNIQUE(soldier_id, report_date)`). Soldier, commander and HR values are stored side by side and never overwrite each other. The **effective status** is HR's value if set, otherwise the commander's, otherwise the soldier's. The UI always shows which layer it came from. A missing report shows as "חסר דיווח" and is never treated as an absence.

The workflow `state` is separate from the attendance status:

`scheduled → pending_approval → sent_to_hr → hr_final`

**Editing rules.**
- **Soldiers** can report today or up to 60 days ahead. They cannot report past dates.
- Reports approved, corrected, or submitted by a commander are locked to soldier edits (`REPORT_LOCKED_BY_COMMANDER`). Multi-day submissions skip commander-locked and HR-locked dates. Soldiers may still edit reports awaiting approval.
- **Commanders** can write the commander layer and report on a soldier's behalf only for *today*. They can approve today's and future reports as they are. Approval automatically moves the report to `sent_to_hr`; historical edits are HR-only.
- **HR** can edit any date. Once HR writes its layer the report becomes `hr_final`, and soldier and commander edits are rejected with `REPORT_LOCKED_BY_HR`. This is the explicit rule for changes after HR review.
- A commander or HR report made on a soldier's behalf is stored in that actor's own layer and attributed to them. It is never shown as a soldier action.

**Automatic HR handoff.** Commander approval immediately makes the report available in this app's HR view. HR does not approve it again; HR may optionally correct it by writing the separate HR layer. No external IDF HR system is integrated.

**Audit.** Every change writes a `report_audit_events` row with the actor, the actor's role, a timestamp, the subject and date, and the before/after values.

**Daily 08:00 job (Asia/Jerusalem).** An in-process loop checks every minute. Once it is 08:00 or later and today has no `daily_job_runs` row, it:
1. moves `scheduled` reports due today or earlier to `pending_approval` and notifies the commander;
2. sends one reminder to each soldier who has no report for today.

The job is idempotent:
- a Postgres advisory lock prevents concurrent runs;
- it only touches rows still in `scheduled`, so commander-approved reports are never reset;
- notifications use deterministic `dedupe_key`s with `ON CONFLICT DO NOTHING`.

To run it by hand: `python -m app.cli run-daily-job --date YYYY-MM-DD`. It is not a report freeze or cutoff.

**ירוק בעיניים.**
- An open, unanswered request replaces the whole app with a blocking response page (only "יציאה" is available). Multiple pending requests are answered one after another. The page is released once all are answered or closed by the commander.
- The ירוק בעיניים page in the navigation is the commander's management view (send requests, track responses) and is visible to commanders only.
- **Down the chain:** a commander who receives a request from above answers it like everyone else, then lands on **בקשות מהמפקד שלי**. There they see how their own recursive subordinates are answering that request, and can **re-send** it down (`parent_request_id`). Re-sent requests go only to their subtree, and the top commander still sees every answer on the original request.
- "Where are you now?" has a single answer: when several requests are open, one answer on the blocking page is sent to all of them, so a soldier never answers the same question twice.
- Each request records the requesting commander and the creation time.
- Recipients are snapshotted when the request is sent, with one response row per recipient.
- Responses stay editable while the request is open and carry timestamps. The requester can close the request.
- Responses never change attendance.
- Notifications are stored in the app with read/unread state. The frontend polls (every 20 seconds).

**Attendance reasons.** The seeded reasons (`attendance_reasons`, each with a configurable `requires_notes`) are **demo values**, not an official or complete list. `requires_notes` is enforced on both the frontend and the backend.

**Errors.** The API returns `{"error": {"code": "NOTES_REQUIRED", ...}}`. The frontend translates each code into Hebrew (`frontend/src/lib/i18n.ts`).

**PostGIS.** The extension is installed and reported by `/api/health`. The current workflows only use a location typed as free text, so there are no spatial columns, GPS or maps.

## Authentication

- The only real boundary is `app/auth.py`. Opaque bearer tokens map to server-side `auth_sessions` rows, and identity and permissions are always loaded from the database.
- **ID login** (`POST /api/auth/login`, ת״ז only, no password) works while `ID_LOGIN_ENABLED=true`. Existing sessions are rejected once it is turned off.
- **SSO is not implemented.** `GET /api/auth/sso/login` returns `501 SSO_NOT_CONFIGURED`. To connect a real OIDC provider:
  1. set `SSO_ISSUER_URL`, `SSO_CLIENT_ID` and `SSO_CLIENT_SECRET`;
  2. implement the authorization-code redirect and callback;
  3. verify the ID token and map a trusted claim (e.g. ת״ז) to `users.personal_number`;
  4. call `create_session(db, user, "sso")`;
  5. set `APP_ENV=production`.

## Verification

- `cd backend && uv run pytest` runs 36 API/domain tests against a real PostGIS database (`doch1_test`). Create it once with `docker compose exec db psql -U doch1 -c "CREATE DATABASE doch1_test"`. They cover:
  - auth boundaries and client role claims being ignored;
  - all four role combinations, and combined roles keeping both scopes;
  - commander and HR scopes;
  - duplicate soldier/date reports (in the app and in the DB);
  - required notes;
  - preservation of the three layers;
  - commander locking against soldier edits;
  - historical HR edits, locking and audit;
  - CSV scope and format;
  - recursive check-in recipients and snapshotting, response isolation, closing, mid-level commander subtree status and re-send;
  - multi-day reporting (all days written, HR-locked days skipped, validation before any write);
  - the idempotent 08:00 job;
  - unit cycle prevention;
  - the nightly anomaly scan (Jev is faked in tests): idempotency, HR unit scoping, missing API key.
- `cd e2e && npm i && npx playwright install chromium && node journey.mjs` runs a browser journey with 43 checks against the running app (reseed first). It covers soldier → commander → HR, the ירוק בעיניים round trip, RTL on the document and on portal dialogs, and no horizontal overflow at 390px and 1366px. Screenshots are saved to `e2e/screens/`.

## Nightly anomaly scan (Jev)

Every night at **02:00 Asia/Jerusalem** (`ANOMALY_JOB_HOUR`), the in-process scheduler sends each active soldier's last **20 days** (`ANOMALY_LOOKBACK_DAYS`, ending yesterday) to [Jev](https://typesafe.ai), TypeSafe's "System One" classification model. Code: `backend/app/services/anomaly.py`.

- **Input ("state"), one request per soldier.** A day-by-day timeline with the soldier, commander and HR layers and all free-text notes, plus facts computed in code (days reported, missing, absent, sick days next to a weekend, layer disagreements). Jev is documented as weak at counting and dates, so the code counts for it.
- **Questions, answered in parallel in the same call.** Three yes/no probabilities (notes contradict the status, soldier vs. commander conflict, suspicious absence pattern) and a severity score from 0 to 3. A soldier is flagged when the strongest signal is ≥ `ANOMALY_THRESHOLD` (0.75). Jev's generic "is anything weird?" probability sat at ≥0.72 for every soldier, so it isn't used.
- **Storage.** Only flagged soldiers are stored (`soldier_anomalies`), per run (`anomaly_runs`: tokens, counts, cost). There is at most one nightly run per date (partial unique index).
- **HR page.** The "חריגות בדיווחים" card lists the unit's flagged soldiers from the latest run, with severity, signals, facts and a link to the history calendar. "סריקה עכשיו" rescans the HR user's unit on demand.
- **CLI.** `uv run python -m app.cli run-anomaly-scan [--date YYYY-MM-DD] [--unit ID]`.
- **Config.** `TYPESAFE_API_KEY` (the scan is off without it), `JEV_MODEL` (pinned `jev-1.13.0`) and `ANOMALY_CONCURRENCY` (16).
- **Privacy.** Jev never receives names or ID numbers, only the role title and the day lines. The window never starts before the first report in the system, so days before go-live don't count as unreported.
- **Test data.** The fictional test seed plants two anomalies: דניאל אברג׳יל (sick every Thursday/Sunday, plus "at base" with a note saying he was home) and אלון דהן (reports "at base" while his commander says he never showed up).

### Cost at 100,000 soldiers

Jev bills **input tokens only**: $0.042 per 1M tokens, and output is free. The measured average on the fictional test data is **~1,170 input tokens per soldier** (20 Hebrew day lines, notes, facts and the 4 questions).

| | per night | per month (30 nights) |
|---|---|---|
| Tokens (100k × 1,170) | 117M | 3.5B |
| **Cost** | **≈ $4.90** | **≈ $150** |
| Pessimistic: long notes, ~2,000 tokens/soldier | ≈ $8.40 | ≈ $250 |

- **Time.** The API limit is 1,200 requests/min (the 250k tokens/s limit is not the bottleneck), so 100k soldiers take ≥ 83 min, and about 1.5–2 h at the default concurrency. That fits between 02:00 and the 08:00 job.
- **Easy savings.** Skip soldiers whose 20 days are all "נוכח בבסיס" with no notes and no disagreements (typically the majority). Soldiers with zero reports can be flagged in code without calling Jev.

## Follow-ups (deliberately not built)

- Real SSO (OIDC) integration.
- An integration with an actual IDF HR system.
- Push, SMS or email notifications.
- Chatbot reporting.
- AI summaries.
- Commander CSV export.
- Formal requests for historical changes (commander → HR).
- Freezing reports into a final status, and a cutoff policy.
- Admin UI for units, users and reasons (currently seed data only).
