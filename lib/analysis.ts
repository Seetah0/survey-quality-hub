import * as XLSX from 'xlsx';

export type Lang = 'ar' | 'en';
export type SurveyType =
  | 'CES'
  | 'PES'
  | 'EMPLOYEE'
  | 'GRADUATE'
  | 'EMPLOYER'
  | 'UNKNOWN';
export type QuestionKind = 'rating' | 'open' | 'categorical' | 'unresolved';
export type Band = 'high' | 'acceptable' | 'improve' | null;
export type Question = {
  id: string;
  column: string;
  ar: string;
  en: string;
  kind: QuestionKind;
};
export type Metric = {
  sum: number;
  valid: number;
  positive: number;
  empty: number;
  nonNumeric: number;
  outOfRange: number;
  mean: number | null;
  positivity: number | null;
  meanBand: Band;
  positivityBand: Band;
};
export type Group = {
  id: string;
  name: string;
  code: string;
  program: string;
  level: string;
  rows: number;
  expected: number | null;
  responseRate: number | null;
  smallSample: boolean;
  overall: Metric;
  questions: Record<string, Metric>;
  priority: boolean;
  levels?: Group[];
  courses?: Group[];
};
export type QualityIssue = { code: string; count: number; detail?: string };
export type AnalysisOptions = {
  type?: SurveyType;
  min?: number;
  max?: number;
  positive?: number;
  kinds?: Record<string, QuestionKind>;
};
export type Analysis = {
  version: 1;
  kind: 'raw' | 'historical';
  sourceSheet: string;
  type: SurveyType;
  detectedType: SurveyType;
  needsConfirmation: boolean;
  detection: string[];
  min: number;
  max: number;
  positive: number;
  questions: Question[];
  overall: Group;
  programs: Group[];
  issues: QualityIssue[];
  comments: {
    question: string;
    count: number;
    ignored: number;
    top: { text: string; count: number }[];
    terms: { text: string; count: number }[];
  }[];
  validation: {
    source: string;
    compared: number;
    matched: number;
    mismatches: number;
    maxDifference: number;
  }[];
  historical?: {
    program: string;
    survey: string;
    question: string;
    label: string;
    year: number;
    value: number;
    cell: string;
    sheet: string;
  }[];
  cohorts: string[];
  rowFingerprints: string[];
};
type Row = Record<string, unknown>;
const AR = [
  'شرح مخطط المقرر',
  'توضيح مصادر المساعدة المتاحة',
  'الالتزام بمخطط المقرر',
  'التواجد خلال الساعات المكتبية',
  'الحماس في تدريس المقرر',
  'الالتزام',
  'فائدة مادة المقرر',
  'تشجيع الأسئلة',
  'الإلهام والتحفيز',
  'ربط المقرر بمقررات أخرى',
  'تقديم التغذية الراجعة في الوقت المناسب',
  'كفاية الموارد',
  'الدعم الفني',
  'تنمية مهارات حل المشكلات',
  'الرضا العام عن المقرر',
  'تنظيم المقرر',
];
const EN = [
  'Course outline explained',
  'Sources of help explained',
  'Course outline followed',
  'Available during office hours',
  'Enthusiasm in teaching',
  'Commitment',
  'Usefulness of course material',
  'Encouraging questions',
  'Inspiration and motivation',
  'Links to other courses',
  'Timely feedback',
  'Adequacy of resources',
  'Technical support',
  'Problem-solving skills',
  'Overall course satisfaction',
  'Course organization',
];
const norm = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v).trim()
    : '';
const key = (v: unknown) =>
  norm(v)
    .toLowerCase()
    .replace(/[\s_\-/]/g, '');
const field = (row: Row, ...names: string[]) => {
  const k = Object.keys(row).find((k) => names.some((n) => key(k) === key(n)));
  return k ? row[k] : undefined;
};
const QID = /^Q\s*(\d+)(?:\s*[:.\-–]?\s+(.+)|\s*[:.\-–]\s*(.*))?$/i;
const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
export const formatMetric = (
  n: number | null,
  digits: number,
  lang: Lang = 'en',
) =>
  n === null
    ? lang === 'ar'
      ? 'غير متاح'
      : 'Unavailable'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export function band(
  n: number | null,
  mode: 'mean' | 'positivity',
  max = 5,
  min = 1,
): Band {
  if (n === null || (mode === 'mean' && (max !== 5 || min !== 1))) return null;
  return n >= (mode === 'mean' ? 3.6 : 80)
    ? 'high'
    : n >= (mode === 'mean' ? 2.6 : 60)
      ? 'acceptable'
      : 'improve';
}
function blankMetric(): Metric {
  return {
    sum: 0,
    valid: 0,
    positive: 0,
    empty: 0,
    nonNumeric: 0,
    outOfRange: 0,
    mean: null,
    positivity: null,
    meanBand: null,
    positivityBand: null,
  };
}
function finish(m: Metric, min: number, max: number): Metric {
  m.mean = m.valid ? m.sum / m.valid : null;
  m.positivity = m.valid ? (m.positive / m.valid) * 100 : null;
  m.meanBand = band(m.mean, 'mean', max, min);
  m.positivityBand = band(m.positivity, 'positivity');
  return m;
}
export function calculate(
  values: unknown[],
  min = 1,
  max = 5,
  positive = 4,
): Metric {
  const m = blankMetric();
  for (const v of values) {
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim()))
      m.empty++;
    else if (!finite(v)) m.nonNumeric++;
    else if (v < min || v > max) m.outOfRange++;
    else {
      m.sum += v;
      m.valid++;
      if (v >= positive) m.positive++;
    }
  }
  return finish(m, min, max);
}
function combine(ms: Metric[], min: number, max: number) {
  const m = blankMetric();
  for (const x of ms)
    for (const k of [
      'sum',
      'valid',
      'positive',
      'empty',
      'nonNumeric',
      'outOfRange',
    ] as const)
      m[k] += x[k];
  return finish(m, min, max);
}
function detect(headers: string[]): { type: SurveyType; reasons: string[] } {
  const h = headers.map(key),
    has = (...ss: string[]) => ss.some((s) => h.includes(key(s)));
  const signals: SurveyType[] = [];
  const reasons: string[] = [];
  if (
    has('CourseName') &&
    has('CourseCode', 'SubjCat') &&
    has('StudentYear') &&
    headers.some((h) => QID.test(h))
  ) {
    signals.push('CES');
    reasons.push('course-name-code-year-questions');
  }
  if (
    has('EmployeeId', 'EmployeeName', 'WorkEnvironment', 'JobTitle', 'StaffId')
  ) {
    signals.push('EMPLOYEE');
    reasons.push('employee-work-fields');
  }
  if (has('GraduationYear', 'GraduateStatus', 'AlumniStatus')) {
    signals.push('GRADUATE');
    reasons.push('graduation-fields');
  }
  if (has('EmployerName', 'Employer', 'GraduateEvaluation', 'CompanyName')) {
    signals.push('EMPLOYER');
    reasons.push('employer-fields');
  }
  if (
    has('ProgramName', 'DegreeCode', 'Program', 'ProgramCode') &&
    !has('CourseName', 'CourseCode', 'SubjCat') &&
    !signals.length
  ) {
    signals.push('PES');
    reasons.push('program-without-course');
  }
  return {
    type: signals.length === 1 ? signals[0] : 'UNKNOWN',
    reasons: reasons.length ? reasons : ['insufficient-evidence'],
  };
}
function cohort(r: Row) {
  return JSON.stringify([
    norm(field(r, 'Campus')),
    norm(field(r, 'College')),
    program(r),
    norm(field(r, 'AcadYear', 'AcademicYear')),
    norm(field(r, 'Term', 'Semester')),
    courseCode(r),
  ]);
}
function program(r: Row) {
  return (
    norm(field(r, 'DegreeCode', 'ProgramCode', 'ProgramName', 'Program')) || '—'
  );
}
function level(r: Row) {
  return norm(field(r, 'StudentYear', 'Level')) || '—';
}
function courseCode(r: Row) {
  return norm(field(r, 'SubjCat', 'CourseCode')) || '—';
}
const junk = /^(?:[\s.\-_،,/]+|لا\s*يوجد|لا\s*شيء|nothing|none|no|n\/?a)$/i;
function textSummary(rows: Row[], q: Question) {
  const counts = new Map<string, number>();
  const terms = new Map<string, number>();
  let ignored = 0;
  for (const r of rows) {
    const txt = norm(r[q.column]);
    if (!txt || junk.test(txt)) {
      ignored++;
      continue;
    }
    counts.set(txt, (counts.get(txt) || 0) + 1);
    for (const word of new Set(
      txt
        .toLowerCase()
        .replace(/[إأآ]/g, 'ا')
        .match(/[\p{L}]{3,}/gu) || [],
    )) {
      if (
        [
          'the',
          'and',
          'was',
          'with',
          'this',
          'that',
          'have',
          'من',
          'على',
          'الى',
          'التي',
          'كان',
          'كل',
          'في',
        ].includes(word)
      )
        continue;
      terms.set(word, (terms.get(word) || 0) + 1);
    }
  }
  const sorted = (m: Map<string, number>) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .map(([text, count]) => ({ text, count }));
  return {
    question: q.id,
    count: [...counts.values()].reduce((a, b) => a + b, 0),
    ignored,
    top: sorted(counts),
    terms: sorted(terms),
  };
}
export function analyzeRows(
  rows: Row[],
  headers: string[],
  options: AnalysisOptions = {},
  labels: Record<string, string> = {},
): Analysis {
  const detected = detect(headers);
  const type =
    options.type && options.type !== 'UNKNOWN' ? options.type : detected.type;
  const min = type === 'CES' ? 1 : (options.min ?? 1),
    max = type === 'CES' ? 5 : (options.max ?? 5),
    positive = type === 'CES' ? 4 : (options.positive ?? 4);
  if (
    ![min, max, positive].every(Number.isFinite) ||
    min >= max ||
    positive < min ||
    positive > max
  )
    throw new Error('INVALID_SCALE');
  const questions: Question[] = headers.flatMap((column) => {
    const match = column.match(QID);
    if (!match) return [];
    const id = 'Q' + Number(match[1]);
    const n = Number(match[1]);
    if (n < 1) return [];
    const label = norm(match[2] || match[3] || labels[id]);
    let kind: QuestionKind = 'unresolved';
    if (type === 'CES' && n <= 16) kind = 'rating';
    else if (type === 'CES' && n <= 19) kind = 'open';
    else if (
      label &&
      /comment|suggest|describe|open.ended|اقتراح|تعليق|اشرح/i.test(label)
    )
      kind = 'open';
    else if (label && /gender|category|department|جنس|فئة|قسم/i.test(label))
      kind = 'categorical';
    else if (
      label &&
      /satisf|agree|adequat|helpful|quality|رضا|راض|موافق|كفاية/i.test(label)
    )
      kind = 'rating';
    if (options.kinds?.[id] && !(type === 'CES' && n <= 19))
      kind = options.kinds[id];
    return [
      {
        id,
        column,
        ar: type === 'CES' && n <= 16 ? AR[n - 1] : label || id,
        en: type === 'CES' && n <= 16 ? EN[n - 1] : label || id,
        kind,
      },
    ];
  });
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw new Error('DUPLICATE_COLUMNS');
  if (!questions.length && rows.length) throw new Error('NO_QUESTION_COLUMNS');
  const needsConfirmation =
    type === 'UNKNOWN' ||
    (type !== 'CES' &&
      (options.min === undefined ||
        options.max === undefined ||
        options.positive === undefined)) ||
    questions.some((q) => q.kind === 'unresolved');
  const issues: QualityIssue[] = [];
  const cohorts = new Map<string, Row[]>();
  for (const r of rows) {
    const c = cohort(r);
    if (!cohorts.has(c)) cohorts.set(c, []);
    cohorts.get(c)!.push(r);
  }
  const expectedByCohort = new Map<string, number | null>();
  for (const [c, rs] of cohorts) {
    const values = rs.map((r) => field(r, 'Expected', 'ExpectedCount'));
    const valid = new Set(values.filter((v) => finite(v) && v > 0));
    const missing = values.some((v) => !finite(v) || v <= 0);
    if (valid.size !== 1 || missing) {
      expectedByCohort.set(c, null);
      if (valid.size > 1)
        issues.push({
          code: 'conflicting-expected',
          count: 1,
          detail: courseCode(rs[0]),
        });
    } else expectedByCohort.set(c, [...valid][0] as number);
  }
  function make(
    rs: Row[],
    id: string,
    name: string,
    code = '',
    p = '',
    l = '',
  ): Group {
    const metrics: Record<string, Metric> = {};
    for (const q of questions.filter((q) => q.kind === 'rating'))
      metrics[q.id] = calculate(
        rs.map((r) => r[q.column]),
        min,
        max,
        positive,
      );
    let expected: number | null = 0;
    const local = new Map<string, number>();
    for (const r of rs) local.set(cohort(r), (local.get(cohort(r)) || 0) + 1);
    for (const [c, count] of local) {
      const e = expectedByCohort.get(c);
      if (e == null || count !== cohorts.get(c)!.length) {
        expected = null;
        break;
      }
      expected += e;
    }
    return {
      id,
      name,
      code,
      program: p,
      level: l,
      rows: rs.length,
      expected,
      responseRate: expected ? (rs.length / expected) * 100 : null,
      smallSample: rs.length < 10,
      overall: combine(Object.values(metrics), min, max),
      questions: metrics,
      priority:
        type === 'CES' &&
        metrics.Q15?.positivity !== null &&
        metrics.Q15?.positivity !== undefined &&
        metrics.Q15.positivity < 60,
    };
  }
  const groupBy = (rs: Row[], fn: (r: Row) => string) => {
    const out = new Map<string, Row[]>();
    for (const r of rs) {
      const k = fn(r);
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(r);
    }
    return out;
  };
  const programs: Group[] = [];
  for (const [p, rs] of groupBy(rows, program)) {
    const g = make(
      rs,
      p,
      norm(field(rs[0], 'FormalDesc', 'ProgramName', 'Program')) || p,
      p,
      p,
    );
    g.courses = [...groupBy(rs, cohort)].map(([c, cr]) =>
      make(
        cr,
        c,
        norm(field(cr[0], 'CourseName')) || courseCode(cr[0]),
        courseCode(cr[0]),
        p,
        [...new Set(cr.map(level))].join(', '),
      ),
    );
    g.levels = [...groupBy(rs, level)]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([l, lr]) => {
        const lg = make(lr, p + '/' + l, l, l, p, l);
        lg.courses = [...groupBy(lr, cohort)].map(([c, cr]) =>
          make(
            cr,
            c + '/' + l,
            norm(field(cr[0], 'CourseName')) || courseCode(cr[0]),
            courseCode(cr[0]),
            p,
            l,
          ),
        );
        return lg;
      });
    programs.push(g);
  }
  const overall = make(rows, 'all', 'All');
  if (overall.overall.nonNumeric)
    issues.push({ code: 'non-numeric', count: overall.overall.nonNumeric });
  if (overall.overall.outOfRange)
    issues.push({ code: 'out-of-range', count: overall.overall.outOfRange });
  if (overall.overall.empty)
    issues.push({ code: 'empty', count: overall.overall.empty });
  if (questions.some((q) => q.kind === 'unresolved'))
    issues.push({
      code: 'unresolved-questions',
      count: questions.filter((q) => q.kind === 'unresolved').length,
    });
  if (overall.responseRate !== null && overall.responseRate > 100)
    issues.push({ code: 'response-over-100', count: 1 });
  return {
    version: 1,
    kind: 'raw',
    sourceSheet: 'RawData',
    type,
    detectedType: detected.type,
    needsConfirmation,
    detection: detected.reasons,
    min,
    max,
    positive,
    questions,
    overall,
    programs,
    issues,
    comments: questions
      .filter((q) => q.kind === 'open')
      .map((q) => textSummary(rows, q)),
    validation: [],
    cohorts: [...cohorts.keys()],
    rowFingerprints: [],
  };
}
function historical(wb: XLSX.WorkBook): Analysis | null {
  const records: NonNullable<Analysis['historical']> = [];
  let errors = 0;
  const issues: QualityIssue[] = [];
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });
    const header = data.findIndex(
      (r) => r.filter((v) => finite(v) && v >= 2020 && v <= 2040).length >= 3,
    );
    if (header < 0 || sn.trim() === 'نتائج الأقسام') continue;
    const years = data[header]
      .map((v, i) => ({ v, i }))
      .filter((x) => finite(x.v) && x.v >= 2020 && x.v <= 2040);
    let survey = '';
    const title = norm(data[0]?.[0]) || sn;
    const p = /الرياضة/.test(sn) ? sn : title;
    if (p !== title)
      issues.push({ code: 'program-title-mismatch', count: 1, detail: sn });
    for (let r = header + 1; r < data.length; r++) {
      const row = data[r];
      if (row[0]) survey = norm(row[0]);
      for (const { v: year, i } of years) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: i })];
        if (cell?.t === 'e') {
          errors++;
          continue;
        }
        const value = row[i];
        if (!finite(value) || value >= 2020) continue;
        records.push({
          program: p,
          survey,
          question: norm(row[1]),
          label: norm(row[2]) || survey,
          year: year as number,
          value,
          cell: XLSX.utils.encode_cell({ r, c: i }),
          sheet: sn,
        });
      }
    }
  }
  if (!records.length) return null;
  const base = analyzeRows([], []);
  base.kind = 'historical';
  base.sourceSheet = 'Historical sheets';
  base.needsConfirmation = false;
  base.historical = records;
  base.issues = [
    ...issues,
    ...(errors ? [{ code: 'excel-reference-errors', count: errors }] : []),
  ];
  return base;
}
export function validateZip(bytes: Uint8Array) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('INVALID_WORKBOOK');
  const entries = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true);
  if (entries > 6000 || entries === 65535)
    throw new Error('WORKBOOK_TOO_LARGE');
  let pos = offset,
    total = 0;
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50)
      throw new Error('INVALID_WORKBOOK');
    total += view.getUint32(pos + 24, true);
    if (total > 50 * 1024 * 1024) throw new Error('WORKBOOK_TOO_LARGE');
    pos +=
      46 +
      view.getUint16(pos + 28, true) +
      view.getUint16(pos + 30, true) +
      view.getUint16(pos + 32, true);
  }
}
export function analyzeWorkbook(
  bytes: Uint8Array,
  options: AnalysisOptions = {},
): Analysis {
  if (bytes.length > 16 * 1024 * 1024) throw new Error('WORKBOOK_TOO_LARGE');
  validateZip(bytes);
  const wb = XLSX.read(bytes, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetRows: 50002,
  });
  const rawName = wb.SheetNames.find((s) => key(s) === 'rawdata');
  if (!rawName) {
    const h = historical(wb);
    if (h) return h;
    throw new Error('RAWDATA_REQUIRED');
  }
  const ws = wb.Sheets[rawName],
    range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  if (range.e.r > 50000 || range.e.c > 255)
    throw new Error('WORKBOOK_TOO_LARGE');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
  const headers = (grid[0] || []).map(norm);
  if (headers.filter(Boolean).length !== new Set(headers.filter(Boolean)).size)
    throw new Error('DUPLICATE_COLUMNS');
  const rows: Row[] = grid
    .slice(1)
    .filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''))
    .map((values) => {
      const row: Row = Object.create(null);
      headers.forEach((h, i) => {
        if (h) row[h] = values[i];
      });
      return row;
    });
  if (!rows.length) throw new Error('EMPTY_RAWDATA');
  const labels: Record<string, string> = {};
  for (const sn of wb.SheetNames.filter((s) =>
    /^(Mean|Cumulative)$/i.test(s),
  )) {
    const values = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], {
      header: 1,
      raw: true,
    });
    for (const row of values.slice(0, 15))
      for (const cell of row) {
        if (typeof cell !== 'string') continue;
        const m = cell.trim().match(/^Q\s*(\d+)\s*[:.-]?\s+(.+)$/i);
        if (m) labels['Q' + Number(m[1])] = m[2];
      }
  }
  const result = analyzeRows(rows, headers, options, labels);
  result.sourceSheet = rawName;
  for (const sn of wb.SheetNames.filter((s) =>
    /^(Mean|Cumulative)$/i.test(s),
  )) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], {
      header: 1,
      raw: true,
    });
    let compared = 0,
      matched = 0,
      maxDifference = 0;
    const headerIndex = grid.findIndex(
      (row) =>
        row.some((v) => key(v) === 'degreecode') &&
        row.some((v) => /^Q\s*1\b/i.test(norm(v))),
    );
    const header = headerIndex >= 0 ? grid[headerIndex] : undefined;
    const programColumn =
      header?.findIndex((v) => key(v) === 'degreecode') ?? -1;
    const sameRowCodeColumn =
      header?.findIndex((v) => key(v) === 'subjcat') ?? -1;
    const codeColumn =
      sameRowCodeColumn >= 0
        ? sameRowCodeColumn
        : headerIndex > 0
          ? grid[headerIndex - 1].findIndex((v) => key(v) === 'subjcat')
          : -1;
    const questionColumns = new Map<string, number>();
    header?.forEach((v, i) => {
      const m = norm(v).match(/^Q\s*(\d+)\b/i);
      if (m) questionColumns.set('Q' + Number(m[1]), i);
    });
    for (const row of grid) {
      if (programColumn < 0 || codeColumn < 0) continue;
      const p = result.programs.find(
        (p) => norm(row[programColumn]) === p.code,
      );
      const c = p?.courses?.find((c) => c.code === norm(row[codeColumn]));
      if (!c) continue;
      for (let q = 1; q <= 16; q++) {
        const col = questionColumns.get('Q' + q);
        if (col === undefined) continue;
        const v = row[col];
        const metric = c.questions['Q' + q];
        const calc =
          sn.toLowerCase() === 'mean' ? metric?.mean : metric?.positivity;
        if (!finite(v) || calc == null) continue;
        const diff = Math.abs(v - calc);
        compared++;
        maxDifference = Math.max(maxDifference, diff);
        if (diff <= (sn.toLowerCase() === 'mean' ? 0.051 : 0.51)) matched++;
      }
    }
    result.validation.push({
      source: sn,
      compared,
      matched,
      mismatches: compared - matched,
      maxDifference,
    });
  }
  let gradCompared = 0,
    gradMatched = 0,
    gradMax = 0;
  for (const p of result.programs)
    for (const c of p.courses || []) {
      const sn = wb.SheetNames.find(
        (s) => s.toLowerCase() === `grad_${p.code}_${c.code}`.toLowerCase(),
      );
      if (!sn) continue;
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], {
        header: 1,
        raw: true,
      });
      for (const row of grid) {
        const q = norm(row[0]);
        if (!/^\d+$/.test(q)) continue;
        const text = norm(row[2]);
        if (!/^\d+(?:\.\d+)?$/.test(text)) continue;
        const actual = c.questions['Q' + Number(q)]?.positivity;
        if (actual == null) continue;
        const diff = Math.abs(Number(text) - actual);
        gradCompared++;
        gradMax = Math.max(gradMax, diff);
        if (diff <= 0.51) gradMatched++;
      }
    }
  if (gradCompared)
    result.validation.push({
      source: 'Grad',
      compared: gradCompared,
      matched: gradMatched,
      mismatches: gradCompared - gradMatched,
      maxDifference: gradMax,
    });
  return result;
}

export function mergeAnalyses(items: Analysis[]): Analysis {
  if (!items.length) throw new Error('NO_REPORTS');
  const base = items[0];
  if (
    items.some(
      (a) =>
        a.kind !== 'raw' ||
        a.needsConfirmation ||
        a.type !== base.type ||
        a.min !== base.min ||
        a.max !== base.max ||
        a.positive !== base.positive ||
        JSON.stringify(a.questions.map((q) => [q.id, q.kind, q.ar, q.en])) !==
          JSON.stringify(base.questions.map((q) => [q.id, q.kind, q.ar, q.en])),
    )
  )
    throw new Error('INCOMPATIBLE_REPORTS');
  const seen = new Set<string>();
  for (const a of items)
    for (const c of a.cohorts) {
      if (seen.has(c)) throw new Error('OVERLAPPING_COHORTS');
      seen.add(c);
    }
  function merge(groups: Group[]): Group {
    const first = groups[0];
    const questions: Record<string, Metric> = {};
    for (const q of base.questions.filter((q) => q.kind === 'rating'))
      questions[q.id] = combine(
        groups.map((g) => g.questions[q.id]),
        base.min,
        base.max,
      );
    const rows = groups.reduce((s, g) => s + g.rows, 0);
    const expected = groups.every((g) => g.expected !== null)
      ? groups.reduce((s, g) => s + g.expected!, 0)
      : null;
    return {
      ...first,
      rows,
      expected,
      responseRate: expected ? (rows / expected) * 100 : null,
      smallSample: rows < 10,
      overall: combine(
        groups.map((g) => g.overall),
        base.min,
        base.max,
      ),
      questions,
      priority:
        base.type === 'CES' &&
        questions.Q15?.positivity != null &&
        questions.Q15.positivity < 60,
    };
  }
  const programs: Group[] = [];
  for (const p of new Set(items.flatMap((a) => a.programs.map((p) => p.id)))) {
    const gs = items.flatMap((a) => a.programs.filter((g) => g.id === p));
    const g = merge(gs);
    g.courses = gs.flatMap((g) => g.courses || []);
    g.levels = [];
    for (const l of new Set(
      gs.flatMap((g) => g.levels?.map((l) => l.level) || []),
    )) {
      const ls = gs.flatMap(
        (g) => g.levels?.filter((x) => x.level === l) || [],
      );
      const level = merge(ls);
      level.courses = ls.flatMap((l) => l.courses || []);
      g.levels.push(level);
    }
    programs.push(g);
  }
  return {
    ...base,
    sourceSheet: 'RawData (combined)',
    overall: merge(items.map((a) => a.overall)),
    programs,
    issues: items.flatMap((a) => a.issues),
    validation: items.flatMap((a) => a.validation),
    cohorts: [...seen],
    comments: base.questions
      .filter((q) => q.kind === 'open')
      .map((q) => {
        const cs = items.flatMap((a) =>
          a.comments.filter((c) => c.question === q.id),
        );
        const aggregate = (k: 'top' | 'terms') => {
          const m = new Map<string, number>();
          for (const c of cs)
            for (const t of c[k]) m.set(t.text, (m.get(t.text) || 0) + t.count);
          return [...m]
            .sort((a, b) => b[1] - a[1])
            .map(([text, count]) => ({ text, count }))
            .slice(0, k === 'top' ? 100 : 20);
        };
        return {
          question: q.id,
          count: cs.reduce((s, c) => s + c.count, 0),
          ignored: cs.reduce((s, c) => s + c.ignored, 0),
          top: aggregate('top'),
          terms: aggregate('terms'),
        };
      }),
  };
}
