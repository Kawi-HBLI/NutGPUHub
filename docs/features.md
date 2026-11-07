# Feature Inventory

| ID | Feature | Sprint | Scope | Requirements | Dependencies |
|---|---|---|---|---|---|
| F-01 | Sign in and sign out | 1 | Authenticate prepared accounts, return the current account and role, and invalidate sessions on sign-out or after one hour. | FR-02, BR-02, NFR-01, NFR-03 | Prepared accounts |
| F-02 | Open GPU slots | 1 | List assigned machines and their slots. Publish one-hour slots on the hour for an assigned machine. Allow several distinct slots on the same date. | FR-03, FR-05, BR-01, BR-02, NFR-01 | F-01, machine assignment |
| F-03 | Find and book an available slot | 1 | List availability by date, reserve a slot before it starts, and retrieve the new booking as its owner. Exactly one competing request can reserve a slot, and a student cannot hold two machines in the same hour. | FR-01, FR-04, FR-05, BR-01, BR-02, BR-04, NFR-01, NFR-02 | F-01, F-02 |
| F-04 | View bookings by role | 1 | List a student's own bookings and add authorized booking details to the operator schedule. | FR-05, BR-02, NFR-01, NFR-02 | F-01, F-02, F-03 |
| F-05 | Cancel a booking | 2 | Cancel an upcoming booking, release its slot, and retain cancellation history. | FR-06, BR-01, BR-02, BR-04 | F-03, F-04 |
| F-06 | Reschedule a booking | 2 | Reserve an available replacement and release the original only when the move succeeds. | FR-07, BR-01, BR-02, BR-03, BR-04 | F-03, F-04, F-05 |
| F-07 | Manage future availability | 2 | Close an upcoming, unbooked slot for an assigned machine. | FR-08, BR-02 | F-02, F-03 |
| F-08 | View a booking summary | 3 | Filter by assigned machine and date range. Show open slots, slots with confirmed bookings, and slots that are still bookable. | FR-09, BR-02 | F-04, F-05, F-07 |

## Observable scope and implementation stage

| Feature | Refined requirement IDs | Stage as of 2026-11-07 |
|---|---|---|
| F-01 | FR-02.1 to FR-02.4 | Reviewed implementation merged into Sprint 1 staging (PR #7). |
| F-02 | FR-03.1 to FR-03.3, FR-05.3 | Reviewed implementation merged into Sprint 1 staging (PR #8). |
| F-03 | FR-01.1 to FR-01.4, FR-04.1 to FR-04.3, FR-05.2 | Reviewed implementation merged into Sprint 1 staging (PR #9). |
| F-04 | FR-05.1, FR-05.3, FR-05.4 | Reviewed implementation merged into Sprint 1 staging (PR #10). |
| F-05 | FR-06.1 to FR-06.3 | Sprint 2 Backlog; contract and Q-01 resolution required. |
| F-06 | FR-07.1 to FR-07.3 | Sprint 2 Backlog; depends on F-05 state/history design and Q-02 resolution. |
| F-07 | FR-08.1 to FR-08.2 | Sprint 2 Backlog; contract must handle competing closure/booking requests. |
| F-08 | FR-09.1 to FR-09.2 | Sprint 3 Backlog; resolve report predicates Q-03 before implementation. |

F-02 supplies the schedule; F-04 adds its reservation details. Feature completion in staging is distinct from the accepted main release and the submission evidence. UI-01 (#6), integrated acceptance evidence, release preparation and documentation are supporting work items; they do not introduce new product feature IDs. See [work tracking](work-tracking.md).

See the [requirements mapping](traceability.md), [sprint outcomes](sprints/plan.md), and [Sprint 1 feature contracts](sprints/sprint-1/feature-contracts.md).

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial feature inventory. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added the Requirements column. Added BR-04 to F-03, F-05 and F-06, and NFR-03 to F-01. |
| 0.3 | 2026-11-07 | Tanadet Nuchaikaew | Added refined requirement ranges and distinguished staging implementation, future Backlog and supporting delivery work. |
