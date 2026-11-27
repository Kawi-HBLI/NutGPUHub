# Requirements Traceability

Sprint 1 test IDs refer to the [test specification](sprints/sprint-1/test-specification.md). The parent matrix preserves the original baseline mapping; the child matrix traces each refined behavior. See the [verification record](sprints/sprint-1/verification.md) for execution results and coverage status.

| Requirement | Feature or responsibility | Sprint | Acceptance criteria and planned verification |
|---|---|---|---|
| FR-01 | F-03, F-04 | 1 | AC-01, AC-02, AC-03, AC-12, AC-13, AC-19. `TC-BOOK-01`, `TC-BOOK-02`, `TC-BOOK-03`, `TC-BOOK-04`, `TC-ACCESS-03`, `TC-E2E-01`, `TC-E2E-02`. |
| FR-02 | F-01 | 1 | AC-06, AC-07, AC-16, AC-20. `TC-AUTH-01`, `TC-AUTH-02`, `TC-AUTH-03`, `TC-VALID-01`, `TC-E2E-02`. |
| FR-03 | F-02 | 1 | AC-04, AC-05, AC-08, AC-10, AC-17, AC-21. `TC-SLOT-01`, `TC-SLOT-03`, `TC-ACCESS-01`, `TC-VALID-01`. |
| FR-04 | F-03 | 1 | AC-11, AC-22. `TC-SLOT-02`, `TC-VALID-01`. |
| FR-05 | F-02, F-03, F-04 | 1 | AC-01, AC-09, AC-10, AC-14, AC-18. `TC-BOOK-01`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-E2E-01`. |
| FR-06 | F-05 | 2 | AC-24 to AC-29. `TC-CANCEL-01` to `TC-CANCEL-05`, `TC-PERSIST-02`, `TC-DB-01`, `TC-DB-02`, `TC-E2E-05`. Planned, not run. |
| FR-07 | F-06 | 2 | AC-30 to AC-36, AC-42, AC-43. `TC-MOVE-01` to `TC-MOVE-09`, `TC-PERSIST-02`, `TC-E2E-06`. Planned, not run. |
| FR-08 | F-07 | 2 | AC-37 to AC-41, AC-44. `TC-CLOSE-01` to `TC-CLOSE-06`, `TC-PERSIST-02`, `TC-MOVE-07`, `TC-E2E-07`. Planned, not run. |
| FR-09 | F-08 | 3 | Verify report counts before and after cancellation, including machine and date filtering and assignment restrictions. |
| BR-01 | F-02, F-03 | 1 | AC-02, AC-03, AC-04, AC-05, AC-17. `TC-TIME-01`, `TC-SLOT-01`, `TC-SLOT-03`, `TC-BOOK-02`, `TC-BOOK-03`. Sprint 2 (planned, not run): AC-27, AC-35, AC-41, AC-42, AC-44. `TC-DB-01`, `TC-CANCEL-04`, `TC-MOVE-06`, `TC-MOVE-08`, `TC-CLOSE-05`, `TC-CLOSE-06`. |
| BR-02 | F-01, F-02, F-03, F-04 | 1 | AC-08, AC-09, AC-10, AC-12, AC-14, AC-18. `TC-BOOK-01`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-ACCESS-03`. Sprint 2 (planned, not run): AC-25, AC-34, AC-40. `TC-CANCEL-02`, `TC-MOVE-05`, `TC-CLOSE-04`. |
| BR-03 | F-06 | 2 | AC-30, AC-31, AC-35, AC-42, AC-43, AC-44. `TC-MOVE-01`, `TC-MOVE-02`, `TC-MOVE-06`, `TC-MOVE-08`, `TC-MOVE-09`, `TC-CLOSE-06`. Planned, not run. |
| BR-04 | F-03, later F-05 and F-06 | 1 | AC-19. `TC-BOOK-04`. Sprint 2 (planned, not run): AC-27, AC-32, AC-42. `TC-CANCEL-04`, `TC-MOVE-03`, `TC-MOVE-08`. |
| NFR-01 | Authentication and authorization across protected routes | 1 | `TC-AUTH-02`, `TC-AUTH-03`, `TC-ACCESS-01`, `TC-ACCESS-02`, `TC-ACCESS-03`. Sprint 2 (planned, not run): AC-25, AC-34, AC-40. `TC-CANCEL-02`, `TC-MOVE-05`, `TC-CLOSE-04`. |
| NFR-02 | F-03, F-04 and durable storage | 1 | AC-15. `TC-PERSIST-01`. Repeat the persistence check on the Cloud Run release after Lab 5. Sprint 2 (planned, not run): AC-29, AC-30, AC-37. `TC-PERSIST-02` and the deployed-release check. |
| NFR-03 | F-01 credential and session handling | 1 | AC-07, AC-16, AC-23. `TC-AUTH-02`, `TC-AUTH-03`, `TC-AUTH-04`. |

## Subrequirement coverage

Each dotted ID is defined in the SRS and inherits its original parent. Existing AC and test IDs remain stable. Later-sprint checks describe the verification to specify in their feature contracts.

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
| FR-06.1 | F-05 | 2 | AC-24, AC-25, AC-26, AC-43 | Planned: TC-CANCEL-01, TC-CANCEL-02, TC-CANCEL-03, TC-MOVE-09 |
| FR-06.2 | F-05 | 2 | AC-27 | Planned: TC-CANCEL-04, TC-E2E-05 |
| FR-06.3 | F-05 | 2 | AC-24, AC-29 | Planned: TC-CANCEL-01, TC-PERSIST-02 |
| FR-07.1 | F-06 | 2 | AC-33, AC-34 | Planned: TC-MOVE-04, TC-MOVE-05 |
| FR-07.2 | F-06 | 2 | AC-30, AC-43 | Planned: TC-MOVE-01, TC-MOVE-09, TC-PERSIST-02, TC-E2E-06 |
| FR-07.3 | F-06 | 2 | AC-31, AC-32, AC-35, AC-42 | Planned: TC-MOVE-02, TC-MOVE-03, TC-MOVE-06, TC-MOVE-08 |
| FR-08.1 | F-07 | 2 | AC-37, AC-39, AC-40 | Planned: TC-CLOSE-01, TC-CLOSE-03, TC-CLOSE-04, TC-PERSIST-02 |
| FR-08.2 | F-07 | 2 | AC-36, AC-38, AC-41, AC-44 | Planned: TC-CLOSE-02, TC-CLOSE-05, TC-CLOSE-06, TC-MOVE-07, TC-E2E-07 |
| FR-09.1 | F-08 | 3 | AC-46, AC-47, AC-49, AC-50 (Sprint 3 contract 0.1) | Planned: TC-SUM-02, TC-SUM-03, TC-SUM-05 to 07 |
| FR-09.2 | F-08 | 3 | AC-45, AC-48, AC-51 (Sprint 3 contract 0.1) | Planned: TC-SUM-01, TC-SUM-04, TC-E2E-08 |

## Coverage gaps

Every baseline FR, its observable children, BR and NFR has a feature or responsibility and a sprint. Sprint 1 execution gaps are listed in the [verification record](sprints/sprint-1/verification.md). Sprint 2 requirements have draft AC and test IDs from the [Sprint 2 test specification](sprints/sprint-2/test-specification.md) (contracts 0.2); none has run yet. Sprint 3 (FR-09) does not yet have AC or test IDs; they go in the F-08 contract before implementation.

## Approved changes

| Date | Change | Reason | Affected IDs |
|---|---|---|---|
| 2026-11-06 | Added BR-04, one machine per student per hour. | Team decision D-01 in the SRS. | BR-04, AC-19, `TC-BOOK-04`, F-03, F-05, F-06 |
| 2026-11-06 | Added NFR-03 and fixed the session lifetime at one hour. | Team decisions D-03 and D-04. | NFR-03, AC-16, AC-23, `TC-AUTH-03`, `TC-AUTH-04` |
| 2026-11-06 | Split the student booking list out of AC-09 into AC-18. | AC-09 was listed under both F-03 and F-04. | AC-09, AC-18, `TC-ACCESS-02` |
| 2026-11-06 | Added AC-20 to AC-22 for malformed input and unknown resources. | The contracts specified these errors without acceptance criteria. | AC-20, AC-21, AC-22, `TC-VALID-01` |
| 2026-11-24 | Lab 7 CR-01: booking closes 30 minutes before the slot starts. | Operators need time to prepare the machine before a booked hour. Approval step waived by the instructor; see the [change request](labs/lab-07/change-request.md). | BR-01, FR-01, FR-01.1, FR-04, FR-04.1, FR-07, FR-07.1, D-08, F-03, F-06, AC-03, AC-11, `TC-BOOK-03`, `TC-SLOT-02`, `TC-TIME-01` |

## Revision awaiting peer review

The November 7 post-F-04 refinement keeps FR-01 to FR-09, F-01 to F-08 and AC-01 to AC-23 intact. Child IDs unpack existing behavior. It records the actual Sprint 1 implementation and exposes later-sprint decisions Q-01 to Q-03; it does not backdate contracts or declare future features implemented. This revision becomes accepted only through the linked documentation PR and teammate review.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial traceability matrix. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added BR-04 and NFR-03 rows, new AC and test IDs, and the coverage gap and approved change sections. |
| 0.3 | 2026-11-07 | Tanadet Nuchaikaew | Added child-requirement traceability and separated planned verification, execution evidence and pending peer review. |
| 0.4 | 2026-11-07 | Tanadet Nuchaikaew | PR #21 review: replaced repeated evidence qualifications with links to the central verification record. |
| 0.5 | 2026-11-24 | Tanadet Nuchaikaew | Lab 7 CR-01: recorded the approved change in Approved changes. |
| 0.6 | 2026-11-24 | Tanadet Nuchaikaew | PR #64 review: CR-01 row now lists BR-01, FR-07, FR-07.1, decision D-08 and F-06. |
| 0.7 | 2026-11-25 | Tanadet Nuchaikaew | Mapped FR-06 to FR-08 and BR-03 to the draft Sprint 2 AC and test IDs (planned, not run). |
| 0.8 | 2026-11-26 | Tanadet Nuchaikaew | PR #67 review: added the Sprint 2 AC and tests to the BR-01, BR-02, BR-04, NFR-01 and NFR-02 rows and mapped contract 0.2 (AC-42 to AC-44, TC-PERSIST-02). |
| 0.9 | 2026-11-27 | Tanadet Nuchaikaew | Mapped FR-09.1 and FR-09.2 to the draft Sprint 3 AC and test IDs (planned, not run). |
