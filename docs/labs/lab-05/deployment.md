# Lab 5 Deployment

Status: first version (Lab5-2). Sections marked *Pending* are filled in by later Lab 5 Issues.

## Stack

| Layer | NutGPUHub | Change from the reference kit (TokTickIT) |
|---|---|---|
| Runtime | Node.js 24, one npm package at the repository root | The kit has separate `client/` and `server/` packages. We build one image from the root. |
| API | Express 4 (`server/`), JSON under `/api/v1`, plus `/api/health` and `/api/ready` | Same idea; our API is versioned under `/api/v1`. |
| UI | React 18 + Vite 6 (`client/`), built to `dist/client` and served by Express | No nginx container; Express serves the built UI on the same origin. |
| Database | PostgreSQL with Prisma 5.22 migrations (`prisma/`) | Same. |
| Passwords | Argon2id (`argon2`, native module) | The image must install `argon2` for Linux inside the build (never copy `node_modules` from a laptop). |
| Accounts | Four demo accounts (two students, two operators) created by the seed with `DEMO_PASSWORD` | The kit seeds an administrator from `ADMIN_PASSWORD`. NutGPUHub has no administrator, so it needs only `DEMO_PASSWORD`. |
| Sessions | Database table `sessions`, SHA-256 hash of an opaque cookie token | Same principle. |
| Tests | Vitest API/integration tests, Playwright browser journeys, a process-restart check | The kit uses separate backend and frontend test commands. |

Reference stack for the cloud: Artifact Registry, Cloud Run, Cloud SQL for PostgreSQL, Secret Manager, GitHub Actions with Workload Identity Federation.

## Cloud readiness (Student Guide Episode 2)

| # | Check | Result |
|---|---|---|
| 1 | Uploaded files are not saved in the container | Not applicable: NutGPUHub has no file upload. All data (users, sessions, machines, slots, bookings) is in PostgreSQL. |
| 2 | The seed is safe for production | `DEMO_PASSWORD` comes from the environment (12–256 characters; the placeholder is rejected) and is never shown on screen. The seed upserts, so it can rerun. Since Lab5-2 it changes an account and ends that account's sessions only when the password or role differs, so rerunning it on every release keeps users signed in. |
| 3 | No development shortcuts | No role picker and no default password on the sign-in page. The Vite proxy exists only in `npm run dev:web`. |
| 4 | Sessions are stored in the database | `sessions` table (`server/session.ts`); a new instance or a redeploy keeps every session. |
| 5 | The server reads its port from `PORT` | `PORT` is read in `server/index.ts`. The bind address is `HOST`, default `127.0.0.1` for local safety; the container image sets `HOST=0.0.0.0` so Cloud Run can reach it. |
| 6 | `/api/ready` exists | Added in Lab5-2: `/api/health` returns `{"status":"ok"}` without the database; `/api/ready` runs `SELECT 1` and returns `{"status":"ready","db":"connected"}`, or 503 `{"status":"not_ready","db":"unavailable"}`. Tests TC-OPS-01 to TC-OPS-04 in `tests/cloud-ready.test.ts`. |

## Environment variables

Only placeholders are committed (`.env.example`). `.env` is in `.gitignore`.

| Variable | Purpose | Secret? | Local value from | Cloud value from |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by the app, migrations and the seed | Yes | `.env` | Secret Manager, mounted into the Cloud Run service and migration job |
| `TEST_DATABASE_URL` | Separate migrated database for `npm test`, `npm run test:e2e`, `npm run verify:restart`; must differ from `DATABASE_URL` | Local only | `.env` | Not used in the cloud. CI uses a throw-away database in the workflow. |
| `DEMO_PASSWORD` | Password the seed sets for the four demo accounts | Yes | `.env` (your own private value) | Secret Manager, mounted into the migration job only. Shared with the Lab 6 partner team privately, never in the repository or a screenshot. |
| `APP_ORIGIN` | The only origin allowed to send state-changing requests (sign-in included); also turns on the `Secure` cookie when it is `https` | No | `.env` (`http://localhost:5173` with Vite, `http://localhost:3000` with `npm start`) | Cloud Run environment: the exact public service URL. If it does not match the URL in the browser, every POST returns 403 `INVALID_ORIGIN`. |
| `PUBLIC_ORIGIN` | Legacy fallback for `APP_ORIGIN` when that is unset or empty | No | Not set | Not set |
| `SESSION_TTL_MINUTES` | Session lifetime; Sprint 1 requires omitting it or exactly `60` | No | `.env` | Not set (default 60) |
| `COOKIE_SECURE` | Forces the `Secure` cookie flag (`true`/`false`) | No | `.env` (`false` for local http) | Not set; an `https` `APP_ORIGIN` already sets it |
| `PORT` | HTTP port | No | `.env` (`3000`) | Set by Cloud Run (`3000`) |
| `HOST` | Bind address; default `127.0.0.1` | No | Not set | Container image sets `0.0.0.0` |
| `NODE_ENV` | Runtime mode; the app code does not branch on it | No | Not set | `production` in the image and on Cloud Run |

## Commands

Local development (Node.js 24, PostgreSQL with a development and a test database):

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

Tests (the test database must be migrated once; see the README):

```bash
npm test
npm run test:e2e
npm run verify:restart
```

Production build and run on one origin (set `APP_ORIGIN=http://localhost:3000` in `.env`):

```bash
npm run build
npm start
```

Health checks while the app runs:

```bash
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
```

Docker and Docker Compose commands: *Pending (Lab5-3).*

## GCP project and resources

*Pending (Lab5-1, Lab5-5).* Project ID, region, Cloud Run service, migration job, Artifact Registry repository, Cloud SQL instance and database, secret names, service accounts.

## CI and the merge gate

*Pending (Lab5-4, Lab5-6).*

## Release procedure and running commit

*Pending (Lab5-7, Lab5-8).* Release flow, rollback by image tag, and how to find the commit that is running.
