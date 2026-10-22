// Загрузка больших файлов с повторами и докачкой по Range: WorldPop и Geofabrik иногда рвут соединение
// (ECONNRESET) на десятках мегабайт. fetchRetry — для мелких запросов (тайлы GIBS), download — для файлов.
import { createWriteStream, existsSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchRetry(url, tries = 5, init) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return res;
      err = new Error(`${res.status} ${url}`);
    } catch (e) { err = e; }
    await sleep(2000 * 2 ** i);
  }
  throw err;
}

export async function download(url, file, tries = 6) {
  const part = `${file}.part`;
  let err;
  for (let i = 0; i < tries; i++) {
    const have = existsSync(part) ? statSync(part).size : 0;
    try {
      const res = await fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {} });
      if (res.status === 416) break; // уже всё скачано
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const resume = res.status === 206;
      if (have && !resume) unlinkSync(part); // сервер не умеет Range — с начала
      await pipeline(Readable.fromWeb(res.body), createWriteStream(part, { flags: resume ? 'a' : 'w' }));
      renameSync(part, file);
      return;
    } catch (e) {
      err = e;
      console.warn(`${url}: ${e.cause?.code ?? e.message}, повтор ${i + 1}/${tries}`);
      await sleep(3000 * 2 ** i);
    }
  }
  if (existsSync(part)) { renameSync(part, file); return; }
  throw err;
}
