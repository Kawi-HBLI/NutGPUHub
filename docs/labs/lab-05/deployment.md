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
| 6 | `/api/ready` exists | Added in Lab5-2. Startup needs the database: `server/index.ts` connects (`database.$connect()`) before it listens and exits if that fails, so a revision without a database never becomes ready. After the server has started, `/api/health` returns `{"status":"ok"}` without querying the database, and `/api/ready` runs `SELECT 1` and returns `{"status":"ready","db":"connected"}`, or 503 `{"status":"not_ready","db":"unavailable"}` if the database is lost later. Tests TC-OPS-01 to TC-OPS-04 in `tests/cloud-ready.test.ts` call `createApp` directly; the 503 after the database stops was also checked against the running built server. |

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
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker Compose only: the local database container and the `DATABASE_URL` built from it | Local only | Fallbacks in `docker-compose.yml`, or your `.env` | Not used (Cloud SQL and Secret Manager) |
| `APP_PORT` | Docker Compose only: host port for the app (default `3000`); `APP_ORIGIN` follows it | No | Optional in `.env` | Not used |

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

## Docker

Files: `Dockerfile`, `.dockerignore`, `docker-compose.yml` at the repository root.

| Decision | Reason |
|---|---|
| One root `Dockerfile`, two stages (`build`, `production`) | NutGPUHub is one npm package. The kit's `client/Dockerfile`, `server/Dockerfile`, `client/nginx.conf` and `server/docker-entrypoint.sh` are not used: Express serves the built UI, and `CMD ["node", "dist/server/index.js"]` makes node PID 1 so it receives SIGTERM without an entrypoint script. |
| Base image `node:24-bookworm-slim` + `openssl` | Debian (glibc) lets `argon2` install its prebuilt binary and lets Prisma find OpenSSL 3 without extra binary targets. |
| `prisma` and `tsx` are runtime dependencies | The same image runs the migration job (`prisma migrate deploy`) and the TypeScript seed (`tsx`). Development tools (Vite, Vitest, Playwright, TypeScript) are pruned from the final image. |
| Runtime contents | `dist/` (server and UI), `prisma/` (schema, migrations, seed), `server/password.ts` (imported by the seed), production `node_modules`. |
| `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000`, `USER node` | Listens on all interfaces at `$PORT` as required by Cloud Run, and does not run as root. No secret is set in the image. |
| `.dockerignore` | Excludes `.git`, `node_modules`, `dist`, `.env*` (except `.env.example`), credentials files, docs and tests. |

Compose services:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 16 with the named volume `postgres_data`, so data survives `down`/`up`. Not published on a host port. |
| `migrate` | Same image; runs `npx prisma migrate deploy && npm run db:seed`, then exits 0. Needs `DEMO_PASSWORD`. |
| `app` | Same image on `http://localhost:3000` (`APP_PORT` changes the host port). Starts after `migrate` succeeds; health check calls `/api/ready`. |

`DEMO_PASSWORD` is read from your shell or your local `.env` (never written in the Compose file). The local PostgreSQL password has a fallback (`POSTGRES_PASSWORD`, default for this local-only database); the cloud uses Secret Manager. Open the app at exactly `http://localhost:3000`; `http://127.0.0.1:3000` is a different origin and sign-in would return 403.

```bash
docker compose up --build -d
docker compose ps -a
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
docker compose down
docker compose up -d
docker compose down -v
```

On Windows PowerShell use `curl.exe`. `docker compose down -v` also deletes the database volume.

Local result (Lab5-3, Docker 28.0.1): the image built (502 MB); `migrate` applied 4 migrations, prepared 4 demo accounts and 2 GPU machines and exited 0; `app` became healthy and ran as `uid=1000(node)`; `/api/health` and `/api/ready` returned 200 and `/` returned 200. An operator opened a GPU-01 slot and `student-a` booked it through the API. After `docker compose down` and `docker compose up -d`, the same session cookie still returned 200 on `/api/v1/auth/me` and My Bookings still contained the booking. A POST with `Origin: http://127.0.0.1:3000` returned 403 `INVALID_ORIGIN`, and `migrate` without `DEMO_PASSWORD` stopped with the seed's error message.

## GCP project and resources

*Pending (Lab5-1, Lab5-5).* Project ID, region, Cloud Run service, migration job, Artifact Registry repository, Cloud SQL instance and database, secret names, service accounts.

## CI and the merge gate

*Pending (Lab5-4, Lab5-6).*

## Release procedure and running commit

*Pending (Lab5-7, Lab5-8).* Release flow, rollback by image tag, and how to find the commit that is running.
