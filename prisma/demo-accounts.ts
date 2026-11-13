import type { Prisma } from '@prisma/client';
import { hashPassword, verifyPassword } from '../server/password.js';

export const demoAccounts = [
  ['student-a', 'student'], ['student-b', 'student'], ['operator-a', 'operator'], ['operator-b', 'operator'],
] as const;

/**
 * Creates the demo accounts, or updates one whose role or password no longer matches.
 * Sessions end only for accounts that changed, so rerunning the seed on every release
 * (the Cloud Run migration job) keeps signed-in users signed in.
 */
export async function seedDemoAccounts(database: Prisma.TransactionClient, password: string) {
  let prepared = 0;
  for (const [username, role] of demoAccounts) {
    const existing = await database.user.findUnique({ where: { username }, select: { role: true, passwordHash: true } });
    if (existing && existing.role === role && await verifyPassword(password, existing.passwordHash)) {
      prepared += 1;
      continue;
    }
    const passwordHash = await hashPassword(password);
    const account = await database.user.upsert({
      where: { username },
      create: { username, role, passwordHash },
      update: { role, passwordHash },
      select: { id: true },
    });
    await database.session.deleteMany({ where: { userId: account.id } });
    prepared += 1;
  }
  return prepared;
}
