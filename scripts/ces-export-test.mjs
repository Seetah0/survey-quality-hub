import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
const base = process.env.TEST_URL || 'http://localhost:3000';
let cookie = '';
async function request(p, options = {}) {
  const r = await fetch(base + p, {
    ...options,
    headers: { Cookie: cookie, ...options.headers },
  });
  if (r.headers.get('set-cookie'))
    cookie = r.headers.get('set-cookie').split(';')[0];
  return r;
}
await request('/api/reports');
assert.ok(
  process.env.CES_FIXTURE,
  'Set CES_FIXTURE to the private local workbook.',
);
const bytes = await fs.readFile(process.env.CES_FIXTURE);
const form = new FormData();
form.set('file', new File([bytes], 'ces-validation.xlsx'));
const up = await request('/api/reports', { method: 'POST', body: form });
assert.equal(up.status, 201, await up.clone().text());
const { id } = await up.json();
const { analysis } = await (await request('/api/reports/' + id)).json();
const post = (body) =>
  request('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [id], format: 'pptx', ...body }),
  });
await fs.mkdir('work/ces-v2', { recursive: true });
for (const lang of ['ar', 'en']) {
  const pre = await post({ lang, preview: true });
  assert.equal(pre.status, 200, await pre.clone().text());
  const { manifest } = await pre.json();
  assert.equal(manifest.courses, 34);
  assert.equal(manifest.charts, 68);
  assert.equal(manifest.priorityCourses, 6);
  assert.equal(manifest.previousPlans, 0);
  assert.equal(manifest.dataReview.compared, 1632);
  assert.equal(manifest.dataReview.mismatches, 0);
  const r = await post({ lang });
  assert.equal(r.status, 200, await r.clone().text());
  const output = new Uint8Array(await r.arrayBuffer());
  const zip = await JSZip.loadAsync(output);
  const names = Object.keys(zip.files);
  assert.equal(
    names.filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).length,
    manifest.slides,
  );
  assert.equal(
    names.filter((p) => /^ppt\/charts\/chart\d+\.xml$/.test(p)).length,
    68,
  );
  assert.equal(
    names.filter((p) => /^ppt\/embeddings\/chart\d+\.xlsx$/.test(p)).length,
    68,
  );
  let ci = 0;
  for (const section of manifest.sections) {
    const slide = await zip
      .file(`ppt/slides/slide${section.slide}.xml`)
      .async('string');
    if (!section.chart) continue;
    ci++;
    assert.match(slide, /<c:chart\b/);
    assert.match(slide, /<a:tbl>/);
    assert.match(
      slide,
      /xmlns:c="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/chart"/,
    );
    assert.match(
      slide,
      /graphicData uri="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/chart"/,
    );
    assert.match(
      slide,
      /graphicData uri="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/table"/,
    );
    const chart = await zip.file(`ppt/charts/chart${ci}.xml`).async('string');
    assert.match(chart, /<c:externalData\b/);
    assert.match(chart, /<c:dispBlanksAs val="gap"/);
    const wb = XLSX.read(
      await zip.file(`ppt/embeddings/chart${ci}.xlsx`).async('uint8array'),
      { type: 'array' },
    );
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Chart Data'], {
      header: 1,
    });
    const course = analysis.programs
      .flatMap((p) => p.courses)
      .find((c) => JSON.stringify([c.program, c.code]) === section.courseId);
    assert.ok(course);
    const values = chart.match(/<c:numCache>([\s\S]*?)<\/c:numCache>/)[1];
    const cache = new Map(
      [
        ...values.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]+)<\/c:v><\/c:pt>/g),
      ].map((m) => [Number(m[1]), Number(m[2])]),
    );
    for (let qi = 0; qi < 16; qi++) {
      const q = 'Q' + (qi + 1),
        m = course.questions[q],
        expected = section.chart === 'mean' ? m.mean : m.positivity / 100;
      assert.equal(rows[qi + 1][0], q);
      assert.ok(Math.abs(rows[qi + 1][1] - expected) < 1e-12);
      assert.ok(Math.abs(cache.get(qi) - expected) < 1e-12);
      assert.equal(rows[qi + 1][2], m.valid);
    }
  }
  await fs.writeFile(`work/ces-v2/ces-${lang}.pptx`, output);
  await fs.writeFile(
    `work/ces-v2/manifest-${lang}.json`,
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    'PASS',
    lang,
    manifest.slides,
    'slides,',
    manifest.charts,
    'native charts,',
    manifest.courses,
    'courses; all chart caches and 68 embedded workbooks match RawData.',
  );
}
const forbidden = await fetch(base + '/api/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: [id],
    format: 'pptx',
    lang: 'en',
    preview: true,
  }),
});
assert.equal(forbidden.status, 404);
console.log('PASS export preview enforces ownership.');
