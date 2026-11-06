# System-Level Software Design Specification

## Architecture

The React and TypeScript UI uses Vite. It calls the Express and TypeScript API, which validates requests, checks permissions, and enforces scheduling rules. The API uses Prisma to read and write PostgreSQL. This stack follows the earlier TokTickIT labs so the team can reuse its setup and testing experience.

| Record | Main fields and relationships |
|---|---|
| User | ID, unique username, password hash, and `student` or `operator` role. |
| GPU machine | ID, unique machine code, and assigned operator ID referencing a user. |
| Slot | ID, machine ID, and `startAt`. Machine ID and start time form a unique pair. Derive `endAt` by adding one hour. |
| Booking | ID, slot ID, student ID, and creation timestamp. The slot ID is unique in Sprint 1. When cancellation history is introduced, preserve uniqueness among confirmed bookings. |
| Session | ID, user ID, unique token hash, and expiry timestamp. |

Store timestamps in UTC. Interpret calendar dates and validate hour boundaries in `Asia/Bangkok`. Treat the end of a slot as the start of the next possible slot. The API checks the server clock before opening or booking a slot. Database uniqueness resolves competing writes. Only a duplicate booking for the same slot is translated to `SLOT_ALREADY_BOOKED`.

## Identity and access

Sign-in verifies a stored password hash and creates an opaque server-side session. The browser receives a session cookie with `HttpOnly` and `SameSite=Lax`. The HTTPS deployment also sets `Secure`. Store a hash of the token on the server. Sessions have a proposed eight-hour lifetime. Sign-out invalidates the session and clears the cookie. Serve the deployed UI and API from the same origin and validate the origin of browser requests that change data.

| Operation | Student | Machine operator |
|---|---|---|
| Find and book available slots | Allowed | Denied |
| Read student booking list or detail | Own bookings | Denied. Use the machine schedule instead. |
| List machines and view their schedules | Denied | Assigned machines only |
| Open slots | Denied | Assigned machines only |

## UI and API conventions

- **Sign-in.** Display a generic error for rejected credentials. Route authenticated users by role and show the current account with a sign-out action.
- **Student view.** Filter availability by date, submit a booking, and view saved reservations. Disable duplicate submissions while a request is pending. Refresh availability after a conflict.
- **Operator view.** List assigned machines, preview the selected one-hour slot, and show the schedule with reservation details. Preserve the selected date and time when correcting a rejected submission.
- Show loading, empty, and failure states for each data view. Use JSON under `/api/v1`. Dates use `YYYY-MM-DD` in Bangkok time, while timestamps include a time-zone offset or UTC designator. Return safe, consistent error responses with an `error` object containing `code` and `message`.

## Local setup and deployment plan

Use versioned Prisma migrations and synthetic seed data for `GPU-01`, two students, an assigned operator, and an operator without an assignment to that machine. Use a separate test database and a documented `DATABASE_URL` example. The project repository stores configuration examples with placeholder values.

Use Vitest for isolated rules, Supertest with a test database for API and persistence checks, and Playwright for the full browser journey. The release setup instructions will identify the actual commands and database migration steps.

Sprint 1 runs locally. The Lab 5 plan packages the UI and API together behind one web address and connects them to persistent PostgreSQL. Choose the exact GCP services using the Lab 5 guidance.
