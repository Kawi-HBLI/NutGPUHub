# Sprint 1 Feature Contracts

See the [system design](../../system-sds.md) for shared rules and the [test specification](test-specification.md) for fixtures and expected results. Test results and reviewer evidence are recorded against the implemented release.

## F-01: Sign in and sign out

**Requirements:** FR-02, BR-02, NFR-01, NFR-03. **Dependency:** prepared accounts.

The user enters a username and password. On successful sign-in, the API creates a session and returns the account ID, username, and role. The UI opens the appropriate role view. On reload, the UI requests the current account. On sign-out, or when the one-hour session has expired, it returns to sign-in.

| Layer | Change |
|---|---|
| UI | Sign-in page, role routing, current account display, and sign-out action. |
| API | Session middleware used by every protected route, plus the endpoints below. |
| Data | First migration: `User` (unique username, argon2id hash, role) and `Session` (unique token hash, expiry). Seed students A and B and operators A and B. |

| API | Contract |
|---|---|
| `POST /api/v1/auth/login` | Accept `username` and `password`. Return `200` with account details and the session cookie. Return `400` for malformed fields and `401` with a generic error for wrong credentials. |
| `GET /api/v1/auth/me` | Return `200` with the current account ID, username, and role. Return `401` for missing, expired, or invalidated sessions. |
| `POST /api/v1/auth/logout` | Invalidate any matching session, clear the cookie, and return `204`. |

- **AC-06:** Valid student and operator accounts receive the correct roles. Wrong credentials return `401` and create no session.
- **AC-07:** The signed-in user can retrieve their account. Reusing the previous session after sign-out returns `401`.
- **AC-16:** A session at its expiry time, one hour after sign-in, is rejected with `401`.
- **AC-20:** A sign-in request with a missing or non-string username or password returns `400` and creates no session.
- **AC-23:** Stored credentials are argon2id hashes. No user record contains the plaintext password.

## F-02: Open GPU slots

**Requirements:** FR-03, FR-05, BR-01, BR-02, NFR-01. **Dependencies:** F-01 and a machine assignment.

An operator chooses an assigned machine, a date, and an hourly start. The UI previews the one-hour range. The API checks the operator's assignment, validates the hour in `Asia/Bangkok`, and checks that the start is strictly later than server time. The database enforces a unique machine and start-time pair. On success, the slot appears in the operator schedule.

| Layer | Change |
|---|---|
| UI | Operator view with machine list, date and hour picker, one-hour preview, and the day's schedule. |
| API | Endpoints below, with operator role and assignment checks. |
| Data | Migration adding `GpuMachine` (unique code, operator ID) and `Slot` (machine ID, `startAt`, unique machine and start pair). Seed `GPU-01` for operator A and `GPU-02` for operator B. |

| API | Contract |
|---|---|
| `GET /api/v1/machines` | Return `200` with the signed-in operator's assigned machines ordered by code, each as `{ machineId, machineCode }`. |
| `GET /api/v1/machines/{machineId}/slots?date=YYYY-MM-DD` | Return `200` with the assigned machine's slots for the selected Bangkok date, ordered by start time. Each entry includes `slotId`, `machineId`, `startAt`, and `endAt`. Return `403` with `MACHINE_NOT_ASSIGNED` for an existing unassigned machine, `404` with `MACHINE_NOT_FOUND` for an unknown machine, and `400` with `INVALID_DATE` for a missing or invalid date. F-04 adds booking details to this response. |
| `POST /api/v1/machines/{machineId}/slots` | Accept `startAt` as a timestamp with an offset, for example `2026-11-08T14:00:00+07:00`. Return `201` with `slotId`, `machineId`, `startAt`, and `endAt`. Return `400` with `INVALID_START_AT`, `START_NOT_ON_HOUR`, or `START_NOT_IN_FUTURE`, `403` with `MACHINE_NOT_ASSIGNED`, `404` with `MACHINE_NOT_FOUND`, and `409` with `SLOT_ALREADY_EXISTS` for a duplicate slot. |

All three routes require a valid session (`401 AUTH_REQUIRED`) and the operator role (`403 FORBIDDEN`). The database also rejects a start time that is not on the hour, as a backstop for BR-01. Timestamps in responses use UTC (`Z`).

- **AC-04:** An assigned operator can open consecutive hourly slots on the same machine. Opening the same start time twice is rejected.
- **AC-05:** A start time of `14:30` is rejected and creates no slot.
- **AC-08:** A student cannot create a slot.
- **AC-10:** An operator cannot create a slot or read a schedule for an unassigned machine.
- **AC-17:** A slot at or before the current server time is rejected and creates no slot.
- **AC-21:** A schedule request with a missing or invalid date returns `400`. A schedule or slot creation request for an unknown machine returns `404` and creates no slot.

## F-03: Find and book an available slot

**Requirements:** FR-01, FR-04, FR-05, BR-01, BR-02, BR-04, NFR-01, NFR-02. **Dependencies:** F-01 and F-02.

The student chooses a date, selects an available slot, and submits one booking request. The API uses the session to identify the student. It validates the slot and writes the booking under the database uniqueness constraints. The UI confirms a successful reservation and links to the saved booking. After a conflict it shows the reason and refreshes availability.

| Layer | Change |
|---|---|
| UI | Student availability view with date filter, booking action, confirmation, and conflict message. |
| API | Endpoints below, with student role and ownership checks. |
| Data | Migration adding `Booking` (slot ID, student ID, `slotStartAt`, created time) with unique slot ID and unique student and `slotStartAt` pair. |

| API | Contract |
|---|---|
| `GET /api/v1/slots?date=YYYY-MM-DD` | Return `200` with the future, unbooked slots for the selected Bangkok calendar date, ordered by start time. Each entry contains `slotId`, `machineId`, `machineCode`, `startAt`, and `endAt`. Return an empty list when appropriate and `400` with `INVALID_DATE` for a missing or invalid date. |
| `POST /api/v1/bookings` | Accept `slotId` as a positive integer. Return `201` with `bookingId` and `slotId`, and a `Location` header for `/api/v1/bookings/{bookingId}`. Return `400` with `INVALID_SLOT_ID` for an invalid ID and `404` with `SLOT_NOT_FOUND` for an unknown slot. Return `409` with `SLOT_ALREADY_STARTED`, `SLOT_ALREADY_BOOKED`, or `STUDENT_TIME_CONFLICT` when the student already holds another machine at that hour. |
| `GET /api/v1/bookings/{bookingId}` | Return `200` with the student's own booking ID, slot ID, machine code, and slot times. Return `404` with `BOOKING_NOT_FOUND` for an invalid or unknown booking ID or one owned by another student. |

Each F-03 route requires a valid session (`401 AUTH_REQUIRED`) and the student role (`403 FORBIDDEN`). These guards apply to the matching routes, so unrelated API paths can reach the API's `404 NOT_FOUND` handler.

- **AC-01:** Booking an available slot creates a reservation that the student can retrieve as its owner.
- **AC-02:** When two students request the same slot concurrently, one request succeeds and one is rejected. The database stores exactly one booking for the successful account.
- **AC-03:** A request at or after the slot start is rejected and creates no booking.
- **AC-09:** A direct request for another student's booking returns `404` without disclosing booking data.
- **AC-11:** The selected date shows future, unbooked slots available to reserve.
- **AC-12:** A booking request without a valid session receives `401`. A signed-in operator receives `403`. Neither request creates a booking.
- **AC-13:** An invalid slot ID returns `400` and an unknown slot ID returns `404`. Neither request creates a booking.
- **AC-19:** A student who holds a booking at 14:00 on `GPU-01` and requests the 14:00 slot on `GPU-02` receives `409` with `STUDENT_TIME_CONFLICT`. When both requests are sent concurrently, exactly one booking is stored.
- **AC-22:** An availability request with a missing or invalid date returns `400`.

## F-04: View bookings by role

**Requirements:** FR-05, BR-02, NFR-01, NFR-02. **Dependencies:** F-01 through F-03.

Students use **My Bookings** to list their saved reservations and open the booking detail introduced in F-03. Operators use the machine schedule introduced in F-02 to see reservation details. A booked slot shows the booking student's username only in the authorized operator view. Both views show times in `Asia/Bangkok` and show an empty state when no records match.

| Layer | Change |
|---|---|
| UI | My Bookings page for students. Booking details added to the operator schedule. |
| API | New list endpoint and an extended schedule response, below. |
| Data | No schema change. Reads the F-03 tables. |

| API | Contract |
|---|---|
| `GET /api/v1/bookings` | Return `200` with only the signed-in student's bookings, including machine code and slot times. |
| `GET /api/v1/machines/{machineId}/slots?date=YYYY-MM-DD` | Extend the F-02 response with a `booking` field on each slot. A booked slot includes the booking ID and student username. A free slot has `booking: null`. Keep the F-02 role, assignment, and error rules. |

- **AC-14:** An assigned operator can retrieve the schedule and booking details for their machine. AC-10 covers rejection for an unassigned machine.
- **AC-15:** A student can retrieve a confirmed booking after an application restart using the same database.
- **AC-18:** The My Bookings list contains only the signed-in student's bookings.

## Shared access and Product Definition of Done

Protected routes return `401` for a missing or invalid session and `403` for the wrong role. The API checks resource ownership or assignment after validating the session and role.

A feature is done when all of the following hold:

- The behavior in its contract is implemented, including the error cases.
- The planned tests for its criteria have been run against the tested commit and pass, with real results recorded. Failed or skipped tests are reported, not removed.
- Its normal user flow has been checked in the browser.
- The teammate has reviewed and approved the PR, and it is merged into `sprint-1-staging`.
- Setup instructions and these documents match the implementation.
- Any incomplete work or known limitation is written down in the release notes.

The Sprint 1 release also requires the integrated browser journeys, local setup instructions, and review and test evidence for submission.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial contracts for F-01 to F-04. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added the layer and data table to each feature. Added AC-18 to AC-23 for BR-04, input errors and password storage. AC-09 now covers detail only, and the list check moved to AC-18. Session expiry set to one hour. Expanded the Definition of Done. |
| 0.3 | 2026-11-06 | Thawat Boonsuk | F-02 implemented: recorded the machine response fields, the error codes for each F-02 route, and the database check for whole-hour starts. |
| 0.4 | 2026-11-07 | Tanadet Nuchaikaew | F-03 review: recorded input, missing-resource and access error codes, and clarified that student guards apply only to matching F-03 routes. |
