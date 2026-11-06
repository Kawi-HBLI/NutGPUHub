import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import express, { type CookieOptions, type ErrorRequestHandler, type Request, type RequestHandler } from 'express';
import { verifyPassword } from './password.js';

const sessionCookie = 'nutgpuhub_session';
export const sessionTtlMinutes = 60;
const sessionLifetime = sessionTtlMinutes * 60_000;
const accountFields = { id: true, username: true, role: true } as const;

function readSessionToken(request: Request): string | undefined {
  for (const cookie of request.get('cookie')?.split(';') ?? []) {
    const prefix = `${sessionCookie}=`;
    const entry = cookie.trim();
    const value = entry.slice(prefix.length);
    if (entry.startsWith(prefix) && /^[a-f0-9]{64}$/.test(value)) return value;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function asyncRoute(handler: (request: Request, response: express.Response) => Promise<void>): RequestHandler {
  return (request, response, next) => { handler(request, response).catch(next); };
}

export function createApp(
  database: PrismaClient,
  appOrigin: string,
  { clock = Date.now, secureCookie = appOrigin.startsWith('https:') }: {
    clock?: () => number;
    secureCookie?: boolean;
  } = {},
) {
  const app = express();
  const auth = express.Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
  };

  app.disable('x-powered-by');
  auth.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'POST' && request.get('origin') !== appOrigin) {
      response.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'The request origin is not allowed.' } });
      return;
    }
    next();
  });
  auth.use(express.json({ limit: '4kb' }));

  auth.post('/login', asyncRoute(async (request, response) => {
    const { username, password } = request.body ?? {};
    if (typeof username !== 'string' || username.trim().length === 0 || username.length > 80 ||
        typeof password !== 'string' || password.length === 0 || password.length > 256) {
      response.status(400).json({ error: { code: 'INVALID_CREDENTIALS_INPUT', message: 'Enter a username and password.' } });
      return;
    }

    const user = await database.user.findUnique({ where: { username: username.trim() } });
    const valid = await verifyPassword(password, user?.passwordHash);
    if (!user || !valid) {
      response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
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

  auth.get('/me', asyncRoute(async (request, response) => {
    const token = readSessionToken(request);
    const session = token && await database.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { expiresAt: true, user: { select: accountFields } },
    });

    if (!session || session.expiresAt.getTime() <= clock()) {
      response.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
      return;
    }
    response.json(session.user);
  }));

  auth.post('/logout', asyncRoute(async (request, response) => {
    const token = readSessionToken(request);
    if (token) await database.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    response.clearCookie(sessionCookie, cookieOptions).status(204).end();
  }));

  const authError: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Send a valid sign-in request.' } });
      return;
    }
    console.error('Authentication request failed', error.name);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
  };
  auth.use(authError);
  app.use('/api/v1/auth', auth);
  return app;
}
