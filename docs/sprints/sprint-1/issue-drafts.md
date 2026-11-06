# Sprint 1 GitHub Issue Drafts

Open each issue with its section from the [feature contracts](feature-contracts.md) and the applicable checks from the [test specification](test-specification.md). Work through the issues in order. Move each from `Backlog` to `Specified` when its contract is ready and to `Started` when implementation begins. Create the feature branch from Sprint 1 staging. Link the PR with `Closes #<issue-number>` and move the issue to `PR Review`. If changes are requested, move to `Fixing`, update the same branch, and return to `PR Review`. The teammate formally approves and merges the PR. After acceptance, close the issue manually if the staging merge leaves it open, then move it to `Done`.

For the report, retain the issue and PR links, branch, author, reviewer, and a specific review finding or reason for approval. Connect these records to the tested release.

## F-01 — Implement sign-in and session lifecycle

**Suggested branch:** `feature/sign-in`

Create the user and session data needed for prepared accounts. Implement sign-in, current-account retrieval, and sign-out. Use the signed-in role to open the appropriate view. A session expires at its configured limit and becomes unusable after sign-out.

**Verify:** AC-06, AC-07, and AC-16 with `TC-AUTH-01` through `TC-AUTH-03`. Demonstrate both roles and retain evidence that a signed-out session is rejected.

## F-02 — Open hourly slots for assigned GPU machines

**Suggested branch:** `feature/open-gpu-slots`

Add machine assignments and slots. Let an operator list assigned machines, view a selected day's schedule, and open a future one-hour slot. Enforce hourly start times and a unique machine and start-time pair in the database.

**Verify:** AC-04, AC-05, AC-08, AC-10 for schedule access and slot creation, and AC-17. Run `TC-SLOT-01`, `TC-SLOT-03`, `TC-ACCESS-01`, and the applicable `TC-TIME-01` and `TC-ACCESS-03` checks.

## F-03 — Find, book, and confirm a GPU slot

**Suggested branch:** `feature/book-gpu-slot`

List available slots by Bangkok calendar date. Reserve one slot for the signed-in student and return a booking detail URL accessible to that student. Enforce one booking per slot and show a conflict when another request wins.

**Verify:** AC-01 through AC-03, AC-09 for direct booking access, and AC-11 through AC-13. Run `TC-SLOT-02`, `TC-BOOK-01` through `TC-BOOK-03`, and the applicable `TC-TIME-01` and `TC-ACCESS-03` checks. Retain the actual failing and passing results for the booking rule in `TC-BOOK-02`.

## F-04 — Show booking lists and operator reservation details

**Suggested branch:** `feature/view-bookings`

Add **My Bookings** for the signed-in student. Extend the existing assigned-machine schedule with booking details for the operator. Preserve the ownership and machine assignment checks already in place.

**Verify:** AC-01, AC-09, AC-10, AC-14, and AC-15. Run `TC-ACCESS-02`, `TC-PERSIST-01`, and `TC-E2E-01`. Rerun the full protected-route coverage in `TC-ACCESS-03` and the Sprint 1 suite on the integrated release.
