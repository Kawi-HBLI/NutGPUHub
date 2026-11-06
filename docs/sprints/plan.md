# Three-Sprint Plan

The [feature inventory](../features.md) gives each feature's dependencies. The [requirements matrix](../traceability.md) maps the full product baseline to the sprints.

## Sprint 1 — Book a GPU slot

**Features:** F-01 through F-04. Start with account sessions and machine assignments. An assigned operator opens a slot, a student finds and books it, and both roles retrieve the saved result within their permissions.

**Completion on November 8, 2026.** Release the reviewed increment on `main`. Demonstrate the UI-to-database workflow, concurrent booking protection, invalid and past slot handling, and role and ownership restrictions. Record the release reference, local setup, test results, and teammate review. Submit the required self-contained PDF through LEB2.

## Sprint 2 — Handle booking changes

**Features:** F-05 through F-07. Build on Sprint 1's booking, ownership, and machine-assignment rules. Prepare each feature contract before implementing it. Keep confirmed booking uniqueness when introducing cancellation history.

**Completion on November 29, 2026.** Finish and review cancellation, rescheduling, and slot closure. Verify them on the integrated release and rerun the Sprint 1 workflow and permissions tests. Use the deployment established in Lab 5 for the release candidate.

## Sprint 3 — Summarize bookings and verify the release

**Feature:** F-08. Derive reporting totals from slot availability and booking state for the operator's assigned machines.

**Progress on November 29, 2026.** Complete the remaining feature contracts. Include at least one implemented and tested Sprint 3 workflow or rule in the candidate deployed to GCP, and record the remaining work.

**Completion on December 13, 2026.** Complete the product baseline, verify the integrated workflows and permissions, have independent users retest affected journeys, and prepare the final deployed release, report, and demonstration video.
