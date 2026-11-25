# Sprint 2 Feature Contracts

Contracts for F-05 (cancel), F-06 (reschedule) and F-07 (close a slot). They are written and reviewed before any Sprint 2 code; implementation PRs cite the version they build against. Tests are defined in the [Sprint 2 test specification](test-specification.md). Shared rules are in the [system design](../../system-sds.md) and the [SRS](../../srs.md). Sprint 1 contracts stay unchanged in [sprint-1/feature-contracts.md](../sprint-1/feature-contracts.md); where a Sprint 2 feature changes a Sprint 1 route, the change is stated here.

Decisions used: D-08 (30-minute booking cutoff, Lab 7 CR-01), D-09 to D-13 (resolved 2026-11-25, see the SRS decision log).

## Shared Sprint 2 design

### Booking state and data

Sprint 2 keeps every booking row. Each booking has one of three states:

| Status | Meaning | Holds the slot and the student's hour? |
|---|---|---|
| `confirmed` | The current reservation. Every Sprint 1 booking becomes `confirmed`. | Yes |
| `cancelled` | Cancelled by its student before the slot started (F-05). `cancelledAt` is set. | No |
| `rescheduled` | Replaced by a new booking through a move (F-06). The replacement's `replacesBookingId` points to it. | No |

Transitions: `confirmed -> cancelled` (F-05) and `confirmed -> rescheduled` (F-06). Nothing leaves `cancelled` or `rescheduled`. Status values are lowercase, like role values; the plan draft wrote them in capitals as labels.

Slots gain `closedAt`. Transition: open -> closed (F-07). There is no reopen (D-13).

| Migration (in order) | Change |
|---|---|
| F-05 `..._booking_status` | Add `bookings.status text not null default 'confirmed'` with a check for the three values, and `bookings.cancelled_at timestamptz null` with a check that it is set exactly when `status = 'cancelled'`. Drop `bookings_slot_id_key` and `bookings_student_id_slot_start_at_key`. Create partial unique indexes `bookings_confirmed_slot_key (slot_id)` and `bookings_confirmed_student_hour_key (student_id, slot_start_at)`, both `WHERE status = 'confirmed'`. One transaction, raw SQL. |
| F-07 `..._slot_closure` | Add `slots.closed_at timestamptz null`. |
| F-06 `..._booking_replacement` | Add `bookings.replaces_booking_id int null unique` referencing `bookings(id)` with `ON DELETE RESTRICT`, so a booking is replaced at most once. |

Prisma cannot declare partial indexes. `schema.prisma` drops the two `@@unique` lines and comments that the migration is the source of truth for exclusivity. Existing rows default to `confirmed`, so the deployed database migrates with no data change; NFR-02 is rechecked after deployment.

### Conflict detection after the index change

Sprint 1 tells `SLOT_ALREADY_BOOKED` from `STUDENT_TIME_CONFLICT` by checking whether the Prisma `P2002` target array contains `slot_id`. With raw-SQL partial indexes Prisma may report the index name instead of the columns. The F-05 change must map the violated constraint by index name (`bookings_confirmed_slot_key` -> `SLOT_ALREADY_BOOKED`, `bookings_confirmed_student_hour_key` -> `STUDENT_TIME_CONFLICT`) in one shared helper used by booking and reschedule. TC-BOOK-02 and TC-BOOK-04 must still pass unchanged; that is the regression check.

### Serializing writes on a slot

Booking, reschedule and closure each run in a transaction that first takes `SELECT ... FOR UPDATE` on the target slot row. So a closure and a booking for the same slot are ordered, and the second sees the first's result. Partial unique indexes still settle competing bookings. Reschedule locks the original booking row first and then the target slot; the other writes lock only a slot or only a booking, so no lock cycle is possible.

### Changes to Sprint 1 routes

| Route | Change | Feature |
|---|---|---|
| `GET /api/v1/slots` | Exclude closed slots, and count only `confirmed` bookings as booked. Response shape unchanged. | F-05, F-07 |
| `POST /api/v1/bookings` | Run inside the slot-locking transaction. A closed slot returns `409 SLOT_CLOSED`, checked after `SLOT_NOT_FOUND` and before the time checks. Only `confirmed` bookings conflict. Other codes and their order unchanged. | F-05, F-07 |
| `GET /api/v1/bookings`, `GET /api/v1/bookings/{id}` | Add `status`, `cancelledAt` (null unless cancelled), `replacesBookingId` and `replacedByBookingId` (null when absent). The list still returns all of the student's rows ordered by slot start, so history stays visible. | F-05, F-06 |
| `GET /api/v1/machines/{machineId}/slots` | Add `closedAt` per slot. `booking` shows only the confirmed booking, or `null`. | F-05, F-07 |

### Access

Every new route requires a valid session (`401 AUTH_REQUIRED`) and the stated role (`403 FORBIDDEN`), then ownership or assignment, as in Sprint 1. A student never learns whether another student's booking exists (`404`). Writes go through the shared Origin check.

## F-05: Cancel a booking

**Requirements:** FR-06, FR-06.1 to FR-06.3, BR-01, BR-02, BR-04, NFR-01, NFR-02. **Decisions:** D-09, D-12. **Dependencies:** F-03, F-04. **Issue:** #12.

The student opens My Bookings and chooses Cancel on an upcoming confirmed booking, then confirms. The API checks ownership and that the server time is before the slot start. It changes the row to `cancelled` with one conditional update (`WHERE id = ? AND student_id = ? AND status = 'confirmed'`), so two cancels cannot both succeed. The UI refreshes My Bookings and shows the cancelled entry with its time. The slot and the student's hour are free again at once. Because cancellation has no 30-minute cutoff (D-12), a slot cancelled in its last 30 minutes is released but no longer offered to students.

| Layer | Change |
|---|---|
| UI | My Bookings: a status badge per entry; Cancel with a confirmation step on upcoming confirmed entries only; cancelled time on cancelled entries; error message on rejection, then refresh. |
| API | New cancel route below; Sprint 1 route changes in the shared table. |
| Data | F-05 migration (status, `cancelled_at`, partial unique indexes). |

| API | Contract |
|---|---|
| `POST /api/v1/bookings/{bookingId}/cancel` | Student only. No body. `200` with the booking view (`bookingId`, `slotId`, `machineId`, `machineCode`, `startAt`, `endAt`, `status: "cancelled"`, `cancelledAt`, `replacesBookingId`, `replacedByBookingId`). Checks in order: `404 BOOKING_NOT_FOUND` for an invalid, unknown or another student's ID; `409 BOOKING_NOT_CONFIRMED` if it is already `cancelled` or `rescheduled` (D-09), with no change; `409 BOOKING_ALREADY_STARTED` at or after `startAt`. |

- **AC-24:** The owner cancels an upcoming confirmed booking and receives `200`. The row remains with `status = cancelled` and `cancelledAt` equal to the server time, and the booking still appears in My Bookings and its detail. (FR-06.1, FR-06.3)
- **AC-25:** Another student cancelling the booking receives `404`; an operator receives `403`; a request without a session receives `401`. The booking stays confirmed. (FR-06.1, BR-02, NFR-01)
- **AC-26:** A cancel at exactly `startAt` or later returns `409 BOOKING_ALREADY_STARTED` and changes nothing. A cancel one millisecond before `startAt` succeeds, including inside the last 30 minutes. (FR-06.1, D-12)
- **AC-27:** After a cancellation, another student can book the released slot if it is still more than 30 minutes ahead, and the cancelling student can book another machine at the same hour. The operator schedule shows the slot with `booking: null` until it is booked again. (FR-06.2, BR-01, BR-04)
- **AC-28:** A second cancel of the same booking, sequential or concurrent, returns `409 BOOKING_NOT_CONFIRMED`. Exactly one cancel succeeds and `cancelledAt` is not overwritten. (D-09)
- **AC-29:** A cancelled booking is retrieved with the same status and `cancelledAt` after an application restart using the same database. (FR-06.3, NFR-02)

## F-06: Reschedule a booking

**Requirements:** FR-07, FR-07.1 to FR-07.3 (as revised by Lab 7 CR-01), BR-01 to BR-04, NFR-01. **Decisions:** D-08, D-10. **Dependencies:** F-03, F-04, F-05; TC-MOVE-07 also needs F-07. **Issue:** #13.

From an upcoming confirmed booking the student chooses Move, picks a date, and sees that date's availability (the F-03 list). The student selects a target and confirms. The API validates the original and the target, then in one transaction locks the original booking, rechecks it is still confirmed, locks the target slot, rechecks the target, sets the original to `rescheduled`, and inserts a new confirmed booking with `replacesBookingId`. If any step fails, the transaction rolls back and the original stays confirmed (BR-03). Because the original is released before the insert inside the same transaction, a move to another machine at the same hour is allowed. The UI shows the new booking and refreshes My Bookings, where the original appears as rescheduled with a link to its replacement.

| Layer | Change |
|---|---|
| UI | Move action on upcoming confirmed entries; date picker and availability list reusing the F-03 components; confirm step; result links to the new booking; rejection message, then refresh. |
| API | New reschedule route below. |
| Data | F-06 migration (`replaces_booking_id`). |

| API | Contract |
|---|---|
| `POST /api/v1/bookings/{bookingId}/reschedule` | Student only. Body `{ slotId }`, a positive integer. `201` with `{ bookingId, slotId, replacesBookingId }` for the new booking and `Location: /api/v1/bookings/{newId}`. Checks in order: `404 BOOKING_NOT_FOUND` (invalid, unknown or another student's booking); `409 BOOKING_NOT_CONFIRMED`; `409 BOOKING_ALREADY_STARTED` (original at or after its start); `400 INVALID_SLOT_ID`; `404 SLOT_NOT_FOUND`; `409 SAME_SLOT` (target is the original's slot); `409 SLOT_CLOSED`; `409 SLOT_ALREADY_STARTED` and `409 BOOKING_CLOSED` for the target (same rule and order as F-03, D-08); `409 SLOT_ALREADY_BOOKED`; `409 STUDENT_TIME_CONFLICT` (the student holds another confirmed booking at the target hour). |

- **AC-30:** A move to an available slot returns `201`. The new booking is confirmed for the target with `replacesBookingId` set; the original is `rescheduled`; the original slot is immediately bookable by another student if more than 30 minutes ahead. (FR-07.2, BR-03)
- **AC-31:** A move to a slot another student holds returns `409 SLOT_ALREADY_BOOKED`. The original stays confirmed and no new row exists. (FR-07.3, BR-03)
- **AC-32:** A move to an hour where the student holds a confirmed booking on another machine returns `409 STUDENT_TIME_CONFLICT` and the original stays confirmed. A move to another machine at the original's own hour succeeds. (BR-04)
- **AC-33:** A target starting exactly 30 minutes after server time, or sooner, is rejected (`BOOKING_CLOSED`, or `SLOT_ALREADY_STARTED` at or after start); a target starting 30 minutes and one millisecond after server time is accepted. An original at or after its start returns `409 BOOKING_ALREADY_STARTED`. (FR-07.1, D-08)
- **AC-34:** Another student's booking returns `404`; an operator receives `403`; no session receives `401`. Nothing changes. Moving a cancelled or rescheduled booking returns `409 BOOKING_NOT_CONFIRMED`. (BR-02, NFR-01, D-10)
- **AC-35:** Two students moving their bookings to the same target concurrently: exactly one succeeds, and the other keeps its original confirmed booking. Two concurrent moves of the same booking: exactly one succeeds. (FR-07.3, BR-01, BR-03)
- **AC-36:** A move to a closed slot returns `409 SLOT_CLOSED` and the original stays confirmed. (FR-08.2)

## F-07: Close a slot

**Requirements:** FR-08, FR-08.1, FR-08.2, BR-01, BR-02, NFR-01. **Decision:** D-13. **Dependencies:** F-02, F-03. **Issue:** #14.

In the machine schedule, the assigned operator chooses Close on an upcoming slot with no confirmed booking, then confirms. The API checks the machine and assignment, locks the slot row, and checks that it is not closed, not started, and has no confirmed booking. It then sets `closedAt`. The schedule shows the slot as Closed. Students no longer see it, and booking or moving into it is rejected. A slot whose only booking was cancelled counts as unbooked and can be closed. Closure uses "upcoming" (server time before `startAt`), not the 30-minute cutoff (D-13).

| Layer | Change |
|---|---|
| UI | Operator schedule: Close with a confirmation step on upcoming, open, unbooked rows only; Closed label on closed rows; rejection message, then refresh. |
| API | New close route below; Sprint 1 route changes in the shared table. |
| Data | F-07 migration (`slots.closed_at`). |

| API | Contract |
|---|---|
| `POST /api/v1/machines/{machineId}/slots/{slotId}/close` | Operator only. No body. `200` with `{ slotId, machineId, startAt, endAt, closedAt }`. Checks in order: `404 MACHINE_NOT_FOUND` (invalid or unknown machine); `403 MACHINE_NOT_ASSIGNED`; `404 SLOT_NOT_FOUND` (invalid, unknown, or on another machine); `409 SLOT_CLOSED`; `409 SLOT_ALREADY_STARTED` (at or after `startAt`); `409 SLOT_ALREADY_BOOKED` (a confirmed booking exists). |

- **AC-37:** The assigned operator closes an upcoming unbooked slot and receives `200`. The schedule then returns the slot with `closedAt` set. A slot whose booking was cancelled can be closed. (FR-08.1)
- **AC-38:** A closed slot is missing from student availability. A direct booking returns `409 SLOT_CLOSED` and creates no booking. (FR-08.2)
- **AC-39:** Closing a slot with a confirmed booking returns `409 SLOT_ALREADY_BOOKED`; at or after its start, `409 SLOT_ALREADY_STARTED`; closing it again, `409 SLOT_CLOSED`. A slot one millisecond before its start can be closed. Rejected requests change nothing. (FR-08.1, D-13)
- **AC-40:** An unassigned operator receives `403 MACHINE_NOT_ASSIGNED`, a student `403 FORBIDDEN`, and no session `401`. A slot ID from another machine returns `404`. Nothing changes. (BR-02, NFR-01)
- **AC-41:** A close and a booking sent concurrently for the same slot: exactly one succeeds, and the final state is either closed with no confirmed booking or open with one confirmed booking. (BR-01, FR-08.2)

## Product Definition of Done (Sprint 2)

The Sprint 1 Product Definition of Done applies, with these changes:

- The contract version and its STS rows are merged into `sprint-2-staging` before the feature's first code commit.
- On the feature branch, a commit with the new tests failing comes before the implementation commit. Both are recorded in the verification record (TDD evidence).
- The feature PR is reviewed and approved by the teammate and merged into `sprint-2-staging`, not `sprint-1-staging`.
- Migrations apply cleanly to a database with Sprint 1 data, and the full Sprint 1 suite (including the CR-01 boundary tests) passes on the same commit.
- After the Sprint 2 release reaches `main`, the feature works on the Cloud Run deployment, and the deployed version matches the tag `sprint-2` and its CI run.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-25 | Tanadet Nuchaikaew | Initial contracts for F-05 to F-07, using D-08 to D-13. Written before any Sprint 2 code. |
