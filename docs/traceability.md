# Requirements Traceability

Sprint 1 test IDs refer to the [test specification](sprints/sprint-1/test-specification.md). The checks below are planned.

| Requirement | Feature or responsibility | Sprint | Acceptance criteria and planned verification |
|---|---|---|---|
| FR-01 | F-03, F-04 | 1 | AC-01, AC-02, AC-03, AC-12, AC-13. `TC-BOOK-01`, `TC-BOOK-02`, `TC-BOOK-03`, `TC-ACCESS-03`, `TC-E2E-01`. |
| FR-02 | F-01 | 1 | AC-06, AC-07, AC-16. `TC-AUTH-01`, `TC-AUTH-02`, `TC-AUTH-03`. |
| FR-03 | F-02 | 1 | AC-04, AC-05, AC-08, AC-10, AC-17. `TC-SLOT-01`, `TC-SLOT-03`, `TC-ACCESS-01`. |
| FR-04 | F-03 | 1 | AC-11. `TC-SLOT-02`. |
| FR-05 | F-02, F-03, F-04 | 1 | AC-01, AC-09, AC-10, AC-14. `TC-BOOK-01`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-E2E-01`. |
| FR-06 | F-05 | 2 | Cancel an owned upcoming booking, verify its history, and book the released slot as another student. Check that another student cannot cancel it. |
| FR-07 | F-06 | 2 | Move a booking and verify that the original slot becomes available. Attempt a move to an occupied slot and verify that the original booking remains confirmed. |
| FR-08 | F-07 | 2 | Close an upcoming unbooked slot and verify that both availability and the booking API exclude it. Verify booked-slot and assignment restrictions. |
| FR-09 | F-08 | 3 | Verify report counts before and after cancellation, including machine and date filtering and assignment restrictions. |
| BR-01 | F-02, F-03 | 1 | AC-02, AC-03, AC-04, AC-05, AC-17. `TC-TIME-01`, `TC-SLOT-01`, `TC-SLOT-03`, `TC-BOOK-02`, `TC-BOOK-03`. Recheck exclusivity in Sprint 2 after booking changes. |
| BR-02 | F-01, F-02, F-03, F-04 | 1 | AC-08, AC-09, AC-10, AC-12, AC-14. `TC-BOOK-01`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-ACCESS-03`. Extend checks to new routes in Sprints 2–3. |
| BR-03 | F-06 | 2 | Attempt a move after another student takes the target slot. Verify that the original remains confirmed and no second booking was created. |
| NFR-01 | Authentication and authorization across protected routes | 1 | `TC-AUTH-02`, `TC-AUTH-03`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-ACCESS-03`. Extend route coverage in Sprints 2–3. |
| NFR-02 | F-03, F-04 and durable storage | 1 | AC-15. `TC-PERSIST-01`. Repeat the persistence check on a deployed release after Lab 5. |
