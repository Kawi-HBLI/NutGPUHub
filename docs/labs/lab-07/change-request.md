# Lab 7 change request CR-01: booking closes 30 minutes before the slot starts

Status: contract revision for teammate review. No code is changed until this document and the linked specification edits are approved.

## Request

| Item | Value |
|---|---|
| Change request | CR-01, GitHub issue #63 (part of #20) |
| Kind | Change to correct Sprint 1 behavior because the requirement changed (not a defect fix) |
| Approval | Not required: the instructor told the class that the instructor/TA approval step can be skipped for Lab 7. |
| Accepted Sprint 1 baseline (old rule) | Tag `sprint-1`, commit `984c4ad`. Accepted by the Lab 6 UAT Team on release `911f631` and corrected release `5f744ab`. |
| Pre-change implementation | `main` at `5f744ab` (Cloud Run revision `nutgpuhub-00008-txd`). No Sprint 2 or 3 code is on `main`; the commits between `sprint-1` and `5f744ab` are Lab 5 delivery work and the Lab 6 fix #60, none of which touch the booking start check. |

## Old and new rule

| | Rule |
|---|---|
| Old (FR-01, FR-04, AC-03, AC-11) | A student can book a free slot until its start time. A request at or after the start is rejected with `409 SLOT_ALREADY_STARTED`. Availability lists free slots that start strictly after the server time. |
| New | Booking closes 30 minutes before the slot starts. A request is accepted only while the server time is earlier than `startAt − 30 minutes`. From `startAt − 30 minutes` up to the start, the request is rejected with `409 BOOKING_CLOSED` and the message "Booking closes 30 minutes before the slot starts." At or after the start, `409 SLOT_ALREADY_STARTED` is unchanged. Availability lists only free slots whose start is strictly later than the server time plus 30 minutes. |

**Reason.** Operators asked for time to prepare the machine (check drivers, clear the previous user's files) before a booked hour begins. A booking made a few minutes before the start leaves no preparation time.

### Boundaries (slot 14:00 Bangkok)

| Server time | Booking request | Listed as available |
|---|---|---|
| 13:29:59.999 | `201` booking created | yes |
| 13:30:00.000 | `409 BOOKING_CLOSED`, no booking | no |
| 13:59:59.999 | `409 BOOKING_CLOSED`, no booking | no |
| 14:00:00.000 and later | `409 SLOT_ALREADY_STARTED`, no booking (unchanged) | no |

### Scope and invalid cases

- Applies to `POST /api/v1/bookings` and `GET /api/v1/slots`. The API decides; the UI only shows the API result.
- The cutoff is a fixed 30 minutes in Sprint 1 code. It is not configurable per machine or per role.
- Checks before the cutoff are unchanged and keep their order: `400 INVALID_SLOT_ID`, `404 SLOT_NOT_FOUND`, then the time checks, then `409 SLOT_ALREADY_BOOKED` and `409 STUDENT_TIME_CONFLICT`.
- Access is unchanged: only a signed-in student can book (`401` without a session, `403` for an operator). The cutoff does not reveal anything about other students' bookings.
- Operators can still open any future whole-hour slot (AC-17 unchanged). A slot opened less than 30 minutes before its start is never offered to students; the operator schedule still shows it as Available.
- Existing bookings are not affected. Sprint 1 has no cancel or reschedule, so no stored booking changes state.

## Acceptance criteria after the change

- **AC-03 (revised):** A booking request at or after `startAt − 30 minutes` is rejected and creates no booking. Before the start it returns `409 BOOKING_CLOSED`; at or after the start it returns `409 SLOT_ALREADY_STARTED`. A request one millisecond before `startAt − 30 minutes` succeeds.
- **AC-11 (revised):** The selected date shows unbooked slots that start more than 30 minutes after the server time. A slot starting exactly 30 minutes after the server time is not shown.

All other acceptance criteria (AC-01, AC-02, AC-04 to AC-10, AC-12 to AC-23) are unchanged.

## Impact

| Requirement | Feature | SRS | Feature SDS (contracts) | System-level SDS | AC | STS test | Code |
|---|---|---|---|---|---|---|---|
| FR-01, FR-01.1 | F-03 | FR-01 and FR-01.1 text revised | F-03 `POST /api/v1/bookings` row: add `BOOKING_CLOSED` | No change: "the API checks the server clock before booking" still holds; the injected clock stays the test seam | AC-03 revised | `TC-BOOK-03` revised, `TC-TIME-01` expected result revised | `server/bookings.ts` booking time check |
| FR-04, FR-04.1 | F-03 | FR-04 and FR-04.1 text revised | F-03 `GET /api/v1/slots` row: "more than 30 minutes after the server time" | No change | AC-11 revised | `TC-SLOT-02` revised | `server/bookings.ts` availability query |
| BR-01 | F-02, F-03 | No change (duration and exclusivity) | No change | No change | AC-04, AC-05, AC-17 unchanged | `TC-SLOT-01`, `TC-SLOT-03` unchanged | `server/machines.ts` unchanged |
| BR-02 | F-01 to F-04 | No change | No change | No change | AC-08 to AC-10, AC-12, AC-14, AC-18 unchanged | `TC-ACCESS-01` to `03` unchanged | Guards unchanged |
| BR-04 | F-03 | No change | No change | No change | AC-19 unchanged | `TC-BOOK-04` unchanged | Unique index unchanged |
| UI | F-03 | — | — | — | AC-03 message shown | `TC-E2E-01`, `TC-E2E-02` unchanged (their slots start a day later) | `client/student.tsx`: show the rule under the date field; the existing error alert shows the API message |

Not applicable, with reasons:

- **Persistence and migrations:** none. The rule compares the clock with `slots.start_at`, which already exists. No column, index or constraint changes.
- **Historical data:** none. Stored bookings keep their state; no data is rewritten.
- **Roles and ownership:** none beyond the existing student-only route; the rule applies to every student the same way.
- **Operator routes (F-02, F-04 schedule):** unchanged, because the change request concerns booking only.
- **Configuration and secrets:** none. The 30 minutes is a named constant, not an environment variable.

## Behavior that must stay the same, and the tests that protect it

| Preserved behavior | Protecting tests |
|---|---|
| A started slot is rejected with `SLOT_ALREADY_STARTED` | `TC-BOOK-03` (13:00 and 14:00 cases kept) |
| Invalid and unknown slot IDs (`400`, `404`) | `TC-BOOK-03`, `TC-VALID-01` |
| One booking per slot under concurrency; one machine per student per hour | `TC-BOOK-02`, `TC-BOOK-04` |
| Availability filters by Bangkok date and hides booked slots | `TC-SLOT-02` (date and booked cases kept) |
| Student-only access, ownership of booking detail and list | `TC-ACCESS-01` to `TC-ACCESS-03` |
| Operator can open future whole-hour slots | `TC-SLOT-01`, `TC-SLOT-03`, `TC-TIME-01` |
| Booking survives a restart | `TC-PERSIST-01` |
| Browser journeys | `TC-E2E-01` to `TC-E2E-04` |

The full Vitest suite (`npm test`) and Playwright suite (`npx playwright test`) run in CI on every PR and must stay green.

## Test-first plan

1. Revise `TC-BOOK-03` and `TC-SLOT-02` to assert the new rule, including the 13:29:59.999 and 13:30:00.000 boundaries, and commit them before any code change.
2. Run CI on that commit against the pre-change code: the revised assertions must fail because booking is still accepted inside the 30 minutes and the slot is still listed (RED).
3. Change `server/bookings.ts` and the student page; the same tests pass with the full suites (GREEN).

The old test "accepts a slot one millisecond before it starts" expects behavior the new rule forbids. It is replaced by "accepts a slot one millisecond before booking closes" and "rejects inside the 30 minutes", and the revision is recorded in the STS version history.
