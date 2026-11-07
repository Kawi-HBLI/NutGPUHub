import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, type Page } from '@playwright/test';
import { hashPassword } from '../server/password.js';

/** Test accounts and a GPU machine created in the test database for one spec file. */
export async function createFixture() {
  const database = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const password = randomBytes(12).toString('hex');
  const passwordHash = await hashPassword(password);
  const create = (prefix: string, role: 'student' | 'operator') =>
    database.user.create({ data: { username: `${prefix}-${suffix}`, passwordHash, role } });
  const operator = await create('e2e-operator', 'operator');
  const studentA = await create('e2e-student-a', 'student');
  const studentB = await create('e2e-student-b', 'student');
  const machine = await database.gpuMachine.create({ data: { code: `E2E-${suffix}`, operatorId: operator.id } });
  const userIds = [operator.id, studentA.id, studentB.id];

  return {
    database, password, operator, studentA, studentB, machine,
    async cleanup() {
      try {
        await database.booking.deleteMany({ where: { studentId: { in: userIds } } });
        await database.gpuMachine.deleteMany({ where: { id: machine.id } });
        await database.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await database.$disconnect();
      }
    },
  };
}

/** Tomorrow's calendar date in Bangkok as YYYY-MM-DD, so the slot is always in the future. */
export function bangkokTomorrow() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(Date.now() + 24 * 3_600_000));
}

export async function signIn(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
}
