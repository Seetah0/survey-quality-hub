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

  const f = (n: number | null, digits = 1) =>
    n === null
      ? t('غير متاح', 'N/A')
      : n.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
        });

  /*
   * ------------------------------------------------------------
   * Rule engine
   * ------------------------------------------------------------
   * Strength  = Actual >= Target
   * Weakness  = Actual < Target
   * Missing Target/Actual = not classified
   * ------------------------------------------------------------
   */

  const validOutcomes = c.outcomes.filter(
    (o) => o.target !== null && o.actual !== null,
  );

  const strengths = validOutcomes
    .filter((o) => outcomeGap(o)! >= 0)
    .sort((a, b) => outcomeGap(b)! - outcomeGap(a)!);

  const weaknesses = validOutcomes
    .filter((o) => outcomeGap(o)! < 0)
    .sort((a, b) => outcomeGap(a)! - outcomeGap(b)!);

  /*
   * Limit the visible CLO table so the exporter does not paginate
   * a single course into extra slides.
   *
   * The full data is still read and analyzed; this only controls
   * what appears visually on the first slide.
   */
  const visibleOutcomes = c.outcomes.slice(0, 7);
  const hiddenOutcomeCount = Math.max(0, c.outcomes.length - visibleOutcomes.length);

  /*
   * ------------------------------------------------------------
   * Improvement-action library
   * ------------------------------------------------------------
   */

  const actionForOutcome = (o: Outcome): string => {
    const plo = (o.plo || '').trim().toUpperCase();

    if (plo.startsWith('K')) {
      return t(
        'إضافة أمثلة توضيحية ومراجعة مركزة واختبارات قصيرة تكوينية مرتبطة بناتج التعلم.',
        'Add focused examples, revision activities, and formative quizzes aligned with the learning outcome.',
      );
    }

    if (plo.startsWith('S')) {
      return t(
        'زيادة التدريبات التطبيقية وتمارين حل المشكلات مع تغذية راجعة مباشرة ثم إعادة القياس.',
        'Increase practical exercises and problem-solving activities with direct feedback, then reassess.',
      );
    }

    if (plo.startsWith('V')) {
      return t(
        'إضافة أنشطة تطبيقية ودراسات حالة مرتبطة بالناتج مع معايير تقييم واضحة وتغذية راجعة.',
        'Add applied activities and case-based tasks aligned with the outcome, supported by clear rubrics and feedback.',
      );
    }

    return t(
      'مراجعة أدوات التقييم المرتبطة بالناتج، وتحديد المهارات المتعثرة، وتوفير تدريب إضافي وتغذية راجعة ثم إعادة القياس.',
      'Review assessment items linked to the outcome, identify difficult skills, provide additional practice and feedback, then reassess.',
    );
  };

  /*
   * ------------------------------------------------------------
   * Slide 1 data
   * ------------------------------------------------------------
   */

 
  /*
   * Grade distribution is kept as a compact summary on slide 1
   * instead of creating another slide.
   */
/*  const gradeSummary = c.grades
    .filter((g) => g.count !== null)
    .map((g) => `${g.grade}: ${f(g.count, 0)}`)
    .join(' | ');

  const strengthSummary =
    strengths.length > 0
      ? strengths
          .map(
            (o) =>
              `CLO ${o.code}: ${f(o.actual)}% ≥ ${f(o.target)}%`,
          )
          .join(' | ')
      : t(
          'لا توجد نواتج تعلم ذات بيانات مكتملة تجاوزت المستهدف.',
          'No learning outcomes with complete data exceeded the target.',
        );

const weaknessSummary =
  weaknesses.length > 0
    ? weaknesses
        .map(
          (o) =>
            `CLO ${o.code}: ${f(o.actual)}% < ${f(o.target)}%`,
        )
        .join(' | ')
    : t(
        'لا توجد فجوات سالبة محسوبة.',
        'No calculated learning-outcome gaps are below target.',
      );
*/
  /*
   * ------------------------------------------------------------
   * Slide 2 improvement plan
   * ------------------------------------------------------------
   *
   * Keep the most important weaknesses only so the report always
   * remains two slides per course.
   */

  const priorityWeaknesses = weaknesses.slice(0, 4);

  const improvementRows =
    priorityWeaknesses.length > 0
      ? priorityWeaknesses.map((o) => [
          `CLO ${o.code}`,
          `${f(o.actual)}% / ${f(o.target)}%\n${f(outcomeGap(o))} pp`,
          actionForOutcome(o),
          t('أعضاء المقرر', 'Course Members'),
          t(
            'الدورة القادمة',
            'Next cycle',
          ),
          `${t('تحقيق', 'Reach')} ≥ ${f(o.target)}%`,
        ])
      : [
          [
            t('المحافظة على الأداء', 'Maintain performance'),
            t(
              'جميع نواتج التعلم ذات البيانات المكتملة حققت المستهدف.',
              'All learning outcomes with complete data met their targets.',
            ),
            t(
              'المحافظة على الممارسات الحالية وإعادة القياس في الدورة القادمة.',
              'Maintain current practices and reassess in the next cycle.',
            ),
            t('أعضاء المقرر', 'Course Members'),
            t('الدورة القادمة', 'Next cycle'),
            t(
              'استمرار تحقيق المستهدفات.',
              'Maintain target achievement.',
            ),
          ],
        ];

  /*
   * ------------------------------------------------------------
   * Data-quality warnings
   * ------------------------------------------------------------
   */

  const dataWarnings: string[] = [];

  if (!c.outcomes.length) {
    dataWarnings.push(
      t(
        'لم يتم العثور على نواتج تعلم قابلة للتحليل.',
        'No analyzable learning outcomes were found.',
      ),
    );
  }

  const missingOutcomes = c.outcomes.filter(
    (o) => o.target === null || o.actual === null,
  ).length;

  if (missingOutcomes > 0) {
    dataWarnings.push(
      t(
        `${missingOutcomes} من نواتج التعلم تحتوي على Target أو Actual غير متاح.`,
        `${missingOutcomes} learning outcome(s) have a missing Target or Actual value.`,
      ),
    );
  }

  if (hiddenOutcomeCount > 0) {
    dataWarnings.push(
      t(
        `تم تحليل جميع نواتج التعلم، ويعرض الجدول أول 7 فقط للمحافظة على شريحتين لكل مقرر.`,
        `All learning outcomes were analyzed; the table displays the first 7 only to preserve the two-slide-per-course format.`,
      ),
    );
  }

  if (weaknesses.length > 4) {
    dataWarnings.push(
      t(
        `تم تحديد ${weaknesses.length} نقاط ضعف، وتعرض خطة التحسين أهم 4 حسب أكبر فجوة عن المستهدف.`,
        `${weaknesses.length} weaknesses were identified; the improvement plan shows the four largest target gaps.`,
      ),
    );
  }

  /*
   * ============================================================
   * SLIDE 1
   * Course Results & Analysis
   * ============================================================
   */

const page1: ReportPage = {
  section: 'course-dashboard',
  courseId: c.code,

  title: c.code && c.title ? `${c.code} ${c.title}` : c.title || c.code || t('المقرر', 'Course'),

subtitle: [
  c.program,
  c.academicYear,
  c.semester,
]
  .filter(Boolean)
  .join(' • '),

  chart: {
    metric: 'mean',

    label: t(
      'Target',
      'Target',
    ),

    comparisonLabel: t(
      'Actual',
      'Actual',
    ),

    note: t(
      'LEARNING OUTCOMES ACHIEVEMENT',
      'LEARNING OUTCOMES ACHIEVEMENT',
    ),

    categories: c.outcomes.map((o) => o.code),

    values: c.outcomes.map((o) => o.target),

    comparisonValues: c.outcomes.map((o) => o.actual),

    valid: c.outcomes.map((o) => o.target ?? 0),

    max: 100,
  },

  secondaryChart: {
    metric: 'mean',

    label: t(
      "Student's Count",
      "Student's Count",
    ),

    note: t(
      'GRADES DISTRIBUTION',
      'GRADES DISTRIBUTION',
    ),

    categories: c.grades.map((g) => g.grade),

    values: c.grades.map((g) => g.count),

    valid: c.grades.map((g) => g.count ?? 0),

    max: Math.max(
      100,
      ...c.grades
        .map((g) => g.count ?? 0)
        .filter((n) => Number.isFinite(n)),
    ),
  },

 metrics: [
  {
    label: 'Covered Planned Topics',
    value: 'N/A',
  },
  {
    label: 'CES Result',
    value: 'N/A',
  },
  {
    label: 'Students Count',
    value:
      c.started === null
        ? 'N/A'
        : `${c.started}`,
  },
  {
    label: 'Completed the course',
    value:
      c.completed === null
        ? 'N/A'
        : `${c.completed}`,
  },
],

  notes: t(
    'السلايد الأول مخصص لعرض الرسمين البيانيين ومؤشرات المقرر فقط.',
    'This slide is dedicated to the two charts and course indicators only.',
  ),
};

  const page2: ReportPage = {
  section: 'course-improvement-plan',
  courseId: c.code,

 title: 'ACTION PLAN',
    
subtitle: c.code && c.title ? `${c.code} ${c.title}` : [c.code, c.title].filter(Boolean).join(' • '),
  headers: [
    t('الملاحظة', 'Finding'),
    t('الدليل', 'Evidence'),
    t('الإجراء المقترح', 'Proposed Action'),
    t('المسؤول المقترح', 'Proposed Responsible'),
    t('المدة المقترحة', 'Proposed Timeline'),
    t('مؤشر النجاح', 'Success Measure'),
  ],

  widths: [1.0, 1.3, 2.6, 1.1, 1.3, 1.3],

  rows: improvementRows,

  notes: t(
    'خطة التحسين مبنية على قواعد ثابتة دون استخدام AI. الأولوية تعطى لنواتج التعلم ذات أكبر فجوة سالبة عن المستهدف. المسؤول والمدة مقترحان وقابلان للتعديل عند الاعتماد الرسمي.',
    'The improvement plan is generated using fixed rules without AI. Priority is given to learning outcomes with the largest negative target gaps. Responsibility and timeline are proposed and may be adjusted during formal approval.',
  ),
};
  /*
   * IMPORTANT:
   * Exactly TWO pages are returned for each course.
   */
  return [page1, page2];
}
