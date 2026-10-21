// Манифест PWA: пути зависят от base (GitHub Pages — подпапка), поэтому генерируется при сборке.
import type { APIRoute } from 'astro';

const base = import.meta.env.BASE_URL;
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: 'Quiet Index',
      short_name: 'Quiet Index',
      description: 'How quiet, dark and remote is any point — open data, computed in the browser',
      start_url: base,
      scope: base,
      display: 'standalone',
      background_color: '#fbfaf7',
      theme_color: '#fbfaf7',
      icons: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
