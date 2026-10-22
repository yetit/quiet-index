// Минимальный читатель OSM PBF (fileformat + osmformat): блоки → узлы (dense), way, relation.
// Делает ровно то, что нужно выгрузке: id, координаты, теги, ссылки. Без зависимостей кроме pbf и zlib.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PbfReader as Pbf } from 'pbf';

// Последовательность блоков файла: { type: 'OSMHeader' | 'OSMData', data } (data — распакованный PrimitiveBlock).
export function* blocks(file) {
  const fd = openSync(file, 'r');
  const size = fstatSync(fd).size;
  const len = Buffer.alloc(4);
  let pos = 0;
  while (pos < size) {
    readSync(fd, len, 0, 4, pos); pos += 4;
    const hb = Buffer.alloc(len.readUInt32BE(0)); readSync(fd, hb, 0, hb.length, pos); pos += hb.length;
    const header = new Pbf(hb).readFields((tag, o, p) => { if (tag === 1) o.type = p.readString(); else if (tag === 3) o.datasize = p.readVarint(); }, {});
    const bb = Buffer.alloc(header.datasize); readSync(fd, bb, 0, bb.length, pos); pos += bb.length;
    const blob = new Pbf(bb).readFields((tag, o, p) => { if (tag === 1) o.raw = p.readBytes(); else if (tag === 3) o.zlib = p.readBytes(); }, {});
    yield { type: header.type, data: blob.zlib ? inflateSync(blob.zlib) : Buffer.from(blob.raw) };
  }
  closeSync(fd);
}

const tagsOf = (strings, keys, vals) => { if (!keys.length) return null; const t = {}; for (let i = 0; i < keys.length; i++) t[strings[keys[i]]] = strings[vals[i]]; return t; };

// Разбор PrimitiveBlock: onNode(id, lon, lat, tags|null), onWay(id, tags|null, refs), onRelation(id, tags|null, members[{type, ref, role}]).
// Ненужные колбэки можно не передавать — соответствующие группы пропускаются без разбора.
export function readBlock(buf, { onNode, onWay, onRelation }) {
  const b = new Pbf(buf).readFields((tag, o, p) => {
    if (tag === 1) o.strings = p.readMessage((t, s, q) => { if (t === 1) s.push(q.readString()); }, []);
    else if (tag === 2) o.groups.push(p.readBytes());
    else if (tag === 17) o.granularity = p.readVarint();
    else if (tag === 19) o.latOffset = p.readVarint(true);
    else if (tag === 20) o.lonOffset = p.readVarint(true);
  }, { strings: [], groups: [], granularity: 100, latOffset: 0, lonOffset: 0 });
  const { strings, granularity, latOffset, lonOffset } = b;
  for (const g of b.groups) new Pbf(g).readFields((tag, _, p) => {
    if (tag === 2 && onNode) {
      const d = p.readMessage((t, o, q) => { if (t === 1) q.readPackedSVarint(o.id); else if (t === 8) q.readPackedSVarint(o.lat); else if (t === 9) q.readPackedSVarint(o.lon); else if (t === 10) q.readPackedVarint(o.kv); }, { id: [], lat: [], lon: [], kv: [] });
      let id = 0, lat = 0, lon = 0, k = 0;
      for (let i = 0; i < d.id.length; i++) {
        id += d.id[i]; lat += d.lat[i]; lon += d.lon[i];
        let tags = null;
        if (d.kv.length) { while (d.kv[k] !== 0) { (tags ??= {})[strings[d.kv[k]]] = strings[d.kv[k + 1]]; k += 2; } k++; }
        onNode(id, 1e-9 * (lonOffset + granularity * lon), 1e-9 * (latOffset + granularity * lat), tags);
      }
    } else if (tag === 1 && onNode) {
      const n = p.readMessage((t, o, q) => { if (t === 1) o.id = q.readSVarint(); else if (t === 2) q.readPackedVarint(o.keys); else if (t === 3) q.readPackedVarint(o.vals); else if (t === 8) o.lat = q.readSVarint(); else if (t === 9) o.lon = q.readSVarint(); }, { keys: [], vals: [] });
      onNode(n.id, 1e-9 * (lonOffset + granularity * n.lon), 1e-9 * (latOffset + granularity * n.lat), tagsOf(strings, n.keys, n.vals));
    } else if (tag === 3 && onWay) {
      const w = p.readMessage((t, o, q) => { if (t === 1) o.id = q.readVarint(); else if (t === 2) q.readPackedVarint(o.keys); else if (t === 3) q.readPackedVarint(o.vals); else if (t === 8) q.readPackedSVarint(o.refs); }, { keys: [], vals: [], refs: [] });
      for (let i = 1; i < w.refs.length; i++) w.refs[i] += w.refs[i - 1];
      onWay(w.id, tagsOf(strings, w.keys, w.vals), w.refs);
    } else if (tag === 4 && onRelation) {
      const r = p.readMessage((t, o, q) => { if (t === 1) o.id = q.readVarint(); else if (t === 2) q.readPackedVarint(o.keys); else if (t === 3) q.readPackedVarint(o.vals); else if (t === 8) q.readPackedVarint(o.roles); else if (t === 9) q.readPackedSVarint(o.memids); else if (t === 10) q.readPackedVarint(o.types); }, { keys: [], vals: [], roles: [], memids: [], types: [] });
      const members = [];
      for (let i = 0, ref = 0; i < r.memids.length; i++) { ref += r.memids[i]; members.push({ type: r.types[i], ref, role: strings[r.roles[i]] ?? '' }); } // type: 0 узел, 1 way, 2 relation
      onRelation(r.id, tagsOf(strings, r.keys, r.vals), members);
    }
  });
}
