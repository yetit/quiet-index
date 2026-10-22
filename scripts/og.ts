// OG-картинка для шаринга: снимок страницы 1200×630 с поднятого сервера (SMOKE_URL или localhost:4327)
// → public/og.jpg. Запуск: node scripts/og.ts (сервер должен быть запущен).
import { chromium } from '@playwright/test';

const url = (process.env.SMOKE_URL ?? 'http://localhost:4327/') + '?lang=en&og=1';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForFunction(() => performance.getEntriesByName('qi:painted').length > 0, null, { timeout: 60_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 82 });
await browser.close();
console.log('public/og.jpg');
