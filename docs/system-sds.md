# System-Level Software Design Specification

## Architecture

The React and TypeScript UI uses Vite. It calls the Express and TypeScript API, which validates requests, checks permissions, and enforces scheduling rules. The API uses Prisma to read and write PostgreSQL. This stack follows the earlier TokTickIT labs so the team can reuse its setup and testing experience.

Business rules live in the API and the database, never only in the UI. The UI hides actions a role cannot use, but the API rechecks every request. Exclusivity rules that must hold under concurrent requests (BR-01 and BR-04) are enforced by database unique constraints, and the API translates the constraint error into a `409` response.

```mermaid
erDiagram
    User ||--o{ Session : "signs in with"
    User ||--o{ GpuMachine : "operates"
    GpuMachine ||--o{ Slot : "has"
    Slot ||--o| Booking : "reserved by"
    User ||--o{ Booking : "owns"
```

| Record | Main fields and relationships |
|---|---|
| User | ID, unique username, argon2id password hash, and `student` or `operator` role. |
| GPU machine | ID, unique machine code, and assigned operator ID referencing a user. |
| Slot | ID, machine ID, and `startAt`. Machine ID and start time form a unique pair. Derive `endAt` by adding one hour. |
| Booking | ID, slot ID, student ID, `slotStartAt`, and creation timestamp. `slotStartAt` is copied from the slot when the booking is created. A composite foreign key `(slotId, slotStartAt)` references the slot `(id, startAt)` so the copied timestamp cannot drift. The slot ID is unique (BR-01), and the pair of student ID and `slotStartAt` is unique (BR-04). |
| Session | ID, user ID, unique token hash, and expiry timestamp. |

Store timestamps in UTC. Interpret calendar dates and validate hour boundaries in `Asia/Bangkok`. Treat the end of a slot as the start of the next possible slot. The API checks the server clock before opening or booking a slot. Database uniqueness resolves competing writes. A duplicate booking for the same slot is translated to `SLOT_ALREADY_BOOKED`, and a second booking by the same student for the same hour is translated to `STUDENT_TIME_CONFLICT`.

The API reads the current time through an injected clock. Production uses the system clock. Tests pass a fixed clock so that slot start checks and session expiry can be tested at exact boundaries.

The diagram shows the current Sprint 1 cardinality. Slots have no stored open/closed state, and bookings have no cancellation status yet. In Sprint 2, retaining historical cancelled bookings changes the slot-to-booking cardinality to one-to-many, while confirmed reservations remain exclusive. The record/history representation must be reviewed in F-05/F-06 before changing the schema.

**Planned Sprint 2 change to bookings.** Cancellation history adds a `status` column (`confirmed` or `cancelled`) and a cancellation timestamp. The two unique constraints then apply only to confirmed bookings, so they become partial unique indexes (`WHERE status = 'confirmed'`). Prisma's schema language cannot declare partial indexes, so this migration is written as raw SQL inside a versioned Prisma migration.

## Identity and access

Sign-in verifies an argon2id password hash and creates an opaque server-side session. The browser receives a session cookie with `HttpOnly` and `SameSite=Lax`. The HTTPS deployment also sets `Secure`. Store a hash of the token on the server. A session expires one hour after sign-in and is not extended by activity. `GET /api/v1/auth/me` returns the current account while the session is valid. Sign-out invalidates the session and clears the cookie. Serve the deployed UI and API from the same origin and validate the origin of browser requests that change data.

| Operation | Student | Machine operator | Sprint |
|---|---|---|---|
| Sign in, read current account, sign out | Allowed | Allowed | 1 |
| Find and book available slots | Allowed | Denied | 1 |
| Read student booking list or detail | Own bookings | Denied. Use the machine schedule instead. | 1 |
| List machines and view their schedules | Denied | Assigned machines only | 1 |
| Open slots | Denied | Assigned machines only | 1 |
| Cancel or reschedule a booking | Own upcoming bookings | Denied | 2 |
| Close a slot | Denied | Unbooked future slots on assigned machines | 2 |
| View booking summary | Denied | Assigned machines only | 3 |

## UI and API conventions

- **Sign-in.** Display a generic error for rejected credentials. Route authenticated users by role and show the current account with a sign-out action. An expired session returns the user to sign-in.
- **Student view.** Filter availability by date, submit a booking, and view saved reservations. Disable duplicate submissions while a request is pending. Refresh availability after a conflict and show which rule rejected the request.
- **Operator view.** List assigned machines, preview the selected one-hour slot, and show the schedule with reservation details. Preserve the selected date and time when correcting a rejected submission.
- Show loading, empty, and failure states for each data view. Use JSON under `/api/v1`. Dates use `YYYY-MM-DD` in Bangkok time, while timestamps include a time-zone offset or UTC designator. Return safe, consistent error responses with an `error` object containing `code` and `message`. Error responses never include stack traces, SQL, or data the caller is not allowed to read.

### UI-01 presentation implementation

The presentation layer uses shared Button, Input, Select, Card, Table, StatusBadge and Alert components in `client/components.tsx`. `client/styles.css` defines the shared color, typography, spacing and radius tokens. Sign-in and role workspaces share the brand header, surfaces, controls, focus treatment and feedback styling. The operator schedule is a captioned table; student availability and My Bookings remain lists. Narrow layouts stack their cards. The schedule uses one time-and-reservation column at every width; each time range already conveys the fixed one-hour length. Role context stays in the heading and account text rather than a reservation-status badge. Disabled buttons use a not-allowed cursor; buttons with pending requests expose `aria-busy` and use a wait cursor.

Available, booked/confirmed, started/past and error states use text and a consistent token palette. Time labels are presentation derived at render time; API permissions and server-clock validation remain authoritative. The [UI verification record](sprints/sprint-1/ui-verification.md) contains the before/after comparisons and acceptance checks.

## Configuration

| Variable | Purpose | Example in `.env.example` |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the application. | `postgresql://nutgpuhub:password@localhost:5432/nutgpuhub` |
| `TEST_DATABASE_URL` | Separate database used by API and persistence tests. | `postgresql://nutgpuhub:password@localhost:5432/nutgpuhub_test` |
| `DEMO_PASSWORD` | Private local seed password; synthetic and supplied by the person running the seed. | `replace-this-local-demo-password` |
| `HOST` | Optional bind address; defaults to loopback. Set appropriately for the container in Lab 5. | Not set in `.env.example`. |
| `PORT` | HTTP port. Cloud Run sets it at runtime. | `3000` |
| `APP_ORIGIN` | Allowed origin for requests that change data. | `http://localhost:5173` |
| `PUBLIC_ORIGIN` | Legacy fallback used only when `APP_ORIGIN` is unset or empty. If both are unset or empty, the origin defaults to `http://localhost:5173`. Prefer `APP_ORIGIN` for new configuration. | Not set in `.env.example`. |
| `SESSION_TTL_MINUTES` | Fixed Sprint 1 lifetime. Omit it or set exactly `60`; another value fails startup. Activity does not renew it. | `60` |
| `COOKIE_SECURE` | Adds `Secure` to the session cookie. `true` when served over HTTPS. | `false` |

Only `.env.example` with placeholder values is committed. `.env` is listed in `.gitignore`. The UI bundle receives no secrets; it calls the API on the same origin. Seed passwords are synthetic test values and are not reused anywhere else.

## Local setup and deployment plan

Use versioned Prisma migrations and synthetic seed data: `GPU-01` assigned to operator A, `GPU-02` assigned to operator B, and two students. Operator B is the unassigned operator for `GPU-01` in access tests, and `GPU-02` lets tests book a second machine in the same hour for BR-04. The seed script can be rerun and produces the same data.

Use Vitest for isolated rules, Supertest with a test database for API and persistence checks, and Playwright for the browser journeys. The README identifies migration, seed and execution commands. `npm test` runs unit/API tests, `npm run test:e2e` runs the browser journeys, and `npm run verify:restart` checks persistence across different Node processes. Tests and system checks use a separate migrated `TEST_DATABASE_URL`. Store local PDF evidence under `evidence/<feature>/`, which Git excludes.

Sprint 1 runs locally. In Lab 5 the UI build and the API are packaged in one Docker image so they share one origin. The image is pushed to Artifact Registry and runs on Cloud Run. Cloud Run containers keep no data between restarts, so the application connects to a persistent managed PostgreSQL database outside the container. `DATABASE_URL` is stored in Secret Manager and exposed to Cloud Run as an environment variable. Migrations run as a release step before the new revision takes traffic.

## Request and data flow

1. The browser restores the current session with `GET /api/v1/auth/me` and opens the student or operator workspace.
2. For writes, the shared API middleware checks Origin and parses a bounded JSON body. Route-specific guards validate the session and role, followed by resource ownership/assignment and feature input checks.
3. The booking API reads the slot and server clock, then attempts the database insert. Unique indexes arbitrate competing slot/student-hour writes; the composite foreign key protects the copied slot time.
4. The API returns the saved ID after a successful insert or a safe error object after rejection. The student UI refreshes availability and My Bookings after a booking attempt. The operator reloads the schedule to retrieve current booking details.
5. Requests that pass the shared middleware and match no API route fall through to `404 NOT_FOUND`. An invalid Origin or malformed JSON may be rejected earlier with `403` or `400`. Existing unknown-path regression tests exercise GET requests. Known protected routes retain their authentication/role errors.

Planned F-05/F-06 operations will use transactions to change confirmed state and history together. Planned F-07 must serialize closure with competing booking requests. These are design responsibilities for their later contracts, not implemented guarantees of Sprint 1. F-08 reads only authorized machines and must define report predicates before its queries are implemented.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial system design. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added the data diagram, BR-04 constraint, injected clock, Sprint 2 partial index plan, argon2id and one-hour sessions, full role matrix, configuration table, and the Cloud Run deployment design. |
| 0.3 | 2026-11-07 | Tanadet Nuchaikaew | Documented current composite FK and request flow, fixed TTL validation, seed configuration, verification commands and planned state/cardinality changes. |
| 0.4 | 2026-11-07 | Tanadet Nuchaikaew | PR #21 review: documented the existing PUBLIC_ORIGIN fallback and origin precedence. |
| 0.5 | 2026-11-07 | Tanadet Nuchaikaew | UI-01: recorded the shared presentation components, responsive layout and verification reference. |
| 0.6 | 2026-11-08 | Tanadet Nuchaikaew | PR #23 review: simplified role/availability labels and schedule columns; distinguished disabled controls from pending requests. |
