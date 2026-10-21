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
