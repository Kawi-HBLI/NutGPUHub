import { expect, test } from '@playwright/test';
import { bangkokTomorrow, createFixture, signIn } from './fixtures.js';

let fixture: Awaited<ReturnType<typeof createFixture>>;

test.beforeAll(async () => { fixture = await createFixture(); });
test.afterAll(async () => { await fixture.cleanup(); });

// F-07 (#14), AC-37 and AC-38.
test('TC-E2E-07 an operator closes a slot and students no longer see it', async ({ browser }) => {
  const date = bangkokTomorrow();
  const code = fixture.machine.code;
  await fixture.database.slot.create({ data: { machineId: fixture.machine.id, startAt: new Date(`${date}T12:00:00+07:00`) } });

  const operator = await (await browser.newContext()).newPage();
  await signIn(operator, fixture.operator.username, fixture.password);
  await operator.getByLabel('Date').fill(date);
  const schedule = operator.getByRole('table', { name: `Slots and reservations for ${date}` });
  await expect(schedule.getByText('12:00–13:00')).toBeVisible();

  // Close asks for confirmation first.
  await schedule.getByRole('button', { name: 'Close 12:00' }).click();
  await expect(schedule.getByText('Closed', { exact: true })).toHaveCount(0);
  await schedule.getByRole('button', { name: 'Confirm close' }).click();
  await expect(operator.getByRole('status')).toHaveText('Slot closed.');
  await expect(schedule.getByText('Closed', { exact: true })).toBeVisible();
  await expect(schedule.getByRole('button', { name: 'Close 12:00' })).toHaveCount(0);

  // The student's availability for that date no longer lists the slot.
  const student = await (await browser.newContext()).newPage();
  await signIn(student, fixture.studentA.username, fixture.password);
  await student.getByLabel('Booking date (Bangkok)').fill(date);
  await expect(student.getByText('No available slots on this date.')).toBeVisible();
  await expect(student.getByRole('button', { name: `Book ${code} at 12:00` })).toHaveCount(0);
});
