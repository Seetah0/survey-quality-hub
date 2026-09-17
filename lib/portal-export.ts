import * as XLSX from 'xlsx';
import type { Dataset } from './portal-model';
import type { Lang } from './analysis';
import { coursePages, outcomeGap } from './course-report';
import { reportPages, paginateTables } from './export';
import type { ReportPage } from './report-model';
export function buildPortalPages(items: Dataset[], lang: Lang): ReportPage[] {
  if (!items.length) throw new Error('NO_REPORTS');
  if (items.some((d) => d.analysis?.needsConfirmation))
    throw new Error('CONFIRM_ANALYSIS_REQUIRED');
  const pages = items.flatMap((d) =>
    d.course
      ? paginateTables(coursePages(d.course, lang))
      : d.analysis
        ? reportPages(d.analysis, lang)
        : [],
  );
  return [
    {
      title:
        lang === 'ar' ? 'تقرير الجودة الشامل' : 'Comprehensive Quality Report',
      subtitle: [...new Set(items.map((d) => d.year))].join(' • '),
      cover: true,
    },
    ...pages,
  ];
}
export function exportWorkbook(items: Dataset[], lang: Lang) {
  const wb = XLSX.utils.book_new();
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  function add(name: string, rows: unknown[][]) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (rows[0] || []).map((_, i) => ({ wch: i === 0 ? 25 : 22 }));
    if (rows.length > 1) ws['!autofilter'] = { ref: ws['!ref']! };
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  add(t('دليل التقرير', 'Report guide'), [
    [
      t('الملف', 'Source'),
      t('القسم', 'Section'),
      t('السنة', 'Year'),
      t('النوع', 'Type'),
    ],
    ...items.map((d) => [
      d.name,
      d.section,
      d.year,
      d.course ? 'CLO / PLO direct' : d.analysis?.type,
    ]),
    [
      t('المنهجية', 'Method'),
      t(
        'لا AI. القيم الفارغة لا تُحسب أصفارًا. نواتج التعلم المباشرة منفصلة عن رضا الاستبيانات.',
        'No AI. Missing values are not zero. Direct outcomes and survey satisfaction are separate.',
      ),
    ],
  ]);
  const grades: unknown[][] = [
    ['File', 'Year', 'Course', 'Grade', 'Count', 'Source percentage'],
  ];
  const outcomes: unknown[][] = [
    [
      'File',
      'Year',
      'Course',
      'CLO',
      'PLO',
      'Description',
      'Assessment',
      'Target %',
      'Actual %',
      'Gap (pp)',
      'Source comment',
    ],
  ];
  const statuses: unknown[][] = [
    ['File', 'Course', 'Started', 'Completed', 'Status', 'Count'],
  ];
  const metrics: unknown[][] = [
    [
      'File',
      'Year',
      'Survey',
      'Scope',
      'Program',
      'Course',
      'Question',
      'Label',
      'Valid n',
      'Mean',
      'Positive %',
      'Positive n',
      'Empty',
      'Non-numeric',
      'Out of range',
    ],
  ];
  const comments: unknown[][] = [['File', 'Question', 'Comment', 'Count']];
  const issues: unknown[][] = [['File', 'Issue', 'Count', 'Detail']];
  const history: unknown[][] = [
    ['File', 'Sheet', 'Survey', 'Question', 'Label', 'Year', 'Value', 'Cell'],
  ];
  for (const d of items) {
    const c = d.course;
    if (c) {
      c.grades.forEach((g) =>
        grades.push([d.name, d.year, c.code, g.grade, g.count, g.percentage]),
      );
      c.outcomes.forEach((o) =>
        outcomes.push([
          d.name,
          d.year,
          c.code,
          o.code,
          o.plo,
          o.description,
          o.method,
          o.target,
          o.actual,
          outcomeGap(o),
          o.comment,
        ]),
      );
      c.statuses.forEach((s) =>
        statuses.push([
          d.name,
          c.code,
          c.started,
          c.completed,
          s.label,
          s.count,
        ]),
      );
      c.issues.forEach((v) => issues.push([d.name, v, 1, '']));
    }
    const a = d.analysis;
    if (a) {
      for (const g of [
        a.overall,
        ...a.programs,
        ...a.programs.flatMap((p) => p.courses || []),
      ])
        for (const q of a.questions.filter((q) => q.kind === 'rating')) {
          const m = g.questions[q.id];
          if (m)
            metrics.push([
              d.name,
              d.year,
              a.type,
              g.name,
              g.program,
              g.code,
              q.id,
              lang === 'ar' ? q.ar : q.en,
              m.valid,
              m.mean,
              m.positivity,
              m.positive,
              m.empty,
              m.nonNumeric,
              m.outOfRange,
            ]);
        }
      a.comments.forEach((q) =>
        q.top.forEach((c) =>
          comments.push([d.name, q.question, c.text, c.count]),
        ),
      );
      a.issues.forEach((v) =>
        issues.push([d.name, v.code, v.count, v.detail || '']),
      );
      a.historical?.forEach((v) =>
        history.push([
          d.name,
          v.sheet,
          v.survey,
          v.question,
          v.label,
          v.year,
          v.value,
          v.cell,
        ]),
      );
    }
  }
  add(t('الدرجات', 'Grades'), grades);
  add(t('نواتج التعلم', 'Learning outcomes'), outcomes);
  add(t('حالات الطلبة', 'Student statuses'), statuses);
  add(t('تحليل الأسئلة', 'Question analysis'), metrics);
  add(t('التعليقات', 'Comments'), comments);
  add(t('جودة البيانات', 'Data quality'), issues);
  add(t('البيانات التاريخية', 'Historical data'), history);
  const pages = buildPortalPages(items, lang);
  add(t('التحليل وخطة التحسين', 'Findings and plans'), [
    ['Page', 'Section', 'Title', 'Evidence / action'],
    ...pages.flatMap((p, i) =>
      (p.lines || []).map((line) => [i + 1, p.section || '', p.title, line]),
    ),
  ]);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}
