# Sprint 1 Feature Contracts

See the [system design](../../system-sds.md) for shared rules and the [test specification](test-specification.md) for fixtures and expected results. Test results and reviewer evidence are recorded against the implemented release.

## F-01 — Sign in and sign out

**Requirements:** FR-02, BR-02, NFR-01. **Dependency:** prepared accounts.

The user enters a username and password. On successful sign-in, the API creates a session and returns the account ID, username, and role. The UI opens the appropriate role view. On reload, the UI requests the current account. On sign-out, it returns to sign-in.

| API | Contract |
|---|---|
| `POST /api/v1/auth/login` | Accept `username` and `password`. Return `200` with account details and the session cookie. Return `400` for malformed fields and `401` with a generic error for wrong credentials. |
| `GET /api/v1/auth/me` | Return `200` with the current account ID, username, and role. Return `401` for missing, expired, or invalidated sessions. |
| `POST /api/v1/auth/logout` | Invalidate any matching session, clear the cookie, and return `204`. |

- **AC-06:** Valid student and operator accounts receive the correct roles. Wrong credentials return `401` and create no session.
- **AC-07:** The signed-in user can retrieve their account. Reusing the previous session after sign-out returns `401`.
- **AC-16:** A session at its expiry time is rejected with `401`.

## F-02 — Open GPU slots

**Requirements:** FR-03, FR-05, BR-01, BR-02, NFR-01. **Dependencies:** F-01 and a machine assignment.

An operator chooses an assigned machine, a date, and an hourly start. The UI previews the one-hour range. The API checks the operator's assignment, validates the hour in `Asia/Bangkok`, and checks that the start is strictly later than server time. The database enforces a unique machine and start-time pair. On success, the slot appears in the operator schedule.

| API | Contract |
|---|---|
| `GET /api/v1/machines` | Return `200` with the signed-in operator's assigned machines, each with its ID and code. |
| `GET /api/v1/machines/{machineId}/slots?date=YYYY-MM-DD` | Return `200` with the assigned machine's slots for the selected Bangkok date. Each entry includes `slotId`, `machineId`, `startAt`, and `endAt`. Return `403` for an existing unassigned machine, `404` for an unknown machine, and `400` for a missing or invalid date. F-04 adds booking details to this response. |
| `POST /api/v1/machines/{machineId}/slots` | Accept `startAt` as a timestamp with an offset, for example `2026-11-08T14:00:00+07:00`. Return `201` with `slotId`, `machineId`, `startAt`, and `endAt`. Return `400` for malformed, off-hour, or nonfuture times, `403` for an existing unassigned machine, `404` for an unknown machine, and `409` with `SLOT_ALREADY_EXISTS` for a duplicate slot. |

- **AC-04:** An assigned operator can open consecutive hourly slots on the same machine. Opening the same start time twice is rejected.
- **AC-05:** A start time of `14:30` is rejected and creates no slot.
- **AC-08:** A student cannot create a slot.
- **AC-10:** An operator cannot create a slot or read a schedule for an unassigned machine.
- **AC-17:** A slot at or before the current server time is rejected and creates no slot.

## F-03 — Find and book an available slot

**Requirements:** FR-01, FR-04, FR-05, BR-01, BR-02, NFR-01, NFR-02. **Dependencies:** F-01 and F-02.

The student chooses a date, selects an available slot, and submits one booking request. The API uses the session to identify the student. It validates the slot and writes the booking under the database uniqueness constraint. The UI confirms a successful reservation and links to the saved booking. It refreshes availability after a conflict.

| API | Contract |
|---|---|
| `GET /api/v1/slots?date=YYYY-MM-DD` | Return `200` with the future, unbooked slots for the selected Bangkok calendar date, ordered by start time. Each entry contains `slotId`, `machineId`, `machineCode`, `startAt`, and `endAt`. Return an empty list when appropriate and `400` for a missing or invalid date. |
| `POST /api/v1/bookings` | Accept `slotId` as a positive integer. Return `201` with `bookingId` and `slotId`, and a `Location` header for `/api/v1/bookings/{bookingId}`. Return `400` for an invalid ID, `404` for an unknown slot, and `409` with `SLOT_ALREADY_STARTED` or `SLOT_ALREADY_BOOKED` for a conflict. |
| `GET /api/v1/bookings/{bookingId}` | Return `200` with the student's own booking ID, slot ID, machine code, and slot times. Return `404` for an unknown booking or one owned by another student. |

- **AC-01:** Booking an available slot creates a reservation that the student can retrieve as its owner.
- **AC-02:** When two students request the same slot concurrently, one request succeeds and one is rejected. The database stores exactly one booking for the successful account.
- **AC-03:** A request at or after the slot start is rejected and creates no booking.
- **AC-09 (detail):** A direct request for another student's booking returns `404` without disclosing booking data.
- **AC-11:** The selected date shows future, unbooked slots available to reserve.
- **AC-12:** A booking request without a valid session receives `401`. A signed-in operator receives `403`. Neither request creates a booking.
- **AC-13:** An invalid slot ID returns `400` and an unknown slot ID returns `404`. Neither request creates a booking.

## F-04 — View bookings by role

**Requirements:** FR-05, BR-02, NFR-01, NFR-02. **Dependencies:** F-01 through F-03.

Students use **My Bookings** to list their saved reservations and open the booking detail introduced in F-03. Operators use the machine schedule introduced in F-02 to see reservation details. A booked slot shows the booking student's username only in the authorized operator view. Both views show times in `Asia/Bangkok` and show an empty state when no records match.

| API | Contract |
|---|---|
| `GET /api/v1/bookings` | Return `200` with only the signed-in student's bookings, including machine code and slot times. |
| `GET /api/v1/machines/{machineId}/slots?date=YYYY-MM-DD` | Extend the F-02 response with a `booking` field on each slot. A booked slot includes the booking ID and student username. A free slot has `booking: null`. Keep the F-02 role, assignment, and error rules. |

- **AC-09 (list and detail):** List results contain only owned bookings. A direct request for another student's booking returns `404`.
- **AC-14:** An assigned operator can retrieve the schedule and booking details for their machine. AC-10 covers rejection for an unassigned machine.
- **AC-15:** A student can retrieve a confirmed booking after an application restart using the same database.

## Shared access and definition of done

Protected routes return `401` for a missing or invalid session and `403` for the wrong role. The API checks resource ownership or assignment after validating the session and role.

Before a feature is complete, verify its criteria through the planned tests and its normal user flow. Record real results against the tested commit, document any setup changes, and obtain teammate PR review. The Sprint 1 release also requires the integrated browser journey, local setup instructions, and review and test evidence for submission.
