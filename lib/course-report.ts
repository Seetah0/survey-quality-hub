import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { validateZip } from './analysis';
import type { Lang } from './analysis';
import type { ReportPage } from './report-model';

export type Outcome = {
  code: string;
  description: string;
  plo: string;
  method: string;
  target: number | null;
  actual: number | null;
  comment: string;
};
export type CourseReport = {
  title: string;
  code: string;
  program: string;
  department: string;
  academicYear: string;
  semester: string;
  started: number | null;
  completed: number | null;
  grades: { grade: string; count: number | null; percentage: number | null }[];
  statuses: { label: string; count: number | null }[];
  outcomes: Outcome[];
  recommendations: string[];
  previousPlan: string[][];
  issues: string[];
};
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const text = (node: Element) =>
  Array.from(node.getElementsByTagNameNS(ns, 'p'))
    .map((p) =>
      Array.from(p.getElementsByTagNameNS(ns, 't'))
        .map((t) => t.textContent || '')
        .join(''),
    )
    .join('\n')
    .trim();
const num = (s: string) => {
  const value = s
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[%٪,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value))
    ? Number(value)
    : null;
};
export function parseCourseXml(xml: string): CourseReport {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('UNSUPPORTED_DOCUMENT');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const tables = Array.from(doc.getElementsByTagNameNS(ns, 'tbl')).map((t) =>
    Array.from(t.getElementsByTagNameNS(ns, 'tr')).map((r) =>
      Array.from(r.getElementsByTagNameNS(ns, 'tc')).map((c) =>
        text(c as unknown as Element),
      ),
    ),
  );
  const cells = tables.flat(2);
  const field = (label: string) =>
    cells
      .find((c) => c.toLowerCase().startsWith(label.toLowerCase() + ':'))
      ?.split(':')
      .slice(1)
      .join(':')
      .trim() || '';
  const c: CourseReport = {
    title: field('Course Title'),
    code: field('Course Code'),
    department: field('Department'),
    program: field('Program'),
    academicYear: field('Academic Year'),
    semester: field('Semester'),
    started: num(field('Number of Students (Starting the Course)')),
    completed: num(field('Number of Students (Completed the Course)')),
    grades: [],
    statuses: [],
    outcomes: [],
    recommendations: [],
    previousPlan: [],
    issues: [],
  };
  if (!c.code || !c.title) throw new Error('COURSE_TEMPLATE_REQUIRED');
  const gt = tables.find((t) =>
    t.some((r) => r.includes('A+') && r.includes('F')),
  );
  if (gt) {
    const headers = gt.find((r) => r.includes('A+'))!;
    const counts = gt.find((r) => /number of students/i.test(r[0] || '')) || [];
    const percentages = gt.find((r) => /percentage/i.test(r[0] || '')) || [];
    for (let i = 1; i < headers.length; i++) {
      const grade = headers[i].trim();
      if (/^(A\+?|B\+?|C\+?|D\+?|F)$/.test(grade))
        c.grades.push({
          grade,
          count: num(counts[i] || ''),
          percentage: num(percentages[i] || ''),
        });
      else if (grade)
        c.statuses.push({ label: grade, count: num(counts[i] || '') });
    }
  }
  const ot = tables.find((t) =>
    t.some((r) => r.some((cell) => /Related PLO/i.test(cell))),
  );
  for (const row of ot || []) {
    if (!/^\d+\.\d+$/.test(row[0]?.trim()) || !row[1]?.trim() || row.length < 7)
      continue;
    c.outcomes.push({
      code: row[0],
      description: row[1],
      plo: row[2],
      method: row[3],
      target: num(row[4]),
      actual: num(row[5]),
      comment: row[6],
    });
  }
  const oi = ot ? tables.indexOf(ot) : -1;
  if (oi >= 0 && tables[oi + 1]?.[0]?.length === 1)
    c.recommendations = tables[oi + 1].flat().filter(Boolean);
  const pt = tables.find((t) =>
    t.some(
      (r) =>
        /Recommendations/i.test(r[0] || '') &&
        /Actions/i.test(r[1] || '') &&
        /Support/i.test(r[2] || ''),
    ),
  );
  c.previousPlan = (pt?.slice(1) || []).filter((r) =>
    r.some((v) => v.trim() && !/^(none|-|n\/a)$/i.test(v.trim())),
  );
  if (!c.outcomes.length)
    c.issues.push('لم يُعثر على جدول نواتج تعلم قابل للتحليل.');
  if (
    c.grades.length &&
    c.grades.every((g) => g.count !== null) &&
    c.completed !== null &&
    c.grades.reduce((s, g) => s + (g.count || 0), 0) !== c.completed
  )
    c.issues.push(
      'مجموع توزيع الدرجات لا يساوي عدد الطلبة المكتملين في المصدر.',
    );
  for (const o of c.outcomes) {
    if (o.actual === null || o.target === null)
      c.issues.push(`الناتج ${o.code}: نتيجة أو مستهدف غير متاح.`);
    if (
      (o.actual !== null && o.actual > 100) ||
      (o.target !== null && o.target > 100)
    ) {
      c.issues.push(
        `الناتج ${o.code}: نسبة خارج النطاق 0–100؛ استُبعدت من المقارنة.`,
      );
      if (o.actual !== null && o.actual > 100) o.actual = null;
      if (o.target !== null && o.target > 100) o.target = null;
    }
  }
  return c;
}
export async function readCourse(bytes: Uint8Array) {
  validateZip(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('COURSE_TEMPLATE_REQUIRED');
  return parseCourseXml(await file.async('string'));
}
export const outcomeGap = (o: Outcome) =>
  o.actual === null || o.target === null ? null : o.actual - o.target;
export function coursePages(c: CourseReport, lang: Lang): ReportPage[] {
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const f = (n: number | null) =>
    n === null ? t('غير متاح', 'N/A') : String(Math.round(n * 100) / 100);
  const pages: ReportPage[] = [
    {
      title: c.title,
      subtitle: `${c.code} • ${c.academicYear} • ${c.semester}`,
      cover: true,
      courseId: c.code,
    },
    {
      title: t(
        'لوحة المقرر وتوزيع الدرجات',
        'Course dashboard and grade distribution',
      ),
      subtitle: c.code,
      lines: [
        `${c.program} • ${t('المسجلون', 'Started')}: ${f(c.started)} • ${t('المكتملون', 'Completed')}: ${f(c.completed)}`,
      ],
      headers: [
        t('الدرجة', 'Grade'),
        t('العدد', 'Count'),
        t('نسبة المصدر %', 'Source %'),
      ],
      rows: c.grades.map((g) => [g.grade, f(g.count), f(g.percentage)]),
    },
    {
      title: t('توزيع درجات المقرر', 'Course grade distribution'),
      subtitle: c.code,
      chart: {
        metric: 'mean',
        label: t('العدد', 'Count'),
        sampleLabel: 'Total',
        note: t(
          'الأعداد كما وردت في المصدر؛ لا تُجمع مع حالات الطلبة.',
          'Counts as documented; do not add overlapping student statuses.',
        ),
        categories: c.grades.map((g) => g.grade),
        values: c.grades.map((g) => g.count),
        valid: c.grades.map(() => c.completed || 0),
        max: Math.max(1, ...c.grades.map((g) => g.count || 0)),
      },
    },
    {
      title: t('حالات الطلبة', 'Student statuses'),
      subtitle: c.code,
      headers: [t('الحالة', 'Status'), t('العدد', 'Count')],
      rows: c.statuses.map((s) => [s.label, f(s.count)]),
      lines: [
        t(
          'حالات المصدر قد تتداخل؛ لا تُجمع مع توزيع الدرجات.',
          'Source statuses may overlap; they are not added to grade counts.',
        ),
      ],
    },
    {
      title: t('نواتج التعلم والمستهدفات', 'Learning outcomes and targets'),
      subtitle: c.code,
      headers: [
        'CLO',
        'PLO',
        t('المستهدف %', 'Target %'),
        t('الفعلي %', 'Actual %'),
        t('الفجوة بالنقاط', 'Gap (pp)'),
      ],
      rows: c.outcomes.map((o) => [
        o.code,
        o.plo,
        f(o.target),
        f(o.actual),
        f(outcomeGap(o)),
      ]),
    },
  ];
  for (let i = 0; i < c.outcomes.length; i += 12) {
    const outcomes = c.outcomes.slice(i, i + 12);
    pages.splice(4, 0, {
      title: t(
        'النتائج الفعلية لنواتج التعلم',
        'Actual learning outcome results',
      ),
      subtitle: c.code,
      chart: {
        metric: 'mean',
        label: t('الفعلي %', 'Actual %'),
        sampleLabel: 'Target %',
        note: t(
          'قياس مباشر؛ المستهدف الخاص بكل ناتج موضح في الجدول.',
          'Direct assessment; each outcome target is listed in the table.',
        ),
        categories: outcomes.map((o) => 'CLO ' + o.code),
        values: outcomes.map((o) => o.actual),
        valid: outcomes.map((o) => o.target ?? 0),
        max: 100,
      },
    });
  }
  for (const o of c.outcomes)
    pages.push({
      title: `${t('دليل ناتج التعلم', 'Learning outcome evidence')} ${o.code}`,
      subtitle: `${c.code} • PLO ${o.plo}`,
      lines: [
        o.description,
        `${t('طريقة القياس', 'Assessment')}: ${o.method}`,
        `${t('تعليق المصدر', 'Source comment')}: ${o.comment || '—'}`,
      ],
    });
  const strong = c.outcomes.filter((o) => (outcomeGap(o) ?? -1) >= 0);
  const weak = c.outcomes
    .filter((o) => outcomeGap(o) !== null && outcomeGap(o)! < 0)
    .sort((a, b) => outcomeGap(a)! - outcomeGap(b)!);
  pages.push({
    title: t(
      'نقاط القوة وفرص التحسين',
      'Strengths and improvement opportunities',
    ),
    subtitle: c.code,
    lines: [
      ...strong.map(
        (o) =>
          `${t('تحقق المستهدف', 'Target met')} CLO ${o.code}: ${f(o.actual)}% ≥ ${f(o.target)}%.`,
      ),
      ...weak.map(
        (o) =>
          `${t('أقل من المستهدف', 'Below target')} CLO ${o.code}: ${f(o.actual)}% / ${f(o.target)}% (${f(outcomeGap(o))} pp).`,
      ),
      t(
        'هذه نتائج قياس مباشر مرتبطة بـPLO؛ لا تمثل رضا المستجيبين في استبيان PLO أو CES.',
        'These are direct assessment results mapped to PLOs, not PLO or CES survey satisfaction.',
      ),
    ],
  });
  for (const o of weak)
    pages.push({
      title: t(
        'خطة تحسين مقترحة للمراجعة',
        'Proposed improvement plan for review',
      ),
      subtitle: `${c.code} • CLO ${o.code} • PLO ${o.plo}`,
      lines: [
        `${t('الدليل', 'Evidence')}: ${f(o.actual)}% / ${f(o.target)}%.`,
        t(
          'مراجعة أسئلة التقييم المرتبطة بالناتج، وتحديد المهارات المتعثرة، ثم تقديم تدريبات وتغذية راجعة وإعادة القياس.',
          'Review outcome assessment items, identify difficult skills, provide practice and feedback, then reassess.',
        ),
        `${t('المؤشر المستهدف', 'Success measure')}: ${f(o.target)}%.`,
        t(
          'المسؤول والموعد: يحددان عند الاعتماد. المقترح قائم على قواعد حسابية دون AI ولا يثبت تنفيذ إجراء سابق.',
          'Owner and deadline: to be assigned on approval. Rule-based proposal without AI; no prior implementation is assumed.',
        ),
      ],
    });
  if (!weak.length)
    pages.push({
      title: t('المتابعة والتحسين', 'Monitoring and improvement'),
      lines: [
        t(
          'المحافظة على الممارسات الناجحة وإعادة القياس في الدورة القادمة. غياب فجوة محسوبة لا يثبت غياب جميع المشكلات.',
          'Maintain effective practices and reassess next cycle. No calculated gap does not prove absence of all issues.',
        ),
      ],
    });
  if (c.recommendations.length)
    pages.push({
      title: t('توصيات التقرير الأصلي', 'Original report recommendations'),
      lines: c.recommendations,
    });
  for (const row of c.previousPlan)
    pages.push({
      title: t('الخطة الواردة في المصدر', 'Plan documented in source'),
      lines: row,
    });
  if (c.issues.length)
    pages.push({
      title: t('مراجعة جودة البيانات', 'Data quality review'),
      lines: c.issues,
    });
  return pages;
}
