# Feature Inventory

| ID | Feature | Sprint | Scope | Dependencies |
|---|---|---|---|---|
| F-01 | Sign in and sign out | 1 | Authenticate prepared accounts, return the current account and role, and invalidate sessions on sign-out. | Prepared accounts |
| F-02 | Open GPU slots | 1 | List assigned machines and their slots. Publish one-hour slots on the hour for an assigned machine. Allow several distinct slots on the same date. | F-01, machine assignment |
| F-03 | Find and book an available slot | 1 | List availability by date, reserve a slot before it starts, and retrieve the new booking as its owner. Exactly one competing request can reserve a slot. | F-01, F-02 |
| F-04 | View bookings by role | 1 | List a student's own bookings and add authorized booking details to the operator schedule. | F-01, F-02, F-03 |
| F-05 | Cancel a booking | 2 | Cancel an upcoming booking, release its slot, and retain cancellation history. | F-03, F-04 |
| F-06 | Reschedule a booking | 2 | Reserve an available replacement and release the original only when the move succeeds. | F-03, F-04, F-05 |
| F-07 | Manage future availability | 2 | Close an upcoming, unbooked slot for an assigned machine. | F-02, F-03 |
| F-08 | View a booking summary | 3 | Filter by assigned machine and date range. Show open slots, slots with confirmed bookings, and slots that are still bookable. | F-04, F-05, F-07 |

See the [requirements mapping](traceability.md), [sprint outcomes](sprints/plan.md), and [Sprint 1 feature contracts](sprints/sprint-1/feature-contracts.md).
