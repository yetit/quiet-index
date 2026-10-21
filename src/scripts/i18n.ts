// Строки интерфейса. Язык: ?lang=ru|en, иначе по navigator.language.
const q = typeof location === 'undefined' ? null : new URL(location.href).searchParams.get('lang');
export const lang: 'ru' | 'en' = q === 'en' || q === 'ru' ? q : globalThis.navigator?.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
if (typeof document !== 'undefined') document.documentElement.lang = lang;

const num = (x: number, d = 0) => x.toLocaleString(lang, { maximumFractionDigits: d, minimumFractionDigits: d });
// Расстояние: до 1 км — метры, дальше — километры; у потолка кодирования — «> N км».
const dist = (m: number, cap: number) => (m >= cap ? `> ${num(cap / 1000)} ${lang === 'ru' ? 'км' : 'km'}` : m < 1000 ? `${num(m)} ${lang === 'ru' ? 'м' : 'm'}` : `${num(m / 1000, 1)} ${lang === 'ru' ? 'км' : 'km'}`);

const ru = {
  tagline: 'Где тихо, темно и безлюдно — карта по открытым данным',
  lead: 'Кликните любую точку: покажем, насколько там тихо, темно и далеко от людей, и из чего сложилась оценка.',
  loading: 'Загружаем сетку…',
  loadError: 'Не удалось загрузить данные. Обновите страницу.',
  searchPh: 'Найти место',
  nothing: 'Ничего не найдено',
  locate: 'Где я',
  geoError: 'Геолокация недоступна или запрещена',
  offline: 'Офлайн: карта и данные из кэша, поиск недоступен',
  views: { index: 'Индекс', noise: 'Тишина', dark: 'Темнота', remote: 'Безлюдье', nature: 'Природа', signal: 'Связь' },
  hints: {
    noise: 'Расстояние до дорог и улиц по классам OSM, железной дороги и аэропорта',
    dark: 'Ночной свет VIIRS (NASA Black Marble), медиана за год',
    remote: 'Плотность населения WorldPop в 2×2 км и расстояние до ближайшего здания OSM',
    nature: 'Доля леса, воды и открытых естественных земель в 2×2 км (ESA WorldCover)',
    signal: 'Расстояние до вышки связи, отмеченной в OSM — данные неполные',
  },
  verdict: (v: number): string => (v >= 80 ? 'очень тихо' : v >= 60 ? 'тихо' : v >= 40 ? 'так себе' : 'шумно и людно'),
  of100: 'из 100',
  outside: 'Вне региона расчёта или вода — здесь ничего не считаем.',
  weights: 'Веса',
  weightsNote: 'Индекс — среднее пяти оценок с этими весами. «Связь» по умолчанию не учитывается: поднимите вес, если нужен интернет.',
  reset: 'Сбросить',
  road: { motorway: 'автомагистраль', trunk: 'скоростная', primary: 'главная', secondary: 'второстепенная', tertiary: 'местная дорога', local: 'улица или проезд' },
  noRoad: 'дорог и улиц рядом нет',
  roadAt: (m: number, cls: string, cap: number) => `${cls} в ${dist(m, cap)}`,
  railAt: (m: number, cap: number) => `ж/д ${dist(m, cap)}`,
  airAt: (m: number, cap: number) => `аэропорт ${dist(m, cap)}`,
  light: (r: number) => `${num(r, 2)} нВт/(см²·ср) ночью`,
  remote: (pop: number, bld: number, cap: number) => `≈${num(pop)} чел/км², ближайший дом ${dist(bld, cap)}`,
  nature: (f: number, w: number, o: number) => `лес ${f} %, вода ${w} %, открытое ${o} %`,
  tower: (m: number, cap: number) => `вышка в OSM ${dist(m, cap)}`,
  copyLink: 'Скопировать ссылку',
  copied: 'Ссылка скопирована',
  examples: 'Примеры',
  spots: 'Тише рядом',
  spotsNone: 'В этом радиусе тише нет',
  radius: (km: number) => `${km} км`,
  dirs: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
  away: (m: number, dir: string) => `${m < 1000 ? `${Math.round(m)} м` : `${(m / 1000).toLocaleString('ru', { maximumFractionDigits: 1 })} км`} на ${dir}`,
  bortle: (n: number) => `≈ класс Бортля ${n}`,
  compareBtn: 'Сравнить с другой точкой',
  compareHint: 'Теперь кликните вторую точку на карте',
  compareTitle: 'Сравнение',
  compareClear: 'Убрать сравнение',
  indexName: 'Индекс',
  legendLow: 'шумно · светло · людно',
  legendHigh: 'тихо · темно · безлюдно',
  legendLayer: { noise: ['шумно', 'тихо'], dark: ['светло', 'темно'], remote: ['людно', 'безлюдно'], nature: ['освоено', 'дико'], signal: ['нет связи', 'связь есть'] } as Record<string, [string, string]>,
  aboutTitle: 'Как считается и откуда данные',
  about: 'Каждая клетка ~250 м получает пять оценок 0–100, индекс — их взвешенное среднее. Пороги эвристические и описаны в README. Данные: OpenStreetMap (ODbL), NASA Black Marble VNP46A2 через GIBS, WorldPop 2020 (CC BY 4.0), ESA WorldCover 2021 (CC BY 4.0). Расчёт — в браузере, без сервера.',
  expand: 'Развернуть панель',
  mapAria: 'Карта индекса тихого места',
  region: 'Регион',
};
const en: typeof ru = {
  tagline: 'Where it is quiet, dark and empty — a map from open data',
  lead: 'Click anywhere: we show how quiet, dark and far from people it is, and what the score is made of.',
  loading: 'Loading the grid…',
  loadError: 'Could not load the data. Reload the page.',
  searchPh: 'Find a place',
  nothing: 'Nothing found',
  locate: 'Where am I',
  geoError: 'Geolocation unavailable or denied',
  offline: 'Offline: map and data from cache, search unavailable',
  views: { index: 'Index', noise: 'Quiet', dark: 'Dark', remote: 'Remote', nature: 'Nature', signal: 'Signal' },
  hints: {
    noise: 'Distance to roads and streets by OSM class, railways and airports',
    dark: 'VIIRS night lights (NASA Black Marble), annual median',
    remote: 'WorldPop population density in 2×2 km and distance to the nearest OSM building',
    nature: 'Share of forest, water and open natural land in 2×2 km (ESA WorldCover)',
    signal: 'Distance to a cell tower mapped in OSM — incomplete data',
  },
  verdict: (v) => (v >= 80 ? 'very quiet' : v >= 60 ? 'quiet' : v >= 40 ? 'so-so' : 'noisy and busy'),
  of100: 'of 100',
  outside: 'Outside the computed region or water — nothing to score here.',
  weights: 'Weights',
  weightsNote: 'The index is the mean of five scores with these weights. “Signal” is off by default: raise it if you need internet.',
  reset: 'Reset',
  road: { motorway: 'motorway', trunk: 'trunk road', primary: 'primary road', secondary: 'secondary road', tertiary: 'tertiary road', local: 'residential street' },
  noRoad: 'no road or street nearby',
  roadAt: (m, cls, cap) => `${cls} ${dist(m, cap)} away`,
  railAt: (m, cap) => `railway ${dist(m, cap)}`,
  airAt: (m, cap) => `airport ${dist(m, cap)}`,
  light: (r) => `${num(r, 2)} nW/(cm²·sr) at night`,
  remote: (pop, bld, cap) => `≈${num(pop)} people/km², nearest building ${dist(bld, cap)}`,
  nature: (f, w, o) => `forest ${f} %, water ${w} %, open ${o} %`,
  tower: (m, cap) => `OSM tower ${dist(m, cap)}`,
  copyLink: 'Copy link',
  copied: 'Link copied',
  examples: 'Examples',
  spots: 'Quieter nearby',
  spotsNone: 'Nothing quieter within this radius',
  radius: (km) => `${km} km`,
  dirs: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  away: (m, dir) => `${m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`} ${dir}`,
  bortle: (n) => `≈ Bortle class ${n}`,
  compareBtn: 'Compare with another point',
  compareHint: 'Now click the second point on the map',
  compareTitle: 'Comparison',
  compareClear: 'Remove comparison',
  indexName: 'Index',
  legendLow: 'noisy · bright · busy',
  legendHigh: 'quiet · dark · empty',
  legendLayer: { noise: ['noisy', 'quiet'], dark: ['bright', 'dark'], remote: ['busy', 'empty'], nature: ['developed', 'wild'], signal: ['no signal', 'signal'] },
  aboutTitle: 'How it is computed and where the data is from',
  about: 'Each ~250 m cell gets five 0–100 scores; the index is their weighted mean. Thresholds are heuristics described in the README. Data: OpenStreetMap (ODbL), NASA Black Marble VNP46A2 via GIBS, WorldPop 2020 (CC BY 4.0), ESA WorldCover 2021 (CC BY 4.0). Computed in the browser, no server.',
  expand: 'Expand panel',
  mapAria: 'Quiet Index map',
  region: 'Region',
};
export const t = lang === 'ru' ? ru : en;
export const T = (s: Record<'ru' | 'en', string>) => s[lang];

// Заполняет data-i (текст), data-i-ph (placeholder), data-i-aria, data-i-title.
export function translate(root: ParentNode = document) {
  const pick = (k: string) => (t as unknown as Record<string, unknown>)[k] as string;
  root.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => (el.textContent = pick(el.dataset.i!)));
  root.querySelectorAll<HTMLInputElement>('[data-i-ph]').forEach((el) => (el.placeholder = pick(el.dataset.iPh!)));
  root.querySelectorAll<HTMLElement>('[data-i-aria]').forEach((el) => el.setAttribute('aria-label', pick(el.dataset.iAria!)));
  root.querySelectorAll<HTMLElement>('[data-i-title]').forEach((el) => (el.title = pick(el.dataset.iTitle!)));
}
