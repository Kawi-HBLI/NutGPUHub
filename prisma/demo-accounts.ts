import type { Prisma } from '@prisma/client';
import { hashPassword } from '../server/password.js';

export const demoAccounts = [
  ['student-a', 'student'], ['student-b', 'student'], ['operator-a', 'operator'], ['operator-b', 'operator'],
] as const;

export async function seedDemoAccounts(database: Prisma.TransactionClient, password: string) {
  const records = await Promise.all(demoAccounts.map(async ([username, role]) => ({
    username, role, passwordHash: await hashPassword(password),
  })));
  const ids: number[] = [];
  for (const record of records) {
    const account = await database.user.upsert({
      where: { username: record.username },
      create: record,
      update: { role: record.role, passwordHash: record.passwordHash },
      select: { id: true },
    });
    ids.push(account.id);
  }
  await database.session.deleteMany({ where: { userId: { in: ids } } });
  return ids.length;
}
