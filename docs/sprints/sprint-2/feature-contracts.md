# Sprint 2 Feature Contracts

Contracts for F-05 (cancel), F-06 (reschedule) and F-07 (close a slot). They are written and reviewed before any Sprint 2 code; implementation PRs cite the version they build against. Tests are defined in the [Sprint 2 test specification](test-specification.md). Shared rules are in the [system design](../../system-sds.md) and the [SRS](../../srs.md). Sprint 1 contracts stay unchanged in [sprint-1/feature-contracts.md](../sprint-1/feature-contracts.md); where a Sprint 2 feature changes a Sprint 1 route, the change is stated here.

Decisions used: D-08 (30-minute booking cutoff, Lab 7 CR-01) and the proposed D-09 to D-13 in the SRS decision log, which become team decisions when this contract is approved.

## Shared Sprint 2 design

### Booking state and data

Sprint 2 keeps every booking row. Each booking has one of three states:

| Status | Meaning | Holds the slot and the student's hour? | Added by |
|---|---|---|---|
| `confirmed` | The current reservation. Every Sprint 1 booking becomes `confirmed`. | Yes | F-05 |
| `cancelled` | Cancelled by its student before the slot started. `cancelledAt` is set. | No | F-05 |
| `rescheduled` | Replaced by a new booking through a move. The replacement's `replacesBookingId` points to it. | No | F-06 |

Transitions: `confirmed -> cancelled` (F-05) and `confirmed -> rescheduled` (F-06). Nothing leaves `cancelled` or `rescheduled`. Status values are lowercase, like role values. The F-05 check constraint already allows all three values, so F-06 needs no constraint change.

Slots gain `closedAt`. Transition: open -> closed (F-07). There is no reopen (D-13).

| Migration (in order) | Change |
|---|---|
| F-05 `..._booking_status` | Add `bookings.status text not null default 'confirmed'` with a check for the three values, and `bookings.cancelled_at timestamptz null` with a check that it is set exactly when `status = 'cancelled'`. Drop `bookings_slot_id_key` and `bookings_student_id_slot_start_at_key`. Create partial unique indexes `bookings_confirmed_slot_key (slot_id)` and `bookings_confirmed_student_hour_key (student_id, slot_start_at)`, both `WHERE status = 'confirmed'`. One transaction, raw SQL. |
| F-07 `..._slot_closure` | Add `slots.closed_at timestamptz null`. |
| F-06 `..._booking_replacement` | Add `bookings.replaces_booking_id int null unique` referencing `bookings(id)` with `ON DELETE RESTRICT`, so a booking is replaced at most once. |

Prisma cannot declare partial indexes. `schema.prisma` drops the two `@@unique` lines and comments that the migration is the source of truth for exclusivity. Existing rows default to `confirmed`, so the deployed database migrates with no data change; NFR-02 is rechecked after deployment.

### Conflict detection

The partial unique indexes stay the final guard. Prisma 5.22 still reports a `P2002` violation of them with the column list as `meta.target` (`["slot_id"]` or `["student_id","slot_start_at"]`), not the index name; this was checked in a temporary schema during review of PR #67. So the Sprint 1 column check stays, moved into one shared helper used by booking and reschedule: a target containing `slot_id` maps to `SLOT_ALREADY_BOOKED`, anything else to `STUDENT_TIME_CONFLICT`. Inserts and status updates use the Prisma client, not raw SQL, because a raw-SQL violation arrives as `P2010` with no target.

### Serializing writes

Each write runs in one transaction that takes its row locks first and only then reads the state it decides on:

| Write | Locks, in order | Checks after the locks, before writing |
|---|---|---|
| Booking (F-03, changed) | Target slot row (`SELECT ... FOR UPDATE`). | Slot not closed. Insert; the indexes reject a second confirmed booking. |
| Reschedule (F-06) | Original booking row, then target slot row. | Original still `confirmed`. Target not closed. No `confirmed` booking on the target slot (`SLOT_ALREADY_BOOKED`). No `confirmed` booking of this student at the target hour other than the original (`STUDENT_TIME_CONFLICT`). Then update the original and insert the replacement. |
| Close (F-07) | Target slot row. | Not closed, not started, no `confirmed` booking. |
| Cancel (F-05) | None beyond the conditional update, which locks the booking row. | `WHERE id = ? AND student_id = ? AND status = 'confirmed' AND slot_start_at > :now`, where `:now` is the injected clock value, not the database `now()`. If no row changes, reread to choose `404`, `409 BOOKING_NOT_CONFIRMED` or `409 BOOKING_ALREADY_STARTED`. |

The explicit reschedule checks matter. If conflicts were left to the indexes alone, two students swapping slots, or one student moving two bookings into each other's hours, deadlock: each transaction waits on a row the other has changed. PostgreSQL then aborts one with error `40P01`, which has no `P2002` code and would surface as a `500`. With the checks, each transaction sees the other's booking still confirmed and both return `409` (AC-42; reproduced and confirmed during review). The indexes still catch the remaining race, two moves by one student into the same hour on different machines, and the helper maps it to `409 STUDENT_TIME_CONFLICT`. No Sprint 2 route may return `500` for a conflict; a test that sees one fails.

### Changes to Sprint 1 routes

| Route | Change | Feature |
|---|---|---|
| `GET /api/v1/slots` | Count only `confirmed` bookings as booked (F-05). Exclude closed slots (F-07). Response shape unchanged. | F-05, F-07 |
| `POST /api/v1/bookings` | Only `confirmed` bookings conflict (F-05). Runs in the slot-locking transaction, and a closed slot returns `409 SLOT_CLOSED`, checked after `SLOT_NOT_FOUND` and before the time checks (F-07). Other codes and their order unchanged. | F-05, F-07 |
| `GET /api/v1/bookings`, `GET /api/v1/bookings/{id}` | F-05 adds `status` and `cancelledAt` (null unless cancelled). F-06 adds `replacesBookingId` and `replacedByBookingId` (null when absent). The list still returns all of the student's rows ordered by slot start, so history stays visible. | F-05, F-06 |
| `GET /api/v1/machines/{machineId}/slots` | `booking` shows only the confirmed booking, or `null` (F-05). Each slot gains `closedAt` (F-07). | F-05, F-07 |

The added list fields break one strict Sprint 1 assertion, `tests/view-bookings.test.ts:69` (TC-ACCESS-02, AC-18), which uses `toEqual` on the My Bookings entries. F-05 revises that assertion to include the new fields; the AC and its ownership check do not change. The [test specification](test-specification.md#justified-revisions-to-sprint-1-tests) records the revision.

### Access

Every new route requires a valid session (`401 AUTH_REQUIRED`) and the stated role (`403 FORBIDDEN`), then ownership or assignment, as in Sprint 1. A student never learns whether another student's booking exists (`404`). Writes go through the shared Origin check.

### Release and rollback limit

After the F-05 migration runs, the Sprint 1 and Lab 7 code (image `25cb60f`) cannot be rolled back onto the same database safely. That code does not know `status`, so it would treat cancelled and rescheduled rows as bookings in availability, in booking conflicts and in the schedule, and it would not see closed slots. A rollback past the Sprint 2 release therefore needs the database restored to its pre-migration state as well. The Sprint 2 release notes state this limit.

## F-05: Cancel a booking

**Requirements:** FR-06, FR-06.1 to FR-06.3, BR-01, BR-02, BR-04, NFR-01, NFR-02. **Decisions:** D-09, D-12. **Dependencies:** F-03, F-04. **Issue:** #12.

The student opens My Bookings and chooses Cancel on an upcoming confirmed booking, then confirms. The API checks ownership and that the server time is before the slot start. It changes the row to `cancelled` with one conditional update (`WHERE id = ? AND student_id = ? AND status = 'confirmed' AND slot_start_at > :now`, using the injected clock), so two cancels cannot both succeed and a started booking is never cancelled, even if it starts between the API's first read and the update. When no row changes, the API rereads the booking to return `404`, `409 BOOKING_NOT_CONFIRMED` or `409 BOOKING_ALREADY_STARTED`. The UI refreshes My Bookings and shows the cancelled entry with its time. The slot and the student's hour are free again at once. Because cancellation has no 30-minute cutoff (D-12), a slot cancelled in its last 30 minutes is released but no longer offered to students.

| Layer | Change |
|---|---|
| UI | My Bookings: a status badge per entry; Cancel with a confirmation step on upcoming confirmed entries only; cancelled time on cancelled entries; error message on rejection, then refresh. |
| API | New cancel route below; Sprint 1 route changes in the shared table. |
| Data | F-05 migration (status, `cancelled_at`, partial unique indexes). |

| API | Contract |
|---|---|
| `POST /api/v1/bookings/{bookingId}/cancel` | Student only. No body. `200` with the booking view (`bookingId`, `slotId`, `machineId`, `machineCode`, `startAt`, `endAt`, `status: "cancelled"`, `cancelledAt`; F-06 later adds the two link fields to the same view). Checks in order: `404 BOOKING_NOT_FOUND` for an invalid, unknown or another student's ID; `409 BOOKING_NOT_CONFIRMED` if it is already `cancelled` or `rescheduled` (D-09), with no change; `409 BOOKING_ALREADY_STARTED` at or after `startAt`. |

- **AC-24:** The owner cancels an upcoming confirmed booking and receives `200`. The row remains with `status = cancelled` and `cancelledAt` equal to the server time, and the booking still appears in My Bookings and its detail. (FR-06.1, FR-06.3)
- **AC-25:** Another student cancelling the booking receives `404`; an operator receives `403`; a request without a session receives `401`. The booking stays confirmed. (FR-06.1, BR-02, NFR-01)
- **AC-26:** A cancel at exactly `startAt` or later returns `409 BOOKING_ALREADY_STARTED` and changes nothing. A cancel one millisecond before `startAt` succeeds, including inside the last 30 minutes. (FR-06.1, D-12)
- **AC-27:** After a cancellation, another student can book the released slot if it is still more than 30 minutes ahead, and the cancelling student can book another machine at the same hour. The operator schedule shows the slot with `booking: null` until it is booked again. (FR-06.2, BR-01, BR-04)
- **AC-28:** A second cancel of the same booking, sequential or concurrent, returns `409 BOOKING_NOT_CONFIRMED`. Exactly one cancel succeeds and `cancelledAt` is not overwritten. (D-09)
- **AC-29:** A cancelled booking is retrieved with the same status and `cancelledAt` after an application restart using the same database. (FR-06.3, NFR-02)

## F-06: Reschedule a booking

**Requirements:** FR-07, FR-07.1 to FR-07.3 (as revised by Lab 7 CR-01), BR-01 to BR-04, NFR-01, NFR-02. **Decisions:** D-08, D-10. **Dependencies:** F-03, F-04, F-05; AC-36 and AC-44 also need F-07. **Issue:** #13.

From an upcoming confirmed booking the student chooses Move, picks a date, and sees that date's availability (the F-03 list). The student selects a target and confirms. The API validates the input, the original and the target, then runs the reschedule transaction in the shared table: lock the original, lock the target slot, recheck both, set the original to `rescheduled`, and insert a new confirmed booking with `replacesBookingId`. If any step fails, the transaction rolls back and the original stays confirmed (BR-03). Because the original is excluded from the student-hour check and released before the insert, a move to another machine at the same hour is allowed. The UI shows the new booking and refreshes My Bookings, where the original appears as rescheduled with a link to its replacement.

| Layer | Change |
|---|---|
| UI | Move action on upcoming confirmed entries; date picker and availability list reusing the F-03 components; confirm step; result links to the new booking; rejection message, then refresh. |
| API | New reschedule route below; `replacesBookingId` and `replacedByBookingId` added to the student booking views. |
| Data | F-06 migration (`replaces_booking_id`). |

| API | Contract |
|---|---|
| `POST /api/v1/bookings/{bookingId}/reschedule` | Student only. Body `{ slotId }`, a positive integer. `201` with `{ bookingId, slotId, replacesBookingId }` for the new booking and `Location: /api/v1/bookings/{newId}`. Checks in order: `400 INVALID_SLOT_ID` (body validated first, as in F-03); `404 BOOKING_NOT_FOUND` (invalid, unknown or another student's booking); `409 BOOKING_NOT_CONFIRMED`; `409 BOOKING_ALREADY_STARTED` (original at or after its start); `404 SLOT_NOT_FOUND`; `409 SAME_SLOT` (target is the original's slot); `409 SLOT_CLOSED`; `409 SLOT_ALREADY_STARTED` and `409 BOOKING_CLOSED` for the target (same rule and order as F-03, D-08); `409 SLOT_ALREADY_BOOKED`; `409 STUDENT_TIME_CONFLICT`. The state checks are repeated after the locks, so a concurrent change gives the same codes. |

- **AC-30:** A move to an available slot returns `201`. The new booking is confirmed for the target with `replacesBookingId` set; the original is `rescheduled` with `replacedByBookingId` set; the original slot is immediately bookable by another student if more than 30 minutes ahead. Both bookings are retrieved unchanged after an application restart. (FR-07.2, BR-03, NFR-02)
- **AC-31:** A move to a slot another student holds returns `409 SLOT_ALREADY_BOOKED`. The original stays confirmed and no new row exists. (FR-07.3, BR-03)
- **AC-32:** A move to an hour where the student holds a confirmed booking on another machine returns `409 STUDENT_TIME_CONFLICT` and the original stays confirmed. A move to another machine at the original's own hour succeeds. (BR-04)
- **AC-33:** A target starting exactly 30 minutes after server time, or sooner, is rejected (`BOOKING_CLOSED`, or `SLOT_ALREADY_STARTED` at or after start); a target starting 30 minutes and one millisecond after server time is accepted. An original at or after its start returns `409 BOOKING_ALREADY_STARTED`. (FR-07.1, D-08)
- **AC-34:** Another student's booking returns `404`; an operator receives `403`; no session receives `401`. Nothing changes. Moving a cancelled or rescheduled booking returns `409 BOOKING_NOT_CONFIRMED`. (BR-02, NFR-01, D-10)
- **AC-35:** Two students moving their bookings to the same target concurrently: exactly one returns `201`; the other returns `409 SLOT_ALREADY_BOOKED` and keeps its original confirmed booking. Two concurrent moves of the same booking: exactly one returns `201` and the other `409 BOOKING_NOT_CONFIRMED`. (FR-07.3, BR-01, BR-03)
- **AC-36:** A move to a closed slot returns `409 SLOT_CLOSED` and the original stays confirmed. (FR-08.2)
- **AC-42:** Student A (holding S1) moves to S2 while student B (holding S2) moves to S1, concurrently: both return `409 SLOT_ALREADY_BOOKED` and both originals stay confirmed. Student A holding 14:00 on `GPU-01` and 15:00 on `GPU-01` moves the 14:00 booking to 15:00 on `GPU-02` and the 15:00 booking to 14:00 on `GPU-02`, concurrently: both return `409 STUDENT_TIME_CONFLICT`. No request returns `500`. (FR-07.3, BR-01, BR-03, BR-04)
- **AC-43:** A cancel and a reschedule of the same booking sent concurrently: exactly one succeeds. If the cancel wins, the move returns `409 BOOKING_NOT_CONFIRMED` and no replacement exists; if the move wins, the cancel returns `409 BOOKING_NOT_CONFIRMED` and the replacement stays confirmed. (FR-06.1, FR-07.2, BR-03)

## F-07: Close a slot

**Requirements:** FR-08, FR-08.1, FR-08.2, BR-01, BR-02, NFR-01, NFR-02. **Decision:** D-13. **Dependencies:** F-02, F-03. **Issue:** #14.

In the machine schedule, the assigned operator chooses Close on an upcoming slot with no confirmed booking, then confirms. The API checks the machine and assignment, locks the slot row, and checks that it is not closed, not started, and has no confirmed booking. It then sets `closedAt`. The schedule shows the slot as Closed. Students no longer see it, and booking or moving into it is rejected. A slot whose only booking was cancelled counts as unbooked and can be closed. Closure uses "upcoming" (server time before `startAt`), not the 30-minute cutoff (D-13).

| Layer | Change |
|---|---|
| UI | Operator schedule: Close with a confirmation step on upcoming, open, unbooked rows only; Closed label on closed rows; rejection message, then refresh. |
| API | New close route below; Sprint 1 route changes in the shared table. |
| Data | F-07 migration (`slots.closed_at`). |

| API | Contract |
|---|---|
| `POST /api/v1/machines/{machineId}/slots/{slotId}/close` | Operator only. No body. `200` with `{ slotId, machineId, startAt, endAt, closedAt }`. Checks in order: `404 MACHINE_NOT_FOUND` (invalid or unknown machine); `403 MACHINE_NOT_ASSIGNED`; `404 SLOT_NOT_FOUND` (invalid, unknown, or on another machine); `409 SLOT_CLOSED`; `409 SLOT_ALREADY_STARTED` (at or after `startAt`); `409 SLOT_ALREADY_BOOKED` (a confirmed booking exists). |

- **AC-37:** The assigned operator closes an upcoming unbooked slot and receives `200`. The schedule then returns the slot with `closedAt` set, also after an application restart. A slot whose booking was cancelled can be closed. (FR-08.1, NFR-02)
- **AC-38:** A closed slot is missing from student availability. A direct booking returns `409 SLOT_CLOSED` and creates no booking. (FR-08.2)
- **AC-39:** Closing a slot with a confirmed booking returns `409 SLOT_ALREADY_BOOKED`; at or after its start, `409 SLOT_ALREADY_STARTED`; closing it again, `409 SLOT_CLOSED`. A slot one millisecond before its start can be closed. Rejected requests change nothing. (FR-08.1, D-13)
- **AC-40:** An unassigned operator receives `403 MACHINE_NOT_ASSIGNED`, a student `403 FORBIDDEN`, and no session `401`. A slot ID from another machine returns `404`. Nothing changes. (BR-02, NFR-01)
- **AC-41:** A close and a booking sent concurrently for the same slot: exactly one succeeds. If the close wins, the booking returns `409 SLOT_CLOSED` and the slot has no confirmed booking; if the booking wins, the close returns `409 SLOT_ALREADY_BOOKED` and the slot stays open with one confirmed booking. (BR-01, FR-08.2)
- **AC-44:** A close and a move into the same slot sent concurrently: exactly one succeeds. If the close wins, the move returns `409 SLOT_CLOSED` and the mover keeps the original; if the move wins, the close returns `409 SLOT_ALREADY_BOOKED`. (BR-01, BR-03, FR-08.2)

## Product Definition of Done (Sprint 2)

The Sprint 1 Product Definition of Done applies, with these changes:

- The contract version and its STS rows are merged into `sprint-2-staging` before the feature's first code commit.
- On the feature branch, a commit with the new tests failing comes before the implementation commit. Both are recorded in the verification record (TDD evidence).
- The feature PR is reviewed and approved by the teammate and merged into `sprint-2-staging`, not `sprint-1-staging`.
- Migrations apply cleanly to a database with Sprint 1 data, and the Sprint 1 suite (including the CR-01 boundary tests) passes on the same commit, with only the revisions listed in the test specification.
- After the Sprint 2 release reaches `main`, the feature works on the Cloud Run deployment, and the deployed version matches the tag `sprint-2` and its CI run. The release notes state the rollback limit above.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-25 | Tanadet Nuchaikaew | Initial contracts for F-05 to F-07, using D-08 to D-13. Written before any Sprint 2 code. |
| 0.2 | 2026-11-26 | Tanadet Nuchaikaew | PR #67 review: kept the column-based conflict mapping (Prisma reports columns, not the index name); added explicit post-lock checks to reschedule after the reviewer reproduced swap and cross-move deadlocks; added AC-42 to AC-44 for those and two more races; exact loser codes in AC-35 and AC-41; moved the link fields from F-05 to F-06; reschedule validates the body first; restart checks for reschedule and close; recorded the TC-ACCESS-02 revision and the rollback limit. |
| 0.3 | 2026-11-27 | Tanadet Nuchaikaew | PR #67 review round 2: the cancel update also requires `slot_start_at > :now` (injected clock), so a started booking cannot be cancelled and the reread can return `BOOKING_ALREADY_STARTED`. |
