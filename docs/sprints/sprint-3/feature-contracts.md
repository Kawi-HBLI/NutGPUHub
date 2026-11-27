# Sprint 3 Feature Contracts

Contract for F-08 (booking summary), the only Sprint 3 feature. It is written and reviewed before any F-08 code; the implementation PR cites the version it builds against. Tests are defined in the [Sprint 3 test specification](test-specification.md). Shared rules are in the [system design](../../system-sds.md), the [SRS](../../srs.md) and the [Sprint 2 contracts](../sprint-2/feature-contracts.md), whose booking states and access rules apply unchanged.

Decisions used: D-08 (30-minute booking cutoff, Lab 7 CR-01) and D-11 (Q-03, summary predicates), both approved. This contract records D-11 in full, as the SRS decision log asks.

## F-08: View a booking summary

**Requirements:** FR-09, FR-09.1, FR-09.2, BR-02, NFR-01. **Decisions:** D-08, D-11. **Dependencies:** F-02, F-04, F-05, F-07 (and F-06, whose `rescheduled` rows must not count). **Issue:** #15.

An operator chooses a date range and, optionally, one of their assigned machines. The page shows three counts for the slots in that range: open slots, slots with a confirmed booking, and slots a student can still book right now. Without a machine, the counts cover all of the operator's assigned machines and no others. The summary only reads; it changes nothing.

| Layer | Change |
|---|---|
| UI | Operator page: a Summary section with From and To dates (Bangkok), a machine choice (All my machines, or one assigned machine), and the three counts with their labels. A rejected range shows the API message. |
| API | New summary route below. No Sprint 1 or Sprint 2 route changes. |
| Data | None. Counts come from `slots.closed_at`, `slots.start_at` and booking `status`. No migration. |

### Counting rules (D-11)

The range covers slots with `from 00:00 <= startAt < (to + 1 day) 00:00`, Bangkok time (UTC+7), so both dates are inclusive. Among those slots, on the chosen machines:

| Count | A slot counts when | Past slots? |
|---|---|---|
| `open` | It is not closed (`closedAt` is null). | Included |
| `booked` | It has a `confirmed` booking. `cancelled` and `rescheduled` rows do not count. | Included |
| `bookable` | It is open, has no confirmed booking, and starts more than 30 minutes after the server time of the request (the F-03 rule, D-08). | Never, by definition |

A closed slot never holds a confirmed booking (F-07 refuses to close a booked slot and booking refuses a closed one), so every booked slot is also open, and `bookable <= open - booked`. The gap between them is open, unbooked slots that are past or inside the 30-minute window.

Past slots stay in `open` and `booked` so that the totals for a past range do not change every hour, which keeps fixture tests and the report easy to explain. Only `bookable` depends on the request time.

### API

| API | Contract |
|---|---|
| `GET /api/v1/booking-summary?from=YYYY-MM-DD&to=YYYY-MM-DD[&machineId=N]` | Operator only. `200` with `{ from, to, machineId, open, booked, bookable }`; `machineId` is `null` when the request names none. Checks in order: `401 AUTH_REQUIRED`; `403 FORBIDDEN` (not an operator); when `machineId` is present, `404 MACHINE_NOT_FOUND` (empty, repeated, not a positive integer, or unknown) and `403 MACHINE_NOT_ASSIGNED`; then `400 INVALID_DATE_RANGE` when `from` or `to` is missing, not `YYYY-MM-DD`, not a calendar date, `from > to`, or the range is longer than 31 days counting both ends. An operator with no assigned machines receives zeros when no `machineId` is given. |

The machine is checked before the range, as in the Sprint 1 schedule route, so an unassigned operator learns nothing about the range either. Error bodies carry no counts.

An empty `machineId=` is treated as an invalid machine (`404`), not as "all machines": the parameter is either absent or names one machine, so a client bug that drops the value cannot widen the report. The UI omits the parameter for All my machines.

### Acceptance criteria

AC numbering continues after AC-44.

- **AC-45:** For a controlled fixture on one assigned machine, the summary returns the expected `open`, `booked` and `bookable`. After a booking, `booked` rises by one and `bookable` falls by one. After that booking is cancelled, both return. After a move, the original's slot leaves `booked` and the target's joins it. After a free slot is closed, `open` and `bookable` fall by one. (FR-09.2, D-11)
- **AC-46:** Both dates are inclusive in Bangkok time: slots at `from` 00:00 and at `to` 23:00 count; slots at 23:00 the day before `from` and at 00:00 the day after `to` do not. A one-day range (`from = to`) is valid. (FR-09.1, D-11)
- **AC-47:** With `machineId`, only that machine's slots count. Without it, the counts are the sum over the operator's assigned machines, and a machine assigned to another operator never contributes. An operator with no assigned machines receives `200` with all three counts `0`. (FR-09.1, BR-02)
- **AC-48:** A slot starting exactly 30 minutes after the request time is not bookable; one starting more than 30 minutes after is. Past open slots count in `open` and past booked slots in `booked`, never in `bookable`. (FR-09.2, D-08, D-11)
- **AC-49:** `from > to`, a missing `from` or `to`, a value that is not `YYYY-MM-DD`, an impossible date such as `2031-02-30`, and a 32-day range return `400 INVALID_DATE_RANGE`. A 31-day range returns `200`. (D-11)
- **AC-50:** An unassigned machine returns `403 MACHINE_NOT_ASSIGNED`, an unknown, non-numeric or empty (`machineId=`) machine `404 MACHINE_NOT_FOUND`, a student `403 FORBIDDEN`, and no session `401`. None of these bodies contains a count. (BR-02, NFR-01)
- **AC-51:** In the browser, operator A picks a range and a machine and sees the three counts with labels; after a student books one of the counted slots, refreshing the summary shows the new counts. (FR-09)

### Deliverable 2 slice and remaining work

Deliverable 2 (29 November 2026) needs at least one meaningful Sprint 3 rule implemented, tested and deployed. The F-08 slice for it is the summary API with AC-45 to AC-50 and their tests, plus a minimal Summary section on the operator page. AC-51 and its browser test (TC-E2E-08), UI polish and the Sprint 3 UAT re-test are remaining work for the final release on 13 December, listed in the remaining-work plan.

## Product Definition of Done (Sprint 3)

The Sprint 2 Product Definition of Done applies, with these changes:

- The contract version and its STS rows are merged into `sprint-3-staging` before the feature's first code commit.
- The feature PR is reviewed, approved and merged into `sprint-3-staging`.
- The full Sprint 1 and Sprint 2 suites pass on the same commit with no revisions; F-08 adds a route and changes no existing response.
- After the release reaches `main`, the summary works on the Cloud Run deployment, and the deployed version matches the release tag and its CI run.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-27 | Tanadet Nuchaikaew | Initial F-08 contract, recording D-11; AC-45 to AC-51; Deliverable 2 slice. Written before any F-08 code. |
| 0.2 | 2026-11-27 | Tanadet Nuchaikaew | PR #72 review: an empty or repeated `machineId` returns `404`; an operator with no assigned machines gets zeros (AC-47, AC-50). |
