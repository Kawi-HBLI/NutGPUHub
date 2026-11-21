# Lab 6 UAT Cases and Handoff (Part A)

Status: draft. The session times and UAT date are added when they are agreed.

These cases let another team check the Sprint 1 behavior of NutGPUHub on the public URL without help from us. They cover the four Sprint 1 features F-01 to F-04 and their acceptance criteria (AC). Cancel, reschedule and slot closing (F-05 to F-08) are Sprint 2 and 3 work and are not part of this UAT.

## Handoff

| Item | Value |
|---|---|
| Product | NutGPUHub: students book one-hour GPU slots that operators open on their assigned machines |
| Product Team | Thawat Boonsuk (`Chessuker`), Tanadet Nuchaikaew (`Kawi-HBLI`) |
| UAT Team | *Names to be added before the PDF* (`ArmmyC`, `Bank848`; [CPE334-Group](https://github.com/ArmmyC/CPE334-Group), Lab Equipment Borrowing System) |
| Public URL | https://nutgpuhub-656822189084.asia-southeast1.run.app |
| Sprint 1 baseline | Tag [`sprint-1`](https://github.com/Kawi-HBLI/NutGPUHub/tree/sprint-1), commit `984c4ad730ff9acc2af736f523cfc62a2ea52667` |
| Version under test | `main` at `911f6314420a95ba73135818f7df1b0fd879fde3`, Cloud Run revision `nutgpuhub-00007-4z5`. The page footer shows "Release 911f631" and `/api/version` returns the full SHA. |
| Why a newer version | The commits after `sprint-1` are Lab 5 work: Docker, CI/CD, the deploy pipeline and the release label in the footer. They do not change the F-01 to F-04 rules or API contracts in [Sprint 1 feature contracts](../../sprints/sprint-1/feature-contracts.md). |
| In scope | F-01 sign in and sign out, F-02 open GPU slots, F-03 find and book a slot, F-04 view bookings by role |
| Out of scope | Cancel, reschedule, close a slot, booking summary (Sprint 2 and 3); load and security testing |
| Browser | Any current desktop browser. Use a private window for each account so two accounts can be signed in at the same time. |
| Time zone | The app shows all times in Asia/Bangkok. |

Before testing, check that the footer shows the release above. If it shows a different release, stop and tell the Product Team.

Every push to `main` deploys a new revision. So nothing, including Lab 6 documents, is released to `main` until the first UAT session is finished, and this document is handed off from the `lab-6-staging` branch. If we must deploy during the UAT period, we tell the UAT Team first and give them the new commit and revision.

### Accounts

| Label | Username | Role | Assigned machine |
|---|---|---|---|
| Student A | `student-a` | student | — |
| Student B | `student-b` | student | — |
| Operator A | `operator-a` | operator | `GPU-01` |
| Operator B | `operator-b` | operator | `GPU-02` |

All four accounts share one password, sent privately through the course handoff. It is not written in this document or in Git.

### Test data, order and cleanup

- **UAT date (D):** a future date the teams agree on, for example the day after the UAT session. Use date D in every case. Each case uses its own hour, so the cases do not interfere.
- **Order:** run UAT-01 to UAT-06 in order. Only UAT-02 can run on its own. UAT-03, UAT-04 and UAT-06 use the slot and booking from UAT-01, and UAT-03 and UAT-05 also use the 14:00 slots from UAT-02.
- **Date after reload:** the booking and schedule date go back to today after every page reload or sign-in. Set the date to D again before reading a list.
- **Shared data:** the live database also holds our own records (for example bookings #1 and #2). Ignore records on other dates.
- **Cleanup:** Sprint 1 has no cancel or delete, so slots and bookings created during UAT stay in the database. This is expected. If you need to run the cases again, pick a new date D. Do not reuse an hour that already has a slot.
- **Booking number:** the booking number (for example `#3`) is shown after booking and in the operator schedule. Write it down in UAT-01; UAT-04 and UAT-06 need it.

## Cases

Each case lists the requirement and AC it checks. "Expected" gives the exact text the page should show.

### UAT-01: Operator opens a slot and a student books it (normal journey)

- **Covers:** F-02, F-03, F-04 · AC-01, AC-11, AC-14, AC-18 · FR-01, FR-03, FR-04, FR-05
- **Role:** Operator A, then Student A
- **Preconditions:** no slot on `GPU-01` at D 13:00.

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as `operator-a`. | "Operator workspace" and "Signed in as **operator-a** (operator)". The machine list shows `GPU-01` only. |
| 2 | Choose machine `GPU-01`, date D, start time `13:00`, and click **Open slot**. | The message "Opened 13:00–14:00." appears. The schedule for D lists 13:00–14:00 as **Available**. |
| 3 | In a second private window, sign in as `student-a`. | "Student workspace" and "Signed in as **student-a** (student)". There is no "Open a slot" form. |
| 4 | Set the booking date to D. | `GPU-01` 13:00–14:00 is listed with a **Book** button. |
| 5 | Click **Book** on `GPU-01` 13:00. | "Your booking is confirmed." A **Saved booking #N** card shows `GPU-01`, D, 13:00–14:00 (Bangkok). Write down N. |
| 6 | Reload the page, then set the booking date to D again. | The booking appears under **My bookings** as **Confirmed**. `GPU-01` 13:00 is no longer offered for D. |
| 7 | Back in the operator window, reload the page and set the schedule date to D again. | 13:00–14:00 shows "Booked by **student-a**" with "(booking #N)". |

### UAT-02: A student cannot hold two machines in the same hour (business rule)

- **Covers:** F-03 · AC-19 · BR-04
- **Role:** Operator A, Operator B, Student A
- **Preconditions:** no slots at D 14:00 on `GPU-01` or `GPU-02`.

| Step | Action | Expected |
|---|---|---|
| 1 | As `operator-a`, open `GPU-01` at D `14:00`. | "Opened 14:00–15:00." |
| 2 | Sign out, sign in as `operator-b`, open `GPU-02` at D `14:00`. | "Opened 14:00–15:00." The machine list shows `GPU-02` only. |
| 3 | As `student-a`, set the date to D and book `GPU-01` 14:00. | "Your booking is confirmed." |
| 4 | Book `GPU-02` 14:00 (still listed because nobody has booked it). | The error "You already have a booking at this hour." The Saved booking card still shows `GPU-01` 14:00, not `GPU-02`. |
| 5 | Reload and check **My bookings**. | Exactly one booking at D 14:00, on `GPU-01`. |
| 6 | As `operator-b`, set the schedule date to D again and view the `GPU-02` schedule. | 14:00–15:00 is still **Available**. |

### UAT-03: Slot rules for operators (boundary)

- **Covers:** F-02 · AC-04, AC-17 · FR-03, BR-01
- **Role:** Operator A
- **Preconditions:** UAT-01 done (D 13:00 on `GPU-01` exists).

| Step | Action | Expected |
|---|---|---|
| 1 | As `operator-a`, open `GPU-01` at D `13:00` again. | The error "This machine already has a slot at that time." The schedule still lists only one 13:00 slot. |
| 2 | Choose today's date and a start time that has already passed (for example the current hour or earlier). Click **Open slot**. | The error "Slots must start after the current time." No new slot appears in today's schedule. |
| 3 | Open `GPU-01` at D `15:00`. | "Opened 15:00–16:00." The schedule for D now lists 13:00, 14:00 and 15:00, each one hour long. |

### UAT-04: A student cannot see another student's booking (ownership)

- **Covers:** F-03, F-04 · AC-09, AC-18 · FR-05, BR-02, NFR-01
- **Role:** Student B
- **Preconditions:** UAT-01 done; booking #N belongs to `student-a`.

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as `student-b`. | "Signed in as **student-b** (student)". |
| 2 | Check **My bookings**. | Booking #N does not appear. Only `student-b`'s own bookings (if any) are listed. |
| 3 | Change the address to `<URL>/?booking=N` and press Enter. | The message "The booking does not exist." No machine, date or time of booking #N is shown. |
| 4 | Set the booking date to D. | `GPU-01` 13:00 is not offered, because it is booked. |

### UAT-05: Roles and machine assignment (forbidden role)

- **Covers:** F-02, F-04 · AC-08, AC-10, AC-14 · FR-03, FR-05, BR-02
- **Role:** Student B, Operator B
- **Preconditions:** UAT-01 and UAT-02 done.

| Step | Action | Expected |
|---|---|---|
| 1 | As `student-b`, look at the workspace. | There is no machine list and no "Open a slot" form. A student can only browse and book. |
| 2 | Sign in as `operator-b`. | The machine list contains only `GPU-02`. `GPU-01` cannot be selected. |
| 3 | View the `GPU-02` schedule for D. | Only `GPU-02` slots appear (14:00 from UAT-02). No `GPU-01` slot and no "Booked by student-a" from UAT-01 is visible. |

The UI can only show that the form and the other machine are hidden. The API rejection for AC-08 and AC-10 (403 or 404 when a student or an unassigned operator calls the slot API directly) is covered by the automated test `TC-ACCESS-01`. UAT-04 step 3 shows a real rejection in the UI.

### UAT-06: Bookings and sessions are kept (state and persistence)

- **Covers:** F-01, F-04 · AC-06, AC-07 · FR-02, NFR-03 (AC-15 only if step 5 is run)
- **Role:** Student A, Operator A
- **Preconditions:** UAT-01 done. Optional: the Product Team redeploys the same release between sessions (a new Cloud Run revision with the same image) and tells the UAT Team the revision names before and after.

| Step | Action | Expected |
|---|---|---|
| 1 | On the sign-in page, enter `student-a` with a wrong password. | "Invalid username or password." You stay on the sign-in page. |
| 2 | Sign in as `student-a` with the right password. | "Student workspace". Booking #N from UAT-01 is listed under **My bookings** with the same machine, date and time. |
| 3 | Click **Sign out**, then go back to `<URL>/?booking=N` in the same window. | The sign-in page is shown. Booking details are not shown. |
| 4 | Sign in as `operator-a`, set the schedule date to D and view the `GPU-01` schedule. | 13:00 still shows "Booked by **student-a**" (booking #N). |
| 5 | (Optional, only if the Product Team redeployed) record the revision names before and after, then repeat steps 2 and 4. | Same results: booking #N and its details are unchanged after the redeploy. |

## Coverage

| AC | Case |
|---|---|
| AC-01, AC-11 | UAT-01 |
| AC-04 | UAT-03 |
| AC-06, AC-07 | UAT-06 |
| AC-08, AC-10 | UAT-05 (UI only; API rejection by automated tests) |
| AC-09 | UAT-04 |
| AC-14 | UAT-01, UAT-05 |
| AC-17 | UAT-03 |
| AC-18 | UAT-01, UAT-04 |
| AC-19 | UAT-02 |

Not covered by manual UAT, because they need direct API calls, a fixed clock, concurrent requests or a restart: AC-02 (two students at once), AC-03 (booking at the exact start), AC-05 (a `14:30` start, which the hour picker cannot produce), AC-12, AC-13, AC-15 (booking kept after a restart; covered by `TC-PERSIST-01` in CI, and by UAT-06 step 5 only if a redeploy is done), AC-16 (one-hour expiry), AC-20 to AC-23. Our automated tests cover these (see the [test specification](../../sprints/sprint-1/test-specification.md)).

## Recording results

For each case, record: case ID, tester name and team, date and time, the release shown in the footer, inputs used (date D, booking number), actual result for each step, and PASS, FAIL or BLOCKED. Write what you actually saw, not the expected text. Report a failure with the steps, what you expected, what happened and a screenshot that shows the URL.
