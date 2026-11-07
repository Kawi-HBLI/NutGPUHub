# Requirements Traceability

Sprint 1 test IDs refer to the [test specification](sprints/sprint-1/test-specification.md). The parent matrix preserves the original baseline mapping. The child matrix below makes each refined behavior traceable. Execution evidence is recorded separately by tested commit; a mapping is not a claim that every planned scenario has passed.

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

## Subrequirement coverage

Each dotted ID is defined in the SRS and inherits its original parent. Existing AC and test IDs remain stable. Planned later-sprint checks are descriptions, not executed test IDs. See [verification and gaps](sprints/sprint-1/verification.md) for actual test files and outstanding evidence.

| Requirement | Feature | Sprint | Criteria | Verification |
|---|---|---|---|---|
| FR-01.1 | F-03 | 1 | AC-01, AC-03, AC-12, AC-13 | TC-BOOK-01, TC-BOOK-03, TC-ACCESS-03 |
| FR-01.2 | F-03 | 1 | AC-01 | TC-BOOK-01, TC-E2E-01 |
| FR-01.3 | F-03 | 1 | AC-02 | TC-BOOK-02, TC-E2E-02 |
| FR-01.4 | F-03 | 1 | AC-19 | TC-BOOK-04 |
| FR-02.1 | F-01 | 1 | AC-06, AC-20 | TC-AUTH-01, TC-VALID-01 |
| FR-02.2 | F-01 | 1 | AC-07 | TC-AUTH-02, TC-E2E-01 |
| FR-02.3 | F-01 | 1 | AC-07 | TC-AUTH-02, TC-E2E-02 |
| FR-02.4 | F-01 | 1 | AC-16 | TC-AUTH-03 |
| FR-03.1 | F-02 | 1 | AC-10 | TC-SLOT-01, TC-ACCESS-01 |
| FR-03.2 | F-02 | 1 | AC-04, AC-05, AC-08, AC-17, AC-21 | TC-SLOT-01, TC-SLOT-03, TC-ACCESS-01, TC-VALID-01 |
| FR-03.3 | F-02 | 1 | AC-04 | TC-SLOT-01 |
| FR-04.1 | F-03 | 1 | AC-11 | TC-SLOT-02 |
| FR-04.2 | F-03 | 1 | AC-11 | TC-SLOT-02 |
| FR-04.3 | F-03 | 1 | AC-22 | TC-VALID-01, TC-TIME-01 |
| FR-05.1 | F-04 | 1 | AC-18 | TC-ACCESS-02 |
| FR-05.2 | F-03 | 1 | AC-01, AC-09 | TC-BOOK-01, TC-ACCESS-02 |
| FR-05.3 | F-02, F-04 | 1 | AC-10, AC-14, AC-21 | TC-SLOT-01, TC-ACCESS-01, TC-ACCESS-02, TC-VALID-01 |
| FR-05.4 | F-04 | 1 | AC-14 | TC-ACCESS-02, TC-E2E-01 |
| FR-06.1 | F-05 | 2 | Planned contract | Planned: owner, wrong-owner, before/at-start checks |
| FR-06.2 | F-05 | 2 | Planned contract | Planned: rebook slot and freed student hour |
| FR-06.3 | F-05 | 2 | Planned contract | Planned: retained record/history and restart retrieval |
| FR-07.1 | F-06 | 2 | Planned contract | Planned: eligible target, ownership and time boundaries |
| FR-07.2 | F-06 | 2 | Planned contract | Planned: final confirmed state and old-slot reuse |
| FR-07.3 | F-06 | 2 | Planned contract | Planned: occupied target, student-hour conflict and concurrent move rollback |
| FR-08.1 | F-07 | 2 | Planned contract | Planned: booked, started and unassigned rejections |
| FR-08.2 | F-07 | 2 | Planned contract | Planned: UI/API exclusion and no booking side effect |
| FR-09.1 | F-08 | 3 | Planned contract | Planned: range boundaries, machine filter and assignment rejection |
| FR-09.2 | F-08 | 3 | Planned contract | Planned: controlled fixture totals before/after booking, cancellation and closure |

## Coverage gaps

Every baseline FR, its observable children, BR and NFR has a feature or responsibility and a sprint. Mapping completeness does not remove the execution gaps listed in the verification record. Sprint 2 and Sprint 3 requirements do not yet have acceptance criteria or test IDs. Those are written in each sprint's feature contracts before implementation starts.

## Approved changes

| Date | Change | Reason | Affected IDs |
|---|---|---|---|
| 2026-11-06 | Added BR-04, one machine per student per hour. | Team decision D-01 in the SRS. | BR-04, AC-19, `TC-BOOK-04`, F-03, F-05, F-06 |
| 2026-11-06 | Added NFR-03 and fixed the session lifetime at one hour. | Team decisions D-03 and D-04. | NFR-03, AC-16, AC-23, `TC-AUTH-03`, `TC-AUTH-04` |
| 2026-11-06 | Split the student booking list out of AC-09 into AC-18. | AC-09 was listed under both F-03 and F-04. | AC-09, AC-18, `TC-ACCESS-02` |
| 2026-11-06 | Added AC-20 to AC-22 for malformed input and unknown resources. | The contracts specified these errors without acceptance criteria. | AC-20, AC-21, AC-22, `TC-VALID-01` |

## Revision awaiting peer review

The November 7 post-F-04 refinement keeps FR-01 to FR-09, F-01 to F-08 and AC-01 to AC-23 intact. Child IDs unpack existing behavior. It records the actual Sprint 1 implementation and exposes later-sprint decisions Q-01 to Q-03; it does not backdate contracts or declare future features implemented. This revision becomes accepted only through the linked documentation PR and teammate review.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial traceability matrix. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added BR-04 and NFR-03 rows, new AC and test IDs, and the coverage gap and approved change sections. |
| 0.3 | 2026-11-07 | Tanadet Nuchaikaew | Added child-requirement traceability and separated planned verification, execution evidence and pending peer review. |
