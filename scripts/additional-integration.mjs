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
const pesExport = await req('/api/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [id], format: 'pptx', lang: 'en' }),
});
assert.equal(pesExport.status, 200, await pesExport.clone().text());
const pesZip = await JSZip.loadAsync(await pesExport.arrayBuffer());
assert.equal(
  Object.keys(pesZip.files).filter((p) =>
    /^ppt\/charts\/chart\d+\.xml$/.test(p),
  ).length,
  2,
);
assert.match(
  await pesZip.file('ppt/charts/chart1.xml').async('string'),
  /<c:max val="10"/,
);
console.log('PASS confirmed PES has editable charts on its own 1–10 scale.');
const sparse = X.utils.book_new();
X.utils.book_append_sheet(
  sparse,
  X.utils.json_to_sheet([
    {
      DegreeCode: 'TEST',
      CourseName: 'Sparse',
      SubjCat: 'S1',
      StudentYear: 1,
      Expected: 2,
      Q1: null,
      Q2: 5,
      Q15: 3,
    },
    {
      DegreeCode: 'TEST',
      CourseName: 'Sparse',
      SubjCat: 'S1',
      StudentYear: 1,
      Expected: 2,
      Q1: 'invalid text',
      Q2: 4,
      Q15: 5,
    },
  ]),
  'RawData',
);
const sparseForm = new FormData();
sparseForm.set(
  'file',
  new File(
    [X.write(sparse, { type: 'buffer', bookType: 'xlsx' })],
    'synthetic-gaps.xlsx',
  ),
);
const sparseUpload = await req('/api/reports', {
  method: 'POST',
  body: sparseForm,
});
assert.equal(sparseUpload.status, 201, await sparseUpload.clone().text());
const sparseId = (await sparseUpload.json()).id;
const sparseExport = await req('/api/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [sparseId], format: 'pptx', lang: 'en' }),
});
assert.equal(sparseExport.status, 200, await sparseExport.clone().text());
const sparseZip = await JSZip.loadAsync(await sparseExport.arrayBuffer());
for (const i of [1, 2]) {
  const chart = await sparseZip
    .file(`ppt/charts/chart${i}.xml`)
    .async('string');
  const cache = chart.match(/<c:numCache>([\s\S]*?)<\/c:numCache>/)[1];
  assert.ok(
    !cache.includes('<c:pt idx="0">'),
    'Unavailable Q1 must not become zero',
  );
  assert.match(chart, /<c:dispBlanksAs val="gap"/);
  const book = X.read(
    await sparseZip.file(`ppt/embeddings/chart${i}.xlsx`).async('uint8array'),
  );
  assert.equal(book.Sheets['Chart Data'].B2?.v, undefined);
  assert.equal(book.Sheets['Chart Data'].C2.v, 0);
}
console.log(
  'PASS no valid answers stay unavailable in chart caches and embedded workbooks.',
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
    for (const match of xml.matchAll(
      /<p:graphicFrame>([\s\S]*?)<\/p:graphicFrame>/g,
    )) {
      if (!match[1].includes('<a:tbl>')) continue;
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
