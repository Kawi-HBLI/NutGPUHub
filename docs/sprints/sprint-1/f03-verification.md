# F-03 Verification

The feature starts from the accepted F-02 release on `sprint-1-staging`, commit `55869b7`.

## TDD rule checks

The first run used the booking API with `20261107000200_create_bookings` applied and no booking uniqueness indexes. `TC-BOOK-02` returned two `201` responses. Both sequential and concurrent `TC-BOOK-04` checks also allowed the same student to reserve two machines in the same hour. The three rule checks failed. The actual output is retained locally in `docs/sprints/sprint-1/evidence/f03-red.txt` for the PDF report.

Migration `20261107000300_enforce_booking_exclusivity` adds unique slot and student/start-time indexes. The same rule scenarios then passed. The final regression run passed all 22 tests across four test files. The actual output is retained locally in `docs/sprints/sprint-1/evidence/f03-green.txt` under the repository's evidence exclusion rule.

The composite foreign key from a booking's slot ID and copied start time also ensures that its stored start time matches the referenced slot.

## Build and browser

`npm run build` passed. Chromium at a 375px viewport verified the student date filter, a competing student's booking after the page had loaded, conflict feedback and refreshed availability, successful booking, retrieval after reloading the saved-detail URL, and sign-out. No page errors or horizontal overflow were found in that journey.

The API suite also verifies saved ownership, forbidden roles, started slots, malformed or unknown IDs, and Bangkok date filtering. Tests use an isolated PostgreSQL database and clean up their own records.
