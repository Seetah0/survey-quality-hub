/* oxlint-disable typescript/no-floating-promises -- node:test owns and awaits all registered tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {
  analyzeRows,
  analyzeWorkbook,
  calculate,
  band,
  mergeAnalyses,
  validateZip,
} from '../lib/analysis.ts';
const headers = [
  'Campus',
  'College',
  'DegreeCode',
  'AcadYear',
  'Term',
  'SubjCat',
  'CourseName',
  'StudentYear',
  'Class',
  'Expected',
  'Q1',
  'Q15',
  'Q17',
];
const row = (extra = {}) => ({
  Campus: 'Test campus',
  College: 'Test college',
  DegreeCode: 'P1',
  AcadYear: '2025/2026',
  Term: 1,
  SubjCat: 'C1',
  CourseName: 'Synthetic course',
  StudentYear: 2,
  Class: 1,
  Expected: 1,
  Q1: 5,
  Q15: 5,
  Q17: null,
  ...extra,
});
test('invalid inputs have independent denominators and never coerce text', () => {
  const m = calculate([
    null,
    undefined,
    '',
    ' ',
    '4',
    true,
    NaN,
    Infinity,
    0,
    6,
    1,
    4,
    5,
  ]);
  assert.equal(m.empty, 4);
  assert.equal(m.nonNumeric, 4);
  assert.equal(m.outOfRange, 2);
  assert.equal(m.valid, 3);
  assert.equal(m.sum, 10);
  assert.equal(m.positive, 2);
});
test('all invalid is unavailable, not zero', () => {
  assert.equal(calculate(['5', null, 6]).mean, null);
  assert.equal(calculate([]).positivity, null);
});
test('boundaries are evaluated before display rounding', () => {
  assert.equal(band(3.6, 'mean'), 'high');
  assert.equal(band(2.6, 'mean'), 'acceptable');
  assert.equal(band(2.5999, 'mean'), 'improve');
  assert.equal(band(59.96, 'positivity'), 'improve');
  assert.equal(band(80, 'positivity'), 'high');
  assert.equal(band(7, 'mean', 10), null);
});
test('CES maps 16 quantitative questions, open numeric answers remain text', () => {
  const a = analyzeRows([row({ Q17: '5' })], headers);
  assert.equal(a.type, 'CES');
  assert.equal(a.questions.find((q) => q.id === 'Q17').kind, 'open');
  assert.equal(a.overall.overall.valid, 2);
  assert.equal(a.comments[0].top[0].text, '5');
  assert.ok(!a.questions.some((q) => q.id === 'Q20'));
});
test('Expected is once per course, not per row or class', () => {
  const a = analyzeRows(
    [row({ Expected: 2 }), row({ Expected: 2, Class: 2 })],
    headers,
  );
  assert.equal(a.overall.expected, 2);
  assert.equal(a.overall.responseRate, 100);
});
test('Expected across source levels is unavailable for partial cohorts', () => {
  const a = analyzeRows(
    [row({ Expected: 2 }), row({ Expected: 2, StudentYear: 3 })],
    headers,
  );
  assert.equal(a.overall.expected, 2);
  assert.equal(a.programs[0].levels[0].expected, null);
  assert.equal(a.programs[0].levels[1].level, '3');
});
test('missing or conflicting Expected does not guess a denominator', () => {
  for (const rs of [
    [row({ Expected: null })],
    [row({ Expected: 2 }), row({ Expected: 3 })],
  ])
    assert.equal(analyzeRows(rs, headers).overall.expected, null);
});
test('program aliases preserve separate PES cohorts', () => {
  const a = analyzeRows(
    [
      { Program: 'A', Expected: 1, Q1: 5 },
      { Program: 'B', Expected: 1, Q1: 3 },
    ],
    ['Program', 'Expected', 'Q1'],
    { type: 'PES', min: 1, max: 5, positive: 4, kinds: { Q1: 'rating' } },
  );
  assert.equal(a.overall.expected, 2);
  assert.equal(a.overall.responseRate, 100);
});
test('unknown/conflicting content requires confirmation', () => {
  const a = analyzeRows([row({ EmployeeId: 1 })], [...headers, 'EmployeeId']);
  assert.equal(a.type, 'UNKNOWN');
  assert.equal(a.needsConfirmation, true);
});
test('non-CES scale requires explicit confirmation', () => {
  const a = analyzeRows(
    [{ Program: 'A', 'Q1 - Satisfaction': 10 }],
    ['Program', 'Q1 - Satisfaction'],
  );
  assert.equal(a.type, 'PES');
  assert.equal(a.needsConfirmation, true);
});
test('duplicate canonical question IDs are rejected and Q0 is ignored', () => {
  assert.throws(
    () => analyzeRows([row({ Q01: 2 })], [...headers, 'Q01']),
    /DUPLICATE_COLUMNS/,
  );
  assert.ok(
    !analyzeRows([row({ Q0: 2 })], [...headers, 'Q0']).questions.some(
      (q) => q.id === 'Q0',
    ),
  );
});
test('weighted pooling uses score totals', () => {
  const a = analyzeRows(
    Array.from({ length: 20 }, () => row({ Expected: 20 })),
    headers,
  );
  const b = analyzeRows(
    Array.from({ length: 1000 }, () =>
      row({ SubjCat: 'C2', Expected: 1000, Q1: 3, Q15: 3 }),
    ),
    headers,
  );
  const m = mergeAnalyses([a, b]);
  assert.ok(Math.abs(m.overall.overall.mean - 3.0392156862745097) < 1e-12);
  assert.ok(
    Math.abs(m.overall.overall.positivity - 1.9607843137254901) < 1e-12,
  );
  assert.equal(m.overall.rows, 1020);
  assert.equal(m.overall.expected, 1020);
});
test('Q15 alone determines CES course priority and sample boundary', () => {
  const a = analyzeRows(
    Array.from({ length: 9 }, () => row({ Expected: 9, Q1: 5, Q15: 2 })),
    headers,
  );
  assert.equal(a.programs[0].courses[0].priority, true);
  assert.equal(a.overall.smallSample, true);
  const b = analyzeRows(
    Array.from({ length: 10 }, () => row({ Expected: 10 })),
    headers,
  );
  assert.equal(b.overall.smallSample, false);
});
test('PES merge never enables CES priority', () => {
  const options = {
    type: 'PES',
    min: 1,
    max: 5,
    positive: 4,
    kinds: { Q15: 'rating' },
  };
  const a = analyzeRows(
    [{ Program: 'A', Expected: 1, Q15: 1 }],
    ['Program', 'Expected', 'Q15'],
    options,
  );
  const b = analyzeRows(
    [{ Program: 'B', Expected: 1, Q15: 1 }],
    ['Program', 'Expected', 'Q15'],
    options,
  );
  assert.equal(mergeAnalyses([a, b]).overall.priority, false);
});
test('overlap and incompatible scales cannot be pooled', () => {
  const a = analyzeRows([row()], headers);
  assert.throws(() => mergeAnalyses([a, a]), /OVERLAPPING_COHORTS/);
  assert.throws(
    () => mergeAnalyses([a, { ...a, max: 10 }]),
    /INCOMPATIBLE_REPORTS/,
  );
});
test('summary sheets never add responses', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([row()]),
    'RawData',
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([row(), row()]),
    'Mean',
  );
  const a = analyzeWorkbook(
    XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
  );
  assert.equal(a.overall.rows, 1);
});
test('ZIP expansion limit is enforced', () => {
  const b = new Uint8Array(68),
    d = new DataView(b.buffer);
  d.setUint32(0, 0x02014b50, true);
  b[0] = 0x50;
  b[1] = 0x4b;
  d.setUint32(24, 60 * 1024 * 1024, true);
  d.setUint32(46, 0x06054b50, true);
  d.setUint16(56, 1, true);
  d.setUint32(62, 0, true);
  assert.throws(() => validateZip(b), /WORKBOOK_TOO_LARGE/);
});
test(
  'provided CES regression oracle',
  { skip: !process.env.CES_FIXTURE },
  () => {
    const a = analyzeWorkbook(fs.readFileSync(process.env.CES_FIXTURE));
    assert.equal(a.overall.rows, 2304);
    assert.equal(a.overall.expected, 2308);
    assert.equal(a.overall.overall.sum, 164938);
    assert.equal(a.overall.overall.valid, 36864);
    assert.equal(a.overall.overall.positive, 31318);
    assert.equal(
      a.programs.flatMap((p) => p.courses).filter((c) => c.priority).length,
      6,
    );
    assert.equal(
      a.programs.flatMap((p) => p.courses).filter((c) => c.smallSample).length,
      10,
    );
    assert.equal(
      a.validation.reduce((s, v) => s + v.mismatches, 0),
      0,
    );
    assert.equal(
      a.validation.reduce((s, v) => s + v.compared, 0),
      1632,
    );
  },
);
