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
    camera: { center: [19.25, 42.72], zoom: 7.4 },
  },
];

export const getRegion = (id) => regions.find((r) => r.id === id) ?? regions[0];
