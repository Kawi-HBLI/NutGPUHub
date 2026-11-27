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

## F-06 and F-07

Planned. See the test specification.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-27 | Tanadet Nuchaikaew | F-05 local RED/GREEN runs and AC mapping. CI run IDs to be added from the PR. |
| 0.2 | 2026-11-27 | Tanadet Nuchaikaew | PR #68 review: added CI runs 45946771176 (RED) and 45947423217 (GREEN); results recorded at `1528a7e`. |
