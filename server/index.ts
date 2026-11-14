import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { createApp, sessionTtlMinutes } from './app.js';

const port = Number(process.env.PORT || 3000);
const appUrl = new URL(process.env.APP_ORIGIN || process.env.PUBLIC_ORIGIN || 'http://localhost:5173');
if (!['http:', 'https:'].includes(appUrl.protocol)) throw new Error('APP_ORIGIN must use HTTP or HTTPS.');
const configuredTtl = process.env.SESSION_TTL_MINUTES;
if (configuredTtl !== undefined && configuredTtl !== String(sessionTtlMinutes)) {
  throw new Error('SESSION_TTL_MINUTES must be 60 for Sprint 1.');
}
const cookieSecure = process.env.COOKIE_SECURE;
if (cookieSecure !== undefined && cookieSecure !== 'true' && cookieSecure !== 'false') {
  throw new Error('COOKIE_SECURE must be true or false.');
}

const database = new PrismaClient();
const app = createApp(database, appUrl.origin, {
  secureCookie: appUrl.protocol === 'https:' || cookieSecure === 'true',
  commit: process.env.APP_COMMIT,
});
app.use(express.static(resolve('dist/client')));
await database.$connect();

app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`NutGPUHub API listening on port ${port}`);
});
