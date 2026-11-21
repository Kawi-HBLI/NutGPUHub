import { expect, test } from '@playwright/test';
import { bangkokTomorrow, createFixture, signIn } from './fixtures.js';

let fixture: Awaited<ReturnType<typeof createFixture>>;

test.beforeAll(async () => { fixture = await createFixture(); });
test.afterAll(async () => { await fixture.cleanup(); });

// Issue #60, UAT finding NF-01: clearing the operator date must not leave the old day's slots on screen.
test('TC-E2E-03 operator schedule asks for a date and shows no slots after the date is cleared', async ({ page }) => {
  const date = bangkokTomorrow();
  await fixture.database.slot.create({
    data: { machineId: fixture.machine.id, startAt: new Date(`${date}T11:00:00+07:00`) },
  });

  await signIn(page, fixture.operator.username, fixture.password);
  await page.getByLabel('Date').fill(date);
  await expect(page.getByText('11:00–12:00 · Available')).toBeVisible();

  await page.getByLabel('Date').fill('');

  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
  await expect(page.getByText('Choose a date to see the schedule.')).toBeVisible();
  await expect(page.getByText('11:00–12:00 · Available')).toHaveCount(0);
});

// Issue #60, UAT finding NF-02: an empty booking date must not be sent, and no useless retry is offered.
test('TC-E2E-04 student availability asks for a date and sends no request while the date is empty', async ({ page }) => {
  await signIn(page, fixture.studentA.username, fixture.password);
  // Wait until today's availability has loaded (an empty list renders with no height, so check the loading text).
  await expect(page.getByText('Loading available slots…')).toHaveCount(0);

  const emptyDateRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/slots' && !url.searchParams.get('date')) emptyDateRequests.push(request.url());
  });

  await page.getByLabel('Booking date (Bangkok)').fill('');

  await expect(page.getByText('Choose a date to see available slots.')).toBeVisible();
  await expect(page.getByText('Choose a date in YYYY-MM-DD format.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  expect(emptyDateRequests).toEqual([]);
});
