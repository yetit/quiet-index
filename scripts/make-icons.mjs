// Иконки PWA: зелёный квадрат с белой точкой (как favicon), 192 и 512 px → public/icons/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  const png = new PNG({ width: size, height: size });
  const c = size / 2, r = size * 0.19;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, dot = Math.hypot(x - c + 0.5, y - c + 0.5) < r;
    [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]] = dot ? [251, 250, 247, 255] : [47, 138, 114, 255];
  }
  writeFileSync(`public/icons/icon-${size}.png`, PNG.sync.write(png));
}
