# Three-Sprint Plan

The [feature inventory](../features.md) gives each feature's dependencies. The [requirements matrix](../traceability.md) maps the full product baseline to the sprints.

## Sprint 1: Book a GPU slot

**Features:** F-01 through F-04. Start with account sessions and machine assignments. An assigned operator opens a slot, a student finds and books it, and both roles retrieve the saved result within their permissions.

**Deliverable 1 is due November 15, 2026 at 23:59 (Asia/Bangkok).** Release the reviewed increment on `main`. Demonstrate the UI-to-database workflow, concurrent booking protection, the one-machine-per-hour rule, invalid and past slot handling, and role and ownership restrictions. Record the release reference, local setup, test results, and teammate review. Submit the required self-contained PDF through LEB2.

## Sprint 2: Handle booking changes

**Features:** F-05 through F-07. Build on Sprint 1's booking, ownership, and machine-assignment rules. Prepare each feature contract before implementing it. Keep confirmed booking uniqueness, for both the slot and the student's hour, when introducing cancellation history.

**Labs in this sprint.** Lab 5 (Docker, CI/CD and Cloud Run deployment, due November 15), Lab 6 (cross-team UAT, due November 22) and Lab 7 (maintenance change, due November 29) run on the same application. Track each lab as its own Issue so lab evidence stays separate from feature work.

**Completion on November 29, 2026.** Finish and review cancellation, rescheduling, and slot closure. Verify them on the integrated release and rerun the Sprint 1 workflow and permissions tests. Use the Cloud Run deployment established in Lab 5 for the release candidate.

## Sprint 3: Summarize bookings and verify the release

**Feature:** F-08. Derive reporting totals from slot availability and booking state for the operator's assigned machines. The rest of the sprint goes to integration, regression testing, fixing defects found in Lab 6 UAT, and hardening the deployed release.

**Progress on November 29, 2026.** Complete the remaining feature contracts. Include at least one implemented and tested Sprint 3 workflow or rule in the candidate deployed to Cloud Run, and record the remaining work.

**Completion on December 13, 2026.** Complete the product baseline, verify the integrated workflows and permissions, have independent users retest affected journeys, and prepare the final deployed release, report, and demonstration video.

## Ownership and dependency checkpoints

| Work | Owner / review | Dependency and exit gate |
|---|---|---|
| F-01 and F-03 | Tanadet implements; Thawat reviews. | Accepted PRs #7 and #9, with meaningful auth/concurrency checks. |
| F-02 and F-04 | Thawat implements; Tanadet reviews. | Accepted PRs #8 and #10, with input/access/persistence checks. |
| DOC-01 (#11) | Tanadet refines; Thawat reviews. | After F-04; verify the same baseline with stable IDs and honest evidence gaps. |
| QA-01 (#16) | Tanadet coordinates; peer reviews test changes. | After accepted contracts/implementation; finish declared scenarios and capture final-candidate evidence. Recheck accepted UI-01 changes (#6). |
| REL-01 (#17) | Thawat coordinates main release/PDF; Tanadet reviews. | After DOC-01/QA-01 and the recorded UI-01 disposition; final main SHA and self-contained A-F PDF. |
| F-05 -> F-06 | Allocate in Sprint 2 planning; peer review each contract/PR. | F-05 state/history and Q-01 first, then F-06 atomic move and Q-02. |
| F-07 | Allocate in Sprint 2 planning. | Reviewed closure/booking concurrency design after F-02/F-03 and Sprint 2 state design. |
| F-08 | Allocate before the November 29 checkpoint. | F-04/F-05/F-07 data, Q-03 report predicates, then a meaningful implemented/tested/deployed progress slice by November 29. |

Track actual board states and milestone dates in [work tracking](../work-tracking.md). New later-sprint Issues remain Backlog until their detailed contracts are reviewed. Lab 5/6/7 are Issues #18/#19/#20; read each lab sheet before turning the outline into concrete implementation tasks.

## Release risks and actions

| Risk | Action / verification gate |
|---|---|
| A mapped AC is mistaken for fully executed coverage. | Use the [verification matrix](sprint-1/verification.md), complete #16 gaps and record final-run failures/skips explicitly. |
| Main/PDF evidence lags behind accepted staging features. | Keep #17 open until reviewed main release and actual private submission are confirmed. |
| Cancellation history breaks confirmed-only uniqueness. | Review the raw SQL/index migration and concurrency cases before F-05; retain original booking on failed F-06. |
| Report scope remains ambiguous too late for Deliverable 2. | Resolve Q-03 and specify the F-08 progress slice before November 29. |
| Screenshots or claims use a different version from the submission. | Record one immutable reference for the demonstration set and disclose any exception; recheck after accepted UI/runtime changes. |

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial three-sprint plan. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Placed Labs 5 to 7 in Sprint 2, named Cloud Run, and stated the hardening work in Sprint 3. |
| 0.3 | 2026-11-07 | Tanadet Nuchaikaew | Added real ownership, dependency/exit gates, work links and release risks after F-04 without expanding feature scope. |
| 0.4 | 2026-11-09 | Tanadet Nuchaikaew | Recorded the revised Deliverable 1 deadline reported in the PR #26 peer review. |
