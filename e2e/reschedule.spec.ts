import { expect, test } from '@playwright/test';
import { bangkokTomorrow, createFixture, signIn } from './fixtures.js';

let fixture: Awaited<ReturnType<typeof createFixture>>;

test.beforeAll(async () => { fixture = await createFixture(); });
test.afterAll(async () => { await fixture.cleanup(); });

/** The Bangkok calendar date one day after `date` (YYYY-MM-DD). */
function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 3_600_000).toISOString().slice(0, 10);
}

test('TC-E2E-06 a student moves a booking to a slot on another date (AC-30)', async ({ page }) => {
  const date = bangkokTomorrow();
  const later = nextDay(date);
  const code = fixture.machine.code;
  await fixture.database.slot.create({ data: { machineId: fixture.machine.id, startAt: new Date(`${date}T11:00:00+07:00`) } });
  await fixture.database.slot.create({ data: { machineId: fixture.machine.id, startAt: new Date(`${later}T13:00:00+07:00`) } });

  await signIn(page, fixture.studentA.username, fixture.password);
  await page.getByLabel('Booking date (Bangkok)').fill(date);
  await page.getByRole('button', { name: `Book ${code} at 11:00` }).click();
  await expect(page.getByRole('status')).toHaveText('Your booking is confirmed.');

  // Move starts from My Bookings, then the student picks another date and slot and confirms.
  await page.getByRole('list', { name: 'My bookings' }).getByRole('button', { name: `Move ${code} on ${date} at 11:00` }).click();
  await page.getByLabel('Booking date (Bangkok)').fill(later);
  await page.getByRole('button', { name: `Move to ${code} at 13:00` }).click();
  await page.getByRole('button', { name: 'Confirm move' }).click();
  await expect(page.getByRole('region', { name: 'Available slots' }).getByRole('status')).toHaveText('Your booking was moved.');

  // After a reload: the replacement is confirmed, the original is Rescheduled with a link to it.
  await page.reload();
  const entries = page.getByRole('list', { name: 'My bookings' }).getByRole('listitem');
  await expect(entries).toHaveCount(2);
  const original = entries.filter({ hasText: 'Rescheduled' });
  await expect(original).toHaveCount(1);
  const replacement = entries.filter({ hasText: 'Confirmed' });
  await expect(replacement).toHaveCount(1);
  await expect(replacement).toContainText('13:00');
  await expect(original.getByRole('button', { name: /^(Move|Cancel) / })).toHaveCount(0);
  await original.getByRole('link', { name: /^New booking #\d+$/ }).click();
  await expect(page.getByRole('heading', { name: /^Saved booking #\d+$/ })).toBeVisible();
  await expect(page.locator('.booking-detail')).toContainText('Confirmed');
  await expect(page.locator('.booking-detail')).toContainText('13:00');
});
