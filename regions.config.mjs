// Регионы расчёта. Сетка ~cell м в Web Mercator (см. src/core/grid.ts), данные — data/<id>/raw (сырые, не в git)
// и public/data/<id>/{scores,grid}.gz (продукт). Новый регион: добавить запись и выполнить `npm run fetch -- <id>`.
// geofabrik — путь выгрузки OSM (download.geofabrik.de/<путь>-latest.osm.pbf), boundary — relation границы
// по id или по тегу ISO3166-1 (страна); bbox должен целиком вмещать границу.
export const regions = [
  {
    id: 'montenegro',
    name: { ru: 'Черногория', en: 'Montenegro' },
    bbox: { west: 18.4, south: 41.8, east: 20.4, north: 43.6 },
    cell: 250, // м
    geofabrik: ['europe/montenegro', 'europe/albania', 'europe/bosnia-herzegovina', 'europe/serbia', 'europe/kosovo', 'europe/croatia'],
    boundary: { iso: 'ME' },
    worldpop: 'MNE', // код страны в WorldPop
    examples: [
      { name: { ru: 'Дурмитор, у Жабляка', en: 'Durmitor near Žabljak' }, p: [19.08, 43.15] },
      { name: { ru: 'Пивское озеро у Плужине', en: 'Piva lake near Plužine' }, p: [18.84, 43.16] },
      { name: { ru: 'Будва, набережная', en: 'Budva seafront' }, p: [18.84, 42.2865] },
    ],
  },
  {
    // Сплитско-Далматинская жупания: второй регион и сверка с картами шума END (EEA покрывает Хорватию).
    id: 'dalmatia',
    name: { ru: 'Далмация (Сплит)', en: 'Dalmatia (Split)' },
    bbox: { west: 15.9, south: 42.9, east: 17.8, north: 43.95 },
    cell: 250,
    geofabrik: ['europe/croatia', 'europe/bosnia-herzegovina'],
    boundary: { relation: 226749 },
    worldpop: 'HRV',
    examples: [
      { name: { ru: 'Биоково, над Макарской', en: 'Biokovo above Makarska' }, p: [17.05, 43.33] },
      { name: { ru: 'Остров Вис, юг', en: 'Vis island, south coast' }, p: [16.15, 43.02] },
      { name: { ru: 'Сплит, Рива', en: 'Split, the Riva' }, p: [16.44, 43.508] },
    ],
  },
  {
    id: 'albania',
    name: { ru: 'Албания', en: 'Albania' },
    bbox: { west: 19.2, south: 39.6, east: 21.1, north: 42.7 },
    cell: 250,
    geofabrik: ['europe/albania', 'europe/montenegro', 'europe/kosovo', 'europe/macedonia', 'europe/greece'],
    boundary: { iso: 'AL' },
    worldpop: 'ALB',
    examples: [
      { name: { ru: 'Тет, Проклетие', en: 'Theth, Accursed Mountains' }, p: [19.77, 42.39] },
      { name: { ru: 'Ксамил, пляж', en: 'Ksamil beach' }, p: [20.0, 39.77] },
      { name: { ru: 'Тирана, центр', en: 'Tirana centre' }, p: [19.82, 41.33] },
    ],
  },
  {
    id: 'bosnia',
    name: { ru: 'Босния и Герцеговина', en: 'Bosnia and Herzegovina' },
    bbox: { west: 15.7, south: 42.5, east: 19.7, north: 45.3 },
    cell: 250,
    geofabrik: ['europe/bosnia-herzegovina', 'europe/croatia', 'europe/serbia', 'europe/montenegro'],
    boundary: { iso: 'BA' },
    worldpop: 'BIH',
    examples: [
      { name: { ru: 'Сутьеска, Тьентиште', en: 'Sutjeska, Tjentište' }, p: [18.7, 43.35] },
      { name: { ru: 'Уна, Штрбачки-Бук', en: 'Una, Štrbački buk' }, p: [16.08, 44.63] },
      { name: { ru: 'Сараево, Башчаршия', en: 'Sarajevo, Baščaršija' }, p: [18.431, 43.859] },
    ],
  },
  {
    id: 'kosovo',
    name: { ru: 'Косово', en: 'Kosovo' },
    bbox: { west: 19.95, south: 41.8, east: 21.85, north: 43.3 },
    cell: 250,
    geofabrik: ['europe/kosovo', 'europe/serbia', 'europe/albania', 'europe/montenegro', 'europe/macedonia'],
    boundary: { iso: 'XK' },
    worldpop: 'KOS',
    examples: [
      { name: { ru: 'Каньон Ругова', en: 'Rugova canyon' }, p: [20.18, 42.68] },
      { name: { ru: 'Брезовица', en: 'Brezovica' }, p: [21.03, 42.17] },
      { name: { ru: 'Приштина, центр', en: 'Pristina centre' }, p: [21.165, 42.663] },
    ],
  },
  {
    id: 'serbia',
    name: { ru: 'Сербия', en: 'Serbia' },
    bbox: { west: 18.8, south: 42.2, east: 23.1, north: 46.2 },
    cell: 250,
    geofabrik: ['europe/serbia', 'europe/kosovo', 'europe/montenegro', 'europe/bosnia-herzegovina', 'europe/croatia', 'europe/hungary', 'europe/romania', 'europe/bulgaria', 'europe/macedonia'],
    boundary: { iso: 'RS' },
    worldpop: 'SRB',
    examples: [
      { name: { ru: 'Тара, Заовине', en: 'Tara, Zaovine' }, p: [19.4, 43.88] },
      { name: { ru: 'Увац, меандры', en: 'Uvac meanders' }, p: [19.86, 43.48] },
      { name: { ru: 'Белград, Теразие', en: 'Belgrade, Terazije' }, p: [20.46, 44.816] },
    ],
  },
];

export const getRegion = (id) => regions.find((r) => r.id === id) ?? regions[0];
