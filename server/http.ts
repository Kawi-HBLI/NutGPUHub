import type { Request, RequestHandler, Response } from 'express';

export type Role = 'student' | 'operator';
export type Account = { id: number; username: string; role: Role };

export function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({ error: { code, message } });
}

export function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => { handler(request, response).catch(next); };
}

/** The account attached by requireAccount. Only call after that middleware has run. */
export function currentAccount(response: Response): Account {
  return response.locals.account as Account;
}
