# Sprint 1 staging acceptance

QA-01 (#16) ran on November 9, 2026 in a fresh clone of `sprint-1-staging` at `f2c1689c688f5612d577375db4d95c133eec5dfd`. This commit includes UI-01 from PR #23 and the Vite development fix from PR #25. Chessuker approved and merged the acceptance record in PR #26. The [sprint-1 tag](https://github.com/Kawi-HBLI/NutGPUHub/tree/sprint-1) identifies the verified release on `main`.

## Clean setup and execution

The clean clone used Node.js 24.14.0, npm 11.9.0, PostgreSQL 18.3 and Chromium from the Playwright 1.59.1 installation. `npm ci` installed 243 packages from the lockfile. A temporary local configuration pointed the app and tests at separate empty databases. `npm run db:generate` succeeded, `npm run db:migrate` applied all four migrations to each database and `npm run db:seed` prepared four synthetic accounts and two machines. The test and evidence fixtures used synthetic accounts on loopback.

| Command | Result | Evidence |
|---|---|---|
| `npm test` | 36 passed, 0 failed, 0 skipped in 7 files | Includes TC-DEV-01, the slot and booking boundaries, authorization and view coverage. |
| `npm run build` | Passed | Both TypeScript configurations and Vite production build. |
| `npm run test:e2e` | 2 passed, 0 failed, 0 skipped | TC-E2E-01 and TC-E2E-02 on the accepted orange UI. |
| `npm run verify:restart` | Passed | TC-PERSIST-01 created a booking, stopped the first process, started another and retrieved the same booking detail and list using the original session. |

The [AC-to-test matrix](verification.md#ac-to-test-mapping) maps the actual assertions to AC-01 through AC-23. The dated runs in that record show the earlier branch history. The clean staging execution above establishes the current run of the mapped automated checks. Broader exploratory scenarios remain identified by the [test specification](test-specification.md).

## Part F demonstrations

All demonstrations use the synthetic E2E fixtures, including machine `E2E-701859d3` and account `e2e-student-a-701859d3`. These fixtures are separate from the local seed accounts and machines such as `student-a` and `GPU-01`. The selected slot starts on November 10, 2026 at 10:00 Bangkok time. The built app used the isolated test database. The cited ACs identify the demonstrated aspects of each criterion. The automated assertions cover additional cases in the verification matrix. Full output and original captures remain local under `evidence/qa-final-f2c1689/`.

1. **Open, book and retrieve (F-02/F-03/F-04, AC-01, AC-14, AC-18).** The assigned operator opens the 10:00–11:00 slot. Student A signs in, selects the date and books it. The expected result is a single reservation readable by the student and assigned operator. The API returned `201`, PostgreSQL had one booking for slot 31 owned by Student A and the booking appeared after reload. The operator schedule showed who booked it. The automated suite separately covers consecutive slot creation and duplicate rejection under AC-04 and process restart under AC-15.

   [Confirmation](images/qa-final/01-booking-confirmed.png) · [My bookings after reload](images/qa-final/02-my-bookings-reload.png) · [Assigned operator schedule](images/qa-final/03-operator-schedule.png)

2. **Stale availability (F-03, AC-02).** Student B loads the slot while it is free, then submits after Student A takes it. The expected result is conflict feedback and a single saved booking. The response was `409 SLOT_ALREADY_BOOKED`, the UI removed the slot and PostgreSQL contained one booking for the slot.

   [Conflict and refreshed availability](images/qa-final/04-booking-conflict.png)

3. **Sign in and sign out (F-01, AC-06, AC-07).** Student A starts signed out, signs in with a fixture account and opens the student workspace. After selecting Sign out, the expected result is the sign-in page and an invalidated session. The sign-in page appeared and `GET /api/v1/auth/me` returned `401`.

   [Sign-in page after sign-out](images/qa-final/05-sign-out.png)

4. **Forbidden slot creation (F-02, AC-08).** Student A has a valid student session and sends a valid future slot-opening request for the fixture machine. The expected result is a role denial without a new slot. `POST /api/v1/machines/8/slots` returned `403 FORBIDDEN` with “Your account cannot perform this operation.” The scoped PostgreSQL slot count was 1 before and 1 after the request.

   Captured API response and database counts from `demonstrations.json`:

   ```text
   POST /api/v1/machines/8/slots
   HTTP 403
   {"error":{"code":"FORBIDDEN","message":"Your account cannot perform this operation."}}
   Scoped slot count before: 1
   Scoped slot count after:  1
   ```

No browser page errors were observed during these captures.

## Domain and access evidence

The original [F-03 TDD record](f03-verification.md#tdd-rule-checks) and raw local `evidence/f03/f03-red.txt` show the actual failures before the uniqueness migration. TC-BOOK-02 and concurrent TC-BOOK-04 returned `[201, 201]` where the tests expected `[201, 409]`. Sequential TC-BOOK-04 received `201` where it expected `409`. The red run used the feature working state before migration `20261107000300_enforce_booking_exclusivity`. The implementation in `4ce7b9f` includes the indexes, and the original `f03-green.txt` records 22 passing tests. The current staging run passes all three rule scenarios again.

Domain excerpt from `tests/bookings.test.ts`, TC-BOOK-02:

```ts
const results = await Promise.all([book(available.id, cookies[0]), book(available.id, cookies[1])]);
expect(results.map(result => result.status).sort()).toEqual([201, 409]);
const rows = await database.booking.findMany({ where: { slotId: available.id } });
expect(rows).toHaveLength(1);
```

Access excerpt from `tests/slots.test.ts`, TC-ACCESS-01. The two assertions are shown with the intervening checks omitted:

```ts
const asStudent = await openSlot(cookies.student, '2030-01-03T10:00:00+07:00').expect(403);
// Other forbidden attempts and response checks omitted.
expect(await slotCount('2030-01-03T00:00:00+07:00', '2030-01-04T00:00:00+07:00')).toBe(before);
```

## Main release verification

Kawi-HBLI approved and merged [PR #27](https://github.com/Kawi-HBLI/NutGPUHub/pull/27) into `main`. The `sprint-1` tag points to `984c4ad730ff9acc2af736f523cfc62a2ea52667`. Its runtime and test files match the verified staging candidate. The four checks below ran again on the tagged `main` commit on November 9, 2026 using the isolated PostgreSQL QA database.

| Command | Result at `984c4ad` |
|---|---|
| `npm test` | 36 passed across 7 files, 0 failed, 0 skipped |
| `npm run build` | Passed |
| `npm run test:e2e` | 2 passed, 0 failed, 0 skipped |
| `npm run verify:restart` | Passed. The original session retrieved the saved booking after a new server process started. |

Raw release logs are retained locally under `evidence/main-984c4ad/`.

## Release limitations

`npm audit` on the installed lockfile reported eight entries across development and runtime packages (five moderate, one high and two critical). `npm audit --omit=dev` reported two moderate entries, `express` and `qs`. The recorded QA run is a local functional acceptance check. The dependency findings remain open for triage. UI-01 accessibility and layout evidence is in the [UI verification record](ui-verification.md).

REL-01 (#17) tracks completion of the private PDF and submission confirmation. The [submission checklist](submission-checklist.md) records the remaining items.

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-09 | Tanadet Nuchaikaew | Recorded clean staging acceptance and captioned demonstration evidence in PR #26. |
| 0.2 | 2026-11-09 | Tanadet Nuchaikaew | Added the captured AC-08 response, clarified the test fixtures, and recorded the verified main release. |
