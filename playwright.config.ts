// Smoke-тест карты. SMOKE_URL — адрес уже поднятого сервера (dev или опубликованное демо);
// без него Playwright сам собирает проект и поднимает astro preview на 4327 (если порт занят dev-сервером — использует его).
import { defineConfig } from '@playwright/test';

const url = process.env.SMOKE_URL;
const local = 'http://localhost:4327/';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: url ?? local,
    viewport: { width: 1280, height: 800 },
    // WebGL в headless-браузере без GPU — через SwiftShader.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: url ? undefined : {
    // --ignore-lock: Astro 7 под агентом уводит preview в фон (демон), Playwright считал бы сервер завершившимся.
    command: 'npm run build && npx astro preview --port 4327 --ignore-lock',
    url: local,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
