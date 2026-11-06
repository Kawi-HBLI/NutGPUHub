# Software Requirements Specification

## Purpose and scope

NutGPUHub gives university students a way to find and reserve available GPU machine time for coursework or projects. Operators use the same schedule to publish availability and see reservations. The working assumption is that students need a clearer view of availability and operators need a shared schedule to avoid conflicting reservations. The team will validate that assumption with intended users when possible.

The product scope covers slot publication, booking, cancellation, rescheduling, slot closure, and booking summaries. GPU host access provisioning, compute job execution, and an account administration interface are outside the project baseline.

## Users

- **Student.** Finds available slots and creates, retrieves, or changes their own bookings according to the rules for each operation.
- **Machine operator.** Manages slots and views bookings and summaries for assigned machines.
- **Unauthenticated visitor.** Can access sign-in. Booking and schedule operations require authentication.

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

## Business rules

- **BR-01 — Slot duration and exclusivity.** Slots start on the hour and last one hour. A machine can have only one slot with a given start time. Adjacent slots are allowed. A slot can have at most one confirmed booking, including when requests arrive concurrently. Only future slots can be opened or booked. The server determines whether the start time has been reached.
- **BR-02 — Role and record permissions.** The API checks the authenticated role and the relevant booking ownership or machine assignment for every protected operation.
- **BR-03 — Rescheduling.** The original booking remains confirmed if the system cannot reserve the replacement slot.

## Non-functional requirements

| ID | Requirement | Verification target |
|---|---|---|
| NFR-01 | Every protected route rejects unauthenticated requests and protects data outside the caller's role, ownership, or assignment. | API tests verify rejection without returning protected data or creating unauthorized records. |
| NFR-02 | A confirmed booking remains retrievable after an application restart using the same persistent database. | Create a booking, restart the application, and retrieve the same booking as its owner. Repeat the persistence check against a deployed release once available. |

## Assumptions and delivery constraints

- Use `Asia/Bangkok` for calendar dates and displayed times. Sprint 1 demonstrations use synthetic data, one GPU machine, prepared student and operator accounts, and an operator assignment.
- Store password hashes for locally managed credentials. The end-to-end workflow runs through the UI, application API, and persistent database.
- Sprint 1 runs locally with documented setup. Containerized deployment to GCP begins in Lab 5.
