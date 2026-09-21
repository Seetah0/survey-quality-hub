/* oxlint-disable typescript/no-floating-promises -- node:test awaits registered tests. */
import './typescript-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
const { parseCourseXml, outcomeGap } = await import('../lib/course-report.ts');
const { inspectHistory, appendHistory } =
  await import('../lib/history-workbook.ts');
const { exportWorkbook, buildPortalPages } =
  await import('../lib/portal-export.ts');
const { makePptx, makeDocx } = await import('../lib/export.ts');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const table = (rows) =>
  `<w:tbl>${rows.map((row) => `<w:tr>${row.map((c) => `<w:tc><w:p><w:r><w:t>${esc(String(c))}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${table([['Course Title: Synthetic course', 'Course Code: TEST101'], ['Program: P1', 'Academic Year: 1445/1446 H'], ['Number of Students (Starting the Course): 12'], ['Number of Students (Completed the Course): 11']])}${table(
  [
    ['', 'A+', 'A', 'B', 'F', 'Pass', 'Fail'],
    ['Number of Students', '0', '2', '8', '0', '10', '0'],
    ['Percentage', '0', '20', '80', '0', '100', '0'],
  ],
)}${table([
  ['Course Learning Outcomes', 'Related PLOs Code'],
  [
    '1.1',
    'Demonstrate skill',
    'S1',
    'Exam',
    '80%',
    '49%',
    'Source says satisfactory',
  ],
  ['1.2', 'Apply concepts', 'S2', 'Project', '85%', '96%', ''],
  ['1.3', '', '', '', '', '', ''],
])}${table([
  ['Recommendations', 'Actions', 'Needed Support'],
  ['None', 'None', 'None'],
])}</w:body></w:document>`;
const course = parseCourseXml(xml);
const dataset = {
  id: 'test',
  name: 'synthetic.docx',
  hash: 'test',
  created: '2026-01-01',
  year: 2027,
  section: 'courses',
  course,
};
test('course source data, CLO/PLO mapping and targets are distinct from survey satisfaction', () => {
  assert.equal(course.code, 'TEST101');
  assert.equal(course.academicYear, '1445/1446 H');
  assert.equal(course.outcomes.length, 2);
  assert.equal(course.outcomes[0].plo, 'S1');
  assert.equal(outcomeGap(course.outcomes[0]), -31);
  assert.equal(course.previousPlan.length, 0);
  assert.equal(course.issues.length, 1);
  assert.equal(
    course.grades.reduce((s, g) => s + g.count, 0),
    10,
  );
  assert.equal(course.outcomes[0].comment, 'Source says satisfactory');
});
test('course exports preserve evidence, produce editable files and retain UTF-8', async () => {
  const pages = buildPortalPages([dataset], 'ar');
  assert.ok(pages.some((p) => p.lines?.some((v) => v.includes('49% / 80%'))));
  const ppt = await JSZip.loadAsync(await makePptx(pages, 'ar'));
  assert.ok(ppt.file('ppt/presentation.xml'));
  const doc = await JSZip.loadAsync(await makeDocx(pages, 'ar'));
  assert.match(await doc.file('word/document.xml').async('string'), /TEST101/);
  const wb = XLSX.read(exportWorkbook([dataset], 'ar'), { type: 'array' });
  assert.equal(wb.Sheets['نواتج التعلم'].J2.v, -31);
  assert.equal(wb.Sheets['نواتج التعلم'].E2.v, 'S1');
});
test('append 2027 then 2028 retains every original historical value, formula and drawing', async () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Program'],
    ['Survey', 'Question', 'Label'],
    [null, null, null, 2022, 2023, 2024, 2025, 2026],
    ['CES', 'Average', 'Overall', 3.4, 3.6, 4.1, 4.2, null, null, 42],
  ]);
  ws.K4 = { t: 'n', f: 'SUM(D4:H4)', v: 15.3 };
  ws['!ref'] = 'A1:K4';
  XLSX.utils.book_append_sheet(wb, ws, 'P1');
  const z = await JSZip.loadAsync(
    XLSX.write(wb, { type: 'array', bookType: 'xlsx' }),
  );
  z.file('xl/drawings/preserved.xml', '<drawing>unchanged</drawing>');
  const before = await z.generateAsync({ type: 'uint8array' });
  assert.deepEqual(
    inspectHistory(before)[0].years,
    [2022, 2023, 2024, 2025, 2026],
  );
  const appended = await appendHistory(before, 2027, [
    { sheet: 'P1', row: 4, value: 4.8, source: 'Synthetic / Mean' },
  ]);
  const after = XLSX.read(appended, { type: 'array' }).Sheets.P1;
  for (const [address, cell] of Object.entries(ws).filter(
    ([key]) => !key.startsWith('!'),
  ))
    assert.deepEqual([after[address]?.v, after[address]?.f], [cell.v, cell.f]);
  assert.equal(after.L3.v, 2027);
  assert.equal(after.L4.v, 4.8);
  assert.equal(
    await (
      await JSZip.loadAsync(appended)
    )
      .file('xl/drawings/preserved.xml')
      .async('string'),
    '<drawing>unchanged</drawing>',
  );
  const next = await appendHistory(appended, 2028, [
    { sheet: 'P1', row: 4, value: 4.9, source: 'Synthetic' },
  ]);
  const afterNext = XLSX.read(next, { type: 'array' }).Sheets.P1;
  assert.equal(afterNext.L4.v, 4.8);
  assert.equal(afterNext.M4.v, 4.9);
  await assert.rejects(
    () => appendHistory(next, 2026, []),
    /NEXT_YEAR_REQUIRED/,
  );
  await assert.rejects(
    () => appendHistory(next, 2030, []),
    /NEXT_YEAR_REQUIRED/,
  );
  await assert.rejects(
    () =>
      appendHistory(next, 2029, [
        { sheet: 'P1', row: 4, value: 4.8 },
        { sheet: 'P1', row: 4, value: 4.9 },
      ]),
    /DUPLICATE_HISTORY_MAPPING/,
  );
});
