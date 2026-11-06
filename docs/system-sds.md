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
| Booking | ID, slot ID, student ID, `slotStartAt`, and creation timestamp. `slotStartAt` is copied from the slot when the booking is created. The slot ID is unique (BR-01), and the pair of student ID and `slotStartAt` is unique (BR-04). |
| Session | ID, user ID, unique token hash, and expiry timestamp. |

Store timestamps in UTC. Interpret calendar dates and validate hour boundaries in `Asia/Bangkok`. Treat the end of a slot as the start of the next possible slot. The API checks the server clock before opening or booking a slot. Database uniqueness resolves competing writes. A duplicate booking for the same slot is translated to `SLOT_ALREADY_BOOKED`, and a second booking by the same student for the same hour is translated to `STUDENT_TIME_CONFLICT`.

The API reads the current time through an injected clock. Production uses the system clock. Tests pass a fixed clock so that slot start checks and session expiry can be tested at exact boundaries.

**Sprint 2 change to bookings.** Cancellation history adds a `status` column (`confirmed` or `cancelled`) and a cancellation timestamp. The two unique constraints then apply only to confirmed bookings, so they become partial unique indexes (`WHERE status = 'confirmed'`). Prisma's schema language cannot declare partial indexes, so this migration is written as raw SQL inside a versioned Prisma migration.

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

## Configuration

| Variable | Purpose | Example in `.env.example` |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the application. | `postgresql://nutgpuhub:change-me@localhost:5432/nutgpuhub` |
| `TEST_DATABASE_URL` | Separate database used by API and persistence tests. | `postgresql://nutgpuhub:change-me@localhost:5432/nutgpuhub_test` |
| `PORT` | HTTP port. Cloud Run sets it at runtime. | `3000` |
| `APP_ORIGIN` | Allowed origin for requests that change data. | `http://localhost:5173` |
| `SESSION_TTL_MINUTES` | Session lifetime. | `60` |
| `COOKIE_SECURE` | Adds `Secure` to the session cookie. `true` when served over HTTPS. | `false` |

Only `.env.example` with placeholder values is committed. `.env` is listed in `.gitignore`. The UI bundle receives no secrets; it calls the API on the same origin. Seed passwords are synthetic test values and are not reused anywhere else.

## Local setup and deployment plan

Use versioned Prisma migrations and synthetic seed data: `GPU-01` assigned to operator A, `GPU-02` assigned to operator B, and two students. Operator B is the unassigned operator for `GPU-01` in access tests, and `GPU-02` lets tests book a second machine in the same hour for BR-04. The seed script can be rerun and produces the same data.

Use Vitest for isolated rules, Supertest with a test database for API and persistence checks, and Playwright for the browser journeys. The release setup instructions will identify the actual commands and database migration steps.

Sprint 1 runs locally. In Lab 5 the UI build and the API are packaged in one Docker image so they share one origin. The image is pushed to Artifact Registry and runs on Cloud Run. Cloud Run containers keep no data between restarts, so the application connects to a persistent managed PostgreSQL database outside the container. `DATABASE_URL` is stored in Secret Manager and exposed to Cloud Run as an environment variable. Migrations run as a release step before the new revision takes traffic.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial system design. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added the data diagram, BR-04 constraint, injected clock, Sprint 2 partial index plan, argon2id and one-hour sessions, full role matrix, configuration table, and the Cloud Run deployment design. |
