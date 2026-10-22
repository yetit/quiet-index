import { defineConfig } from 'astro/config';

// BASE_PATH задаёт CI для GitHub Pages (/<repo>); локально — корень.
export default defineConfig({
  site: process.env.SITE,
  base: (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/'),
  server: { port: 4327 },
  devToolbar: { enabled: false },
  vite: {
    // Идентификатор сборки: имя кэша service worker и версия данных в URL — после деплоя старый кэш не подсовывает
    // растр прежнего формата.
    define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
    optimizeDeps: { include: ['maplibre-gl'] },
    build: { chunkSizeWarningLimit: 1200 }, // бандл MapLibre ~1 МБ
  },
});
