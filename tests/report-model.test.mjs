/* oxlint-disable typescript/no-floating-promises -- node:test awaits registered tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRows } from '../lib/analysis.ts';
import {
  buildSurveyReport,
  reportManifest,
  courseKey,
} from '../lib/report-model.ts';
const headers = [
  'DegreeCode',
  'CourseName',
  'SubjCat',
  'StudentYear',
  'Expected',
  'Q1',
  'Q2',
  'Q15',
];
const row = (extra = {}) => ({
  DegreeCode: 'A',
  CourseName: 'Course',
  SubjCat: 'C1',
  StudentYear: 1,
  Expected: 2,
  Q1: 5,
  Q2: 5,
  Q15: 2,
  ...extra,
});
const analysis = () => analyzeRows([row(), row()], headers);
test('CES sequence is complete for every course and global sections follow all courses', () => {
  const a = analysis(),
    pages = buildSurveyReport(a, 'en'),
    id = courseKey(a.programs[0].courses[0]);
  assert.deepEqual(
    pages.filter((p) => p.courseId === id).map((p) => p.section),
    [
      'course-summary',
      'implementation',
      'current-proposed-action-plan',
      'ces-mean',
      'ces-cumulative',
      'improvement-priority',
    ],
  );
  assert.deepEqual(
    pages.slice(-5).map((p) => p.section),
    [
      'strengths',
      'areas-for-improvement',
      'priority-courses',
      'proposed-improvement-plan',
      'end',
    ],
  );
  assert.equal(pages.at(-1).title, 'End of Report');
});
test('no fictional previous plan or implementation percentage', () => {
  const pages = buildSurveyReport(analysis(), 'en');
  assert.equal(
    pages.some((p) => p.section === 'previous-action-plan'),
    false,
  );
  assert.match(
    pages.find((p) => p.section === 'implementation').lines.join(' '),
    /No documented implementation/,
  );
  assert.ok(
    !pages
      .find((p) => p.section === 'implementation')
      .lines.join(' ')
      .includes('0%'),
  );
});
test('previous plan only with source evidence and in its requested position', () => {
  const a = analysis(),
    id = courseKey(a.programs[0].courses[0]);
  const pages = buildSurveyReport(a, 'en', 'all', {
    previousActions: {
      [id]: {
        plan: 'Supplied plan',
        source: 'User document',
        implementation: 'Supplied evidence',
      },
    },
  });
  const sequence = pages.filter((p) => p.courseId === id).map((p) => p.section);
  assert.equal(sequence[1], 'previous-action-plan');
  assert.equal(sequence[2], 'implementation');
});
test('every low question gets a proposed action, even when more than three', () => {
  const hs = [...headers, 'Q3', 'Q4', 'Q5'];
  const a = analyzeRows([row({ Q1: 1, Q2: 1, Q3: 1, Q4: 1, Q5: 1 })], hs);
  const plan = buildSurveyReport(a, 'en').find(
    (p) => p.section === 'current-proposed-action-plan',
  );
  assert.equal(plan.rows.length, 6);
  assert.ok(plan.rows.every((r) => r[3].includes('proposed')));
});
test('a high overall mean never suppresses Q15 priority', () => {
  const a = analyzeRows([row({ Q15: 3 }), row({ Q15: 5 })], headers);
  assert.ok(a.overall.overall.mean >= 3.6);
  assert.ok(
    buildSurveyReport(a, 'en').some(
      (p) => p.section === 'improvement-priority',
    ),
  );
});
test('unavailable chart values stay null with zero valid answers', () => {
  const a = analyzeRows([row({ Q1: null, Q15: null })], headers),
    page = buildSurveyReport(a, 'en').find((p) => p.section === 'ces-mean');
  assert.equal(page.chart.values[0], null);
  assert.equal(page.chart.valid[0], 0);
});
test('selected course exports no unrelated courses, even when its expected rate is unavailable', () => {
  const a = analyzeRows(
    [row(), row({ SubjCat: 'C2', StudentYear: 2 })],
    headers,
  );
  const c = a.programs[0].courses[0];
  const p = buildSurveyReport(a, 'en', c.id);
  assert.equal(reportManifest(a, p, c.id).courses, 1);
  assert.equal(p.filter((p) => p.section === 'course-summary').length, 1);
});
test('every confirmed non-CES survey gets charts and a proposed plan without CES priority', () => {
  const a = analyzeRows([{ Program: 'A', Q1: 9 }], ['Program', 'Q1'], {
    type: 'PES',
    min: 1,
    max: 10,
    positive: 8,
    kinds: { Q1: 'rating' },
  });
  const p = buildSurveyReport(a, 'en');
  assert.equal(p.filter((p) => p.chart).length, 2);
  assert.ok(p.some((p) => p.section === 'proposed-improvement-plan'));
  assert.ok(!p.some((p) => p.section === 'priority-courses'));
  assert.ok(!p.some((p) => p.title.includes('CES')));
});
test('manifest never describes absent reconciliation or visual approval as completed', () => {
  const a = analysis(),
    p = buildSurveyReport(a, 'en'),
    m = reportManifest(a, p);
  assert.equal(m.charts, 2);
  assert.equal(m.courses, 1);
  assert.equal(m.dataReview.status, 'unverified');
  assert.equal(m.designReview, 'pending-visual-review');
});
test('non-CES ratings use confirmed question types and never invent course counts', () => {
  const a = analyzeRows([{ Program: 'A', Q17: 1 }], ['Program', 'Q17'], {
    type: 'PES',
    min: 1,
    max: 10,
    positive: 8,
    kinds: { Q17: 'rating' },
  });
  const pages = buildSurveyReport(a, 'en');
  assert.ok(pages.every((p) => !p.notes?.includes('Q17–Q19 are not scored')));
  const areas = pages.find((p) => p.section === 'areas-for-improvement');
  assert.ok(areas.headers.every((h) => !h.includes('Courses')));
  assert.equal(areas.rows[0][2], '1.00');
  assert.equal(reportManifest(a, pages).courses, 0);
});
