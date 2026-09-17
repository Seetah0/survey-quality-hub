import type { Analysis, Group, Lang, Metric, Question } from './analysis';

export type ReportChart = {
  label?: string;
  note?: string;
  sampleLabel?: string;
  metric: 'mean' | 'positivity';
  categories: string[];
  values: (number | null)[];
  valid: number[];
  max: number;
};
export type ReportPage = {
  title: string;
  subtitle?: string;
  lines?: string[];
  headers?: string[];
  rows?: string[][];
  widths?: number[];
  rowHeights?: number[];
  cover?: boolean;
  chart?: ReportChart;
  section?: string;
  courseId?: string;
  notes?: string;
};
export type PreviousAction = {
  plan: string;
  implementation?: string;
  source: string;
};
export type ReportOptions = {
  previousActions?: Record<string, PreviousAction>;
};
export const courseKey = (g: Group) => JSON.stringify([g.program, g.code]);

const ACTIONS: Record<string, [string, string]> = {
  Q1: [
    'مراجعة وضوح مخطط المقرر والتحقق من فهم الطلبة له.',
    'Review the course outline and check students’ understanding.',
  ],
  Q2: [
    'توضيح مصادر المساعدة وقنوات الوصول إليها.',
    'Clarify available help and how students can access it.',
  ],
  Q3: [
    'مراجعة توافق التدريس مع مخطط المقرر وتوثيق التعديلات المعلنة.',
    'Review alignment with the course outline and document announced changes.',
  ],
  Q4: [
    'مراجعة إعلان الساعات المكتبية وإمكانية الوصول خلالها.',
    'Review office-hour communication and accessibility.',
  ],
  Q5: [
    'مراجعة أساليب عرض المحتوى ومشاركة الطلبة أثناء التدريس.',
    'Review teaching methods and student participation.',
  ],
  Q6: [
    'مراجعة الالتزام بالمواعيد والخطة المعلنة للمقرر.',
    'Review adherence to the published course schedule.',
  ],
  Q7: [
    'مراجعة فائدة المواد التعليمية وربطها بمخرجات التعلم.',
    'Review learning materials and their alignment with learning outcomes.',
  ],
  Q8: [
    'تخصيص فرص للأسئلة وتوفير قناة مشاركة إضافية للطلبة.',
    'Provide time for questions and an additional participation channel.',
  ],
  Q9: [
    'تجربة أنشطة تربط التعلم باهتمامات الطلبة وتطبيقاته.',
    'Trial activities connecting learning to students’ interests and applications.',
  ],
  Q10: [
    'توضيح روابط المحتوى بالمقررات السابقة واللاحقة.',
    'Make links to preceding and subsequent courses explicit.',
  ],
  Q11: [
    'مراجعة مواعيد التغذية الراجعة ومعاييرها ومتابعة الالتزام بها.',
    'Review feedback deadlines and criteria, then track delivery.',
  ],
  Q12: [
    'مراجعة توافر الموارد وكفايتها بالاستناد إلى ملاحظات الطلبة.',
    'Review resource availability and adequacy using student feedback.',
  ],
  Q13: [
    'مراجعة قنوات الدعم الفني وآلية متابعة الطلبات.',
    'Review technical support channels and request follow-up.',
  ],
  Q14: [
    'تعزيز تدريبات حل المشكلات مع تغذية راجعة على الحلول.',
    'Strengthen problem-solving practice with feedback on solutions.',
  ],
  Q15: [
    'مراجعة نتائج الأسئلة والتعليقات لتحديد أسباب انخفاض الرضا قبل اعتماد إجراء علاجي.',
    'Review question results and comments to investigate low satisfaction before selecting a remedy.',
  ],
  Q16: [
    'مراجعة تسلسل الموضوعات وتنظيم الأنشطة والتقييم والجدول.',
    'Review topic sequencing and the organization of activities, assessment and schedules.',
  ],
};

export function reportScope(a: Analysis, id = 'all') {
  if (id === 'all')
    return {
      group: a.overall,
      courses: a.programs.flatMap((p) => p.courses || []),
    };
  for (const p of a.programs) {
    if (p.id === id) return { group: p, courses: p.courses || [] };
    for (const l of p.levels || []) {
      if (l.id === id) return { group: l, courses: l.courses || [] };
      const c = l.courses?.find((c) => c.id === id);
      if (c) return { group: c, courses: [c] };
    }
    const c = p.courses?.find((c) => c.id === id);
    if (c) return { group: c, courses: [c] };
  }
  throw new Error('NOT_FOUND');
}

export function buildSurveyReport(
  a: Analysis,
  lang: Lang,
  groupId = 'all',
  options: ReportOptions = {},
): ReportPage[] {
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const f = (n: number | null | undefined, d = 2) =>
    n == null
      ? t('غير متاح', 'N/A')
      : n.toLocaleString('en-US', {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        });
  const pct = (n: number | null | undefined) =>
    n == null ? f(n) : f(n, 1) + '%';
  const { group, courses } = reportScope(a, groupId);
  const qs = a.questions.filter((q) => q.kind === 'rating');
  const titleScope =
    groupId === 'all' ? t('جميع البرامج', 'All programs') : group.name;
  const band = (m: Metric, mode: 'mean' | 'positivity') => {
    const b = mode === 'mean' ? m.meanBand : m.positivityBand;
    return b === 'high'
      ? t('جودة مرتفعة', 'High quality')
      : b === 'acceptable'
        ? t('مقبول', 'Acceptable')
        : b === 'improve'
          ? t('يحتاج تحسينًا', 'Needs improvement')
          : t('غير مصنف', 'Unclassified');
  };
  const evidence = (g: Group, q: Question) => {
    const m = g.questions[q.id];
    return `${q.id}: ${pct(m?.positivity)} / ${t('المتوسط', 'mean')} ${f(m?.mean)} / n=${f(m?.valid, 0)}${m?.valid < 10 ? t(' (عينة صغيرة)', ' (small sample)') : ''}`;
  };
  const opportunities = (g: Group) =>
    qs
      .filter((q) => {
        const m = g.questions[q.id];
        return (
          m &&
          ((m.positivity !== null && m.positivity < 80) ||
            m.meanBand === 'improve')
        );
      })
      .sort((x, y) => {
        if (g.priority && x.id === 'Q15') return -1;
        if (g.priority && y.id === 'Q15') return 1;
        return (
          (g.questions[x.id].positivity ?? 101) -
          (g.questions[y.id].positivity ?? 101)
        );
      });
  const pages: ReportPage[] = [
    {
      section: 'cover',
      cover: true,
      title: t('تقرير تحليل استبيانات الجودة', 'Survey Quality Report'),
      subtitle: a.type + '\n' + titleScope,
      lines: [
        new Date().toLocaleDateString('en-GB'),
        t('للمراجعة والاعتماد', 'For review and approval'),
      ],
    },
  ];
  const add = (p: ReportPage) => pages.push(p);
  const summaryRows = (g: Group) => [
    [t('الاستجابات الفعلية', 'Actual responses'), f(g.rows, 0)],
    [t('العدد المتوقع', 'Expected responses'), f(g.expected, 0)],
    [t('معدل الاستجابة', 'Response rate'), pct(g.responseRate)],
    [
      t('المتوسط الموزون', 'Weighted mean'),
      `${f(g.overall.mean)} / ${a.max} (${band(g.overall, 'mean')})`,
    ],
    [
      t('نسبة الإيجابية', 'Positive answers'),
      `${pct(g.overall.positivity)} (${band(g.overall, 'positivity')})`,
    ],
    [
      t('حجم العينة', 'Sample size'),
      g.smallSample
        ? t(
            'أقل من 10 استجابات. تُفسر النتائج بحذر.',
            'Fewer than 10 responses. Interpret cautiously.',
          )
        : t('10 استجابات فأكثر', 'At least 10 responses'),
    ],
  ];
  add({
    section: 'overview',
    title: t('ملخص التقرير', 'Report Overview'),
    subtitle: titleScope,
    headers: [t('المؤشر', 'Measure'), t('النتيجة', 'Result')],
    widths: [3.1, 5.5],
    rows: summaryRows(group),
  });
  const compared = a.validation.reduce((s, v) => s + v.compared, 0),
    mismatches = a.validation.reduce((s, v) => s + v.mismatches, 0);
  const issues = a.issues.reduce((s, i) => s + i.count, 0);
  add({
    section: 'review',
    title: t('حالة مراجعة البيانات والتصميم', 'Data and Design Review'),
    headers: [t('البند', 'Item'), t('الحالة', 'Status')],
    widths: [2.5, 6.1],
    rows: [
      [
        t('مصدر الحساب', 'Calculation source'),
        `${a.sourceSheet}. ${t('أوراق الملخص للمطابقة فقط.', 'Summary sheets are checks only.')}`,
      ],
      [
        t('المطابقة', 'Reconciliation'),
        `${f(compared, 0)} ${t('مقارنة', 'comparisons')}. ${f(mismatches, 0)} ${t('اختلاف خارج دقة المصدر', 'differences beyond source precision')}. ${compared ? '' : t('لا توجد مطابقة متاحة.', 'No reconciliation available.')}`,
      ],
      [
        t('تنبيهات المصدر', 'Source warnings'),
        `${f(issues, 0)}. ${t('تُستبعد الإجابات غير الصالحة وتُحفظ المقامات الصحيحة.', 'Invalid answers are excluded with question-specific denominators.')}`,
      ],
      [
        t('المراجعة البصرية', 'Visual review'),
        t(
          'بانتظار مراجعة هذا التقرير واعتماده. وجود الرسوم والجداول القابلة للتعديل لا يعني اعتماد التصميم.',
          'This report awaits visual review and approval. Editable charts and tables do not imply design approval.',
        ),
      ],
      [
        t('حالة الخطط', 'Action plans'),
        t(
          'مقترحات مبنية على النتائج. لا توجد بيانات تنفيذ سابقة ما لم تُرفق بوثيقة مصدر.',
          'Proposals based on results. No prior implementation is assumed without source evidence.',
        ),
      ],
    ],
  });
  const notes = `Source: ${a.sourceSheet}. Values recalculated from valid responses. ${a.type === 'CES' ? 'Q17–Q19 are not scored. ' : 'Question types and scale follow confirmed source mappings. '}Source summary validation applies to the whole uploaded file.`;
  for (let i = 0; i < qs.length; i += 8)
    add({
      section: 'question-key',
      title: t('دليل الأسئلة', 'Question Key'),
      headers: [t('الرمز', 'Code'), t('معنى السؤال', 'Question meaning')],
      widths: [0.8, 7.8],
      rows: qs.slice(i, i + 8).map((q) => [q.id, q[lang]]),
      notes,
    });
  const planPages = (g: Group, aggregate = false) => {
    const candidates = opportunities(g);
    const weak = candidates.filter(
      (q) =>
        g.questions[q.id].positivityBand === 'improve' ||
        g.questions[q.id].meanBand === 'improve',
    );
    const target = candidates.length
      ? weak.length
        ? weak
        : candidates.slice(0, 3)
      : qs
          .filter((q) => g.questions[q.id]?.valid)
          .sort(
            (x, y) =>
              (g.questions[x.id].positivity ?? 101) -
              (g.questions[y.id].positivity ?? 101),
          )
          .slice(0, 1);
    if (!target.length) {
      add({
        section: aggregate
          ? 'proposed-improvement-plan'
          : 'current-proposed-action-plan',
        courseId: aggregate ? undefined : courseKey(g),
        title: t('خطة التحسين المقترحة', 'Proposed Improvement Plan'),
        subtitle: g.code,
        lines: [
          t(
            'لا توجد إجابات مقياسية صحيحة. الإجراء المقترح: مراجعة بنية الملف واستكمال البيانات قبل اقتراح تدخل تعليمي.',
            'No valid scaled answers. Proposed action: review file structure and complete the data before recommending a teaching intervention.',
          ),
        ],
      });
      return;
    }
    const rows = target.map((q) => {
      const action =
        a.type === 'CES' && ACTIONS[q.id]
          ? ACTIONS[q.id][lang === 'ar' ? 0 : 1]
          : t(
              `مراجعة الإجابات المرتبطة بـ«${q.ar}» والتحقق من سبب النتيجة قبل اختيار التدخل.`,
              `Review responses to “${q.en}” and investigate the finding before selecting an intervention.`,
            );
      return [
        q.id + '\n' + pct(g.questions[q.id].positivity),
        candidates.length
          ? action
          : t(
              'الحفاظ على الممارسة الحالية مع مراجعة الملاحظات ومتابعة السؤال في الدورة التالية.',
              'Maintain current practice, review comments and track this question in the next cycle.',
            ),
        t(
          'إعادة قياس السؤال بنفس المقياس وتعريف الإيجابية.',
          'Repeat the same question with the same scale and positivity rule.',
        ),
        t(
          'المسؤول والموعد يُحددان بعد الاعتماد. الحالة: مقترح.',
          'Owner and deadline to be set after approval. Status: proposed.',
        ),
      ];
    });
    add({
      section: aggregate
        ? 'proposed-improvement-plan'
        : 'current-proposed-action-plan',
      courseId: aggregate ? undefined : courseKey(g),
      title: t(
        'خطة التحسين المقترحة',
        aggregate ? 'Proposed Improvement Plan' : 'Proposed Action Plan',
      ),
      subtitle: [g.program, g.code].filter(Boolean).join(' / '),
      headers: [
        t('خط الأساس', 'Baseline'),
        t('الإجراء المقترح', 'Proposed action'),
        t('مؤشر المتابعة', 'Follow-up measure'),
        t('الاعتماد', 'Approval'),
      ],
      widths: [1.0, 3.3, 2.1, 2.2],
      rows,
      notes:
        notes +
        ' ' +
        t(
          'تغطي الخطة جميع الأسئلة التي تحتاج تحسينًا، أو أقل ثلاثة أسئلة مقبولة عند غياب الضعف، أو متابعة المحافظة عند غياب نتائج دون 80%. الأسباب ليست تشخيصًا مثبتًا.',
          'The plan covers every question needing improvement, otherwise the lowest three acceptable questions, or maintenance when none are below 80%. Causes are not established.',
        ),
    });
  };
  const chartPages = (g: Group, courseId?: string) => {
    for (const metric of ['mean', 'positivity'] as const)
      for (let i = 0; i < qs.length; i += 16) {
        const part = qs.slice(i, i + 16);
        add({
          section: metric === 'mean' ? 'ces-mean' : 'ces-cumulative',
          courseId,
          title:
            metric === 'mean'
              ? t(
                  'متوسطات الأسئلة',
                  a.type === 'CES' ? 'CES Mean Values' : 'Question Mean Values',
                )
              : t(
                  'نسب الإيجابية للأسئلة',
                  a.type === 'CES'
                    ? 'CES Cumulative Values'
                    : 'Question Positive Values',
                ),
          subtitle: [
            g.program,
            g.code,
            g.level ? t('المستوى ', 'Level ') + g.level : '',
          ]
            .filter(Boolean)
            .join(' / '),
          chart: {
            metric,
            categories: part.map((q) => q.id),
            values: part.map((q) =>
              metric === 'mean'
                ? (g.questions[q.id]?.mean ?? null)
                : (g.questions[q.id]?.positivity ?? null),
            ),
            valid: part.map((q) => g.questions[q.id]?.valid ?? 0),
            max: a.max,
          },
          notes:
            notes +
            (metric === 'positivity'
              ? ' Cumulative means percentage of valid ratings at or above the positive threshold; not a running total.'
              : ''),
        });
      }
  };
  if (a.type === 'CES')
    for (const c of courses) {
      const id = courseKey(c);
      add({
        section: 'course-summary',
        courseId: id,
        title: t('ملخص المقرر', 'Course Summary'),
        subtitle: `${c.code} / ${c.name}`,
        headers: [t('البيان', 'Item'), t('القيمة', 'Value')],
        widths: [3.1, 5.5],
        rows: [
          [
            t('البرنامج / المستوى', 'Program / level'),
            `${c.program} / ${c.level || t('حسب المصدر', 'As in source')}`,
          ],
          ...summaryRows(c),
        ],
        notes,
      });
      const previous = options.previousActions?.[id];
      if (previous?.plan && previous.source)
        add({
          section: 'previous-action-plan',
          courseId: id,
          title: t('خطة التحسين السابقة', 'Previous Action Plan'),
          subtitle: c.code,
          lines: [previous.plan, t('المصدر: ', 'Source: ') + previous.source],
        });
      add({
        section: 'implementation',
        courseId: id,
        title: t('متابعة التنفيذ', 'Implementation'),
        subtitle: c.code,
        lines: previous?.implementation
          ? [
              previous.implementation,
              t('المصدر: ', 'Source: ') + previous.source,
            ]
          : [
              t(
                'لا تتوفر بيانات موثقة عن تنفيذ خطة سابقة لهذا المقرر.',
                'No documented implementation data is available for this course.',
              ),
              t(
                'تبدأ المتابعة بعد اعتماد الخطة الحالية. لا يُستنتج التنفيذ من نتائج الاستبيان وحدها.',
                'Follow-up starts after the current proposal is approved. Survey results alone do not establish implementation.',
              ),
            ],
      });
      planPages(c);
      chartPages(c, id);
      const weak = qs.filter(
        (q) =>
          c.questions[q.id]?.positivityBand === 'improve' ||
          c.questions[q.id]?.meanBand === 'improve',
      );
      if (weak.length || c.priority)
        add({
          section: 'improvement-priority',
          courseId: id,
          title: c.priority
            ? t('مقرر ذو أولوية تحسين', 'Improvement Priority')
            : t('جوانب تحتاج إلى تحسين', 'Areas Requiring Improvement'),
          subtitle: c.code,
          headers: [t('السؤال', 'Question'), t('الدليل', 'Evidence')],
          widths: [3.5, 5.1],
          rows: weak.map((q) => [q[lang], evidence(c, q)]),
          notes:
            notes +
            ' Q15 positivity <60% determines CES course priority, independently of the overall mean.',
        });
    }
  else {
    chartPages(group);
    planPages(group);
  }
  const strong = qs.filter(
    (q) => group.questions[q.id]?.positivityBand === 'high',
  );
  add({
    section: 'strengths',
    title: t('نقاط القوة', 'Strengths'),
    subtitle: t(
      'حسب إيجابية السؤال 80% فأعلى، مع عرض المتوسط مستقلًا',
      'Question positivity of at least 80%, with the mean shown separately',
    ),
    headers: [
      t('السؤال', 'Question'),
      t('المتوسط', 'Mean'),
      t('الإيجابية', 'Positive'),
      t('الصحيح', 'Valid'),
    ],
    widths: [5.2, 1.1, 1.2, 1.1],
    rows: strong.map((q) => [
      q.id + ' ' + q[lang],
      f(group.questions[q.id].mean),
      pct(group.questions[q.id].positivity),
      f(group.questions[q.id].valid, 0),
    ]),
    lines: strong.length
      ? undefined
      : [
          t(
            'لا توجد أسئلة تحقق هذا الحد في النطاق المختار.',
            'No questions meet this threshold in the selected scope.',
          ),
        ],
    notes,
  });
  const opportunitiesAll = qs.filter(
    (q) =>
      opportunities(group).includes(q) ||
      courses.some((c) => opportunities(c).includes(q)),
  );
  add({
    section: 'areas-for-improvement',
    title: t('مجالات التحسين والتعزيز', 'Areas for Improvement'),
    subtitle: t(
      'أقل من 60% يحتاج تحسينًا. من 60% إلى أقل من 80% فرصة تعزيز.',
      'Below 60% needs improvement. 60% to below 80% is an opportunity to strengthen results.',
    ),
    headers: [
      t('السؤال', 'Question'),
      t('الإيجابية المجمعة', 'Pooled positive'),
      ...(a.type === 'CES'
        ? [
            t('مقررات دون 60%', 'Courses <60%'),
            t('مقررات 60–80%', 'Courses 60–80%'),
          ]
        : [t('المتوسط', 'Mean'), t('الصحيح', 'Valid')]),
    ],
    widths: [4.4, 1.4, 1.4, 1.4],
    rows: opportunitiesAll.map((q) => [
      q.id + ' ' + q[lang],
      pct(group.questions[q.id].positivity),
      ...(a.type !== 'CES'
        ? [f(group.questions[q.id].mean), f(group.questions[q.id].valid, 0)]
        : [
            String(
              courses.filter((c) => (c.questions[q.id]?.positivity ?? 100) < 60)
                .length,
            ),
            String(
              courses.filter((c) => {
                const n = c.questions[q.id]?.positivity;
                return n != null && n >= 60 && n < 80;
              }).length,
            ),
          ]),
    ]),
    lines: opportunitiesAll.length
      ? undefined
      : [
          t(
            'لا توجد نتائج دون حدود التحسين المحددة. تتضمن الخطة متابعة المحافظة على الأداء.',
            'No results fall below the specified improvement thresholds. The plan includes monitoring to sustain performance.',
          ),
        ],
    notes,
  });
  const priority = courses.filter((c) => c.priority);
  if (a.type === 'CES')
    add({
      section: 'priority-courses',
      title: t('المقررات ذات أولوية التحسين', 'Priority Courses'),
      subtitle: t(
        'إيجابية Q15 أقل من 60%، مهما كان المتوسط العام. * عينة صغيرة.',
        'Q15 positivity below 60%, regardless of the overall mean. * Small sample.',
      ),
      headers: [
        t('المقرر / البرنامج', 'Course / program'),
        'n',
        t('الاستجابة', 'Response'),
        t('إيجابية Q15', 'Q15 positive'),
      ],
      widths: [4.6, 0.8, 1.6, 1.6],
      rows: priority.map((c) => [
        `${c.code} / ${c.program}${c.smallSample ? ' *' : ''}`,
        f(c.rows, 0),
        pct(c.responseRate),
        pct(c.questions.Q15?.positivity),
      ]),
      lines: priority.length
        ? undefined
        : [
            t(
              'لا توجد مقررات تحقق شرط الأولوية في النطاق المختار.',
              'No courses meet the priority criterion in this scope.',
            ),
          ],
      notes,
    });
  const globalTargets =
    a.type === 'CES'
      ? priority.length
        ? priority
        : courses.filter((c) => opportunities(c).length)
      : [];
  if (globalTargets.length) for (const c of globalTargets) planPages(c, true);
  else planPages(group, true);
  add({
    section: 'end',
    cover: true,
    title: t('نهاية التقرير', 'End of Report'),
    subtitle: t(
      'خطط التحسين للمراجعة والاعتماد',
      'Improvement plans for review and approval',
    ),
  });
  return pages;
}

export function reportManifest(
  a: Analysis,
  pages: ReportPage[],
  groupId = 'all',
) {
  const { courses } = reportScope(a, groupId);
  const compared = a.validation.reduce((s, v) => s + v.compared, 0),
    mismatches = a.validation.reduce((s, v) => s + v.mismatches, 0);
  return {
    slides: pages.length,
    charts: pages.filter((p) => p.chart).length,
    surveyType: a.type,
    courses: a.type === 'CES' ? new Set(courses.map(courseKey)).size : 0,
    tables:
      pages.filter((p) => p.headers && p.rows?.length).length +
      pages.filter((p) => p.chart).length,
    priorityCourses: courses.filter((c) => c.priority).length,
    previousPlans: pages.filter((p) => p.section === 'previous-action-plan')
      .length,
    proposedPlanSlides: pages.filter(
      (p) =>
        p.section === 'current-proposed-action-plan' ||
        p.section === 'proposed-improvement-plan',
    ).length,
    dataReview: {
      status: mismatches ? 'attention' : compared ? 'reconciled' : 'unverified',
      compared,
      mismatches,
    },
    designReview: 'pending-visual-review',
    sections: pages.map((p, i) => ({
      slide: i + 1,
      section: p.section || 'other',
      courseId: p.courseId || null,
      title: p.title,
      chart: p.chart?.metric || null,
    })),
  };
}
