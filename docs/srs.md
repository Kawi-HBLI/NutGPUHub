# Software Requirements Specification

| Field | Value |
|---|---|
| Course | CPE 334, Semester 1/2026 |
| Theme | 1. Appointment and Scheduling System |
| Context | Reserving one-hour time slots on shared university GPU machines |
| Team | Tanadet Nuchaikaew, Thawat Boonsuk. Student IDs are in the submitted PDF. |
| Version | 0.4, see [version history](#version-history) |

## Purpose and scope

NutGPUHub gives university students a way to find and reserve available GPU machine time for coursework or projects. Operators use the same schedule to publish availability and see reservations. The working assumption is that students need a clearer view of availability and operators need a shared schedule to avoid conflicting reservations. The team will validate that assumption with intended users when possible.

The product scope covers slot publication, booking, cancellation, rescheduling, slot closure, and booking summaries. GPU host access provisioning, compute job execution, and an account administration interface are outside the project baseline. Self-registration and password recovery are also excluded; Sprint 1 uses seeded accounts.

## Users

- **Student.** Finds available slots and creates, retrieves, or changes their own bookings according to the rules for each operation.
- **Machine operator.** Manages slots and views bookings and summaries for assigned machines. Each machine has one assigned operator. An operator can be assigned to several machines.
- **Unauthenticated visitor.** Can access sign-in. Booking and schedule operations require authentication.

## Domain vocabulary and state

| Term | Meaning |
|---|---|
| GPU machine | One exclusive resource identified by a machine code; exactly one assigned operator, with an operator able to own several assignments. |
| Slot | A published one-hour interval for one machine, represented as [startAt, startAt + one hour). Adjacent intervals do not overlap. |
| Open slot | Published and not closed. Sprint 1 has no closed state, so every stored slot is open. Closure is planned for Sprint 2. |
| Confirmed booking | A saved reservation for one student and slot. Every Sprint 1 booking is implicitly confirmed; cancellation states are planned for Sprint 2. |
| Available slot | An open slot whose start is strictly after server time and which has no confirmed booking. Availability is a slot property. |
| Student eligibility | The student role, valid session and BR-04 also apply when reserving. A slot may appear available even if that student already holds another machine at the same hour; the booking request then rejects the conflict. |
| Upcoming / started | Upcoming means server time < startAt; started means server time >= startAt. Passing time does not delete the booking. |

Sprint 1 transitions are unpublished slot -> published/unbooked slot -> booked slot. A rejected request leaves the persisted reservation state unchanged. Time changes whether a slot may be booked; it does not add a stored slot status. Sprint 2 introduces cancellation, rescheduling and closure under separately reviewed contracts. Reopening a closed slot, an account-admin interface and GPU execution remain outside the baseline.

## Functional requirements

| ID | Requirement | Sprint |
|---|---|---|
| FR-01 | A signed-in student can reserve an open, unbooked slot before its start time. The system confirms the booking after saving it. | 1 |
| FR-02 | Users can sign in, see their current account and role, and sign out. | 1 |
| FR-03 | An operator can open one-hour slots for an assigned machine. A machine can have several slots on the same day. | 1 |
| FR-04 | A student can select a date and see open, unbooked slots that have yet to start. | 1 |
| FR-05 | A student can retrieve their own bookings. An operator can retrieve the schedule and bookings for assigned machines. | 1 |
| FR-06 | A student can cancel their own booking before the slot starts. The slot becomes available again, and the cancellation remains in the booking history. | 2 |
| FR-07 | A student can move their own upcoming booking to an available future slot. A successful move reserves the new slot and releases the original. | 2 |
| FR-08 | An operator can close an upcoming, unbooked slot for an assigned machine. The system removes the slot from student availability and rejects booking requests for it. | 2 |
| FR-09 | An operator can filter by assigned machine and date range and see counts of open slots, slots with confirmed bookings, and slots currently available to book. | 3 |

### Observable subrequirements

FR-01 through FR-09 keep their original meaning and IDs. Dotted IDs below refine the existing scope for review and traceability; they do not represent additional features or retroactively change the original contracts. Sprint 1 rows describe the accepted F-01 to F-04 behavior. Sprint 2 and Sprint 3 rows remain planned, with detailed contracts required before implementation.

| ID | Observable behavior | Feature | Sprint |
|---|---|---|---|
| FR-01.1 | A signed-in student can submit a booking for an open, unbooked future slot. The API takes the student identity from the session. | F-03 | 1 |
| FR-01.2 | Confirm only after saving the booking; return its ID and a link to retrieve the saved result. | F-03 | 1 |
| FR-01.3 | Reject a slot already booked by another request, including concurrent attempts, without creating a second booking. | F-03 | 1 |
| FR-01.4 | Reject a second machine for the same student and start time, including concurrent attempts. | F-03 | 1 |
| FR-02.1 | Valid prepared credentials sign in with the account identity and role; malformed input or rejected credentials create no session. Wrong password and unknown username use the same generic error. | F-01 | 1 |
| FR-02.2 | Return the current account and role for a valid session, including after reloading the UI. | F-01 | 1 |
| FR-02.3 | Sign-out invalidates the server session and clears the browser cookie; replaying it cannot retrieve the current account. | F-01 | 1 |
| FR-02.4 | Reject the session at exactly one hour after sign-in without extending it through activity. | F-01 | 1 |
| FR-03.1 | An operator can list and choose only machines assigned to that operator. | F-02 | 1 |
| FR-03.2 | An assigned operator can open a slot strictly after server time, on a whole Bangkok hour, with an end exactly one hour later. | F-02 | 1 |
| FR-03.3 | Reject a duplicate machine/start pair while permitting adjacent slots and several rounds on the same date. | F-02 | 1 |
| FR-04.1 | A student can select a Bangkok calendar date and retrieve only open, unbooked slots strictly after server time within that date. | F-03 | 1 |
| FR-04.2 | Show each available slot with its machine code and one-hour time range, ordered by start time. A valid date without availability returns an empty list and an empty UI state. | F-03 | 1 |
| FR-04.3 | Reject missing or invalid calendar dates rather than normalizing impossible dates to another day. | F-03 | 1 |
| FR-05.1 | A student can list only their own saved bookings, ordered by slot start, with machine and slot times; show an empty state when none exist. | F-04 | 1 |
| FR-05.2 | A student can retrieve their own saved booking by ID; another student receives 404 without booking data. | F-03 | 1 |
| FR-05.3 | An operator can retrieve a selected Bangkok day schedule only for an assigned machine. | F-02, F-04 | 1 |
| FR-05.4 | Each operator schedule slot includes its booking ID and student username when booked, or booking: null when unbooked. Student availability does not disclose the booking student. | F-04 | 1 |
| FR-06.1 | A student can cancel only their own booking before the slot starts; reject attempts on another owner or a started booking. | F-05 | 2 |
| FR-06.2 | Successful cancellation releases the slot and the student hour so another eligible booking can use them. | F-05 | 2 |
| FR-06.3 | Retain the cancelled booking and cancellation history instead of deleting evidence of the reservation. | F-05 | 2 |
| FR-07.1 | A student can request a move of their own upcoming booking to an open, unbooked future slot. | F-06 | 2 |
| FR-07.2 | A successful move reserves the target and releases the original as one transaction. | F-06 | 2 |
| FR-07.3 | If the target cannot be reserved, retain the original confirmed booking; enforce slot and student-hour exclusivity during competing moves. | F-06 | 2 |
| FR-08.1 | An operator can close only an upcoming, unbooked slot on an assigned machine. | F-07 | 2 |
| FR-08.2 | A closed slot is excluded from student availability and a direct booking request for it is rejected. | F-07 | 2 |
| FR-09.1 | An operator can filter the booking summary by assigned machine and date range. | F-08 | 3 |
| FR-09.2 | Show counts of open slots, slots with confirmed bookings, and slots currently available to book. Define exact counting and date-range predicates in the F-08 contract before implementation (Q-03). | F-08 | 3 |

## Business rules

- **BR-01: Slot duration and exclusivity.** Slots start on the hour and last one hour. A machine can have only one slot with a given start time. Adjacent slots are allowed. A slot can have at most one confirmed booking, including when requests arrive concurrently. Only future slots can be opened or booked. The server determines whether the start time has been reached.
- **BR-02: Role and record permissions.** The API checks the authenticated role and the relevant booking ownership or machine assignment for every protected operation.
- **BR-03: Rescheduling.** The original booking remains confirmed if the system cannot reserve the replacement slot.
- **BR-04: One machine per student per hour.** A student can hold at most one confirmed booking for a given start time, across all machines. A request for a second machine at the same hour is rejected, including when both requests arrive concurrently. There is no daily booking quota; the slots that operators open limit how much a student can book.

### Rule examples and verification allocation

| Rule | Accepted example | Rejected example | Establish / recheck |
|---|---|---|---|
| BR-01 | GPU-01 has 14:00 and 15:00 slots; different students reserve distinct free slots. | A second request reserves the same slot, or an operator publishes 14:30. Exactly one competing reservation succeeds. | Sprint 1; recheck when adding cancellation, closure and rescheduling in Sprint 2. |
| BR-02 | Operator A reads GPU-01 assigned to A; Student A reads A's booking. | Operator B reads GPU-01 or Student B reads A's booking. Student booking detail uses 404 to conceal another owner's record. | Sprint 1; extend to every new operation in Sprints 2-3. |
| BR-03 | A successful move releases the original after securing the target. | Another student wins the target; losing the original booking as well would violate the rule. | Sprint 2. |
| BR-04 | Student A reserves GPU-01 at 14:00 and GPU-02 at 15:00. | A also reserves GPU-02 at 14:00, including concurrent requests. | Sprint 1; recheck freed hours and replacement targets in Sprint 2. |

## Non-functional requirements

| ID | Requirement | Verification target | Establish / repeat |
|---|---|---|---|
| NFR-01 | Every protected route rejects unauthenticated requests and protects data outside the caller's role, ownership, or assignment. | API tests verify rejection without returning protected data or creating unauthorized records. | Sprint 1; extend to new routes in Sprints 2-3. |
| NFR-02 | A confirmed booking remains retrievable after an application restart using the same persistent database. | Create a booking, restart the application, and retrieve the same booking as its owner. Repeat the persistence check against a deployed release once available. | Sprint 1 locally; Lab 5 and later deployed releases. |
| NFR-03 | Passwords are stored only as argon2id hashes. A session is rejected from one hour after sign-in, and immediately after sign-out. | API and database tests check that no plaintext password is stored, that a session at its one-hour expiry returns `401`, and that a signed-out session returns `401`. Verified in Sprint 1. | Sprint 1; rerun after authentication changes. |

## Assumptions and delivery constraints

- Use `Asia/Bangkok` for calendar dates and displayed times. Sprint 1 demonstrations use synthetic data, two GPU machines, prepared student and operator accounts, and operator assignments.
- The end-to-end workflow runs through the UI, application API, and persistent database.
- Sprint 1 runs locally with documented setup. Containerized deployment to Cloud Run begins in Lab 5.

## Assumption register

| ID | Assumption | Validation / consequence |
|---|---|---|
| A-01 | A reservation grants exclusive use of one whole GPU machine, rather than a fraction of its compute capacity. | Validate with intended users; resource sharing would require a scope decision. |
| A-02 | Operators publish service hours as separate slots. There is no automatic daily opening schedule or student daily quota. | Demonstrate several slots on one day; D-02 and D-06 govern the baseline. |
| A-03 | Prepared synthetic accounts and machine assignments are sufficient for Sprint 1. | Verify seed reproduction locally. Real account administration requires a later scope decision. |
| A-04 | University users interpret service dates and times in Asia/Bangkok. | Verify UTC/Bangkok date boundaries and display consistently. |

## Decisions and resolved questions

| ID | Question | Decision | Date |
|---|---|---|---|
| D-01 | Can a student book two machines in the same hour? | No. Added as BR-04. | 2026-11-06 |
| D-02 | Is there a daily booking quota per student? | No. Availability is limited by the slots operators open during their service hours. | 2026-11-06 |
| D-03 | How long does a session last? | One hour from sign-in, with no sliding renewal. | 2026-11-06 |
| D-04 | Which password hashing algorithm is used? | argon2id. | 2026-11-06 |
| D-05 | Which GCP service runs the application? | Cloud Run, configured in Lab 5. | 2026-11-06 |
| D-06 | What slot length is used? | One hour, starting on the hour. Recorded in BR-01. | 2026-11-06 |
| D-07 | Who can change availability? | Only the operator assigned to the machine. Recorded in BR-02. | 2026-11-06 |

## Open questions for later contracts

These questions refine later-sprint behavior. They do not block the accepted Sprint 1 workflow.

| ID | Question | Owner / resolution gate |
|---|---|---|
| Q-01 | How should a repeated cancellation request respond, and which history fields are displayed? | Team review of F-05 before Sprint 2 implementation. |
| Q-02 | Does a reschedule retain the booking ID or create a linked replacement, and how is its history presented? | Team review of F-06 before implementation; BR-03 and exclusivity must hold either way. |
| Q-03 | Do open-slot totals include past slots, and are both date-range endpoints inclusive in Bangkok time? Define each report predicate and invalid-range behavior. | Team review of F-08 before Sprint 3 implementation; needed for the November 29 progress slice. |

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | Tanadet Nuchaikaew | Initial draft for team review. |
| 0.2 | 2026-11-06 | Thawat Boonsuk | Added document header, BR-04, NFR-03 and the decision log after team review. Sprint 1 seed now uses two machines so BR-04 can be tested. |
| 0.3 | 2026-11-06 | Thawat Boonsuk | Removed student IDs from the public repository after review. They appear only in the submitted PDF. |
| 0.4 | 2026-11-07 | Tanadet Nuchaikaew | Post-F-04 refinement for peer review: retained parent IDs, added observable child requirements, state vocabulary, assumption register and later-sprint questions. No runtime scope change. |
