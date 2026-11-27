# Sprint 3 Software Test Specification

Test design for the [Sprint 3 feature contracts](feature-contracts.md) (version 0.2), written before implementation. Execution results go in `verification.md` once the tests run; a row here is a plan, not evidence.

## Common fixtures

The Sprint 1 and Sprint 2 fixtures apply: a separate migrated PostgreSQL test database, students A and B, operator A assigned to `GPU-01`, operator B assigned to `GPU-02` and not to `GPU-01`, isolated data per test, and an injected fixed clock. F-08 adds `GPU-03`, also assigned to operator A, so that a summary without `machineId` has two machines to add up, and operator C, assigned to no machine. Each test uses its own dates, so other tests' slots never fall in its range. A booking or move needed for a check is made while the clock is before that slot's 30-minute cutoff; the clock then moves and the operator signs in again, as in the CR-01 tests. Every summary is read as operator A unless the row says otherwise.

| Test and level | Covers | Setup and action | Expected result |
|---|---|---|---|
| TC-SUM-01 · API and database | AC-45 | Date D, clock the day before. `GPU-01` slots at 10:00, 11:00, 12:00 and 13:00. Read the summary for D..D after each step: (1) nothing; (2) A books 10:00; (3) A cancels it; (4) A books 11:00 and moves it to 12:00; (5) operator A closes 13:00. | `{ open, booked, bookable }`: (1) 4, 0, 4; (2) 4, 1, 3; (3) 4, 0, 4; (4) 4, 1, 3, and the schedule shows 12:00 booked and 11:00 free; (5) 3, 1, 2. The cancelled and rescheduled rows never count. |
| TC-SUM-02 · API | AC-46 | `GPU-01` slots at D-1 23:00, D 00:00, D+1 23:00 and D+2 00:00 (Bangkok). Read D..D+1, then D..D. | D..D+1: `open` 2 (the D 00:00 and D+1 23:00 slots). D..D: `open` 1. |
| TC-SUM-03 · API | AC-47 | On date D: two slots on `GPU-01`, one on `GPU-03`, three on `GPU-02`. Operator A reads with `machineId` = `GPU-01`, with `GPU-03`, and with none. Operator B reads with none. Operator C reads with none. | Operator A: `open` 2, 1, then 3 with `machineId: null`. Operator B: 3 (only `GPU-02`). Operator C: `200` with `open`, `booked` and `bookable` all 0. |
| TC-SUM-04 · API and database | AC-48 | Date D, `GPU-01` slots at 11:00, 12:00 and 14:00. At 10:00, A books 11:00. Read at 13:29:59.999 and again at 13:30:00.000. | At 13:29:59.999: `open` 3, `booked` 1, `bookable` 1 (14:00). At 13:30:00.000: `open` 3, `booked` 1, `bookable` 0. The past 11:00 stays in `booked` and the past free 12:00 in `open`. |
| TC-SUM-05 · API | AC-49 | Requests with `from > to`; `from` missing; `to` missing; `from=2031-1-5`; `from=2031-02-30`; a 32-day range (2031-03-01..2031-04-01); a 31-day range (2031-03-01..2031-03-31). | `400 INVALID_DATE_RANGE` for each of the first six, with no counts in the body. The 31-day range returns `200`. |
| TC-SUM-06 · API | AC-50 | Operator B with `machineId` = `GPU-01`; operator A with an unknown ID, with `machineId=x`, with an empty `machineId=` and with `machineId` given twice; student A; no cookie. Each with a valid range. | `403 MACHINE_NOT_ASSIGNED`, `404 MACHINE_NOT_FOUND` four times, `403 FORBIDDEN`, `401 AUTH_REQUIRED`. No body contains `open`, `booked` or `bookable`. |
| TC-SUM-07 · API | Check order | Operator B with `machineId` = `GPU-01` and `from > to`. | `403 MACHINE_NOT_ASSIGNED`, not `400`: the machine is checked before the range. |
| TC-E2E-08 · UI | AC-51 | Browser: operator A opens Summary, picks date D and `GPU-01`, reads the counts; student A books a slot on D in another context; operator A refreshes the summary. | The counts show with their labels and change by one booked and one fewer bookable after the refresh. Remaining work after Deliverable 2. |

## Revisions to earlier tests

None. F-08 adds a route and changes no existing response, so any change in a Sprint 1 or Sprint 2 assertion is a regression.

## Regression on every staging merge and on the release candidate

- The full `npm test` and `npm run test:e2e` suites, which include every Sprint 1 and Sprint 2 test ID listed in the [Sprint 2 test specification](../sprint-2/test-specification.md), and `npm run verify:restart`.
- Deployed release: the Lab 5 smoke test plus one summary request on the deployed URL by an operator, checked against that operator's schedule for the same day.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-27 | Tanadet Nuchaikaew | Initial F-08 test design for contract 0.1: TC-SUM-01 to 07 and TC-E2E-08. |
| 0.2 | 2026-11-27 | Tanadet Nuchaikaew | PR #72 review: operator C with no machines in TC-SUM-03; empty and repeated `machineId` in TC-SUM-06. |
