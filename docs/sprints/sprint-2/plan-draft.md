# Sprint 2 Plan (draft)

| Field | Value |
|---|---|
| Status | Draft for team review. Q-01 to Q-05 have proposed answers from 2026-11-25 (the recommendations below), recorded as D-09 to D-13 in the SRS. They become team decisions when PR #67 is approved. The detailed F-05 to F-07 contracts are in `feature-contracts.md` and `test-specification.md`, which replace sections 4 and 5. No code starts until they are merged. |
| Base | `main` at `25cb60f` (Lab 7 release, PR #66), which includes CR-01. Sprint 2 branches start here. |
| Deadline | Project Deliverable 2, 29 November 2026, 23:59 Asia/Bangkok (same day as the Lab 7 PDF). |
| Version | 0.1, 2026-11-25, Tanadet Nuchaikaew |

## 1. What Deliverable 2 asks for

From `project_deliverable_2_v1.pdf` (70 points). Every part goes into one self-contained PDF, and the documents also stay in the repository.

| Part | Points | Required evidence | Where it comes from |
|---|---|---|---|
| A. Sprint 1 continuity and change status | 5 | Accepted Sprint 1 tag/commit (`sprint-1`, `984c4ad`); Sprint 1 critical journey re-run on the candidate; change/defect register (ID, source, affected FR/feature, decision, status, fix release, re-test) for Lab 5 deployment, Lab 6 UAT (NF-01, NF-02, #60) and Lab 7 CR-01 (#63); approved baseline revisions with rationale (D-08). | `docs/sprints/sprint-2/change-register.md` (new), Lab 6 and Lab 7 docs. |
| B. Sprint 2 contracts and working increment | 25 | Complete contract per Sprint 2 feature (FR/BR/NFR, feature SDS and workflow, UI/API/data, validation/errors/boundaries/permissions, numbered AC, STS with IDs/levels/inputs/expected, DoD; say when a layer has no change). Versioned contract history committed before code; TDD red/green evidence. Real DB persistence. Completion table (AC, implementation, executed verification, result, accepted release). AC-to-test mapping covering rules, boundaries, persistence, new access paths. Issue -> branch -> reviewed PR -> staging -> identifiable Sprint 2 release on `main`. | `docs/sprints/sprint-2/feature-contracts.md`, `test-specification.md`, `verification.md`; tag `sprint-2`. |
| C. Sprint 3 contracts and working progress | 15 | Contracts/AC/STS for all remaining Sprint 3 features (only F-08). At least one meaningful workflow or rule implemented and tested in the candidate. Status split: planned / in progress / implemented / tested / accepted. Remaining-work table (feature or defect, current status, remaining action, owner and target date before 13 December). | `docs/sprints/sprint-3/feature-contracts.md`, `remaining-work.md`. |
| D. Updated requirements and traceability | 10 | Current SRS, feature inventory, System SDS. One matrix for all FR/BR and key NFR: requirement -> feature -> sprint -> AC/NFR check -> planned test -> actual file/test -> result and version. Uncovered requirements and planned checks shown; never "done" for an unexecuted test. | `docs/srs.md`, `docs/features.md`, `docs/system-sds.md`, `docs/traceability.md`. |
| E. Integrated release candidate | 15 | Coherent candidate on `main`; build, full automated suite, integration/system checks and selected acceptance journeys run on its commit; cross-feature checks (cancel vs. booking, closure vs. availability, reschedule vs. BR-04/cutoff); failed/skipped tests disclosed. Deployed on GCP through the Lab 5 pipeline, deployed version matched to tag/commit and CI run; post-deploy critical journey and persistence check; Docker/env/migrations/setup current; readiness review and dated plan to 13 December. | CI run, `deploy.yml` run, `deploy/smoke_test.py`, footer release string. |

Front matter in the PDF: both students and IDs (PDF only), theme, repository URL, immutable submitted tag/commit, deployed URL and version, and a navigation table mapping parts to pages and IDs.

Selected program evidence: two Sprint 2 features (proposed: F-05 cancel and F-06 reschedule) and the F-08 slice, each with feature/AC IDs, role, start state, steps, expected/actual, tested version. It must show retrieval of saved data, a rule rejection, and backend/API evidence of a forbidden role or ownership operation. Also: two short test excerpts (one domain/cross-feature rule, one access restriction), TDD red/green with versions, two Issue/PR chains with author/reviewer/review/staging/release history, a short Sprint 1 continuity demo, setup summary, and no real passwords or tokens.

## 2. Scope check

| Sprint | Feature | Issue | Requirements | Depends on |
|---|---|---|---|---|
| 2 | F-05 Cancel a booking | #12 | FR-06, FR-06.1 to FR-06.3, BR-01, BR-02, BR-04, NFR-01, NFR-02 | F-03, F-04 |
| 2 | F-06 Reschedule a booking | #13 | FR-07, FR-07.1 to FR-07.3, BR-01 to BR-04, NFR-01 | F-03, F-04, F-05 |
| 2 | F-07 Close a slot | #14 | FR-08, FR-08.1, FR-08.2, BR-01, BR-02, NFR-01 | F-02, F-03 |
| 3 | F-08 Booking summary | #15 | FR-09, FR-09.1, FR-09.2, BR-02, NFR-01 | F-04, F-05, F-07 |

No feature moves between sprints. Lab 7 CR-01 already revised FR-07 and FR-07.1 (decision D-08, SRS 0.6): a reschedule target must start more than 30 minutes after server time, like a new booking. F-06 inherits that rule; this plan does not edit any Lab 7 file.

## 3. Decisions (Q-01 to Q-05)

Proposed 2026-11-25: the recommendation in each row, recorded as D-09 to D-11 for Q-01 to Q-03 and D-12, D-13 for Q-04, Q-05 in the SRS decision log. They become team decisions when PR #67 is approved, as in the SRS.

| ID | Question | Recommendation | Alternative and its cost |
|---|---|---|---|
| Q-01 | Repeated cancellation response; which history fields are shown. | Second cancel returns `409 BOOKING_NOT_CONFIRMED` and changes nothing. My Bookings and booking detail show `status` (`confirmed`, `cancelled`, `rescheduled`) and `cancelledAt`; the operator schedule shows only the current confirmed booking per slot. | Idempotent `200` returning the cancelled record. Friendlier for retries, but hides a client bug and needs one more test case for "no second timestamp". |
| Q-02 | Does a reschedule keep the booking ID or create a linked replacement? | Linked replacement. In one transaction the original becomes `rescheduled` and a new `confirmed` booking is inserted with `replacesBookingId`. If the insert hits a uniqueness violation the transaction rolls back, so the original stays confirmed (BR-03) with no extra code path. The response is `201` with the new ID and `Location`. | Keep the ID and update `slotId` in place. Simpler URLs, but history needs a separate events table, and the old slot/time are lost from the row. |
| Q-03 | F-08 predicates: past slots, inclusive range, invalid range. | `from` and `to` are Bangkok dates, both inclusive (`from 00:00` to `to + 1 day 00:00`). Count slots in range on assigned machines: `open` = not closed (past included), `booked` = has a confirmed booking (past included), `bookable` = open, unbooked and more than 30 minutes ahead at request time (the F-03 rule). `from > to`, a missing date or a range over 31 days returns `400 INVALID_DATE_RANGE`. Unassigned machine `403`, unknown `404`. | Exclude past slots from all counts. Simpler reading, but then `open` changes every hour, which makes fixture tests and the report harder to explain. |

Two more decisions surfaced while drafting, smaller but needed in the contracts:

- **Q-04 (new).** Cancellation keeps the FR-06 rule "before the slot starts" and does not use the 30-minute cutoff. A slot cancelled inside the last 30 minutes is released but no longer bookable. Recommendation: keep FR-06 as written and say so in the F-05 contract.
- **Q-05 (new).** Closure uses "upcoming" (server time before `startAt`), not the booking cutoff. Recommendation: keep FR-08 as written. A closed slot cannot be reopened (SRS scope).

## 4. Shared data change and 5. Contract outlines

Replaced by the reviewed documents, which are the only source for these details: the [Sprint 2 feature contracts](feature-contracts.md) (data change, locking, routes, AC-24 to AC-44, Definition of Done) and the [Sprint 2 test specification](test-specification.md). The F-08 contract and its AC numbers come in the Sprint 3 contracts; F-08 AC numbering starts after AC-44.

## 6. Issues, branches and order

PRs open as drafts and become ready only when tests pass. Issues #12 to #15 already exist; only the docs and release issues are new. Everything below must be on `main` and deployed by 29 November 2026, 23:59.

| # | Work | Issue | Branch | Target | Gate |
|---|---|---|---|---|---|
| 1 | Lab 7 release `lab-7-staging` -> `main` | #20 / #63 | (existing) | `main` | Done: merged in PR #66 (`25cb60f`). `sprint-2-staging` is cut from it. |
| 2 | S2-DOC Sprint 2 contracts, STS, decisions D-09 to D-11 | new | `docs/sprint-2-contracts` | `sprint-2-staging` | Merged before any F-05/F-06/F-07 code. |
| 3 | F-05 cancel | #12 | `feature/12-cancel-booking` | `sprint-2-staging` | Migration and partial indexes first. |
| 4 | F-07 close slot | #14 | `feature/14-close-slot` | `sprint-2-staging` | After F-05 merges (shared `bookings.ts` and migrations). |
| 5 | F-06 reschedule | #13 | `feature/13-reschedule-booking` | `sprint-2-staging` | After F-05; TC-MOVE-07 needs F-07. |
| 6 | Sprint 2 release, tag `sprint-2` | new REL-02 | `sprint-2-staging` | `main` | Full regression on staging, deploy, post-deploy check. |
| 7 | S3-DOC F-08 contract and STS | new | `docs/sprint-3-contracts` | `sprint-3-staging` | Q-03 recorded. Can be reviewed together with item 2. |
| 8 | F-08 summary slice | #15 | `feature/15-booking-summary` | `sprint-3-staging` | After the Sprint 2 release. |
| 9 | D2 documents: change register, SRS/features/SDS/traceability, completion and remaining-work tables | new DOC-02 | `docs/d2-baseline-update` | `sprint-3-staging` | Records the actual test results of the candidate. |
| 10 | Candidate release, tag `d2-candidate` | REL-02 | `sprint-3-staging` | `main` | CI green, deploy run matched to the tag, smoke test and persistence check. |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Partial-index migration breaks Sprint 1 exclusivity or the deployed DB. | TC-DB-01 and the full TC-BOOK suite run before F-05 merges; migrate a copy first; recheck NFR-02 after deploy. |
| Close/book race leaves a booked closed slot. | Row lock in both transactions; TC-CLOSE-05. |
| F-08 slice crowds out documentation. | F-08 slice is API plus minimal page only; UI polish goes to the remaining-work plan. |

## 8. After 29 November (outline for the remaining-work plan)

Exams run 1 to 11 December, so work then stays small. F-08 UI and E2E (TC-E2E-08) by 6 Dec; UAT re-test of F-05 to F-08 by 9 Dec; final regression, video and release by 13 Dec. Owners and exact AC go into `docs/sprints/sprint-3/remaining-work.md`.
