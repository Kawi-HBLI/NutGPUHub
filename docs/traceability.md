# Requirements Traceability

Sprint 1 test IDs refer to the [test specification](sprints/sprint-1/test-specification.md). The checks below are planned.

| Requirement | Feature or responsibility | Sprint | Acceptance criteria and planned verification |
|---|---|---|---|
| FR-01 | F-03, F-04 | 1 | AC-01, AC-02, AC-03, AC-12, AC-13, AC-19. `TC-BOOK-01`, `TC-BOOK-02`, `TC-BOOK-03`, `TC-BOOK-04`, `TC-ACCESS-03`, `TC-E2E-01`, `TC-E2E-02`. |
| FR-02 | F-01 | 1 | AC-06, AC-07, AC-16, AC-20. `TC-AUTH-01`, `TC-AUTH-02`, `TC-AUTH-03`, `TC-VALID-01`, `TC-E2E-02`. |
| FR-03 | F-02 | 1 | AC-04, AC-05, AC-08, AC-10, AC-17, AC-21. `TC-SLOT-01`, `TC-SLOT-03`, `TC-ACCESS-01`, `TC-VALID-01`. |
| FR-04 | F-03 | 1 | AC-11, AC-22. `TC-SLOT-02`, `TC-VALID-01`. |
| FR-05 | F-02, F-03, F-04 | 1 | AC-01, AC-09, AC-10, AC-14, AC-18. `TC-BOOK-01`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-E2E-01`. |
| FR-06 | F-05 | 2 | Cancel an owned upcoming booking, verify its history, and book the released slot as another student. Check that another student cannot cancel it. |
| FR-07 | F-06 | 2 | Move a booking and verify that the original slot becomes available. Attempt a move to an occupied slot and verify that the original booking remains confirmed. |
| FR-08 | F-07 | 2 | Close an upcoming unbooked slot and verify that both availability and the booking API exclude it. Verify booked-slot and assignment restrictions. |
| FR-09 | F-08 | 3 | Verify report counts before and after cancellation, including machine and date filtering and assignment restrictions. |
| BR-01 | F-02, F-03 | 1 | AC-02, AC-03, AC-04, AC-05, AC-17. `TC-TIME-01`, `TC-SLOT-01`, `TC-SLOT-03`, `TC-BOOK-02`, `TC-BOOK-03`. Recheck exclusivity in Sprint 2 after booking changes. |
| BR-02 | F-01, F-02, F-03, F-04 | 1 | AC-08, AC-09, AC-10, AC-12, AC-14, AC-18. `TC-BOOK-01`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-ACCESS-03`. Extend checks to new routes in Sprints 2–3. |
| BR-03 | F-06 | 2 | Attempt a move after another student takes the target slot. Verify that the original remains confirmed and no second booking was created. |
| BR-04 | F-03, later F-05 and F-06 | 1 | AC-19. `TC-BOOK-04`. In Sprint 2, check that a cancelled booking frees the hour and that a reschedule into an hour the student already holds is rejected. |
| NFR-01 | Authentication and authorization across protected routes | 1 | `TC-AUTH-02`, `TC-AUTH-03`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-ACCESS-03`. Extend route coverage in Sprints 2–3. |
| NFR-02 | F-03, F-04 and durable storage | 1 | AC-15. `TC-PERSIST-01`. Repeat the persistence check on the Cloud Run release after Lab 5. |
| NFR-03 | F-01 credential and session handling | 1 | AC-07, AC-16, AC-23. `TC-AUTH-02`, `TC-AUTH-03`, `TC-AUTH-04`. |

## Coverage gaps

Every baseline FR, BR and NFR has a feature or responsibility and a sprint. Sprint 2 and Sprint 3 requirements do not yet have acceptance criteria or test IDs. Those are written in each sprint's feature contracts before implementation starts.

## Approved changes

| Date | Change | Reason | Affected IDs |
|---|---|---|---|
| 2026-11-06 | Added BR-04, one machine per student per hour. | Team decision D-01 in the SRS. | BR-04, AC-19, `TC-BOOK-04`, F-03, F-05, F-06 |
| 2026-11-06 | Added NFR-03 and fixed the session lifetime at one hour. | Team decisions D-03 and D-04. | NFR-03, AC-16, AC-23, `TC-AUTH-03`, `TC-AUTH-04` |
| 2026-11-06 | Split the student booking list out of AC-09 into AC-18. | AC-09 was listed under both F-03 and F-04. | AC-09, AC-18, `TC-ACCESS-02` |
| 2026-11-06 | Added AC-20 to AC-22 for malformed input and unknown resources. | The contracts specified these errors without acceptance criteria. | AC-20, AC-21, AC-22, `TC-VALID-01` |

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial traceability matrix. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added BR-04 and NFR-03 rows, new AC and test IDs, and the coverage gap and approved change sections. |
