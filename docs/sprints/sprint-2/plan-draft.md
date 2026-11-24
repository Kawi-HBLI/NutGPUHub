# Sprint 2 Plan (draft)

| Field | Value |
|---|---|
| Status | Draft for team review. Not a reviewed contract; no code may start from it until the decisions below are recorded and the contracts in `feature-contracts.md` are merged. |
| Base | `main` at `5f744ab` (Lab 6 release). Lab 7 CR-01 is reviewed on `lab-7-staging` (PR #64 contract, PR #65 code) but not yet on `main`. |
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

## 3. Decisions needed before contracts (Q-01 to Q-03)

Each row gives a recommendation. The team records the chosen answer as D-09 to D-11 in the SRS decision log when the contracts PR is reviewed.

| ID | Question | Recommendation | Alternative and its cost |
|---|---|---|---|
| Q-01 | Repeated cancellation response; which history fields are shown. | Second cancel returns `409 BOOKING_NOT_CONFIRMED` and changes nothing. My Bookings and booking detail show `status` (`CONFIRMED`, `CANCELLED`, `RESCHEDULED`) and `cancelledAt`; the operator schedule shows only the current confirmed booking per slot. | Idempotent `200` returning the cancelled record. Friendlier for retries, but hides a client bug and needs one more test case for "no second timestamp". |
| Q-02 | Does a reschedule keep the booking ID or create a linked replacement? | Linked replacement. In one transaction the original becomes `RESCHEDULED` and a new `CONFIRMED` booking is inserted with `replacesBookingId`. If the insert hits a uniqueness violation the transaction rolls back, so the original stays confirmed (BR-03) with no extra code path. The response is `201` with the new ID and `Location`. | Keep the ID and update `slotId` in place. Simpler URLs, but history needs a separate events table, and the old slot/time are lost from the row. |
| Q-03 | F-08 predicates: past slots, inclusive range, invalid range. | `from` and `to` are Bangkok dates, both inclusive (`from 00:00` to `to + 1 day 00:00`). Count slots in range on assigned machines: `open` = not closed (past included), `booked` = has a confirmed booking (past included), `bookable` = open, unbooked and more than 30 minutes ahead at request time (the F-03 rule). `from > to`, a missing date or a range over 31 days returns `400 INVALID_DATE_RANGE`. Unassigned machine `403`, unknown `404`. | Exclude past slots from all counts. Simpler reading, but then `open` changes every hour, which makes fixture tests and the report harder to explain. |

Two more decisions surfaced while drafting, smaller but needed in the contracts:

- **Q-04 (new).** Cancellation keeps the FR-06 rule "before the slot starts" and does not use the 30-minute cutoff. A slot cancelled inside the last 30 minutes is released but no longer bookable. Recommendation: keep FR-06 as written and say so in the F-05 contract.
- **Q-05 (new).** Closure uses "upcoming" (server time before `startAt`), not the booking cutoff. Recommendation: keep FR-08 as written. A closed slot cannot be reopened (SRS scope).

## 4. Shared data change

Sprint 1 enforces exclusivity with plain unique indexes `bookings_slot_id_key` and `bookings_student_id_slot_start_at_key`. Keeping cancelled rows breaks them, so F-05 must replace them before any other Sprint 2 work.

- `bookings.status` text with a check constraint (`CONFIRMED`, `CANCELLED`, `RESCHEDULED`), default `CONFIRMED`; `cancelled_at timestamptz null`; `replaces_booking_id int null` (added by F-06, unique, FK to `bookings.id`).
- Drop the two unique indexes; create partial unique indexes on `(slot_id)` and `(student_id, slot_start_at)` `WHERE status = 'CONFIRMED'` in the same raw-SQL migration. Prisma cannot declare partial indexes, so `schema.prisma` drops the `@@unique` lines and the SDS notes that the migration is the source of truth.
- `slots.closed_at timestamptz null` (F-07).
- Booking and closure both take `SELECT ... FOR UPDATE` on the slot row inside the transaction, so a close and a booking racing for the same slot cannot both succeed.

Migration order is F-05, then F-07, then F-06, each a new timestamped folder. Existing rows become `CONFIRMED`, so the deployed Cloud Run database migrates without data loss (recheck NFR-02 after deploy).

## 5. Contract outlines

AC numbering continues from Sprint 1 (AC-01 to AC-23). Test IDs are new families. All new routes require a session (`401 AUTH_REQUIRED`) and the right role (`403 FORBIDDEN`), then ownership or assignment, as in Sprint 1.

### F-05 Cancel a booking (#12)

- **Requirements:** FR-06, FR-06.1 to FR-06.3, BR-01, BR-02, BR-04, NFR-01, NFR-02.
- **Workflow:** student opens My Bookings, picks an upcoming confirmed booking, confirms Cancel; API checks ownership and `now < startAt`, sets `CANCELLED` and `cancelledAt` in one update guarded by `status = 'CONFIRMED'`; UI refreshes the list and shows the cancelled entry.
- **UI:** Cancel button and confirm dialog on upcoming confirmed rows; status badge and cancelled time. **Data:** section 4 migration. **API:**

| Route | Contract |
|---|---|
| `POST /api/v1/bookings/{bookingId}/cancel` | Student only. `200` with `{ bookingId, status: "CANCELLED", cancelledAt }`. `404 BOOKING_NOT_FOUND` for invalid, unknown or another student's ID. `409 SLOT_ALREADY_STARTED` at or after start. `409 BOOKING_NOT_CONFIRMED` if already cancelled or rescheduled (per Q-01). |
| `GET /api/v1/bookings`, `GET /api/v1/bookings/{id}` | Add `status` and `cancelledAt`. List keeps all of the student's rows, ordered by slot start. |
| `GET /api/v1/slots`, operator schedule | Only confirmed bookings count as booked; no response shape change. |

- **AC (draft):** AC-24 owner cancels before start, `200`, record retained with status and time (FR-06.1, FR-06.3). AC-25 another student gets `404`, operator gets `403`, no change (FR-06.1, BR-02). AC-26 cancel at exactly `startAt` and later returns `409 SLOT_ALREADY_STARTED`; one ms before succeeds (FR-06.1). AC-27 after cancel another student can book the slot (more than 30 min ahead) and the same student can book another machine at that hour (FR-06.2, BR-04). AC-28 repeated cancel returns `409`, record unchanged (Q-01). AC-29 cancelled record is still retrievable after restart (NFR-02).
- **STS:** TC-CANCEL-01 API+DB (AC-24, AC-29 restart variant through `scripts/process-restart-check.ts`), TC-CANCEL-02 API (AC-25), TC-CANCEL-03 API+DB fixed clock (AC-26), TC-CANCEL-04 API+DB (AC-27), TC-CANCEL-05 API (AC-28), TC-DB-01 database: partial indexes still reject two confirmed rows for one slot and one student-hour, and allow a cancelled plus a confirmed row (BR-01, BR-04). TC-E2E-05 UI: cancel from My Bookings.

### F-06 Reschedule a booking (#13)

- **Requirements:** FR-07, FR-07.1 to FR-07.3 (as revised by CR-01/D-08), BR-01 to BR-04, NFR-01.
- **Workflow:** from an upcoming confirmed booking the student picks Move, sees availability for a chosen date (the F-03 list), selects a target; API checks ownership, original still upcoming and confirmed, target open, unclosed and more than 30 min ahead; in one transaction marks the original `RESCHEDULED` and inserts the replacement (per Q-02). Any failure rolls back.
- **UI:** Move action opening the availability picker; result links to the new booking. **Data:** `replaces_booking_id`. **API:**

| Route | Contract |
|---|---|
| `POST /api/v1/bookings/{bookingId}/reschedule` | Body `{ slotId }`. `201` with new `{ bookingId, slotId, replacesBookingId }` and `Location`. `400 INVALID_SLOT_ID`; `404 BOOKING_NOT_FOUND` (incl. other owner); `404 SLOT_NOT_FOUND`; `409 BOOKING_NOT_CONFIRMED`; `409 SLOT_ALREADY_STARTED` (original started); `409 BOOKING_CLOSED` or `SLOT_ALREADY_STARTED` (target inside cutoff, same order as F-03); `409 SLOT_CLOSED`; `409 SLOT_ALREADY_BOOKED`; `409 STUDENT_TIME_CONFLICT`; `409 SAME_SLOT` when target equals the current slot. |

- **AC (draft):** AC-30 successful move: new booking confirmed, original `RESCHEDULED`, original slot bookable again (FR-07.2). AC-31 target held by another student: `409`, original still confirmed, no new row (BR-03, FR-07.3). AC-32 target in an hour where the student holds another machine: `409 STUDENT_TIME_CONFLICT`, original kept (BR-04). Moving to another machine in the same hour as the original is allowed. AC-33 target at or within 30 min of start rejected; 30 min + 1 ms accepted (D-08). AC-34 another student's booking `404`, operator `403`. AC-35 two concurrent moves to one target: exactly one succeeds, the loser keeps its original (FR-07.3). AC-36 closed target rejected `409 SLOT_CLOSED`.
- **STS:** TC-MOVE-01 API+DB (AC-30), TC-MOVE-02 API+DB (AC-31), TC-MOVE-03 API+DB (AC-32), TC-MOVE-04 API fixed clock (AC-33), TC-MOVE-05 API (AC-34), TC-MOVE-06 API+DB concurrent (AC-35), TC-MOVE-07 API (AC-36, needs F-07), TC-E2E-06 UI move journey.

### F-07 Close a slot (#14)

- **Requirements:** FR-08, FR-08.1, FR-08.2, BR-01, BR-02, NFR-01.
- **Workflow:** assigned operator sees Close on an upcoming unbooked slot in the schedule, confirms; API locks the slot row, checks assignment, upcoming, no confirmed booking, not closed; sets `closed_at`. Booking and reschedule check `closed_at` under the same lock.
- **UI:** Close action and a Closed label in the operator schedule. **Data:** `slots.closed_at`. **API:**

| Route | Contract |
|---|---|
| `POST /api/v1/machines/{machineId}/slots/{slotId}/close` | Operator only, assigned machine. `200` with `{ slotId, closedAt }`. `403 MACHINE_NOT_ASSIGNED`; `404 MACHINE_NOT_FOUND` / `SLOT_NOT_FOUND` (incl. slot on another machine); `409 SLOT_ALREADY_STARTED`; `409 SLOT_ALREADY_BOOKED`; `409 SLOT_CLOSED`. |
| Operator schedule | Each slot gains `closedAt` (null when open). |
| `GET /api/v1/slots`, `POST /api/v1/bookings` | Closed slots are excluded; booking returns `409 SLOT_CLOSED`. |

- **AC (draft):** AC-37 assigned operator closes an upcoming unbooked slot; schedule shows it closed (FR-08.1). AC-38 closed slot absent from availability and direct booking returns `409 SLOT_CLOSED` (FR-08.2). AC-39 booked, started or already closed slot cannot be closed (FR-08.1). AC-40 unassigned operator `403`, student `403`, no change (BR-02). AC-41 close and booking sent concurrently: exactly one wins, final state is either closed-unbooked or open-booked.
- **STS:** TC-CLOSE-01 API+DB (AC-37), TC-CLOSE-02 API (AC-38), TC-CLOSE-03 API fixed clock (AC-39), TC-CLOSE-04 API (AC-40), TC-CLOSE-05 API+DB concurrent (AC-41), TC-E2E-07 UI.

### F-08 Booking summary (Sprint 3, #15), progress slice for 29 November

- **Requirements:** FR-09, FR-09.1, FR-09.2, BR-02, NFR-01. Predicates per Q-03.
- **Slice for Deliverable 2:** the API with full rule tests and a minimal operator page. Remaining after 29 Nov: UI polish, E2E and UAT re-test.
- **API:** `GET /api/v1/machines/{machineId}/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` returns `{ machineId, from, to, open, booked, bookable }`; errors `400 INVALID_DATE_RANGE`, `403`, `404`.
- **AC (draft):** AC-42 counts on a controlled fixture match the predicates. AC-43 counts change correctly after a booking, a cancellation and a closure (cross-feature). AC-44 both endpoints inclusive in Bangkok time; `from > to` and over 31 days return `400`. AC-45 unassigned operator and student `403`.
- **STS:** TC-SUM-01 unit (predicate function), TC-SUM-02 API+DB (AC-42, AC-43), TC-SUM-03 API (AC-44), TC-SUM-04 API (AC-45).

### Regression set on every staging merge and on the candidate

Full Sprint 1 suite (TC-AUTH, TC-SLOT, TC-BOOK incl. CR-01 boundaries, TC-ACCESS, TC-PERSIST-01), E2E TC-E2E-01/02, plus the new TC-DB-01. Cross-feature: TC-X-01 cancel then rebook by another student and the summary reflects it; TC-X-02 close a slot, availability and summary drop it, booking is rejected.

### Definition of Done (Sprint 2)

Same as the Sprint 1 Product DoD, with these changes: merged into `sprint-2-staging` instead of `sprint-1-staging`; red test commit precedes the implementation commit on the feature branch; contract and STS are merged before the first code commit; migrations apply cleanly on a copy of the deployed schema; the feature works on the Cloud Run deployment of the Sprint 2 release.

## 6. Issues, branches and order

PRs open as drafts and become ready only when tests pass. Issues #12 to #15 already exist; only the docs and release issues are new. Everything below must be on `main` and deployed by 29 November 2026, 23:59.

| # | Work | Issue | Branch | Target | Gate |
|---|---|---|---|---|---|
| 1 | Lab 7 release `lab-7-staging` -> `main` | #20 / #63 | (existing) | `main` | Lab 7 work, not part of this plan; `sprint-2-staging` is cut after it lands so CR-01 is in the base. |
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
| Lab 7 release slips and `sprint-2-staging` lacks CR-01. | If it is not on `main` when F-05 is ready to start, cut `sprint-2-staging` from `lab-7-staging` and note it in the release record. |
| F-08 slice crowds out documentation. | F-08 slice is API plus minimal page only; UI polish goes to the remaining-work plan. |

## 8. After 29 November (outline for the remaining-work plan)

Exams run 1 to 11 December, so work then stays small. F-08 UI and E2E (TC-E2E-08) by 6 Dec; UAT re-test of F-05 to F-08 by 9 Dec; final regression, video and release by 13 Dec. Owners and exact AC go into `docs/sprints/sprint-3/remaining-work.md`.
