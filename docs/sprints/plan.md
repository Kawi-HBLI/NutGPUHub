# Three-Sprint Plan

The [feature inventory](../features.md) gives each feature's dependencies. The [requirements matrix](../traceability.md) maps the full product baseline to the sprints.

## Sprint 1: Book a GPU slot

**Features:** F-01 through F-04. Start with account sessions and machine assignments. An assigned operator opens a slot, a student finds and books it, and both roles retrieve the saved result within their permissions.

**Completion on November 8, 2026.** Release the reviewed increment on `main`. Demonstrate the UI-to-database workflow, concurrent booking protection, the one-machine-per-hour rule, invalid and past slot handling, and role and ownership restrictions. Record the release reference, local setup, test results, and teammate review. Submit the required self-contained PDF through LEB2.

## Sprint 2: Handle booking changes

**Features:** F-05 through F-07. Build on Sprint 1's booking, ownership, and machine-assignment rules. Prepare each feature contract before implementing it. Keep confirmed booking uniqueness, for both the slot and the student's hour, when introducing cancellation history.

**Labs in this sprint.** Lab 5 (Docker, CI/CD and Cloud Run deployment, due November 15), Lab 6 (cross-team UAT, due November 22) and Lab 7 (maintenance change, due November 29) run on the same application. Track each lab as its own Issue so lab evidence stays separate from feature work.

**Completion on November 29, 2026.** Finish and review cancellation, rescheduling, and slot closure. Verify them on the integrated release and rerun the Sprint 1 workflow and permissions tests. Use the Cloud Run deployment established in Lab 5 for the release candidate.

## Sprint 3: Summarize bookings and verify the release

**Feature:** F-08. Derive reporting totals from slot availability and booking state for the operator's assigned machines. The rest of the sprint goes to integration, regression testing, fixing defects found in Lab 6 UAT, and hardening the deployed release.

**Progress on November 29, 2026.** Complete the remaining feature contracts. Include at least one implemented and tested Sprint 3 workflow or rule in the candidate deployed to Cloud Run, and record the remaining work.

**Completion on December 13, 2026.** Complete the product baseline, verify the integrated workflows and permissions, have independent users retest affected journeys, and prepare the final deployed release, report, and demonstration video.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial three-sprint plan. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Placed Labs 5 to 7 in Sprint 2, named Cloud Run, and stated the hardening work in Sprint 3. |
