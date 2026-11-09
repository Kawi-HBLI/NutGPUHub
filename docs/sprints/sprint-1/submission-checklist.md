# Deliverable 1 Preparation Checklist

Preparation guide for REL-01 (#17), based on the Deliverable 1 sheet. The team recorded the revised deadline as **November 15, 2026 at 23:59 (Asia/Bangkok)** in the [PR #26 peer review](https://github.com/Kawi-HBLI/NutGPUHub/pull/26). The [verification record](verification.md) lists the execution results and coverage status.

## Parts A-F

| Part | Source content to embed in the PDF | Completion checks |
|---|---|---|
| A: SRS (10 points) | `docs/srs.md` | Include context, actors, exclusions, all FR/BR/NFR, assumptions, decisions and unresolved later-sprint questions. Use the peer-accepted document revision. |
| B: Features and traceability (10 points) | `docs/features.md`, `docs/traceability.md` | Include the full baseline and child mapping, later-sprint allocation, gaps and change history. |
| C: System SDS (15 points) | `docs/system-sds.md` | Include architecture, data diagram/constraints, UI/API, role matrix, sessions/configuration and planned deployment. |
| D: Three-sprint plan (5 points) | `docs/sprints/plan.md` | Include scope, dependencies, ownership, checkpoint outcomes and the November 29 Sprint 3 progress requirement. |
| E: Engineering contracts (20 points) | `feature-contracts.md`, `test-specification.md` | Include every Sprint 1 feature design, AC, STS, DoD and visible version history directly in the PDF. |
| F: Working increment and verification (20 points) | `verification.md`, actual release output, demonstrations and GitHub evidence | Include versioned results, limitations and the contribution identity reference from `docs/work-tracking.md`. |

Paths without a `docs/` prefix above refer to this Sprint 1 directory. Keep the content self-contained; external links support targeted checking but do not replace embedded engineering documents.

## Release and evidence gates

- [x] The Sprint 1 changes, including UI-01 (#6), were peer-reviewed and integrated into staging. The [acceptance record](staging-acceptance.md) lists the remaining limitations.
- [x] QA-01 (#16) completed the declared coverage gaps and clean-checkout run. Chessuker approved and merged PR #26.
- [x] Kawi-HBLI approved and merged release PR #27. The [sprint-1 tag](https://github.com/Kawi-HBLI/NutGPUHub/tree/sprint-1) points to `984c4ad730ff9acc2af736f523cfc62a2ea52667` on `main`.
- [x] Build, automated tests, E2E and real-process restart passed again on the tagged `main` commit. See the [main release verification](staging-acceptance.md#main-release-verification).
- [ ] Demonstrations show a normal UI/API/database journey with saved retrieval, meaningful rejection, login/logout and a forbidden operation. Caption each with AC/feature, role, conditions, steps and expected/actual result.
- [ ] Embed an AC-to-planned-test-to-actual-test/result table and two short real test excerpts: a domain rule and an access restriction.
- [ ] Embed genuine TDD red/green evidence with the relevant versions for TC-BOOK-02 and TC-BOOK-04.
- [ ] Select two completed Issue/PR/review chains, branch names, author/reviewer, substantive feedback, contract-before-implementation history, final board state and integration into main.
- [ ] Confirm both students' actual contributions and include the [account/display-name reference](../../work-tracking.md#contribution-identity-reference-for-part-f) once in the Part F contribution table. Identify pair work only if it occurred, and include a brief truthful AI-use declaration.

## Document assembly and private submission

- [ ] Opening pages contain both names and student IDs, theme/context, repository URL and actual submitted release reference. Keep IDs in the private submitted PDF.
- [ ] Include a table of contents with page numbers and one A-F navigation row per part with actual page ranges and relevant IDs.
- [ ] Render the PDF and inspect tables, diagrams, captions, screenshots and page breaks at normal size. No fixed page quota is required.
- [ ] Include setup summary and synthetic local seed procedure. Exclude real credentials/tokens and private configuration.
- [ ] Disclose incomplete features, unperformed checks and failed/skipped tests. Later-sprint features must not appear completed in Sprint 1.
- [ ] Both students inspect the final PDF and immutable release; submit one PDF on LEB2 and record confirmation.

Docker, completed CI/CD, a cloud URL and a separate video are not required for Deliverable 1. Track their later assessment in the relevant Lab/final-delivery Issues.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | Tanadet Nuchaikaew | Added the actual A-F content map and outstanding release/PDF gates without claiming completion. |
| 0.2 | 2026-11-07 | Tanadet Nuchaikaew | PR #21 review: linked the central execution record and the account/display-name reference for Part F. |
| 0.3 | 2026-11-09 | Tanadet Nuchaikaew | Recorded the revised deadline and completed QA, release and main verification gates. |
