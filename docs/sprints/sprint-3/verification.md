# Sprint 3 Verification Record

Execution results for the [Sprint 3 test specification](test-specification.md) (version 0.2) against the [feature contracts](feature-contracts.md) (version 0.2, merged into `sprint-3-staging` in PR #72 as `6383c2f`). A row records what actually ran. Rows not yet run stay planned.

## F-08 booking summary (#15), Deliverable 2 slice

### TDD order

| Step | Commit | Run | Result |
|---|---|---|---|
| Tests first | `718f20a` | Local, then CI run 46130533131 on PR #77 | RED: the 7 TC-SUM tests failed, all with `404` because `GET /api/v1/booking-summary` did not exist; the other 66 tests passed (73 in all) |
| Route and minimal Summary section | `b42fc20` | Local, then CI run 46130817201 on PR #77 | GREEN: `npm test` 73 passed (73), `npm run test:e2e` 7 passed, type checks clean |

Local runs were made through Claude Code by Tanadet Nuchaikaew on the local PostgreSQL 16 test database.

### Acceptance criteria

| AC | Test | Result at `b42fc20` |
|---|---|---|
| AC-45 counts follow book, cancel, move and close | TC-SUM-01 | Passed: (4,0,4), (4,1,3), (4,0,4), (4,1,3), (3,1,2); the schedule shows the move target booked and the original slot free |
| AC-46 both dates inclusive in Bangkok time | TC-SUM-02 | Passed: D..D+1 counts 2 of the 4 edge slots, D..D counts 1 |
| AC-47 machine filter, operator's own machines only, zeros for no machines | TC-SUM-03 | Passed: 2, 1, 3 (`machineId: null`) for operator A; 3 for operator B; all zeros for operator C |
| AC-48 30-minute boundary, past slots | TC-SUM-04 | Passed: `bookable` 1 at 13:29:59.999 and 0 at 13:30:00.000; the past booked and past free slots stay in `booked` and `open` |
| AC-49 invalid ranges | TC-SUM-05 | Passed: six `400 INVALID_DATE_RANGE` with no counts; 31 days returns `200` |
| AC-50 access and machine refusals | TC-SUM-06 | Passed: `403 MACHINE_NOT_ASSIGNED`, four `404 MACHINE_NOT_FOUND` (unknown, `x`, empty, repeated), `403 FORBIDDEN`, `401 AUTH_REQUIRED`; no body contains a count |
| Check order | TC-SUM-07 | Passed: unassigned machine with `from > to` returns `403`, not `400` |
| AC-51 browser summary | TC-E2E-08 | Planned. Remaining work for 13 December |

### Mutation checks

Each change was made by hand in `server/summary.ts`, the TC-SUM tests were run, and the file was restored with `git restore`. Run through Claude Code by Tanadet Nuchaikaew.

| Mutation | Failing test | What it shows |
|---|---|---|
| `bookable` includes a slot exactly 30 minutes away (`gt: now + cutoff - 1 ms`) | TC-SUM-04: `bookable` 1 instead of 0 at 13:30:00.000 | The boundary is tested at the millisecond |
| `booked` counts a slot with a booking of any status (`some: {}`) | TC-SUM-01: cancelled and rescheduled rows counted | Only `confirmed` counts (D-11) |
| The range is checked before the machine | TC-SUM-07: `400` instead of `403` | The contract's check order is pinned |

### Minimal Summary section

The operator page has a Summary card with From, To, a machine choice (All my machines omits `machineId`) and the three counts. It was checked through Claude Code with a temporary Playwright script, not committed, against the local build at 1280 px and 390 px widths: the counts showed 3, 0, 3 for three free slots on one date, and the card stacked under the other cards on the phone width with no horizontal scroll. The committed browser test for it is TC-E2E-08, planned for 13 December.

Not covered yet: the deployed check runs after the candidate release reaches `main`.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-28 | Tanadet Nuchaikaew | F-08 slice: TDD order, CI runs 46130533131 (RED) and 46130817201 (GREEN), AC-45 to AC-50 results, three mutation checks, Summary section check. |
