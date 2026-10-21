// Мобильный лист: панель внизу в двух состояниях — свёрнута (видна оценка) и раскрыта. На десктопе не используется.
import { $ } from '../app.ts';

export function setSheet(open: boolean) {
  document.body.dataset.sheet = open ? 'full' : 'peek';
  $('.sheet-handle').setAttribute('aria-expanded', String(open));
}

export function initSheet() {
  setSheet(false);
  $('.sheet-handle').addEventListener('click', () => setSheet(document.body.dataset.sheet !== 'full'));
}
