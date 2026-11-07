# NutGPUHub

NutGPUHub lets university students reserve one-hour time slots on GPU machines and lets machine operators manage availability for their assigned machines.

**Course:** CPE 334, Semester 1/2026 · **Theme:** 1. Appointment and Scheduling System · **Repository:** https://github.com/Kawi-HBLI/NutGPUHub · **Sprint 1 release:** to be tagged on `main`

## Team

| Name | GitHub |
|---|---|
| Tanadet Nuchaikaew | `Kawi-HBLI` |
| Thawat Boonsuk | `Chessuker` |

Student IDs are listed in the submitted PDF, not in this public repository.

## Branches

Feature branches start from `sprint-1-staging`. Teammate-reviewed PRs merge into `sprint-1-staging`, and the accepted staging release merges into `main`.

## Sprint 1 review package

These documents are drafts for team review. The test cases describe planned checks. Execution results belong to the release evidence once the application runs.

| Document | Review focus |
|---|---|
| [Software Requirements Specification](docs/srs.md) | Product scope, roles, and business rules |
| [Feature inventory](docs/features.md) | Feature scope and dependencies |
| [Requirements traceability](docs/traceability.md) | Requirements, features, sprints, and planned verification |
| [System-Level SDS](docs/system-sds.md) | Architecture, data, access rules, and deployment plan |
| [Three-sprint plan](docs/sprints/plan.md) | Checkpoints and completion outcomes |
| [Sprint 1 feature contracts](docs/sprints/sprint-1/feature-contracts.md) | Screens, API behavior, acceptance criteria, and definition of done |
| [Sprint 1 test specification](docs/sprints/sprint-1/test-specification.md) | Preconditions, actions, and expected results |
| [Sprint 1 issue drafts](docs/sprints/sprint-1/issue-drafts.md) | Work order, verification, and PR review handoff |

## Run the sign-in feature locally

Use Node.js 24 and PostgreSQL. Create separate development and test databases and give the configured database user access to each. From the repository root, copy `.env.example` to `.env`, update both database URLs, and set a private `DEMO_PASSWORD` for the prepared accounts.

The student workspace now lists available hourly GPU slots by Bangkok date. A successful booking has an **Open saved booking** link that can be reloaded. Booking ownership and concurrent reservations are checked by the API and database. See [F-03 verification](docs/sprints/sprint-1/f03-verification.md) for the test evidence.

```powershell
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
```

Run `npm run dev:api` in one terminal and `npm run dev:web` in another. Open `http://localhost:5173` and use `student-a` or `operator-a` with the password you set. The seed also prepares `student-b` and `operator-b`, and the GPU machines `GPU-01` (assigned to `operator-a`) and `GPU-02` (assigned to `operator-b`). Sign in as an operator to open one-hour slots on an assigned machine.

To serve the built UI and API from one local address, run `npm run build`, set `APP_ORIGIN` in `.env` to `http://localhost:3000`, and run `npm start`. Restore `http://localhost:5173` in `.env` when returning to the Vite development server. Use `SESSION_TTL_MINUTES=60` and `COOKIE_SECURE=false` for local HTTP.

If you seeded demo accounts with the earlier scrypt draft, run `npm run db:seed` again with your private `DEMO_PASSWORD`. This updates the demo credentials to Argon2id and ends existing sessions for those accounts.

To run the authentication suite, migrate the test database once in a separate PowerShell window. Set the temporary `DATABASE_URL` to the same value as `TEST_DATABASE_URL` in `.env`, then clear it so the app and tests use their respective databases.

```powershell
$env:DATABASE_URL = '<test PostgreSQL URL>'
npm run db:migrate
Remove-Item Env:DATABASE_URL
npm test
```

The browser journeys (`TC-E2E-01`, `TC-E2E-02`) use Playwright against the migrated test database. Install Chromium once, then run the suite. Playwright builds the app and starts it on `http://127.0.0.1:3100` with `TEST_DATABASE_URL`, so port 3100 must be free.

```powershell
npx playwright install chromium
npm run test:e2e
```

Students see their saved reservations under **My bookings**, and operators see who booked each slot in the machine schedule.
