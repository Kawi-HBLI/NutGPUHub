# F-03 Verification

The feature starts from the accepted F-02 release on `sprint-1-staging`, commit `55869b7`.

## TDD rule checks

The first run used the booking API with `20261107000200_create_bookings` applied and no booking uniqueness indexes. `TC-BOOK-02` returned two `201` responses. Both sequential and concurrent `TC-BOOK-04` checks also allowed the same student to reserve two machines in the same hour. The three rule checks failed. The actual output is retained locally in `evidence/f03/f03-red.txt` for the PDF report.

Migration `20261107000300_enforce_booking_exclusivity` adds unique slot and student/start-time indexes. The same rule scenarios then passed. The initial regression run passed all 22 tests across four test files. The actual output is retained locally in `evidence/f03/f03-green.txt` under the repository's evidence exclusion rule.

The composite foreign key from a booking's slot ID and copied start time also ensures that its stored start time matches the referenced slot.

## Build and browser

`npm run build` passed. Chromium at a 375px viewport verified the student date filter, a competing student's booking after the page had loaded, conflict feedback and refreshed availability, successful booking, retrieval after reloading the saved-detail URL, and sign-out. No page errors or horizontal overflow were found in that journey.

The API suite also verifies saved ownership, forbidden roles, started slots, malformed or unknown IDs, and Bangkok date filtering. Tests use an isolated PostgreSQL database and clean up their own records.

## PR #9 review fixes

The reviewer found that the student router applied its guards to every unmatched API request. Before the fix, the new regression tests reproduced `401` for anonymous `GET /api/v1/nope`, and `403` for operator requests to `/api/v1/nope` and `/api/v1/machines/1/nope`, instead of `404`. The student unknown-path case already passed. This run had three failing and eight passing booking tests; the actual output is in `evidence/f03/review-red.txt`.

The student session and role guards now apply separately to the three F-03 routes. All four unknown-path cases return `404 NOT_FOUND`, while the existing routes still enforce session and role checks. `TC-ACCESS-03` now uses a valid future slot and checks that it has no booking after each rejected anonymous or operator booking request.

After these fixes, `npm test` passed all 26 tests across four files and `npm run build` passed both TypeScript configurations and the Vite build. Their output is retained locally in `evidence/f03/review-green.txt` and `evidence/f03/review-build.txt`. The feature contract records the F-03 error codes and a v0.4 history row. All F-03 evidence now uses the repository-root `evidence/f03/` directory and stays excluded from Git.
