import { expect, test } from '@playwright/test';
import { bangkokTomorrow, createFixture, signIn } from './fixtures.js';

let fixture: Awaited<ReturnType<typeof createFixture>>;

test.beforeAll(async () => { fixture = await createFixture(); });
test.afterAll(async () => { await fixture.cleanup(); });

test('TC-E2E-05 a student cancels a booking from My Bookings and another student books the released slot', async ({ browser }) => {
  const date = bangkokTomorrow();
  const code = fixture.machine.code;
  await fixture.database.slot.create({ data: { machineId: fixture.machine.id, startAt: new Date(`${date}T11:00:00+07:00`) } });

  // Student A books 11:00 tomorrow.
  const pageA = await (await browser.newContext()).newPage();
  await signIn(pageA, fixture.studentA.username, fixture.password);
  await pageA.getByLabel('Booking date (Bangkok)').fill(date);
  await pageA.getByRole('button', { name: `Book ${code} at 11:00` }).click();
  await expect(pageA.getByRole('status')).toHaveText('Your booking is confirmed.');

  // A cancels it from My Bookings, with a confirmation step (AC-24).
  const myBookings = pageA.getByRole('list', { name: 'My bookings' });
  await myBookings.getByRole('button', { name: `Cancel ${code} on ${date} at 11:00` }).click();
  await expect(myBookings.getByText('Cancelled', { exact: true })).toHaveCount(0);
  await myBookings.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(pageA.getByRole('region', { name: 'My bookings' }).getByRole('status')).toHaveText('Booking cancelled.');

  // After a reload the entry is still listed, now as cancelled with its time, and has no Cancel action.
  await pageA.reload();
  const entry = pageA.getByRole('list', { name: 'My bookings' }).getByRole('listitem');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('Cancelled');
  await expect(entry).toContainText(/Cancelled at \d{2}:\d{2}/);
  await expect(entry.getByRole('button', { name: /^Cancel / })).toHaveCount(0);

  // Student B finds the released slot and books it (AC-27).
  const pageB = await (await browser.newContext()).newPage();
  await signIn(pageB, fixture.studentB.username, fixture.password);
  await pageB.getByLabel('Booking date (Bangkok)').fill(date);
  await pageB.getByRole('button', { name: `Book ${code} at 11:00` }).click();
  await expect(pageB.getByRole('status')).toHaveText('Your booking is confirmed.');
});
