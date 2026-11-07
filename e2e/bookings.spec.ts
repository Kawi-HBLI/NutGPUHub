import { expect, test } from '@playwright/test';
import { bangkokTomorrow, createFixture, signIn } from './fixtures.js';

let fixture: Awaited<ReturnType<typeof createFixture>>;

test.beforeAll(async () => { fixture = await createFixture(); });
test.afterAll(async () => { await fixture.cleanup(); });

test('TC-E2E-01 operator opens a slot, a student books it, and both see the saved booking', async ({ browser }) => {
  const date = bangkokTomorrow();
  const code = fixture.machine.code;
  const operatorPage = await (await browser.newContext()).newPage();
  const studentPage = await (await browser.newContext()).newPage();

  // Operator opens 10:00-11:00 tomorrow on the assigned machine.
  await signIn(operatorPage, fixture.operator.username, fixture.password);
  await expect(operatorPage.getByRole('heading', { name: 'Operator workspace' })).toBeVisible();
  await operatorPage.getByLabel('Date').fill(date);
  await operatorPage.getByLabel('Start time').selectOption('10');
  await operatorPage.getByRole('button', { name: 'Open slot' }).click();
  await expect(operatorPage.getByRole('status')).toHaveText('Opened 10:00–11:00.');
  await expect(operatorPage.getByText('10:00–11:00 · Available')).toBeVisible();

  // Student finds and books it.
  await signIn(studentPage, fixture.studentA.username, fixture.password);
  await studentPage.getByLabel('Booking date (Bangkok)').fill(date);
  await studentPage.getByRole('button', { name: `Book ${code} at 10:00` }).click();
  await expect(studentPage.getByRole('status')).toHaveText('Your booking is confirmed.');

  // After a reload, My Bookings still shows the saved reservation (read back from the server).
  await studentPage.reload();
  const myBookings = studentPage.getByRole('list', { name: 'My bookings' });
  await expect(myBookings.getByRole('listitem')).toHaveCount(1);
  await expect(myBookings).toContainText(`${code} · ${date} · 10:00–11:00`);

  // Operator sees who booked the slot on the assigned machine.
  await operatorPage.reload();
  await operatorPage.getByLabel('Date').fill(date);
  await expect(operatorPage.getByText(`Booked by ${fixture.studentA.username}`)).toBeVisible();
});

test('TC-E2E-02 a student sees a conflict when the slot is taken, and cannot return after signing out', async ({ browser, playwright, baseURL }) => {
  const date = bangkokTomorrow();
  const code = fixture.machine.code;
  const slot = await fixture.database.slot.create({
    data: { machineId: fixture.machine.id, startAt: new Date(`${date}T15:00:00+07:00`) },
  });

  // Student B loads availability while the slot is still free.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, fixture.studentB.username, fixture.password);
  await page.getByLabel('Booking date (Bangkok)').fill(date);
  const bookButton = page.getByRole('button', { name: `Book ${code} at 15:00` });
  await expect(bookButton).toBeVisible();

  // Student A takes the slot through the API before B submits.
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } });
  await api.post('/api/v1/auth/login', { data: { username: fixture.studentA.username, password: fixture.password } });
  expect((await api.post('/api/v1/bookings', { data: { slotId: slot.id } })).status()).toBe(201);
  await api.dispose();

  // B submits and sees the conflict. Availability refreshes and the slot disappears.
  await bookButton.click();
  await expect(page.getByRole('alert')).toHaveText('This slot has already been booked.');
  await expect(bookButton).toHaveCount(0);
  expect(await fixture.database.booking.count({ where: { slotId: slot.id } })).toBe(1);

  // After sign-out, reopening the app shows sign-in, not My Bookings.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My bookings' })).toHaveCount(0);
});
