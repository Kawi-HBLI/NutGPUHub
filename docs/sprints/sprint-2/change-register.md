# Change and Defect Register

Changes and defects found after the Sprint 1 release (tag `sprint-1`, commit `984c4ad`), up to the Deliverable 2 candidate. Each row says where the item came from, what it affects, what was decided and in which release it reached `main`. Baseline revisions that came from these items are listed after the table.

| ID | Source | Kind | Affects | Decision | Status | Fixed or delivered in | Re-test |
|---|---|---|---|---|---|---|---|
| CHG-01 | Lab 5 deployment (#50, PR #52, release PR #53) | Operational change | NFR-02, deployment; no FR change | Add `/api/ready` and `/api/version`; every Cloud Run revision gets `APP_COMMIT`, shown in the footer; releases go through the Deploy demo workflow with a migration job and smoke test | Done | Lab 5 releases on `main` (first pipeline release revision `nutgpuhub-00003-8c8`, commit `6604c5e`) | Lab 5 smoke test, restart, rollback and roll forward with saved bookings ([Lab 5 deployment](../../labs/lab-05/deployment.md)); smoke test repeated on every later Deploy demo run |
| DEF-01 (NF-01) | Lab 6 UAT, Bank848 and Sitthichai Phirompan, 21 Nov 2026, release `911f631` (#60) | Defect, Minor | F-02/F-04 operator schedule UI (AC-14); the API answer (AC-21, AC-22) was correct | Accepted defect: clearing the date left the previous date's slots on screen. Fix the UI | Closed | PR #61, released in PR #62 (`5f744ab`, revision `nutgpuhub-00008-txd`) | Playwright test RED before and GREEN after the fix; UAT team retested `5f744ab` for NF-01 and NF-02 and accepted the release with minor limitations |
| DEF-02 (NF-02) | Lab 6 UAT, same session (#60) | Defect, Minor | F-03 student availability UI (AC-11); the API answer (AC-21, AC-22) was correct | Accepted defect: an empty date was sent to the API and "Try again" repeated it. Send no request until a date is chosen | Closed | PR #61, released in PR #62 (`5f744ab`) | As DEF-01 |
| CR-01 | Lab 7 change request (#63, part of #20), team decision D-08 | Requirement change, not a defect | FR-01, FR-04, FR-07, FR-07.1, BR-01; AC-03, AC-11 | Booking closes 30 minutes before the slot starts (`409 BOOKING_CLOSED`); availability hides those slots. Contract reviewed in PR #64 before code | Done | PR #65, released in PR #66 (`25cb60f`, revision `nutgpuhub-00009-tpz`) | CR-01 boundary tests RED then GREEN ([Lab 7 change request](../../labs/lab-07/change-request.md)); live checks after the release; F-06 reschedule inherits the rule (AC-33) |

No defect was raised against Sprint 2 after its release. Problems found in Sprint 2 reviews were fixed on the same feature branch before merge and are recorded in the [Sprint 2 verification](verification.md) (PR #69, #70 and #71 review checks). TC-X-01 was missing from the regression set when F-05 to F-07 merged; it was added in PR #73 before the release.

## Baseline revisions

| Decision | Revision | Rationale | Approved in |
|---|---|---|---|
| D-08 | BR-01, FR-01, FR-04 and FR-07 gain the 30-minute booking cutoff | An operator needs time to prepare the machine before a booked hour | Lab 7, PR #64 |
| D-09 to D-13 | Sprint 2 rules: repeated cancel, linked replacement on reschedule, summary predicates, no cutoff for cancel or close, closed slots stay closed | Needed to write testable Sprint 2 and Sprint 3 contracts | PR #67 (D-11 recorded in full in the F-08 contract, PR #72) |

The decision log with dates is in the [SRS](../../srs.md).

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-28 | Tanadet Nuchaikaew | Register for Deliverable 2: CHG-01, DEF-01, DEF-02, CR-01 and the baseline revisions D-08 to D-13. |
