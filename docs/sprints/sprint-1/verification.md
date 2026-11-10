# Sprint 1 Verification Record

## Tested versions and evidence boundaries

F-01 to F-04 were accepted through PRs [#7](https://github.com/Kawi-HBLI/NutGPUHub/pull/7), [#8](https://github.com/Kawi-HBLI/NutGPUHub/pull/8), [#9](https://github.com/Kawi-HBLI/NutGPUHub/pull/9) and [#10](https://github.com/Kawi-HBLI/NutGPUHub/pull/10). The accepted staging integration is `08e9aa40a50e0afb779b2248c04677b40f6697b5`.

The F-04 independent execution recorded here was on `fc278e1ee5c712f93cb08f57bdbf613da2fbcd01`, the reviewed F-04 head, on November 7, 2026. Its runtime/test tree matches staging integration `08e9aa4`. The post-F-04 requirement refinement changed documentation only. These results are historical evidence, not execution on a future main release. QA-01 (#16) must identify and verify the actual submitted candidate; REL-01 (#17) records the immutable main release.

| Command | Actual result at fc278e1 | Evidence |
|---|---|---|
| `npm test` | 31 passed, 0 failed, 0 skipped; 5 files | `time.test.ts` 3, `slots.test.ts` 6, `bookings.test.ts` 11, `auth.test.ts` 6, `view-bookings.test.ts` 5. |
| `npm run build` | Passed | Both TypeScript configurations and Vite production build; also run by the system checks below. |
| `npm run test:e2e` | 2 passed, 0 failed, 0 skipped | `e2e/bookings.spec.ts`, TC-E2E-01 and TC-E2E-02, using the committed config and Chromium Headless Shell revision 1217 installed by Playwright 1.59.1. |
| `npm run verify:restart` | Passed | `scripts/process-restart-check.ts`: booking created, first Node process stopped and port closed, another process started, original session retrieves identical detail and My Bookings. |
| `npm audit --json` | No Playwright advisory reported | Targeted confirmation of PR #10 dependency correction. This is not a claim that the whole dependency tree has zero advisories. |

The local reviewer logs for this run are retained under `evidence/reviewer-f04-rerun/`. F-03 rule red/green logs are under `evidence/f03/`, summarized in [F-03 verification](f03-verification.md). Evidence directories are excluded from Git and must be copied into the private PDF preparation materials. They are not public download links.

## AC-to-test mapping

The rows below distinguish implemented assertions from the fuller planned scenarios in the [STS](test-specification.md). A historical pass describes the listed assertion at the version above. It does not certify every future release or every input combination.

| AC | Planned test ID | Actual file / assertion | Historical coverage |
|---|---|---|---|
| AC-01 | TC-BOOK-01, TC-E2E-01 | `tests/bookings.test.ts`: saved ID, Location and owner retrieval; `e2e/bookings.spec.ts`: book then reload My Bookings. | Passed. |
| AC-02 | TC-BOOK-02, TC-E2E-02 | `tests/bookings.test.ts`: concurrent students get one 201 and one 409, one row and correct owner; browser stale-availability conflict. | Passed. |
| AC-03 | TC-BOOK-03 | `tests/bookings.test.ts`: after-start (13:00 at a 14:00 clock) and exactly-at-start requests return 409 `SLOT_ALREADY_STARTED` and save nothing; a request 1 ms before start returns 201. | Passed on the QA-01 branch (see below). |
| AC-04 | TC-SLOT-01 | `tests/slots.test.ts`: consecutive 14:00/15:00 slots, duplicate rejected, two stored slots. | Passed. |
| AC-05 | TC-SLOT-01, TC-TIME-01 | `tests/slots.test.ts` and `tests/time.test.ts`: off-hour rejection and whole-hour/offset parsing. | Passed. |
| AC-06 | TC-AUTH-01 | `tests/auth.test.ts`: both roles, generic wrong-password/unknown-user error and unchanged session count. | Passed. |
| AC-07 | TC-AUTH-02, TC-E2E-02 | `tests/auth.test.ts`: current account, sign-out, cookie replay 401; browser returns to sign-in. | Passed. |
| AC-08 | TC-ACCESS-01 | `tests/slots.test.ts`: student slot creation rejected without changes to the tested schedule. | Passed. |
| AC-09 | TC-BOOK-01, TC-ACCESS-02 | `tests/bookings.test.ts` and `tests/view-bookings.test.ts`: another owner's detail returns 404 with no booking data. | Passed. |
| AC-10 | TC-ACCESS-01, TC-ACCESS-02 | `tests/slots.test.ts` and `tests/view-bookings.test.ts`: unassigned operator cannot open/read the machine schedule. | Passed. |
| AC-11 | TC-SLOT-02, TC-TIME-01 | `tests/bookings.test.ts`: booked and other-date slots excluded, Bangkok midnight slots included; a separate test excludes past-hour and starts-now slots and keeps the next hour; `tests/availability-empty-day.test.ts`: a valid day without slots returns `200 []` from a freshly migrated PostgreSQL schema that no other test writes to, then lists a slot once one is added; `tests/time.test.ts`: UTC bounds. | Passed on the QA-01 branch. The original test is renamed to the assertions it makes (date and booked filtering). |
| AC-12 | TC-ACCESS-03 | `tests/bookings.test.ts`: anonymous/operator booking requests return 401/403 and leave a valid future slot unbooked; protected reads reject the wrong role. | Passed. |
| AC-13 | TC-BOOK-03 | `tests/bookings.test.ts`: missing, invalid and unknown IDs return 400/404, and the suite's booking count is checked unchanged after every rejected request. | Passed on the QA-01 branch. |
| AC-14 | TC-ACCESS-02, TC-E2E-01 | `tests/view-bookings.test.ts`: assigned schedule includes correct booking/user and null for a free slot; browser operator sees student username. | Passed. |
| AC-15 | TC-PERSIST-01 | `tests/view-bookings.test.ts`: new app/Prisma instance; `scripts/process-restart-check.ts`: real stop/start with same database and session. | Both checks passed; repeat on deployed release after Lab 5. |
| AC-16 | TC-AUTH-03 | `tests/auth.test.ts`: 59-minute read succeeds, 60-minute read fails, persisted expiry unchanged. | Passed. |
| AC-17 | TC-SLOT-03 | `tests/slots.test.ts`: past and exactly-current starts fail; future hour succeeds. | Passed. |
| AC-18 | TC-ACCESS-02 | `tests/view-bookings.test.ts`: student list excludes the other student's booking; separate empty-list test; two own bookings made late-first are listed earliest-first. | Passed on the QA-01 branch. |
| AC-19 | TC-BOOK-04 | `tests/bookings.test.ts`: sequential and concurrent same-student same-hour conflicts; another hour succeeds. | Passed. |
| AC-20 | TC-VALID-01 | `tests/auth.test.ts`: malformed login returns 400 and session count is unchanged. | Passed. |
| AC-21 | TC-VALID-01 | `tests/slots.test.ts`: invalid/missing dates, malformed starts and unknown machine requests rejected. | Passed for the listed fixtures. |
| AC-22 | TC-VALID-01, TC-SLOT-02 | `tests/bookings.test.ts`: missing/impossible availability dates rejected; `tests/time.test.ts`: malformed calendar dates rejected. | Passed; availability assertions are named TC-SLOT-02 in the actual file. |
| AC-23 | TC-AUTH-04 | `tests/auth.test.ts`: each prepared account has a distinct Argon2id hash, no plaintext match, and password verification succeeds. | Passed. |

The API regression suite also checks unknown-path 404 behavior for anonymous/student/operator requests. These checks came from PR #9 review feedback, followed by the matching machine-router correction in PR #10.

## QA-01 coverage additions

The QA-01 branch `test/qa-01-coverage` (base `ded957b`) closes the four gaps above with test changes only. Runtime code is unchanged. Tested commit: `42cdd7675a69bd0ae81428c49eb4e08be14ae4ef`, November 7, 2026. Only documentation differed in the working tree during the run:

| Command | Result |
|---|---|
| `npm test` | 35 passed, 0 failed, 0 skipped; 6 files (`bookings.test.ts` 13, `view-bookings.test.ts` 6, `availability-empty-day.test.ts` 1) |
| `npm run build` | Passed |
| `npm run test:e2e` | 2 passed, 0 failed, 0 skipped |
| `npm run verify:restart` | Passed |

The behavior already existed, so these tests passed when added and are not TDD red/green evidence. To show that each new assertion can fail, `server/bookings.ts` was changed temporarily and restored after each run:

| Temporary change | Test that failed |
|---|---|
| Availability no longer filters out started slots | TC-SLOT-02 started-slot test |
| Booking allowed when the slot starts exactly now | TC-BOOK-03 rejection test |
| Booking rejected 1 ms before start | TC-BOOK-03 1 ms test (and the TC-SLOT-02 started-slot test, which expects that slot to be booked) |
| My Bookings ordered by booking ID instead of slot start | AC-18 ordering test |

The empty-day test runs in its own schema because the shared test database may hold other fixtures' slots on any date (PR #22 review). It still passed after an unrelated slot was inserted on 2031-01-08 in the shared schema; that slot was removed afterwards and no isolated schema was left behind. The no-write assertions were not mutation-checked. Logs are under `evidence/qa-01/`. These results identify the tested commit above, not the final release candidate, which still needs its own run.

## UI-01 integration checks

The [UI-01 record](ui-verification.md) documents the restyle built from staging `81a7300`, with before/after screenshots and rendered-state checks. The same 35 unit/API tests, both browser journeys, build and real-process restart check passed with the shared presentation components. The UI-01 PR identifies the corresponding committed implementation for peer review.

On November 8, these commands were rerun on the PR #23 review-fix working tree based on orange-palette commit `8b02008`; all passed again. The orange UI also passed 19 axe scans (zero violations or incomplete checks), 245 reflow checks, keyboard focus traversal and 13 text-contrast pairs (minimum 5.3037:1). The refreshed after screenshots and local evidence path are recorded in the UI-01 document. This is branch-level review evidence; #16 still owns verification of the accepted final candidate.

## Development routing follow-up

BUG-01 (#24) adds `tests/dev-proxy.test.ts` (TC-DEV-01) because the existing browser journeys use the built server and do not load Vite's `/api.ts` module. On the fix branch based on accepted UI merge `cb8b5a9`, the original `/api` prefix returned 404 JSON for that module and the regression check failed. The `/api/` fix returns 200 JavaScript while preserving API proxying. `npm test` passed 36 tests across 7 files; build and both unchanged E2E scenarios passed. The [development proxy record](dev-proxy-verification.md) includes the automated check's limits and the actual Vite/API browser demonstration. These branch results do not complete final-candidate acceptance in #16.

## Integrated staging acceptance

The [staging acceptance record](staging-acceptance.md) contains the November 9 clean-checkout run at `f2c1689c688f5612d577375db4d95c133eec5dfd`, including 36 passing tests, both E2E journeys, build, restart, and Part F demonstrations with scoped database evidence. The accepted staging candidate includes UI-01 and BUG-01. The prior runs above remain useful for tracing earlier revisions.

## Verified main release

QA-01 closed after peer approval and merge of PR #26. PR #27 then merged Sprint 1 to `main`. The [main release verification](staging-acceptance.md#main-release-verification) records all four passing checks on `984c4ad`, tagged `sprint-1`. REL-01 (#17) tracks the remaining report and submission checks.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | Tanadet Nuchaikaew | Recorded reviewed F-04 execution, all Sprint 1 AC mappings and explicit gaps before final release. |
| 0.2 | 2026-11-07 | Tanadet Nuchaikaew | PR #21 review: identified overclaiming test names and their QA-01 remediation; centralized execution-evidence qualifications here. |
| 0.3 | 2026-11-07 | Thawat Boonsuk | QA-01: recorded the added started-slot, empty-day, booking-boundary, no-write and ordering tests with their branch results and mutation checks. |
| 0.4 | 2026-11-07 | Thawat Boonsuk | PR #22 review: moved the empty-day check to an isolated schema and recorded the exact tested commit. |
| 0.5 | 2026-11-07 | Tanadet Nuchaikaew | Linked UI-01 visual checks and the unchanged regression suite results after the restyle. |
| 0.6 | 2026-11-08 | Tanadet Nuchaikaew | Recorded the orange-palette UI review rerun and refreshed evidence while preserving the final-candidate release gate. |
| 0.7 | 2026-11-08 | Tanadet Nuchaikaew | Recorded BUG-01 development-routing reproduction, regression coverage and branch verification without closing QA-01. |
| 0.8 | 2026-11-09 | Tanadet Nuchaikaew | Recorded clean staging setup, integrated test execution and Part F demonstrations for QA-01 peer review. |
| 0.9 | 2026-11-09 | Tanadet Nuchaikaew | Linked the verified main release and closed QA-01 evidence. |
