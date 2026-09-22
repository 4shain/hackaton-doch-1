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

The backend container runs migrations, seeds fictional demo data if the DB is empty, and starts the API plus the in-process 08:00 scheduler.

- App: http://localhost:5173
- API docs: http://localhost:8000/docs
- DB: `localhost:5433` (user/pass/db: `doch1`)

Useful commands:

```bash
docker compose exec backend python -m app.cli seed --reset             # reset demo data
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

## Demo users (development only, all fictional)

| Personal no. | Name | Capabilities |
|---|---|---|
| 8941203 | רב״ט איתי כהן | soldier (team 1) — has scheduled future reports |
| 8112345 | סמ״ר גיא מזרחי | soldier (team 1) — pending report today |
| 1000003 | סמ״ר עומר לוי | commander of team 1 |
| 1000004 | סמ״ר נועה אלקיים | commander of team 2 |
| 1000002 | סרן יעל מזרחי | commander of the team commanders |
| 1000001 | סא״ל רון ברק | battalion commander (root; recursive check-ins reach everyone) |
| 1000006 | סמל מיכל פרץ | HR of פלוגה א׳ |
| 1000005 | רס״ן דנה אלון | HR of פלוגה א׳ **and** commander of the HR office |
| 1000007 | רב״ט אור חדד | soldier in the HR office (outside HR scope) |

## Walkthrough

1. **Soldier** – log in as איתי כהן. **דיווח לכמה ימים** reports one status for a date range (up to 31 days) in one step; days HR has locked are skipped, not overwritten. **היסטוריה** shows a month calendar (color + icon per day, legend, month navigation); tapping a day shows its three layers. Notifications open as a floating list from the bell in the header.
   Then, as איתי כהן → "האם אתה בבסיס?" → **כן, אני בבסיס** (report is pending commander approval). Pick a day later in the week → **לא, אני לא בבסיס** → choose e.g. הפנייה רפואית; notes are required → the report is saved as *מתוכנן* and enters the queue at 08:00 on that date.
2. **Commander** – log in as עומר לוי → **החיילים שלי**: metrics, distribution, filter chips. **אשר דיווח**, **תקן ואשר** (writes the commander layer), **דווח בשם החייל** for missing soldiers. A soldier's history opens as the same month calendar (HR gets it too, with edit/audit actions for the selected day). Then **העברת N דיווחים מאושרים לשלישות**.
3. **HR** – log in as מיכל פרץ → **ניהול שלישות**: filter by date/soldier, see handed-off / pending / missing, edit current or historical reports (HR layer), view the audit log, export CSV.
4. **ירוק בעיניים** – as עומר לוי send a request (all recursive subordinates are snapshotted as recipients and notified). Log in as איתי כהן: the app immediately goes to a separate, blocking page (`/checkin`) that must be answered with a free-text location before anything else is usable. Users already in the app are taken over within ~15 seconds (polling). For the chain: send as רון ברק, log in as יעל מזרחי, answer, then see her company's status and re-send it to them. Back as עומר, open the request to see responded/pending counts, locations and times; close it when done.

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

`scheduled → pending_approval → approved → sent_to_hr → hr_final`

**Editing rules.**
- **Soldiers** can report today or up to 60 days ahead. They cannot report past dates.
- A material soldier edit (a different reason or different notes) cancels any commander approval or correction and sends the report back for review. The previous values stay in the audit log.
- **Commanders** can write the commander layer and report on a soldier's behalf only for *today*. They can approve today's and future reports as they are. Historical edits are HR-only.
- **HR** can edit any date. Once HR writes its layer the report becomes `hr_final`, and soldier and commander edits are rejected with `REPORT_LOCKED_BY_HR`. This is the explicit rule for changes after HR review.
- A commander or HR report made on a soldier's behalf is stored in that actor's own layer and attributed to them. It is never shown as a soldier action.

**Handoff to HR ("שליחה לשלישות").** This only moves the report into this app's HR view. No external IDF HR system is integrated.

**Audit.** Every change writes a `report_audit_events` row with the actor, the actor's role, a timestamp, the subject and date, and the before/after values.

**Daily 08:00 job (Asia/Jerusalem).** An in-process loop checks every minute. Once it is 08:00 or later and today has no `daily_job_runs` row, it:
1. moves `scheduled` reports due today or earlier to `pending_approval` and notifies the commander;
2. sends one reminder to each soldier who has no report for today.

The job is idempotent:
- a Postgres advisory lock prevents concurrent runs;
- it only touches rows still in `scheduled`, so approved reports are never reset;
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
- **Demo login** (`POST /api/auth/dev-login`) works only when `APP_ENV=development` **and** `DEV_LOGIN_ENABLED=true`. Existing demo sessions are also rejected once that is no longer true.
- **SSO is not implemented.** `GET /api/auth/sso/login` returns `501 SSO_NOT_CONFIGURED`. To connect a real OIDC provider:
  1. set `SSO_ISSUER_URL`, `SSO_CLIENT_ID` and `SSO_CLIENT_SECRET`;
  2. implement the authorization-code redirect and callback;
  3. verify the ID token and map a trusted claim (e.g. personal number) to `users.personal_number`;
  4. call `create_session(db, user, "sso")`;
  5. set `APP_ENV=production`.

## Verification

- `cd backend && uv run pytest` runs 32 API/domain tests against a real PostGIS database (`doch1_test`). Create it once with `docker compose exec db psql -U doch1 -c "CREATE DATABASE doch1_test"`. They cover:
  - auth boundaries and client role claims being ignored;
  - all four role combinations, and combined roles keeping both scopes;
  - commander and HR scopes;
  - duplicate soldier/date reports (in the app and in the DB);
  - required notes;
  - preservation of the three layers;
  - approval invalidation;
  - historical HR edits, locking and audit;
  - CSV scope and format;
  - recursive check-in recipients and snapshotting, response isolation, closing, mid-level commander subtree status and re-send;
  - multi-day reporting (all days written, HR-locked days skipped, validation before any write);
  - the idempotent 08:00 job;
  - unit cycle prevention.
- `cd e2e && npm i && npx playwright install chromium && node journey.mjs` runs a browser journey with 43 checks against the running app (reseed first). It covers soldier → commander → HR, the ירוק בעיניים round trip, RTL on the document and on portal dialogs, and no horizontal overflow at 390px and 1366px. Screenshots are saved to `e2e/screens/`.

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
