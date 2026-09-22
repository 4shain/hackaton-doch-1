# Initial Codex prompt — Doch 1

Build a working full-stack MVP of **דו״ח 1**, a Hebrew system for soldiers’ daily attendance reporting, commander review, HR management, and **ירוק בעיניים** check-ins.

Read the repository’s README.md and the attached desing-flow.png before implementing. The README describes the entities and feature priorities; the Hebrew flowchart describes the planned workflows. The flowchart is a process diagram, not a visual UI reference. Its workflows are also transcribed below so you can proceed if the image is unavailable. Preserve existing repository work and follow applicable AGENTS.md instructions.

Implement the application, rather than stopping at a plan. Aim for a practical hackathon MVP with clear code and a polished, responsive interface. Ask only about genuinely blocking ambiguities; otherwise use the explicitly labeled MVP assumptions below and document them.

## Required stack

- Frontend: React, Vite, TypeScript, MUI, Axios.
- Backend: Python, FastAPI.
- Database: PostgreSQL with the PostGIS extension enabled.
- Suggested supporting tools: SQLAlchemy, Alembic, Pydantic, and Docker Compose. Keep additional dependencies minimal.
- All application data must persist through the backend to PostgreSQL. Do not build a frontend-only mockup.
- PostGIS is required infrastructure, but the current workflows only request a location written as text. Do not invent GPS collection, map screens, or geofencing requirements.

## Language and interface

The entire user-facing application must be in **Hebrew and RTL**: navigation, forms, tables, dialogs, dates, validation, errors, notifications, empty states, and accessibility labels. Code identifiers and developer documentation can be in English.

Configure Hebrew document language, global RTL, MUI theme direction, and RTL styling, including portal-rendered dialogs, menus, and tooltips. Keep numbers, identifiers, and other mixed-direction content readable. Use a mobile-first layout for soldiers and responsive tables or cards for commanders and HR. Provide loading, success, error, and empty states, keyboard navigation, and status labels that do not rely on color alone.

Use a restrained, professional visual style with clear hierarchy and prominent primary actions. Example navigation labels: ״הדיווח שלי״, ״החיילים שלי״, ״ירוק בעיניים״, ״ניהול שלישות״, ״התראות״.

## Domain model and access

**Unit**
- ID, name, parent unit except at the root, exactly one commander, and zero or more HR personnel.
- Support nested units and prevent hierarchy cycles.

**User / soldier**
- Personal number stored as a string, full name, commander except at the root, and unit.
- Every user is a soldier. Commander and HR permissions are independent, additive capabilities: ordinary soldier, commander, HR, or both commander and HR.
- Model HR assignment explicitly. MVP assumption: each HR user manages one assigned unit; multiple HR users can manage that unit.
- Keep the user’s reporting hierarchy and unit hierarchy distinct. Do not infer one from the other.

**Daily attendance report**
- One logical report per soldier per calendar date, enforced in the database.
- Preserve separate soldier-reported status/notes, commander-reported status/notes, and HR-reported status/notes, as required by the README.
- Add the workflow metadata needed for scheduling, submission, commander approval, and HR handoff, plus actors, timestamps, and audit history.
- A commander or the soldier’s unit HR can submit on the soldier’s behalf. Preserve attribution; never represent a staff action as a soldier action.
- Keep attendance status separate from approval state. A missing report must not be treated as an absence.
- MVP assumption: the effective status is HR’s value when present, otherwise the commander’s value, otherwise the soldier’s value. Show provenance and retain the underlying values.

**Authorization**
- Enforce scope on the server for every read, write, export, and check-in action.
- Soldiers can access their own reports and check-in requests.
- MVP assumption: ordinary commander attendance actions apply to direct reports. The README explicitly requires recursive subordinate access for ירוק בעיניים; implement that separately.
- HR can manage reports and history for soldiers in its assigned unit. MVP assumption: this does not automatically include child units.
- Users with both capabilities receive both scoped sets of permissions and retain their own soldier view.

## Required workflows

### 1. Soldier reporting for a selected date

1. The user enters through an SSO-based login flow.
2. Show the selected reporting date, defaulting to today, and ask ״האם אתה בבסיס?״.
3. If yes, offer a prominent home-screen action such as ״אני בבסיס״. Submit the report to the commander for approval.
4. If no, let the soldier select an absence reason.
5. Each reason has a configurable `requires_notes` property. Require nonblank notes when true; otherwise allow submission without notes. Validate this on both frontend and backend.
6. Submit the report to the commander for approval and display a clear pending state.

Support reporting future dates as a must-have. MVP assumption: a future report is saved as scheduled and enters the commander’s approval queue at 08:00 on its reporting date. Make the future-date state visible to the soldier. Use configurable sample Hebrew attendance reasons; document that they are demo values rather than an official exhaustive list.

### 2. Daily 08:00 processing

The flowchart specifies a daily 08:00 check: if a report exists, send it to the commander for approval; otherwise notify the soldier to report. Its note specifically associates this with future reporting.

Use **Asia/Jerusalem** for reporting dates and the 08:00 schedule, with timezone-aware timestamps stored consistently. Implement a small, documented scheduled job that:
- Activates scheduled reports due today and puts them in the approval queue.
- Sends an in-app reminder to soldiers missing today’s report.
- Does not reset approved reports or duplicate already queued reports or notifications.

Make processing idempotent and safe against duplicate execution. Document scheduler startup and provide a development command to run the job for a chosen date. Do not interpret 08:00 as a report-freezing cutoff; no cutoff policy was supplied.

### 3. Commander review and HR handoff

After login, a commander can:
- View their soldiers and attendance for a selected day, including missing reports and pending approvals.
- Select a soldier and inspect past reports.
- Approve a soldier’s report or change its commander status/notes and then approve it.
- Submit a report on behalf of a soldier.
- Forward approved or corrected reports to HR, as shown in the flowchart.

MVP assumption: ״שליחה לשלישות״ means making the approved report available in this application’s HR view. Do not imply that an actual IDF HR integration exists. Separate integration boundaries from local workflow state.

MVP assumption: commanders can edit today’s reports and review future reports, but historical edits are reserved for HR. A material edit to a submitted soldier report must invalidate prior commander approval and return it for review. Do not silently overwrite HR-reviewed reports; document a clear rule for subsequent changes.

### 4. Human resources

Provide an HR view for the assigned unit with date and soldier filters. HR must be able to:
- View reports handed off by commanders and identify missing or pending reports.
- Submit on behalf of a soldier.
- Change current and historical reports through the separate HR status/notes fields.
- Export the unit’s historical attendance as CSV with Hebrew headers and encoding suitable for Excel.

Keep an audit trail of staff changes, including previous/new values, actor, timestamp, and the subject/date. Exports must respect the same access scope as the screen.

### 5. ירוק בעיניים

This is a separate check-in workflow, not an attendance reason or approval state. The README leaves its entity unspecified, so implement this minimal model based on the flowchart:
- A check-in request records the requesting commander and creation time.
- Snapshot the commander’s full recursive subordinate set as recipients when issuing the request, with one response record per recipient.
- Notify each recipient in the app.
- A soldier opens an outstanding request, enters their current location **as free text**, and submits the response to the requesting commander.
- The commander sees all recipients, response/pending state, location text, response time, and response counts.
- Permit multiple distinct requests and associate every answer with the correct request. A response must never update daily attendance implicitly.

MVP assumption: responses remain editable while the request is open, with audit timestamps, and the requesting commander can close the request. Persist notifications and unread state; polling is sufficient for this MVP. External push, SMS, and email are not required.

## Authentication and integrations

The intended authentication is SSO, but no provider details were supplied. Define an authentication boundary and provide an explicitly labeled **development-only** demo login with seeded users for each role combination. The backend must resolve identity and permissions from trusted session/token data, never from client-provided role claims.

Do not fake a completed production SSO integration. Ensure demo authentication is disabled outside development and document what configuration is needed to connect a real provider. Seed only fictional people, units, and reports.

## Implementation and delivery

Organize the repository into frontend and backend directories with database migrations, demo seed data, an environment example, and Docker Compose for local startup. Keep route handling, validation, permissions, and domain logic reasonably separated without overengineering.

Provide typed frontend models and a centralized Axios client. Implement validated REST endpoints for identity, attendance, review/handoff, history, HR edits/export, check-in requests/responses, and notifications. Return stable machine-readable errors that the frontend translates into Hebrew.

Add meaningful verification for authorization boundaries, combined roles, duplicate soldier/date reports, required notes, preservation of the three reporting layers, approval invalidation, historical HR edits, recursive check-in recipients, and idempotent 08:00 processing. Verify the primary UI journeys and RTL layout at desktop and mobile widths. Run the available checks and state honestly what passed and what could not be run.

Complete all README must-have requirements before optional features. In-app check-in notifications are included because the flowchart explicitly requires them. Soldier history is useful if inexpensive. Defer chatbot reporting, AI summaries, commander CSV export, formal historical-change requests, and report freezing until the core flows work; list them as follow-ups rather than adding nonfunctional buttons.

Start with a brief implementation plan and your assumptions, then build through to a runnable result. Finish with startup instructions, demo users, a short walkthrough covering soldier → commander → HR and a ירוק בעיניים round trip, verification results, and remaining integration gaps. Update the README with setup and design decisions while preserving its original product requirements.
