import { PrismaClient } from '@prisma/client';
import { seedDemoAccounts } from './demo-accounts.js';
import { seedDemoMachines } from './demo-machines.js';

const password = process.env.DEMO_PASSWORD;
if (!password || password === 'replace-this-local-demo-password' || password.length < 12 || password.length > 256) {
  throw new Error('Set DEMO_PASSWORD to a private local demo password between 12 and 256 characters.');
}

const database = new PrismaClient();

try {
  const [accounts, machines] = await database.$transaction(async transaction => [
    await seedDemoAccounts(transaction, password),
    await seedDemoMachines(transaction),
  ]);
  console.log(`Prepared ${accounts} demo accounts and ${machines} GPU machines.`);
} finally {
  await database.$disconnect();
}
