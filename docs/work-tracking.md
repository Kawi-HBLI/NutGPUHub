# Work Tracking

Use [Issues](https://github.com/Kawi-HBLI/NutGPUHub/issues), the [project board](https://github.com/users/Kawi-HBLI/projects/6) and [milestones](https://github.com/Kawi-HBLI/NutGPUHub/milestones) together. Issues describe work and acceptance; labels identify its type; milestones group the delivery checkpoint; board status identifies its actual stage. More Issue numbers do not imply more product features.

## Workflow and labels

Follow `Backlog -> Specified -> Started -> PR Review -> Done`. When review requests changes, use `PR Review -> Fixing -> PR Review` on the same feature branch. Only start implementation after its reviewed contract is ready. Work sequentially; peer approval precedes the next implementation issue unless the team explicitly agrees otherwise.

| Label | Purpose |
|---|---|
| `feature` | Product behavior covered by a stable F-ID. |
| `documentation` | Requirements, design, traceability or submission content. |
| `testing` | Acceptance, regression, UAT or execution evidence. |
| `release` | Integration into main and delivery acceptance. |
| `ui` | UI-01 visual consistency and its own acceptance checks. |
| `infrastructure` | Docker, CI/CD and deployment work. |

Create feature branches from the active sprint staging branch. Use `Closes #<issue>` in PR descriptions and include the feature/contract IDs, tested SHA, commands/results and review focus. Require a formal peer Approve and resolved review feedback. The author does not merge their own PR. A staging merge may leave the Issue open, so close it and set Done only after actual peer acceptance. Main release and PDF submission are separate work items.

## Current work map

| Issue | Work | Milestone | Ownership / completion gate |
|---|---|---|---|
| [#1](https://github.com/Kawi-HBLI/NutGPUHub/issues/1) | F-01 sessions | Sprint 1 | Tanadet; accepted PR #7. |
| [#2](https://github.com/Kawi-HBLI/NutGPUHub/issues/2) | F-02 publish slots | Sprint 1 | Thawat; accepted PR #8. |
| [#3](https://github.com/Kawi-HBLI/NutGPUHub/issues/3) | F-03 availability and booking | Sprint 1 | Tanadet; accepted PR #9. |
| [#4](https://github.com/Kawi-HBLI/NutGPUHub/issues/4) | F-04 booking lists and operator details | Sprint 1 | Thawat; accepted PR #10. |
| [#6](https://github.com/Kawi-HBLI/NutGPUHub/issues/6) | UI-01 consistent visual style | Sprint 1 | Tanadet implements; Thawat reviews. Shared components and visual evidence are in the UI-01 PR and [verification record](sprints/sprint-1/ui-verification.md). |
| [#11](https://github.com/Kawi-HBLI/NutGPUHub/issues/11) | DOC-01 requirement/evidence refinement | Sprint 1 | Tanadet; current documentation PR, peer review required. |
| [#16](https://github.com/Kawi-HBLI/NutGPUHub/issues/16) | QA-01 integrated acceptance evidence | Sprint 1 | Tanadet coordinates; complete documented gaps and verify the accepted candidate. |
| [#17](https://github.com/Kawi-HBLI/NutGPUHub/issues/17) | REL-01 main release and A-F PDF | Sprint 1 | Thawat coordinates release/PDF; the other student reviews; both validate contributions. |
| [#12](https://github.com/Kawi-HBLI/NutGPUHub/issues/12) | F-05 cancellation/history | Sprint 2 | Backlog; allocate owner and review contract/Q-01 before implementation. |
| [#13](https://github.com/Kawi-HBLI/NutGPUHub/issues/13) | F-06 atomic rescheduling | Sprint 2 | Backlog; depends on F-05 and Q-02. |
| [#14](https://github.com/Kawi-HBLI/NutGPUHub/issues/14) | F-07 slot closure | Sprint 2 | Backlog; review closure/booking concurrency design. |
| [#18](https://github.com/Kawi-HBLI/NutGPUHub/issues/18) | Lab 5 Docker/CI/CD/GCP | Sprint 2 | Backlog; read lab sheet before concrete lab subtasks; due November 15. |
| [#19](https://github.com/Kawi-HBLI/NutGPUHub/issues/19) | Lab 6 cross-team UAT | Sprint 2 | Backlog; requires deployed app and partner evidence; due November 22. |
| [#20](https://github.com/Kawi-HBLI/NutGPUHub/issues/20) | Lab 7 approved maintenance change | Sprint 2 | Backlog; select a real change and obtain approval; due November 29. |
| [#15](https://github.com/Kawi-HBLI/NutGPUHub/issues/15) | F-08 booking summary | Sprint 3 | Backlog; Q-03/contract before code. A meaningful deployed progress slice is required by November 29; complete by December 13. |

The November 7 organization adds work items prospectively for remaining work and annotates original implementation Issues with their real acceptance links. It does not create retrospective specification Issues or claim unperformed pair work. Repository contributions are identified by the actual PR authors and reviewers. Record pair work only when it happened and both students can describe it.

## Contribution identity reference for Part F

| Team member | GitHub login | Display name | Contribution evidence |
|---|---|---|---|
| Tanadet Nuchaikaew | [Kawi-HBLI](https://github.com/Kawi-HBLI) | `Tanadet_NU` | F-01/F-03 implementation (PRs #7/#9) and peer reviews of F-02/F-04 (PRs #8/#10). |
| Thawat Boonsuk | [Chessuker](https://github.com/Chessuker) | `Chessuker` | F-02/F-04 implementation (PRs #8/#10) and peer reviews of F-01/F-03 (PRs #7/#9). |

`Tanadet_NU` is the profile display name of the `Kawi-HBLI` account, not another account or team member. The PR #8 merge event links to that same `Kawi-HBLI` profile. Include this identity reference once in the Part F contribution table so screenshots, commit authors and review history are read consistently. The profile and merge-event link were checked on November 7, 2026.

## Checkpoints

| Milestone | Due date (Asia/Bangkok) | Required outcome |
|---|---|---|
| Sprint 1 - Deliverable 1 | November 8, 2026, 23:59 | Reviewed main increment plus one self-contained PDF with Parts A-F. |
| Sprint 2 - Deliverable 2 | November 29, 2026, 23:59 | Completed F-05 to F-07 and required Sprint 3 implemented/tested/deployed progress. Labs have their own earlier dates. |
| Sprint 3 - Final delivery | December 13, 2026, 23:59 | Complete product baseline, deployed verification, independent retesting, final report and video. |

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | Tanadet Nuchaikaew | Added explicit work categories, Issue/dependency map and real acceptance versus release gates. |
| 0.2 | 2026-11-07 | Tanadet Nuchaikaew | PR #21 review: added the verified GitHub login/display-name mapping for the Part F contribution table. |
| 0.3 | 2026-11-07 | Tanadet Nuchaikaew | Recorded UI-01 ownership and the visual-verification handoff. |
