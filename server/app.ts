import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import express, { type CookieOptions, type ErrorRequestHandler } from 'express';
import { asyncRoute, currentAccount, sendError } from './http.js';
import { createMachineRouter } from './machines.js';
import { createStudentRouter } from './bookings.js';
import { verifyPassword } from './password.js';
import { createSessionGuard, hashToken, readSessionToken, sessionCookie } from './session.js';

export const sessionTtlMinutes = 60;
const sessionLifetime = sessionTtlMinutes * 60_000;

export function createApp(
  database: PrismaClient,
  appOrigin: string,
  { clock = Date.now, secureCookie = appOrigin.startsWith('https:') }: {
    clock?: () => number;
    secureCookie?: boolean;
  } = {},
) {
  const app = express();
  const api = express.Router();
  const auth = express.Router();
  const guard = createSessionGuard(database, clock);
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
  };

  app.disable('x-powered-by');

  // Liveness: the process is up. Does not touch the database.
  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });

  // Readiness: the database answers. 503 lets Cloud Run checks and the smoke test see a broken connection.
  app.get('/api/ready', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      await database.$queryRaw`SELECT 1`;
      response.json({ status: 'ready', db: 'connected' });
    } catch {
      response.status(503).json({ status: 'not_ready', db: 'unavailable' });
    }
  });

  api.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.get('origin') !== appOrigin) {
      sendError(response, 403, 'INVALID_ORIGIN', 'The request origin is not allowed.');
      return;
    }
    next();
  });
  api.use(express.json({ limit: '4kb' }));

  auth.post('/login', asyncRoute(async (request, response) => {
    const { username, password } = request.body ?? {};
    if (typeof username !== 'string' || username.trim().length === 0 || username.length > 80 ||
        typeof password !== 'string' || password.length === 0 || password.length > 256) {
      sendError(response, 400, 'INVALID_CREDENTIALS_INPUT', 'Enter a username and password.');
      return;
    }

    const user = await database.user.findUnique({ where: { username: username.trim() } });
    const valid = await verifyPassword(password, user?.passwordHash);
    if (!user || !valid) {
      sendError(response, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
      return;
    }

    const token = randomBytes(32).toString('hex');
    const previousToken = readSessionToken(request);
    await database.$transaction(async (transaction) => {
      if (previousToken) await transaction.session.deleteMany({ where: { tokenHash: hashToken(previousToken) } });
      await transaction.session.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(clock() + sessionLifetime) },
      });
    });

    response.cookie(sessionCookie, token, { ...cookieOptions, maxAge: sessionLifetime });
    response.json({ id: user.id, username: user.username, role: user.role });
  }));

  auth.get('/me', guard.requireAccount, (_request, response) => {
    response.json(currentAccount(response));
  });

  auth.post('/logout', asyncRoute(async (request, response) => {
    const token = readSessionToken(request);
    if (token) await database.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    response.clearCookie(sessionCookie, cookieOptions).status(204).end();
  }));

  api.use('/auth', auth);
  api.use('/machines', createMachineRouter(database, clock, guard));
  api.use(createStudentRouter(database, clock, guard));
  api.use((_request, response) => sendError(response, 404, 'NOT_FOUND', 'The requested resource does not exist.'));

  const apiError: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      sendError(response, 400, 'INVALID_REQUEST', 'Send a valid JSON request body.');
      return;
    }
    console.error('API request failed', error.name);
    sendError(response, 500, 'INTERNAL_ERROR', 'The request could not be completed.');
  };
  api.use(apiError);
  app.use('/api/v1', api);
  return app;
}
