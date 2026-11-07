import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { currentAccount, sendError, type Account, type Role } from './http.js';

export const sessionCookie = 'nutgpuhub_session';
const accountFields = { id: true, username: true, role: true } as const;

export function readSessionToken(request: Request): string | undefined {
  for (const cookie of request.get('cookie')?.split(';') ?? []) {
    const prefix = `${sessionCookie}=`;
    const entry = cookie.trim();
    const value = entry.slice(prefix.length);
    if (entry.startsWith(prefix) && /^[a-f0-9]{64}$/.test(value)) return value;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Session checks shared by every protected route (BR-02, NFR-01, NFR-03). */
export function createSessionGuard(database: PrismaClient, clock: () => number) {
  async function findAccount(request: Request): Promise<Account | null> {
    const token = readSessionToken(request);
    if (!token) return null;
    const session = await database.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { expiresAt: true, user: { select: accountFields } },
    });
    if (!session || session.expiresAt.getTime() <= clock()) return null;
    return session.user;
  }

  /** Rejects with 401 unless the request has a valid, unexpired session. */
  const requireAccount: RequestHandler = (request, response, next) => {
    findAccount(request).then((account) => {
      if (!account) {
        sendError(response, 401, 'AUTH_REQUIRED', 'Sign in to continue.');
        return;
      }
      response.locals.account = account;
      next();
    }, next);
  };

  /** Rejects with 403 unless the signed-in account has the given role. Use after requireAccount. */
  function requireRole(role: Role): RequestHandler {
    return (_request, response, next) => {
      if (currentAccount(response).role !== role) {
        sendError(response, 403, 'FORBIDDEN', 'Your account cannot perform this operation.');
        return;
      }
      next();
    };
  }

  return { requireAccount, requireRole };
}
