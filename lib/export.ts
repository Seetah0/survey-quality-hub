import JSZip from 'jszip';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  PageBreak,
} from 'docx';
import theme from './report-theme.json' with { type: 'json' };
import { type Analysis, type Group, type Lang, formatMetric } from './analysis';
import {
  buildSurveyReport,
  type ReportPage,
  type ReportOptions,
} from './report-model';
import { nativeChart, nativeTable } from './native-evidence';
const xml = (v: string | number | null | undefined) =>
  String(v ?? '')
    // oxlint-disable-next-line no-control-regex -- XML 1.0 forbids these control bytes.
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[c]!,
    );
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main',
  P = 'http://schemas.openxmlformats.org/presentationml/2006/main',
  R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
type Page = ReportPage;
export function paginateTables(pages: Page[]): Page[] {
  return pages.flatMap((page) => {
    if (!page.rows?.length || !page.headers) return [page];
    const widths =
      page.widths || page.headers.map(() => 8.6 / page.headers!.length);
    const result: Page[] = [];
    let rows: string[][] = [],
      heights: number[] = [],
      height = 0.48;
    for (const row of page.rows) {
      const lines = Math.max(
        ...row.map((cell, i) =>
          cell
            .split('\n')
            .reduce(
              (n, line) =>
                n +
                Math.max(
                  1,
                  Math.ceil(line.length / Math.max(8, (widths[i] - 0.12) * 10)),
                ),
              0,
            ),
        ),
      );
      const rowHeight = Math.max(0.48, 0.16 + lines * 0.19);
      if (rowHeight > 4.02) throw new Error('EXPORT_TEXT_TOO_LONG');
      if (height + rowHeight > 4.5 && rows.length) {
        result.push({ ...page, rows, rowHeights: heights });
        rows = [];
        heights = [];
        height = 0.48;
      }
      rows.push(row);
      heights.push(rowHeight);
      height += rowHeight;
    }
    if (rows.length) result.push({ ...page, rows, rowHeights: heights });
    return result;
  });
}
export function selectGroup(analysis: Analysis, id?: string) {
  if (!id || id === 'all') return analysis.overall;
  for (const p of analysis.programs) {
    if (p.id === id) return p;
    for (const l of p.levels || []) {
      if (l.id === id) return l;
      for (const c of l.courses || []) if (c.id === id) return c;
    }
    for (const c of p.courses || []) if (c.id === id) return c;
  }
  throw new Error('NOT_FOUND');
}
export function reportPages(
  a: Analysis,
  lang: Lang,
  groupId?: string,
  options: ReportOptions = {},
): Page[] {
  if (a.kind === 'raw')
    return paginateTables(buildSurveyReport(a, lang, groupId, options));
  const pages = legacyReportPages(a, lang, groupId);
  pages.push({
    section: 'proposed-improvement-plan',
    title:
      lang === 'ar'
        ? 'خطة تحسين جودة البيانات'
        : 'Data Quality Improvement Plan',
    lines:
      lang === 'ar'
        ? [
            'توحيد عناوين الأسئلة والسنوات والتحقق من أخطاء Excel المبلغ عنها.',
            'استكمال أعداد المستجيبين وتعريف المقاييس قبل المقارنة بين السنوات.',
            'المسؤول والموعد يُحددان بعد الاعتماد. القيم التاريخية وحدها لا تثبت تنفيذ إجراء أو أثره.',
          ]
        : [
            'Standardize question labels and years and investigate reported Excel errors.',
            'Complete respondent counts and scale definitions before comparing years.',
            'Owner and deadline require approval. Historical aggregates alone do not establish implementation or impact.',
          ],
  });
  pages.push({
    section: 'end',
    title: lang === 'ar' ? 'نهاية التقرير' : 'End of Report',
    cover: true,
  });
  return pages;
}
export function legacyReportPages(
  a: Analysis,
  lang: Lang,
  groupId?: string,
): Page[] {
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en),
    f = (n: number | null, d = 2) => formatMetric(n, d, lang),
    pct = (n: number | null) => (n === null ? f(null) : f(n, 1) + '%');
  const bandText = (b: string | null) =>
    b === 'high'
      ? t('جودة مرتفعة', 'High quality')
      : b === 'acceptable'
        ? t('مقبول', 'Acceptable')
        : b === 'improve'
          ? t('يحتاج إلى تحسين', 'Needs improvement')
          : t('غير مصنف', 'Not classified');
  const g = selectGroup(a, groupId);
  const pages: Page[] = [
    {
      cover: true,
      title: t('تقرير تحليل استبيانات الجودة', 'Survey Quality Report'),
      subtitle: g.id === 'all' ? a.type : g.name,
      lines: [
        new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB'),
        t('نسخة اختبار للمراجعة', 'Testing version for review'),
      ],
    },
  ];
  const summary = (g: Group, title: string) => ({
    title,
    subtitle: [...new Set([g.program, g.code, g.level].filter(Boolean))].join(
      ' · ',
    ),
    lines: [
      `${t('الاستجابات', 'Responses')}: ${f(g.rows, 0)} · ${t('المتوقع', 'Expected')}: ${f(g.expected, 0)} · ${t('معدل الاستجابة', 'Response rate')}: ${pct(g.responseRate)}`,
      `${t('المتوسط الموزون', 'Weighted mean')}: ${f(g.overall.mean)} / ${a.max}`,
      `${t('الإيجابية', 'Positivity')}: ${pct(g.overall.positivity)} · ${t('الإجابات الصحيحة', 'Valid scores')}: ${f(g.overall.valid, 0)}`,
      `${t('تصنيف المتوسط', 'Mean classification')}: ${bandText(g.overall.meanBand)} · ${t('تصنيف الإيجابية', 'Positivity classification')}: ${bandText(g.overall.positivityBand)}`,
      ...(g.smallSample
        ? [
            t(
              'تنبيه: حجم العينة أقل من 10 استجابات.',
              'Caution: sample size is below 10 responses.',
            ),
          ]
        : []),
      ...(g.priority
        ? [
            t(
              'أولوية تحسين: إيجابية Q15 أقل من 60%.',
              'Improvement priority: Q15 positivity below 60%.',
            ),
          ]
        : []),
    ],
  });
  const questionPages = (g: Group) => {
    const qs = a.questions.filter((q) => q.kind === 'rating');
    for (let i = 0; i < qs.length; i += 8)
      pages.push({
        title: g.id === 'all' ? t('جميع البرامج', 'All programs') : g.name,
        subtitle: t(
          'نتائج الأسئلة · * أقل من 10 إجابات صحيحة',
          'Question results · * fewer than 10 valid answers',
        ),
        widths: [3, 0.6, 0.8, 1.4, 0.9, 1.9],
        headers: [
          t('السؤال', 'Question'),
          t('صحيح', 'Valid'),
          t('المتوسط', 'Mean'),
          t('تصنيفه', 'Mean class'),
          t('الإيجابية', 'Positive'),
          t('تصنيفها', 'Positive class'),
        ],
        rows: qs
          .slice(i, i + 8)
          .map((q) => [
            `${q.id} · ${q[lang]}`,
            f(g.questions[q.id]?.valid ?? 0, 0) +
              ((g.questions[q.id]?.valid ?? 0) < 10 ? ' *' : ''),
            f(g.questions[q.id]?.mean ?? null),
            bandText(g.questions[q.id]?.meanBand ?? null),
            pct(g.questions[q.id]?.positivity ?? null),
            bandText(g.questions[q.id]?.positivityBand ?? null),
          ]),
      });
  };
  if (a.kind === 'historical') {
    pages.push({
      title: t('النتائج التاريخية', 'Historical results'),
      lines: [
        t(
          'القيم من خلايا المصدر؛ لا تعاد معاملتها كاستجابات خام أو دمجها بمتوسط غير موزون.',
          'Values are source aggregates, not individual responses; no unweighted overall average is created.',
        ),
      ],
    });
    const records = a.historical || [];
    const sections = new Map<string, typeof records>();
    for (const r of records) {
      const key = r.program + '\n' + r.survey;
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(r);
    }
    for (const section of sections.values()) {
      const years = [...new Set(section.map((r) => r.year))].sort(
        (a, b) => a - b,
      );
      const sourceRows = new Map<
        string,
        { label: string; values: Map<number, number> }
      >();
      for (const r of section) {
        const key = r.sheet + '!' + r.cell.replace(/^[A-Z]+/, '');
        if (!sourceRows.has(key))
          sourceRows.set(key, {
            label: [r.question, r.label].filter(Boolean).join(' · '),
            values: new Map(),
          });
        sourceRows.get(key)!.values.set(r.year, r.value);
      }
      const rows = [...sourceRows.values()].map((r) => [
        r.label,
        ...years.map((y) => f(r.values.get(y) ?? null)),
      ]);
      for (let i = 0; i < rows.length; i += 8)
        pages.push({
          title: section[0].program,
          subtitle: section[0].survey,
          headers: [t('السؤال', 'Question'), ...years.map(String)],
          rows: rows.slice(i, i + 8),
          widths: [4.8, ...years.map(() => 3.8 / years.length)],
        });
    }
    return paginateTables(pages);
  }
  pages.push(summary(g, t('ملخص النتائج', 'Results overview')));
  questionPages(g);
  if (g.id === 'all') {
    for (const p of a.programs) {
      pages.push(summary(p, p.name));
      questionPages(p);
      for (const l of p.levels || []) {
        pages.push(summary(l, t('المستوى ', 'Level ') + l.level));
        for (const c of l.courses || []) {
          pages.push(summary(c, c.name));
          questionPages(c);
        }
      }
    }
  }
  const courses =
    g.id === 'all'
      ? a.programs.flatMap((p) => p.courses || [])
      : g.courses || [];
  const priority = courses.filter((c) => c.priority);
  for (let i = 0; a.type === 'CES' && i < Math.max(1, priority.length); i += 8)
    pages.push({
      title: t('أولوية التحسين', 'Improvement priorities'),
      subtitle: t(
        'إيجابية Q15 أقل من 60% · * عينة أقل من 10',
        'Q15 positivity below 60% · * sample below 10',
      ),
      headers: [
        t('المقرر', 'Course'),
        t('البرنامج', 'Program'),
        t('الاستجابات', 'Responses'),
        t('الاستجابة %', 'Response %'),
        'Q15',
      ],
      widths: [2.6, 1.5, 1.2, 1.7, 1.6],
      rows: priority
        .slice(i, i + 8)
        .map((c) => [
          c.code,
          c.program,
          String(c.rows) + (c.smallSample ? ' *' : ''),
          pct(c.responseRate),
          pct(c.questions.Q15.positivity),
        ]),
      lines: priority.length
        ? undefined
        : [
            t(
              'لا توجد مقررات تحقق شرط أولوية التحسين.',
              'No courses meet the improvement-priority threshold.',
            ),
          ],
    });
  if (g.id === 'all')
    for (const c of a.comments) {
      pages.push({
        title:
          t('الأسئلة المفتوحة', 'Open-ended responses') + ' · ' + c.question,
        subtitle: t(
          'أكثر الإجابات تكرارًا — دون تحويلها إلى درجات',
          'Most frequent responses — never converted to scores',
        ),
        lines: [
          `${t('إجابات نصية', 'Text responses')}: ${c.count}`,
          ...c.top
            .slice(0, 6)
            .map((r) => `${r.count} × ${r.text.slice(0, 280)}`),
        ],
      });
    }
  pages.push({
    title: t(
      'قواعد الحساب وجودة البيانات',
      'Calculation rules and data quality',
    ),
    lines: [
      t(
        'المصدر الأساسي: RawData. الملخصات للمطابقة فقط.',
        'Source: RawData. Summary sheets are verification only.',
      ),
      t(
        'المتوسط = مجموع الدرجات الصحيحة ÷ عددها.',
        'Mean = sum of valid scores / valid score count.',
      ),
      `${t('الإيجابية', 'Positivity')}: ${a.positive}–${a.max} · ${t('المقياس', 'Scale')}: ${a.min}–${a.max}`,
      t(
        'الفراغ والنص والقيم خارج المقياس لا تدخل في المقام.',
        'Blank, text and out-of-range scores are excluded from denominators.',
      ),
      t(
        'المتوسطات والنسب مجمعة بوزن الإجابات الصحيحة. التقريب عند العرض فقط.',
        'Pooled metrics are weighted by valid answers. Rounding occurs only for display.',
      ),
      ...a.issues.map((i) => `${i.code}: ${i.count}`),
    ],
  });
  return paginateTables(pages);
}
function textShape(
  id: number,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  lang: Lang,
  color = '1D1E34',
  bold = false,
) {
  const e = (n: number) => Math.round(n * 914400);
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Report ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${e(w)}" cy="${e(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="40000" rIns="40000" tIns="18000" bIns="18000"><a:normAutofit/></a:bodyPr><a:lstStyle/>${text
    .split('\n')
    .map(
      (line) =>
        `<a:p><a:pPr algn="${lang === 'ar' ? 'r' : 'l'}" rtl="${lang === 'ar' ? 1 : 0}"/><a:r><a:rPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}" sz="${size * 100}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>${xml(line)}</a:t></a:r><a:endParaRPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}"/></a:p>`,
    )
    .join('')}</p:txBody></p:sp>`;
}
export async function makePptx(pages: Page[], lang: Lang) {
  const zip = new JSZip();
  const paths: string[] = [];
  for (const [path, data] of Object.entries(theme.parts)) {
    if (path.includes('theme2')) continue;
    zip.file(path, data);
    paths.push(path);
  }
  for (const [path, data] of Object.entries(theme.media))
    zip.file(path, data, { base64: true });
  const rel = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`;
  let slideList = '',
    presentationRels = rel(
      'rId1',
      'slideMaster',
      'slideMasters/slideMaster1.xml',
    );
  let chartCount = 0;
  for (const [i, page] of pages.entries()) {
    let shape = 1001,
      body = '';
    let extraRels = '';
    if (page.cover) {
      body += textShape(
        shape++,
        page.title,
        1.17,
        3.65,
        3.35,
        1.25,
        25,
        lang,
        'FFFFFF',
        true,
      );
      body += textShape(
        shape++,
        page.subtitle || '',
        1.17,
        5.05,
        3.35,
        0.65,
        16,
        lang,
        'FFFFFF',
      );
      body += textShape(
        shape++,
        (page.lines || []).join('\n'),
        1.17,
        6.02,
        3.35,
        0.8,
        12,
        lang,
        'FFFFFF',
      );
    } else {
      body += textShape(
        shape++,
        page.title,
        0.97,
        1.05,
        8.55,
        0.65,
        22,
        lang,
        '32395A',
        true,
      );
      if (page.subtitle)
        body += textShape(
          shape++,
          page.subtitle,
          0.97,
          1.73,
          8.55,
          0.5,
          12,
          lang,
          '57667B',
        );
      let y = 2.27;
      if (page.chart) {
        chartCount++;
        const chart = await nativeChart(page.chart, lang, chartCount);
        zip.file(`ppt/charts/chart${chartCount}.xml`, chart.chart);
        zip.file(
          `ppt/charts/_rels/chart${chartCount}.xml.rels`,
          chart.relationship,
        );
        zip.file(`ppt/embeddings/chart${chartCount}.xlsx`, chart.workbook);
        paths.push(`ppt/charts/chart${chartCount}.xml`);
        extraRels += rel(
          'rIdChart',
          'chart',
          `../charts/chart${chartCount}.xml`,
        );
        body += chart.frame;
        const values = page.chart.values.map((v) =>
          v === null
            ? lang === 'ar'
              ? 'غير متاح'
              : 'N/A'
            : formatMetric(v, page.chart!.metric === 'mean' ? 2 : 1, lang) +
              (page.chart!.metric === 'positivity' ? '%' : ''),
        );
        const rows = [
          ['Q', ...page.chart.categories],
          [
            page.chart.label || (page.chart.metric === 'mean' ? 'Mean' : '%'),
            ...values,
          ],
          [page.chart.sampleLabel || 'n', ...page.chart.valid.map(String)],
        ];
        body += nativeTable(
          shape++,
          rows,
          [
            0.6,
            ...page.chart.categories.map(
              () => 8 / page.chart!.categories.length,
            ),
          ],
          [0.31, 0.31, 0.31],
          lang,
          5.8,
          8,
          0.95,
          'en',
        );
        body += textShape(
          shape++,
          page.chart.note ||
            (lang === 'ar'
              ? 'n = الإجابات الصحيحة لكل سؤال. النتائج الأقل من 10 تُفسر بحذر.'
              : 'n = valid answers per question. Interpret results below 10 cautiously.'),
          1.02,
          6.78,
          8.42,
          0.23,
          9,
          lang,
        );
      } else if (page.headers && page.rows?.length) {
        const widths =
          page.widths ||
          (page.headers.length === 4
            ? [4.8, 1.1, 1.1, 1.6]
            : page.headers.map(() => 8.6 / page.headers!.length));
        const heights = [
          0.48,
          ...page.rows.map((_, i) => page.rowHeights?.[i] || 0.48),
        ];
        body += nativeTable(
          shape++,
          [page.headers, ...page.rows],
          widths,
          heights,
          lang,
          y,
        );
        y += heights.reduce((s, h) => s + h, 0);
      }
      if (page.lines) {
        body += textShape(
          shape++,
          page.lines.join('\n\n'),
          1.02,
          y,
          8.42,
          4.4,
          14,
          lang,
        );
      }
      body += textShape(
        shape++,
        String(i + 1),
        8.8,
        7.05,
        0.6,
        0.25,
        9,
        'en',
        '57667B',
      );
    }
    if (page.notes) {
      extraRels += rel(
        'rIdNotes',
        'notesSlide',
        `../notesSlides/notesSlide${i + 1}.xml`,
      );
      zip.file(
        `ppt/notesSlides/notesSlide${i + 1}.xml`,
        `<p:notes xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xml(page.notes)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`,
      );
      zip.file(
        `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`,
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slide', `../slides/slide${i + 1}.xml`)}</Relationships>`,
      );
      paths.push(`ppt/notesSlides/notesSlide${i + 1}.xml`);
    }
    const base = page.cover ? theme.cover : theme.content;
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      base.replace('</p:spTree>', body + '</p:spTree>'),
    );
    zip.file(
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      (page.cover ? theme.coverRels : theme.contentRels).replace(
        '</Relationships>',
        extraRels + '</Relationships>',
      ),
    );
    slideList += `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`;
    presentationRels += rel(
      'rId' + (i + 2),
      'slide',
      `slides/slide${i + 1}.xml`,
    );
    paths.push(`ppt/slides/slide${i + 1}.xml`);
  }
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideList}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presentationRels}</Relationships>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'ppt/presentation.xml')}</Relationships>`,
  );
  const typeFor = (p: string) =>
    p.includes('/charts/')
      ? 'chart'
      : p.includes('/notesSlides/')
        ? 'notesSlide'
        : p.includes('/slides/')
          ? 'slide'
          : p.includes('/slideMasters/')
            ? 'slideMaster'
            : p.includes('/slideLayouts/')
              ? 'slideLayout'
              : p.includes('/theme/')
                ? 'theme'
                : null;
  const overrides = paths
    .filter((p) => !p.endsWith('.rels'))
    .map((p) => {
      const type = typeFor(p);
      return type
        ? `<Override PartName="/${p}" ContentType="application/vnd.openxmlformats-officedocument.${type === 'theme' ? 'theme' : type === 'chart' ? 'drawingml.chart' : `presentationml.${type}`}+xml"/>`
        : '';
    })
    .join('');
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${overrides}</Types>`,
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
export async function makeDocx(pages: Page[], lang: Lang) {
  const rtl = lang === 'ar';
  const paragraph = (text: string, heading = false) =>
    new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      heading: heading ? HeadingLevel.HEADING_1 : undefined,
      spacing: { after: 160 },
      children: [
        new TextRun({
          text,
          font: 'Arial',
          size: heading ? 30 : 22,
          rightToLeft: rtl,
          color: heading ? '32395A' : '1D1E34',
        }),
      ],
    });
  const children: (Paragraph | Table)[] = [];
  for (const [pi, p] of pages.entries()) {
    if (pi) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(paragraph(p.title, true));
    if (p.subtitle) children.push(paragraph(p.subtitle));
    for (const line of p.lines || []) children.push(paragraph(line));
    if (p.chart) {
      const rows = [
        [
          lang === 'ar' ? 'البند' : 'Item',
          p.chart.label || (p.chart.metric === 'positivity' ? '%' : 'Mean'),
          p.chart.sampleLabel || 'n',
        ],
        ...p.chart.categories.map((c, i) => [
          c,
          p.chart!.values[i] === null ? '—' : String(p.chart!.values[i]),
          String(p.chart!.valid[i]),
        ]),
      ];
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows.map(
            (row, i) =>
              new TableRow({
                tableHeader: i === 0,
                children: (rtl ? [...row].reverse() : row).map(
                  (cell) =>
                    new TableCell({
                      children: [paragraph(cell)],
                      shading: { fill: i === 0 ? 'D2DBE5' : 'FFFFFF' },
                    }),
                ),
              }),
          ),
        }),
      );
      if (p.chart.note) children.push(paragraph(p.chart.note));
    }
    if (p.headers && p.rows?.length) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [p.headers, ...p.rows].map(
            (row, i) =>
              new TableRow({
                children: (rtl ? [...row].reverse() : row).map(
                  (cell) =>
                    new TableCell({
                      shading: {
                        fill: i === 0 ? 'D2DBE5' : i % 2 ? 'F3F6FA' : 'FFFFFF',
                      },
                      children: [paragraph(cell)],
                    }),
                ),
              }),
          ),
        }),
      );
    }
  }
  return new Uint8Array(
    await Packer.toArrayBuffer(
      new Document({
        creator: 'Survey Quality Hub',
        title: 'Survey Quality Report',
        sections: [
          {
            properties: {
              page: {
                margin: { top: 900, bottom: 900, left: 800, right: 800 },
              },
            },
            children,
          },
        ],
      }),
    ),
  );
}
