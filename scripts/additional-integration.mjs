import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as X from 'xlsx';
import JSZip from 'jszip';
const base = process.env.TEST_URL || 'http://localhost:3000';
let cookie = '';
async function req(p, init = {}) {
  const r = await fetch(base + p, {
    ...init,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...init.headers },
  });
  if (r.headers.get('set-cookie'))
    cookie = r.headers.get('set-cookie').split(';')[0];
  return r;
}
await req('/api/reports');
const wb = X.utils.book_new();
X.utils.book_append_sheet(
  wb,
  X.utils.json_to_sheet([
    {
      Program: 'PES test',
      Expected: 2,
      'Q1 - Overall satisfaction': 8,
      'Q20 - Gender category': 1,
    },
    {
      Program: 'PES test',
      Expected: 2,
      'Q1 - Overall satisfaction': 10,
      'Q20 - Gender category': 2,
    },
  ]),
  'RawData',
);
const form = new FormData();
form.set(
  'file',
  new File(
    [X.write(wb, { type: 'buffer', bookType: 'xls' })],
    'synthetic-pes.xls',
  ),
);
const up = await req('/api/reports', { method: 'POST', body: form });
assert.equal(up.status, 201, await up.clone().text());
const { id } = await up.json();
let result = await (await req('/api/reports/' + id)).json();
assert.equal(result.analysis.type, 'PES');
assert.equal(result.analysis.needsConfirmation, true);
const blocked = await req('/api/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [id], format: 'pptx', lang: 'en' }),
});
assert.equal((await blocked.json()).error, 'CONFIRM_REQUIRED');
const confirmed = await req('/api/reports/' + id, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'PES',
    min: 1,
    max: 10,
    positive: 8,
    kinds: { Q1: 'rating', Q20: 'categorical' },
  }),
});
assert.equal(confirmed.status, 200, await confirmed.clone().text());
result = await confirmed.json();
assert.equal(result.analysis.overall.overall.mean, 9);
assert.equal(result.analysis.overall.overall.positivity, 100);
assert.equal(result.analysis.needsConfirmation, false);
assert.equal(result.analysis.overall.overall.valid, 2);
console.log(
  'PASS legacy XLS, uncertain scale, export confirmation, explicit mapping and 1–10 scoring.',
);
if (process.env.HISTORICAL_FIXTURE) {
  const b = await fs.readFile(process.env.HISTORICAL_FIXTURE);
  const f = new FormData();
  f.set('file', new File([b], 'historical-test.xlsx'));
  const r = await req('/api/reports', { method: 'POST', body: f });
  assert.equal(r.status, 201, await r.clone().text());
  const h = await r.json();
  const data = await (await req('/api/reports/' + h.id)).json();
  assert.equal(data.analysis.kind, 'historical');
  assert.equal(data.analysis.historical.length, 6589);
  assert.equal(data.analysis.overall.rows, 0);
  const ex = await req('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [h.id], format: 'pptx', lang: 'ar' }),
  });
  assert.equal(ex.status, 200, await ex.clone().text());
  const bytes = new Uint8Array(await ex.arrayBuffer());
  const zip = await JSZip.loadAsync(bytes);
  const count = Object.keys(zip.files).filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p),
  ).length;
  assert.ok(count < 800);
  for (const p of Object.keys(zip.files).filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p),
  )) {
    const xml = await zip.file(p).async('string');
    for (const match of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
      if (!/name="Cell \d+"/.test(match[1])) continue;
      const y = Number(match[1].match(/<a:off x="\d+" y="(\d+)"/)?.[1]);
      const h = Number(match[1].match(/<a:ext cx="\d+" cy="(\d+)"/)?.[1]);
      assert.ok(
        (y + h) / 914400 <= 6.8,
        'Table exceeds the footer boundary in ' + p,
      );
    }
  }
  await fs.mkdir('work/integration', { recursive: true });
  await fs.writeFile('work/integration/historical-ar.pptx', bytes);
  console.log(
    'PASS historical import and pivoted export:',
    data.analysis.historical.length,
    'source values,',
    count,
    'slides.',
  );
}
