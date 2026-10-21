// Регионы расчёта. Сетка ~cell м в Web Mercator (см. src/core/grid.ts), данные — data/<id>/raw (сырые, не в git)
// и public/data/<id>/grid.gz (продукт). Новый регион: добавить запись и выполнить `npm run fetch -- <id>`.
export const regions = [
  {
    id: 'montenegro',
    name: { ru: 'Черногория', en: 'Montenegro' },
    bbox: { west: 18.4, south: 41.8, east: 20.4, north: 43.6 },
    cell: 250, // м
    osmRelation: 53296, // граница страны (OSM relation) — маска расчёта
    worldpop: 'MNE', // код страны в WorldPop
    worldcover: ['N39E018', 'N42E018'], // тайлы ESA WorldCover 3°×3°, покрывающие bbox
    buildingTile: 0.25, // размер тайла Overpass для зданий, °
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
    osmRelation: 226749,
    worldpop: 'HRV',
    worldcover: ['N42E015'],
    buildingTile: 0.2,
    examples: [
      { name: { ru: 'Биоково, над Макарской', en: 'Biokovo above Makarska' }, p: [17.05, 43.33] },
      { name: { ru: 'Остров Вис, юг', en: 'Vis island, south coast' }, p: [16.15, 43.02] },
      { name: { ru: 'Сплит, Рива', en: 'Split, the Riva' }, p: [16.44, 43.508] },
    ],
  },
];

export const getRegion = (id) => regions.find((r) => r.id === id) ?? regions[0];
