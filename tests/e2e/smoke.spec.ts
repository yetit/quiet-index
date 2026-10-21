// Карта действительно отрисована индексом (не пустой блок), клик по точке даёт разбивку, веса меняют оценку, состояние — в ссылке.
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const painted = (page: Page) => page.waitForFunction(() => performance.getEntriesByName('qi:painted').length > 0, null, { timeout: 60_000 });

test('карта окрашена индексом сразу при входе', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`?lang=en&v=${Date.now()}`);
  await painted(page);
  await expect(page.locator('.empty .lead')).toContainText('Click anywhere');
  await page.waitForTimeout(1000);
  const png = PNG.sync.read(await page.locator('#map').screenshot());
  const colors = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 97) colors.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
  expect(colors.size).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});

test('точка из ссылки: оценка, пять слоёв, веса меняют индекс', async ({ page }) => {
  await page.goto(`?p=43.15,19.08&lang=en&v=${Date.now()}`); // Дурмитор, Жабляк
  await painted(page);
  await expect(page.locator('.score')).toHaveText(/^\d+$/);
  await expect(page.locator('.layer-row')).toHaveCount(5);
  await expect(page.locator('.layer-row[data-layer="noise"] .l-detail')).toContainText(/road|street/);
  const noise = Number(await page.locator('.layer-row[data-layer="noise"] .l-val').textContent());
  // Только вес тишины → индекс равен оценке тишины.
  for (const k of ['dark', 'remote', 'nature', 'signal']) await page.locator(`input[data-w="${k}"]`).fill('0');
  await page.locator('input[data-w="noise"]').fill('100');
  await expect(page.locator('.score')).toHaveText(String(noise));
  expect(page.url()).toContain('w=100-0-0-0-0');
  expect(page.url()).toContain('p=43.1500,19.0800');
  // Клик по карте выбирает другую точку.
  await page.locator('#map').click({ position: { x: 300, y: 300 } });
  await expect(page.locator('.result:visible, .outside:visible')).toHaveCount(1);
  expect(page.url()).not.toContain('p=43.1500,19.0800');
});

test.describe('геолокация и офлайн', () => {
  test.use({ geolocation: { latitude: 42.9, longitude: 19.3 }, permissions: ['geolocation'] });
  test('«где я» выбирает точку; после первого визита карта открывается без сети', async ({ page, context }) => {
    await page.goto(`?lang=en&v=${Date.now()}`);
    await painted(page);
    await page.locator('.locate').click();
    await expect(page.locator('.score')).toHaveText(/^\d+$/);
    expect(page.url()).toContain('p=42.9000,19.3000');
    // Service worker регистрируется только в сборке; на dev-сервере офлайн не проверяем.
    const sw = await page.evaluate(() => navigator.serviceWorker?.getRegistration().then((r) => !!r));
    test.skip(!sw, 'dev-сервер без service worker');
    await page.waitForFunction(() => performance.getEntriesByName('qi:cached').length > 0, null, { timeout: 60_000 });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.score')).toHaveText(/^\d+$/, { timeout: 30_000 });
    await expect(page.locator('.offline-note')).toBeVisible();
    await context.setOffline(false);
  });
});

test('примеры, «тише рядом» и сравнение двух точек', async ({ page }) => {
  await page.goto(`?lang=en&v=${Date.now()}`);
  await painted(page);
  await expect(page.locator('.example')).toHaveCount(3);
  await page.locator('.example').first().click(); // Дурмитор
  await expect(page.locator('.score')).toHaveText(/^\d+$/);
  await expect(page.locator('.layer-row[data-layer="dark"] .l-detail')).toContainText('Bortle class');
  const spots = page.locator('.spots-list button');
  await expect(spots.first()).toBeVisible();
  const best = Number(await spots.first().locator('b').textContent());
  const here = Number(await page.locator('.score').textContent());
  expect(best).toBeGreaterThanOrEqual(here);
  // Сравнение: закрепить A, выбрать B из списка «тише рядом»
  await page.locator('.compare-btn').click();
  await expect(page.locator('.compare-hint')).toBeVisible();
  expect(page.url()).toContain('a=43.1500,19.0800');
  await spots.first().click();
  await expect(page.locator('.compare-table tbody tr')).toHaveCount(6);
  await expect(page.locator('.compare-table tbody tr').first().locator('td').nth(2)).toHaveText(String(best));
  await page.locator('.compare-clear').click();
  await expect(page.locator('.compare')).toBeHidden();
  expect(page.url()).not.toContain('a=');
});
