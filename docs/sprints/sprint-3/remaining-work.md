# Sprint 3 Status and Remaining Work

Status of the Sprint 3 work at the Deliverable 2 candidate, and what is left for the final release on 13 December 2026. Exams run 1 to 11 December, so the remaining items are kept small. Roles follow the project from Lab 6 on: Tanadet Nuchaikaew writes each change and opens its PR; Thawat Boonsuk reviews and merges.

## F-08 status

| AC | Planned | In progress | Implemented | Tested | Accepted |
|---|---|---|---|---|---|
| AC-45 to AC-50 (API) | Yes | | Yes, PR #77 | Yes: TC-SUM-01 to 07, CI run 46130817201; see the [Sprint 3 verification](verification.md) | Reviewed and merged into `sprint-3-staging` (`b116103`); reaches `main` with the `d2-candidate` release |
| Minimal Summary section | Yes | | Yes, PR #77 | Checked with a temporary Playwright script; no committed browser test yet | Reviewed and merged with PR #77 |
| AC-51 (browser summary) | Yes | Yes | | | |

## Remaining work

| Item | Current status | Remaining action | Owner | Target date |
|---|---|---|---|---|
| F-08 AC-51 and TC-E2E-08 | Summary card exists; no committed browser test | Write TC-E2E-08 (operator reads counts, student books, refresh shows the change), then polish the card if the test shows gaps | Tanadet (author), Thawat (review) | 6 Dec 2026 |
| F-08 consistent counts (PR #77 review, optional) | The three counts are three queries, so a booking made between them can mix moments; a refresh corrects it | Decide whether to read them in one `RepeatableRead` transaction; if yes, add it with a test | Tanadet (author), Thawat (review) | 6 Dec 2026 |
| UAT re-test of F-05 to F-08 | Not started | Ask the UAT team to retest the affected journeys on the deployed candidate and record their findings in the register | Tanadet (author), Thawat (review) | 9 Dec 2026 |
| Final regression, release and tag | Not started | Full suites on the final candidate, release to `main`, deployed check, final tag | Tanadet (author), Thawat (review and merge) | 13 Dec 2026 |
| Final report and demonstration video | Not started | Write the report and record the video from the final release | Tanadet and Thawat | 13 Dec 2026 |

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-28 | Tanadet Nuchaikaew | F-08 status at the Deliverable 2 candidate and the remaining-work table for 13 December. |
