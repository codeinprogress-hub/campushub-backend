import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Steps from e2e/scenarios/reservation.feature.
 * A booking lasts one hour. 10:00 AM is 10:00 UTC and 2:00 PM is 14:00 UTC,
 * matching the time input on the home page.
 */

function tomorrowUtcDate(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString().slice(0, 10);
}

async function resetStore(request: APIRequestContext): Promise<void> {
  const reset = await request.post('/api/v1/test/reset');
  expect(reset.status()).toBe(204);
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CampusHub' })).toBeVisible();
}

test('Student successfully reserves an available study room', async ({ page, request }) => {
  const date = tomorrowUtcDate();
  await resetStore(request);
  await openHome(page);

  await page.getByLabel('Resource type').selectOption('ROOM');
  await page.getByRole('button', { name: 'Study Room 302' }).click();
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('Start time').fill('10:00');
  await page.getByRole('button', { name: 'Reserve' }).click();

  await expect(page.getByText('Reservation Confirmed')).toBeVisible();
  const bookings = page.getByRole('region', { name: 'My Bookings' });
  await expect(bookings.getByText('Study Room 302')).toBeVisible();
  await expect(bookings.getByText('10:00 AM')).toBeVisible();
});

test('Student receives conflict alert on double-booking', async ({ page, request }) => {
  const date = tomorrowUtcDate();
  await resetStore(request);

  const seeded = await request.post('/api/v1/reservations', {
    data: {
      resourceId: 'res-102',
      userId: 'user-seed',
      startTime: `${date}T14:00:00.000Z`,
      endTime: `${date}T15:00:00.000Z`,
    },
  });
  expect(seeded.status()).toBe(201);

  await openHome(page);
  await page.getByLabel('Student ID').fill('user-789');
  await page.getByLabel('Resource type').selectOption('EQUIPMENT');
  await page.getByRole('button', { name: '3D Printer A' }).click();
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('Start time').fill('14:00');
  await page.getByRole('button', { name: 'Reserve' }).click();

  await expect(page.getByRole('alert')).toHaveText('Resource unavailable for selected time');
  const bookings = page.getByRole('region', { name: 'My Bookings' });
  await expect(bookings.getByText('3D Printer A')).toHaveCount(0);

  const mine = await request.get('/api/v1/reservations/user/user-789');
  expect(mine.status()).toBe(200);
  expect(await mine.json()).toEqual([]);
});
