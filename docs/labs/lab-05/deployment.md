# Lab 5 Deployment

Status: updated in Lab5-5 (deploy scripts). Sections marked *Pending* are filled in by later Lab 5 Issues.

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

Project (Lab5-1): **CPE334-2026 NutGPUHub**, one project for Labs 5–7 and the Final Project, on the Free Trial. Thawat is Owner, Tanadet is Editor. Alerts-only budget `CPE334-Alert`: THB 8,500, 13 Nov – 15 Dec 2026, e-mails at 10/20/50/90% of actual cost (credits not subtracted).

| Item | Value |
|---|---|
| Project ID | *recorded after the first deployment (Lab5-5)* |
| Region | `asia-southeast1` (Singapore) |
| Public URL | `https://nutgpuhub-<PROJECT_NUMBER>.asia-southeast1.run.app`: *exact URL recorded after the first deployment* |

Resources created by `deploy/deploy.sh` (Lab5-5). The same names are used in `release.sh`, `teardown.sh` and the tests.

| Resource | Name | Settings |
|---|---|---|
| Artifact Registry (Docker) | `nutgpuhub` | Image `nutgpuhub/nutgpuhub:<full commit SHA>`, one tag per commit |
| Cloud SQL for PostgreSQL | instance `nutgpuhub-pg`, database `nutgpuhub`, user `nutgpuhub` | PostgreSQL 16, Enterprise edition, `db-f1-micro`, 10 GB SSD, storage auto-increase **off**, daily backup 03:00 |
| Runtime service account | `nutgpuhub-runner` | Project role Cloud SQL Client only; Secret Manager Secret Accessor on each of the two secrets, not project-wide |
| Secret | `nutgpuhub-database-url` | `DATABASE_URL` (Unix socket `/cloudsql/PROJECT:REGION:nutgpuhub-pg`, `connection_limit=3`); the DB password is generated (`openssl rand -hex 24`) |
| Secret | `nutgpuhub-demo-password` | `DEMO_PASSWORD` for the seed (generated, 24 characters). Read only privately: `gcloud secrets versions access latest --secret=nutgpuhub-demo-password` |
| Cloud Run job | `nutgpuhub-migrate` | Same image; `npx prisma migrate deploy && npm run db:seed`; gets `DATABASE_URL` and `DEMO_PASSWORD`; 1 retry, 300 s timeout |
| Cloud Run service | `nutgpuhub` | Public (`--allow-unauthenticated`), port 3000, 0–3 instances, 512 MiB, 1 CPU; secret `DATABASE_URL` only; plain env `NODE_ENV=production`, `TZ=Asia/Bangkok`, `APP_ORIGIN=<public URL>` |

Changes to the kit's `deploy/` scripts:

| Change | Reason |
|---|---|
| Names `nutgpuhub*` instead of `toktickit*` | Our app. |
| No administrator secret and no `--demo` option; the seed always uses `nutgpuhub-demo-password` | NutGPUHub has no administrator. Its seed needs `DEMO_PASSWORD` for the four demo accounts and two GPU machines, and nobody could sign in without them. The service itself never receives `DEMO_PASSWORD`. |
| `APP_ORIGIN` is set to `https://nutgpuhub-<PROJECT_NUMBER>.<REGION>.run.app`, read with `gcloud projects describe` before the service exists | The app rejects every POST, sign-in included, whose `Origin` is not `APP_ORIGIN`. Cloud Run's deterministic URL is known before the first deploy, so one deploy is enough. Open the app at this URL; the other `…-as.a.run.app` address serves pages but sign-in there returns 403. |
| Image tag is the full commit SHA (not `latest`); the script stops if the working tree has uncommitted changes | The running commit is known from the first deployment (R-08), and `release.sh` can roll back by tag. |
| `--no-storage-auto-increase` when the instance is created | Guide step 5.4 then only checks the setting. |
| Migration command `npx prisma migrate deploy && npm run db:seed` | Our seed script name. The seed is safe to rerun (Lab5-2). |
| `smoke_test.py`: no `/api/categories`; sign-in with `username`, the `nutgpuhub_session` cookie and an `Origin` header; two origin checks | NutGPUHub has no public list endpoint. A POST from another origin must return 403, and an empty sign-in from the service URL must return 400 (not 403), which proves `APP_ORIGIN` matches the URL. Optional sign-in with `SMOKE_USERNAME`/`SMOKE_PASSWORD`. |
| Offline tests rewritten for these rules; CI runs them in step 1 | `deploy/tests/test_deploy_stub.sh` (4 scenarios + bad input + dry run), `test_release_stub.sh`, `test_smoke.py` (6 tests). |

First deployment from Cloud Shell (guide Episode 5), on a clean clone of `main`:

```bash
export PROJECT_ID=<project id>
export REGION=asia-southeast1
gcloud config set project "$PROJECT_ID"
git clone https://github.com/Kawi-HBLI/NutGPUHub.git && cd NutGPUHub
git rev-parse HEAD
DRY_RUN=1 PROJECT_ID="$PROJECT_ID" REGION="$REGION" bash deploy/deploy.sh
PROJECT_ID="$PROJECT_ID" REGION="$REGION" bash deploy/deploy.sh
export SERVICE_URL="https://nutgpuhub-$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)').$REGION.run.app"
curl --fail "$SERVICE_URL/api/health"
curl --fail "$SERVICE_URL/api/ready"
python3 deploy/smoke_test.py "$SERVICE_URL"
gcloud sql instances describe nutgpuhub-pg --format='value(settings.storageAutoResize)'
```

First deployment result: *Pending (Lab5-5): commit, URL, smoke test output, C-04 screenshots.*

Teardown when the course no longer needs it: `DRY_RUN=1 bash deploy/teardown.sh`, then `bash deploy/teardown.sh` (asks for the project ID; deletes all Cloud SQL data).

## CI and the merge gate

Workflow: `.github/workflows/ci-docker.yml`, check name **CI & Docker Build / test-and-docker** (Lab5-4). It never signs in to Google Cloud and never pushes an image.

| Setting | Value | Reason |
|---|---|---|
| Triggers | `pull_request` into `main` or any `*-staging` branch; `workflow_dispatch`; `workflow_call` | Every change is checked on its PR into the staging branch (for example `lab-5-staging`) and again on the release PR into `main`. The deploy workflow (Lab5-7) calls the same job before it deploys. |
| Job id | `test-and-docker` | The merge gate (Lab5-6) requires this check by name. |
| Runner | `ubuntu-24.04` (not `ubuntu-latest`) | `ubuntu-latest` became Ubuntu 26.04 in October 2026. Playwright 1.59 supports Ubuntu up to 24.04, so the first run failed at "Install Chromium for Playwright" in 0 seconds ([run #1](https://github.com/Kawi-HBLI/NutGPUHub/actions/runs/43468192530/job/132032857719)). A pinned runner also keeps CI the same between runs. |
| Permissions | `contents: read` | The workflow cannot change the repository. |
| Concurrency | one run per ref, older run cancelled | A new push replaces the running check; a cancelled run is not a failure. |
| Actions | pinned to full commit SHAs (`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `actions/upload-artifact` v7.0.2) | A moved tag cannot change what runs. |
| Database | `postgres:16-alpine` service with throw-away CI credentials; `nutgpuhub` for migrations and the seed, `nutgpuhub_test` for the tests | The tests refuse to run unless `TEST_DATABASE_URL` differs from `DATABASE_URL`. `prisma migrate deploy` creates the test database. |
| `DEMO_PASSWORD` | random per run (`openssl rand -hex 16`), masked in the log | No password is stored in the repository or in GitHub settings for CI. |

Steps of `test-and-docker`, in order (a failing step fails the check):

1. Deploy scripts without Google Cloud (since Lab5-5): `bash -n` on `deploy/*.sh`, `test_deploy_stub.sh`, `test_release_stub.sh` and `test_smoke.py`, all with a fake `gcloud` or a mocked network.
2. `npm ci` and `prisma generate` on Node.js 24.
3. `prisma migrate deploy` on both databases.
4. The seed twice, because the release job reruns it on every deploy.
5. `npm run build` (server and client).
6. `npm test`: Vitest unit, API and integration tests (TC-AUTH, TC-SLOT, TC-BOOK, TC-OPS and others).
7. `npx playwright test`: browser journeys TC-E2E-01 and TC-E2E-02 against the built app.
8. `npm run verify:restart`: TC-PERSIST-01, a booking survives a restart of the Node process.
9. `docker build` of the root `Dockerfile` that Cloud Run uses.
10. A test summary on the run page (`scripts/ci-test-summary.mjs`): passed, failed and skipped per test file, the restart check, the Docker build and the tested commit. If a step fails, Playwright traces are uploaded as the `playwright-test-results` artifact for 7 days.

Differences from the kit's `ci-docker.yml`: one npm package instead of `server/` and `client/` steps; a second database for the tests; Playwright and the restart check added; the image tag is `nutgpuhub:ci-<sha>`. The kit's deploy-script check was added in Lab5-5 together with `deploy/`; it uses the runner's `python3` instead of a `setup-python` step.

Local result before the first push (Lab5-4): the same commands in a `node:24-bookworm-slim` container with `postgres:16-alpine` migrated both databases, seeded twice ("Prepared 4 demo accounts and 2 GPU machines." both times), built, passed Vitest 40/40 in 8 files and passed the restart check; Playwright passed 2/2. CI evidence (C-01): [run #2](https://github.com/Kawi-HBLI/NutGPUHub/actions/runs/43468965780/job/132035501311) on PR #41 (`ci/33-pr-checks` → `lab-5-staging`), commit `d1a12c7`, runner `ubuntu-24.04`, 1 min 48 s. Every step passed: migrations, seed twice, build, Vitest (40 tests in 8 files), Playwright (TC-E2E-01, TC-E2E-02), restart check (TC-PERSIST-01) and the Docker build. The job's Summary tab shows the per-file test table.

Merge gate (required check on `main`): *Pending (Lab5-6).*

## Release procedure and running commit

*Pending (Lab5-7, Lab5-8).* Release flow, rollback by image tag, and how to find the commit that is running.
