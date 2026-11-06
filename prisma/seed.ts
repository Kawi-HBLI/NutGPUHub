import { PrismaClient } from '@prisma/client';
import { seedDemoAccounts } from './demo-accounts.js';

const password = process.env.DEMO_PASSWORD;
if (!password || password === 'replace-this-local-demo-password' || password.length < 12 || password.length > 256) {
  throw new Error('Set DEMO_PASSWORD to a private local demo password between 12 and 256 characters.');
}

const database = new PrismaClient();

try {
  const count = await database.$transaction(transaction => seedDemoAccounts(transaction, password));
  console.log(`Prepared ${count} demo accounts.`);
} finally {
  await database.$disconnect();
}
