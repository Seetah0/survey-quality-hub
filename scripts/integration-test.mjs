import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
const base = process.env.TEST_URL || 'http://localhost:3000';
let cookie = '';
const req = async (url, options = {}) => {
  const r = await fetch(base + url, {
    ...options,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
  });
  const c = r.headers.get('set-cookie');
  if (c) cookie = c.split(';')[0];
  return r;
};
const first = await req('/api/reports');
assert.equal(first.status, 200);
assert.ok(cookie);
const security = first.headers.get('set-cookie');
assert.match(security, /HttpOnly/);
assert.match(security, /SameSite=Strict/);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet([
    {
      DegreeCode: 'SYNTHETIC',
      CourseName: 'Test course',
      SubjCat: 'TEST-' + crypto.randomUUID(),
      StudentYear: 2,
      Expected: 1,
      Q1: 5,
      Q15: 4,
      Q17: 'Synthetic test comment',
    },
  ]),
  'RawData',
);
const bytes = process.env.CES_FIXTURE
  ? await fs.readFile(process.env.CES_FIXTURE)
  : XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const body = new FormData();
body.set('file', new File([bytes], 'integration-survey.xlsx'));
const upload = await req('/api/reports', { method: 'POST', body });
assert.ok([200, 201].includes(upload.status), await upload.clone().text());
const { id } = await upload.json();
const dataResponse = await req('/api/reports/' + id);
assert.equal(dataResponse.status, 200);
const data = await dataResponse.json();
assert.equal(data.analysis.type, 'CES');
if (process.env.CES_FIXTURE) {
  assert.equal(data.analysis.overall.rows, 2304);
  assert.equal(data.analysis.overall.overall.sum, 164938);
}
const duplicate = await req('/api/reports', { method: 'POST', body });
assert.equal((await duplicate.json()).id, id);
const forbidden = await fetch(base + '/api/reports/' + id);
assert.equal(forbidden.status, 404);
const otherList = await fetch(base + '/api/reports');
assert.equal((await otherList.json()).reports.length, 0);
const csrf = await req('/api/reports', {
  method: 'POST',
  headers: { Origin: 'https://untrusted.invalid' },
  body,
});
assert.equal(csrf.status, 403);
const second = await req('/api/reports');
assert.ok((await second.json()).reports.some((r) => r.id === id));
const out = path.resolve('work/integration');
await fs.mkdir(out, { recursive: true });
for (const lang of ['ar', 'en'])
  for (const format of ['pptx', 'docx']) {
    const r = await req('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], format, lang, groupId: 'all' }),
    });
    assert.equal(r.status, 200, await r.clone().text());
    const b = new Uint8Array(await r.arrayBuffer());
    const zip = await JSZip.loadAsync(b);
    assert.ok(zip.file('[Content_Types].xml'));
    if (format === 'pptx') {
      const pres = await zip.file('ppt/presentation.xml').async('string');
      assert.match(pres, /9144000/);
      assert.match(pres, /6858000/);
      const slide = await zip.file('ppt/slides/slide2.xml').async('string');
      assert.match(slide, lang === 'ar' ? /ملخص النتائج/ : /Results overview/);
      assert.ok(zip.file('ppt/slideMasters/slideMaster1.xml'));
    } else assert.ok(zip.file('word/document.xml'));
    await fs.writeFile(path.join(out, `report-${lang}.${format}`), b);
    console.log('PASS export', lang, format, b.length);
  }
await fs.writeFile(
  path.join(out, 'session.json'),
  JSON.stringify({ cookie, id }),
);
console.log(
  'PASS upload, duplicate prevention, calculations, reload persistence, session isolation, CSRF and four exports.',
);
