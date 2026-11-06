# Sprint 1 Software Test Specification

These checks are planned. Record the tested commit, command, expected and actual outcomes, and pass or fail status once each check runs.

## Common fixtures

Use a separate PostgreSQL test database with the same schema as the application. Prepare students A and B, operator A assigned to `GPU-01`, and operator B with no assignment to `GPU-01`. Isolate each test's data. Use a controlled clock for time-dependent tests, with future or past slots relative to that clock.

| Test and level | Covers | Setup and action | Expected result |
|---|---|---|---|
| TC-AUTH-01 · API | AC-06 | Sign in with prepared student and operator accounts, an incorrect password, and an unknown username. | Valid sign-in returns `200` with the correct identity and role. Wrong credentials return `401` with the same message and create no session. |
| TC-AUTH-02 · API | AC-07 | Retrieve the current account, sign out, then replay the previous session cookie. | The initial read returns `200`. Sign-out returns `204`. The old cookie returns `401`. |
| TC-AUTH-03 · API | AC-16 | Create a session and set the clock to its expiry time. Request the current account. | The expired session returns `401`. |
| TC-TIME-01 · Unit | AC-03, AC-05, AC-11, AC-17 | Check date boundaries in `Asia/Bangkok`, whole-hour validation, and times immediately before and at a slot's start. | The selected date uses Bangkok boundaries. `14:00` is on the hour, `14:30` is not, and a slot cannot be opened or booked once its start time has been reached. |
| TC-SLOT-01 · API and database | AC-04, AC-05 | As the assigned operator, list machines and open consecutive future `14:00` and `15:00` slots. Repeat the `14:00` request, try `14:30`, and read the schedule. | The machine list includes `GPU-01`. The valid requests return `201` and end one hour after their start. The duplicate returns `409` with `SLOT_ALREADY_EXISTS` and the off-hour request returns `400`. Only the two valid slots are saved and returned for the selected date. |
| TC-SLOT-02 · API | AC-11 | Seed future available, booked, started, and other-date slots. Request availability for the selected date and for a valid date without slots. | The first result contains only future, unbooked slots on the selected date. The second returns `200` with an empty list. |
| TC-SLOT-03 · API and database | AC-17 | Set server time to `14:00` Bangkok time. Request starts at `13:00`, `14:00`, and `15:00`. | The first two requests return `400` and create no slots. The future start returns `201`. |
| TC-BOOK-01 · API and database | AC-01, AC-09 | Student A books a future slot and follows the returned `Location`. Student B requests the same URL. | The API returns `201`, saves the reservation for A, and returns it to A. B receives `404` without booking data. |
| TC-BOOK-02 · API and database | AC-02 | Sign in A and B independently. Issue both booking requests for the same future slot before awaiting either response. Inspect the database after both finish. | One response is `201` and the other is `409` with `SLOT_ALREADY_BOOKED`. Exactly one row exists for the slot, and it belongs to the successful account. |
| TC-BOOK-03 · API and database | AC-03, AC-13 | Submit a booking at or after the slot start. Also submit missing, invalid, and unknown slot IDs. | Started slots return `409` with `SLOT_ALREADY_STARTED`. Missing or invalid IDs return `400` and a valid but unknown ID returns `404`. No bookings are created. |
| TC-ACCESS-01 · API and database | AC-08, AC-10 | A student and an unassigned operator attempt to open a slot for `GPU-01`. The unassigned operator also requests the schedule. | The requests return `403`, disclose no schedule data, and leave the schedule unchanged. |
| TC-ACCESS-02 · API | AC-09, AC-10, AC-14 | Give A and B separate bookings. Read A's list and request B's booking as A. Request the `GPU-01` schedule as each operator. | A's list contains only A's bookings. B's booking returns `404` to A. The assigned operator receives the schedule and the unassigned operator receives `403`. |
| TC-ACCESS-03 · API and database | AC-12, NFR-01 | Send unauthenticated requests to protected routes. Try student-only routes as an operator and operator-only routes as a student. | Missing sessions return `401`, wrong roles return `403`, no protected data is disclosed, and no unauthorized records are created. |
| TC-PERSIST-01 · System | AC-15, NFR-02 | Create a booking, restart the application with the same PostgreSQL database, and retrieve the booking as its owner. | The booking ID, student, machine, and slot are preserved and retrievable. |
| TC-E2E-01 · Browser | AC-01, AC-14 | An operator opens a slot. A student signs in, finds it, books it, and reloads My Bookings. The operator checks the schedule. | The student sees the saved reservation and the operator sees the correct booked slot on the assigned machine. |

## TDD evidence

For the booking exclusivity rule, retain the failing `TC-BOOK-02` run that exposes the missing behavior and the passing run after the rule is implemented. The test must assert both API responses and persisted rows. Record the actual versions and outputs used in the report.
