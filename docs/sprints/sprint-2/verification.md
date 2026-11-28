# Sprint 2 Verification Record

Execution results for the [Sprint 2 test specification](test-specification.md) (version 0.3) against the [feature contracts](feature-contracts.md) (version 0.3, merged into `sprint-2-staging` in PR #67 as `d498a11`). A row records what actually ran. Rows for features not yet built stay planned.

## F-05 cancel a booking (#12)

Branch `feature/12-cancel-booking`, cut from `sprint-2-staging` at `d498a11`. The local runs below used the separate test database from `.env` (`TEST_DATABASE_URL`, PostgreSQL 16 in Docker) and Chromium Headless Shell revision 1217. CI runs on the PR are the evidence of record for Deliverable 2; their run IDs are added here when they exist.

### TDD order

| Step | Commit | What it contains | Local result |
|---|---|---|---|
| RED (API and DB) | `6b4f09a` | `tests/cancel-booking.test.ts` (TC-CANCEL-01 to 05, TC-DB-01, TC-DB-02) and the TC-ACCESS-02 revision in `tests/view-bookings.test.ts`. No production code. | `npm test`: 8 failed, 43 passed, 0 skipped. Each failure is the missing feature: the cancel route returns `404 NOT_FOUND`, the `status` column does not exist (TC-DB-01, PostgreSQL `42703`), and My Bookings lacks `status` and `cancelledAt`. |
| GREEN (API and DB) | `47d30fc` | Migration `20261127000100_booking_status`, `schema.prisma`, `server/bookings.ts` (cancel route, booking view, `bookingConflict` helper), `server/machines.ts` (schedule counts confirmed bookings only). | `npm test`: 51 passed, 0 failed, 0 skipped. |
| RED (UI) | `408dc17` | `e2e/cancel-booking.spec.ts` (TC-E2E-05). | Failed: no Cancel button in My Bookings. |
| GREEN (UI) | `a170df2` | `client/student.tsx` (Cancel, confirmation step, status badge, cancelled time), `client/styles.css`. | `npm run test:e2e`: 5 passed (TC-E2E-01 to 05). |
| Restart check | `285b0b8` | `scripts/process-restart-check.ts`, cancel part of TC-PERSIST-02. | `npm run verify:restart`: passed. |

Two disclosures:

- **TC-DB-01 assertion changed after the RED commit.** The first version expected the index name in the error text. PostgreSQL's detail, as Prisma passes it in `meta.message`, names the key columns instead (`Key (slot_id)=...`). The test now checks the SQLSTATE (`23505` unique, `23514` check) and the key columns. The rule under test did not change, and its RED failure (missing `status` column) is still valid. The change is in `47d30fc`.
- **TC-PERSIST-02 (cancel part) was written after the implementation**, so it passed on its first run. AC-29 has no separate RED evidence; the RED API tests cover the cancelled state it reads back.

### CI runs on PR #68

| Step | Commit | CI run | Vitest | Playwright |
|---|---|---|---|---|
| RED | `6b4f09a` | 45946771176 | 8 failed, 43 passed (51) | not reached |
| GREEN | `1528a7e` | 45947423217 | 51 passed (51), 9 files | 5 passed; TC-PERSIST-01 and TC-PERSIST-02 passed |

The local results below were rerun at `1528a7e`, the head that CI tested. `1528a7e` only adds this document and decision dates on top of `285b0b8`, so code and tests are the same.

### Results at `1528a7e` (head of PR #68)

| Command | Result |
|---|---|
| `npm run build` | Passed (server and client TypeScript, Vite build). |
| `npm test` | 51 passed, 0 failed, 0 skipped; 9 files. |
| `npm run test:e2e` | 5 passed, 0 failed, 0 skipped. |
| `npm run verify:restart` | Passed: TC-PERSIST-01 and the cancel part of TC-PERSIST-02. |

### AC-to-test mapping

| AC | Test | Actual file / assertion | Result at `1528a7e` |
|---|---|---|---|
| AC-24 | TC-CANCEL-01, TC-E2E-05 | `tests/cancel-booking.test.ts`: `200` with `status: cancelled` and `cancelledAt` = clock; detail, list and the stored row agree. `e2e/cancel-booking.spec.ts`: cancel with confirmation, still listed after reload. | Passed |
| AC-25 | TC-CANCEL-02 | Another student `404 BOOKING_NOT_FOUND` with only `error`; operator `403 FORBIDDEN`; no cookie `401 AUTH_REQUIRED`; unknown and invalid IDs `404`; row stays confirmed. | Passed |
| AC-26 | TC-CANCEL-03 | Four dates: cancel at 14:00:00.000 and 14:05 returns `409 BOOKING_ALREADY_STARTED` and leaves the row; 13:59:59.999 and 13:45 return `200`. | Passed |
| AC-27 | TC-CANCEL-04, TC-E2E-05 | Schedule shows `booking: null` after the cancel; B books the slot; A books another machine at the same hour; schedule then shows B. Browser: B books the released slot. | Passed |
| AC-28 | TC-CANCEL-05 | Sequential second cancel `409 BOOKING_NOT_CONFIRMED`, row unchanged; concurrent pair gives one `200` and one `409`. | Passed |
| AC-29 | TC-PERSIST-02 (cancel part) | `scripts/process-restart-check.ts`: cancelled booking detail is identical after a new server process. | Passed (written after implementation) |
| BR-01, BR-04 | TC-DB-01 | Partial indexes reject a second confirmed row per slot (`Key (slot_id)`) and per student hour (`Key (student_id, slot_start_at)`); a cancelled plus a confirmed row is allowed; both check constraints reject bad rows; no stored row violates them. | Passed |
| Conflict mapping | TC-DB-02, TC-BOOK-02, TC-BOOK-04 | After a cancellation, a held slot maps to `SLOT_ALREADY_BOOKED` and a held hour to `STUDENT_TIME_CONFLICT`. Sprint 1 tests unchanged and passing. | Passed |
| AC-18 (revision) | TC-ACCESS-02 | `tests/view-bookings.test.ts:69` strict list now includes `status: confirmed`, `cancelledAt: null`, as listed in the test specification. | Passed |

Not covered yet: the deployed-release check (Cloud Run) runs after the Sprint 2 release. F-06 adds the link fields to the same views and revises TC-ACCESS-02 again.

## F-07 close a slot (#14)

Branch `feature/14-close-slot`, cut from `sprint-2-staging` at `82b03a8` (after #68). Local runs used the Docker PostgreSQL 16 test database from `.env`.

### TDD order

| Step | Commit | What it contains | Result |
|---|---|---|---|
| RED (API and UI tests) | `abcfe61` | `tests/close-slot.test.ts` (TC-CLOSE-01 to 05), `e2e/close-slot.spec.ts` (TC-E2E-07). No production code. | CI run 45951713384: Vitest 5 failed, 51 passed (56), every failure the missing route (`404`); Playwright not reached. Locally TC-E2E-07 failed at the missing Close button. |
| GREEN (API) | `905bbe2` | Migration `20261127000200_slot_closure`, `schema.prisma` (`closedAt`), close route in `server/machines.ts`, slot-locking booking transaction and closed-slot filter in `server/bookings.ts`, `server/slot-lock.ts`. | Locally Vitest 56 passed; `close-slot` and `bookings` files rerun 5 times, all passed. |
| GREEN (UI) | `ff39150` | `client/operator.tsx`: Close, Confirm close / Keep open, Closed label. | Locally Playwright 6 passed. |
| Restart check | `8f5d69f` | Close part of TC-PERSIST-02 in `scripts/process-restart-check.ts`. | Passed. Written after the implementation, so it has no separate RED run. |

### CI runs on PR #69

| Step | Commit | CI run | Vitest | Playwright |
|---|---|---|---|---|
| RED | `abcfe61` | 45951713384 | 5 failed, 51 passed (56) | not reached |
| GREEN | `8f5d69f` | 45951910649 | 56 passed (56), 10 files | 6 passed (TC-E2E-01 to 05, 07); TC-PERSIST-01 and both TC-PERSIST-02 parts passed |

The UI RED (TC-E2E-07 failing) exists only as a local run, because CI stops at the failing Vitest step before Playwright.

### AC-to-test mapping

| AC | Test | Actual file / assertion | Result at `8f5d69f` |
|---|---|---|---|
| AC-37 | TC-CLOSE-01, TC-E2E-07, TC-PERSIST-02 (close part) | `200` with `{ slotId, machineId, startAt, endAt, closedAt }`, `closed_at` = clock time; a slot whose booking was cancelled can be closed; schedule shows `closedAt` and `booking: null`; `closedAt` unchanged after a process restart; UI row shows Closed. | Passed |
| AC-38 | TC-CLOSE-02, TC-E2E-07 | Closed slot absent from `GET /api/v1/slots`; direct booking `409 SLOT_CLOSED`, no booking row; student page lists nothing for that date. | Passed |
| AC-39 | TC-CLOSE-03 | Booked slot `409 SLOT_ALREADY_BOOKED`, closing twice `409 SLOT_CLOSED` with `closed_at` unchanged, 14:00 slot at 14:00 `409 SLOT_ALREADY_STARTED`, 14:00 slot at 13:59:59.999 `200` (D-13, no 30-minute cutoff). | Passed |
| AC-40 | TC-CLOSE-04 | Other operator `403 MACHINE_NOT_ASSIGNED`, student `403 FORBIDDEN`, no cookie `401`, slot of another machine and a non-numeric ID `404 SLOT_NOT_FOUND`, unknown machine `404 MACHINE_NOT_FOUND`; `closed_at` stays null. | Passed |
| AC-41 | TC-CLOSE-05 | 20 rounds of close and booking sent together: exactly one `2xx`, no `5xx`; losing booking `SLOT_CLOSED` with no confirmed booking, losing close `SLOT_ALREADY_BOOKED` with `closed_at` null. | Passed |

### Mutation check (TC-CLOSE-05)

TC-CLOSE-05 passing on its own does not show that it can catch a race, so it was run against a mutated `server/slot-lock.ts` with `FOR UPDATE` removed from the `SELECT`. The change was never committed.

| Who | Where | Mutated (no `FOR UPDATE`) | Restored |
|---|---|---|---|
| Thawat Boonsuk, through Claude Code (PR #69 review, at `cad94ac`) | Temporary schemas, dropped afterwards | Failed in every run: both the close and the booking succeeded | Passed 3 of 3 runs; the close won about 1 round in 20 and the booking the rest, so both branches of the test ran |
| Tanadet Nuchaikaew, through Claude Code (at `cad94ac`) | Local PostgreSQL 16 test database | Failed 3 of 3 runs | Passed 3 of 3 runs; `git status` clean afterwards |

So the race test fails when the slot lock is missing, and the lock is what makes AC-41 pass.

Not covered yet: the deployed-release check runs after the Sprint 2 release. AC-44 (TC-CLOSE-06, close against a move) is covered in the F-06 section.

## F-06 reschedule a booking (#13)

Branch `feature/13-reschedule`, cut from `feature/14-close-slot` at `f5ff39c`, which reached `sprint-2-staging` through #69. Local runs used the Docker PostgreSQL 16 test database from `.env`.

### TDD order

| Step | Commit | What it contains | Result |
|---|---|---|---|
| RED (API and UI tests) | `bbfaf53` | `tests/reschedule.test.ts` (TC-MOVE-01 to 09), TC-CLOSE-06 in `tests/close-slot.test.ts`, `e2e/reschedule.spec.ts` (TC-E2E-06), TC-ACCESS-02 expecting the two link fields. No production code. | CI run 46021926341: Vitest 11 failed, 55 passed (66); every failure the missing route (`404`) or the missing link fields; Playwright not reached. Locally TC-E2E-06 failed at the missing Move button. |
| GREEN (API) | `d796fb9` | Migration `20261127000300_booking_replacement`, `schema.prisma` (`replacesBookingId`, self relation), reschedule route and shared `slotRefusal` in `server/bookings.ts`, `lockBooking` in `server/slot-lock.ts`. | Locally Vitest 66 passed; `reschedule`, `close-slot` and `cancel` files rerun 5 times, all passed. |
| GREEN (UI) | `cfc99cb` | `client/student.tsx`: Move, Move here, Confirm move / Keep current booking, Stop moving, Rescheduled label, links between the two bookings. | Locally Playwright 7 passed. |
| Restart check | `c563284` | Reschedule part of TC-PERSIST-02 in `scripts/process-restart-check.ts`. | Passed. Written after the implementation, so it has no separate RED run. |

### CI runs on PR #70

| Step | Commit | CI run | Vitest | Playwright |
|---|---|---|---|---|
| RED | `bbfaf53` | 46021926341 | 11 failed, 55 passed (66) | not reached |
| GREEN | `c563284` | 46024245235 | 66 passed (66), 11 files | 7 passed (TC-E2E-01 to 07); TC-PERSIST-01 and all three TC-PERSIST-02 parts passed |

The UI RED (TC-E2E-06 failing) exists only as a local run, because CI stops at the failing Vitest step before Playwright.

### AC-to-test mapping

| AC | Test | Actual file / assertion | Result at `c563284` |
|---|---|---|---|
| AC-30 | TC-MOVE-01, TC-E2E-06, TC-PERSIST-02 (reschedule part) | `201` with a new `bookingId`, `replacesBookingId` = original and a `Location`; original `rescheduled` with `replacedByBookingId`; B then books the freed slot (`201`); both bookings and their links unchanged after a process restart; UI shows Rescheduled and a link to the new booking. | Passed |
| AC-31 | TC-MOVE-02 | `409 SLOT_ALREADY_BOOKED`; original confirmed, booking count unchanged. | Passed |
| AC-32 | TC-MOVE-03 | Move into an hour A holds on another machine `409 STUDENT_TIME_CONFLICT`, original kept; move to another machine at the original's own hour `201`. | Passed |
| AC-33 | TC-MOVE-04 | Target at 13:29:59.999 `201`, 13:30:00.000 `409 BOOKING_CLOSED`, 14:00 `409 SLOT_ALREADY_STARTED`; started original `409 BOOKING_ALREADY_STARTED`; every rejected move leaves the original confirmed. | Passed |
| AC-34 | TC-MOVE-05 | Other student `404 BOOKING_NOT_FOUND`, operator `403`, no cookie `401`, cancelled and rescheduled originals `409 BOOKING_NOT_CONFIRMED`, `slotId: "x"` `400 INVALID_SLOT_ID` with both a valid and another student's booking ID, unknown slot `404 SLOT_NOT_FOUND`, own slot `409 SAME_SLOT`; no row changes. | Passed |
| AC-35 | TC-MOVE-06 | 5 rounds each: two students moving to one target, exactly one `201` and the other `409 SLOT_ALREADY_BOOKED` with its original confirmed; two moves of one booking, exactly one `201` and the other `409 BOOKING_NOT_CONFIRMED`. No `5xx`. The third case, added after the PR #70 review, is below. | Passed |
| AC-36 | TC-MOVE-07 | Move to a closed slot `409 SLOT_CLOSED`; original confirmed. | Passed |
| AC-42 | TC-MOVE-08 | 10 rounds each of a swap (both `409 SLOT_ALREADY_BOOKED`) and a cross-move (both `409 STUDENT_TIME_CONFLICT`); no `500`, both originals confirmed. | Passed |
| AC-43 | TC-MOVE-09 | 10 rounds of a cancel and a move of one booking sent together: exactly one wins; the loser gets `409 BOOKING_NOT_CONFIRMED`; no replacement when the cancel wins, replacement confirmed when the move wins. | Passed |
| AC-44 | TC-CLOSE-06 | 10 rounds of a close and a move into one slot sent together: exactly one wins; losing move `409 SLOT_CLOSED` with the original confirmed, losing close `409 SLOT_ALREADY_BOOKED` with `closed_at` null. | Passed |

TC-ACCESS-02 was revised again, as planned in the contract: its strict `toEqual` now includes `replacesBookingId: null, replacedByBookingId: null`.

### Mutation check (lockBooking)

`server/slot-lock.ts` was run with `FOR UPDATE` removed from the `lockBooking` query. The change was never committed.

| Who | Where | Mutated (no `FOR UPDATE` on the booking) | Restored |
|---|---|---|---|
| Tanadet Nuchaikaew, through Claude Code (at `c563284`) | Local PostgreSQL 16 test database | TC-MOVE-06 and TC-MOVE-09 failed 3 of 3 runs: two moves of one booking, or a cancel and a move, both succeeded | Passed 3 of 3 runs; `git status` clean afterwards |

TC-MOVE-08 (swap and cross-move) still passed under the mutation. It depends on the conflict checks that run before any write, not on the booking lock, which matches the contract's reason for those checks.

### PR #70 review

Thawat Boonsuk approved PR #70 at `eb9fcef` after runs he made through Claude Code in temporary schemas, dropped afterwards: RED 11 failures at `bbfaf53`; GREEN Vitest 66/66, Playwright 7/7 and the restart check; the reschedule, close and cancel files 3 times, 22/22 each. Those runs also covered the mutation the PR had not: with the two pre-write checks (slot taken, same hour) removed, TC-MOVE-08 got a `500` from the deadlock and failed in every run, with or without an extra delay. The `lockBooking` mutation matched the one above.

| Mutation | Who | Result |
|---|---|---|
| Pre-write checks removed | Thawat Boonsuk, through Claude Code (at `eb9fcef`) | TC-MOVE-08 failed in every run (`500`, deadlock) |
| No `FOR UPDATE` in `lockBooking` | Thawat Boonsuk, through Claude Code (at `eb9fcef`) | TC-MOVE-06 and TC-MOVE-09 failed in every run |

So both halves of the design are needed: the booking lock for AC-35 and AC-43, the pre-write checks for AC-42.

He noted that no test covered the last race the contract leaves to the indexes: one student moving two bookings into the same hour on different machines at once. The two transactions lock different rows, so the pre-write check can miss the other's uncommitted booking and the student-hour index refuses the second insert. TC-MOVE-06 now has that case (test specification 0.5): 5 rounds, exactly one `201` and one `409 STUDENT_TIME_CONFLICT`, the loser's original confirmed with no replacement.

The code already handled this case, so the test passed on its first run and has no RED. To show it can fail, the reschedule route was run with the `bookingConflict` mapping removed from its `catch` (never committed):

| Who | Where | Mutated (no `bookingConflict` in the reschedule `catch`) | Restored |
|---|---|---|---|
| Tanadet Nuchaikaew, through Claude Code | Local PostgreSQL 16 test database | Failed 3 of 3 runs at the new case: `[201, 500]` instead of `[201, 409]` | `reschedule.test.ts` passed 3 of 3 runs; `git status` clean afterwards |

Not covered yet: the deployed-release check runs after the Sprint 2 release.

## Release regression on `sprint-2-staging`

Run through Claude Code by Tanadet Nuchaikaew on the local PostgreSQL 16 test database, before the Sprint 2 release PR.

| Check | Commit | Result |
|---|---|---|
| `npm test` | `c506704` | 66 passed (66), 11 files |
| `npm run test:e2e` | `c506704` | 7 passed (TC-E2E-01 to 07) |
| `npm run verify:restart` | `c506704` | TC-PERSIST-01 and the cancel, close and reschedule parts of TC-PERSIST-02 passed |
| TC-X-01 (`tests/cross-feature.test.ts`) | this PR | Passed; full `npm test` 67 passed (67) in 3 of 3 runs |

TC-X-01 was listed in the regression set of the test specification but had not been written when F-05 to F-07 merged. It was added afterwards, so it has no RED run: it checks that the features work together, and every step it uses is already covered by its own RED/GREEN tests above. The deployed-release check runs after the release reaches `main`.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-27 | Tanadet Nuchaikaew | F-05 local RED/GREEN runs and AC mapping. CI run IDs to be added from the PR. |
| 0.2 | 2026-11-27 | Tanadet Nuchaikaew | PR #68 review: added CI runs 45946771176 (RED) and 45947423217 (GREEN); results recorded at `1528a7e`. |
| 0.3 | 2026-11-27 | Tanadet Nuchaikaew | F-07: TDD order, CI runs 45951713384 (RED) and 45951910649 (GREEN), AC-37 to AC-41 mapping. |
| 0.4 | 2026-11-27 | Tanadet Nuchaikaew | PR #69 review: TC-CLOSE-05 mutation check (no `FOR UPDATE`) by Thawat Boonsuk and Tanadet Nuchaikaew. |
| 0.5 | 2026-11-27 | Tanadet Nuchaikaew | F-06: TDD order, CI runs 46021926341 (RED) and 46024245235 (GREEN), AC-30 to AC-36 and AC-42 to AC-44 mapping, `lockBooking` mutation check. |
| 0.6 | 2026-11-27 | Tanadet Nuchaikaew | PR #70 review: Thawat Boonsuk's mutation runs; new TC-MOVE-06 case for one student's two moves into one hour, with a `bookingConflict` mutation check. |
| 0.7 | 2026-11-27 | Tanadet Nuchaikaew | PR #71 review: the mutation and rerun checks credited to Thawat Boonsuk and Tanadet Nuchaikaew were run through Claude Code; each row now says so, to match the AI-use declarations. |
| 0.8 | 2026-11-28 | Tanadet Nuchaikaew | Release regression at `c506704` and TC-X-01 (cross-feature), added before the Sprint 2 release. |
