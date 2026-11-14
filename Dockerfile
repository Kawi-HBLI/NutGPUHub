# NutGPUHub production image (Lab 5).
# One image serves the built React UI and the Express API on $PORT, and the same image
# runs `prisma migrate deploy` + the seed as a separate job (Docker Compose `migrate`,
# Cloud Run job later). Build from the repository root: docker build -t nutgpuhub .
#
# No secret is baked in: DATABASE_URL and DEMO_PASSWORD are supplied at run time.
# Adapted from the Lab 5 starter kit: NutGPUHub is one npm package, so there is one
# build stage instead of separate client and server stages, and no nginx.

# Debian (glibc) rather than Alpine: argon2 installs its prebuilt glibc binary and
# Prisma finds OpenSSL 3 without extra binary targets.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Dependencies first, so this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev --no-audit --no-fund \
  && npx prisma generate

FROM node:24-bookworm-slim AS production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Runtime files only: compiled server and UI, Prisma schema and migrations, the seed
# (run with tsx) and the one server module it imports, and production node_modules.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/server/password.ts ./server/password.ts

USER node
EXPOSE 3000

# node is PID 1, so it receives SIGTERM from Docker and Cloud Run directly.
CMD ["node", "dist/server/index.js"]
