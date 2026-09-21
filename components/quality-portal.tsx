'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  FolderClock,
  ShieldCheck,
  UploadCloud,
  Languages,
  GraduationCap,
  Users,
  Briefcase,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import type {
  Analysis,
  AnalysisOptions,
  Lang,
  QuestionKind,
  SurveyType,
  Group,
} from '@/lib/analysis';
import type { CourseReport } from '@/lib/course-report';
import { outcomeGap } from '@/lib/course-report';
import type { Dataset, Section } from '@/lib/portal-model';
import type { ReportPage } from '@/lib/report-model';
import type { HistorySheet, HistoryMapping } from '@/lib/history-workbook';
import { processInBrowser, downloadFile } from '@/lib/browser-processing';
import { listDatasets, saveDataset, deleteDataset } from '@/lib/local-store';

const errorMessages: Record<string, string> = {
  WORKBOOK_TOO_LARGE: 'الحد لكل ملف 16 MB و50 ألف استجابة. قسّمي الملف الكبير.',
  RAWDATA_REQUIRED:
    'لم يُعثر على ورقة RawData. ضعي الاستجابات فيها، وعناوين Q1 وQ2… في الصف الأول. استخدمي قسم المقارنة السنوية للملف التاريخي.',
  COURSE_TEMPLATE_REQUIRED:
    'ملف Word لا يطابق نموذج تقرير المقرر الذي يحتوي Course Title وCourse Code وجدول CLO.',
  CONFIRM_ANALYSIS_REQUIRED: 'راجعي نوع الاستبيان وتصنيف الأسئلة قبل التصدير.',
  INVALID_SCALE: 'راجعي حدود المقياس وحد الإجابة الإيجابية.',
  INCOMPATIBLE_REPORTS:
    'يمكن دمج الاستبيانات المتطابقة فقط في النوع والمقياس والأسئلة.',
  OVERLAPPING_COHORTS:
    'الملفات تتضمن مجموعات متداخلة؛ أُوقف الدمج لتجنب احتسابها مرتين.',
  LOCAL_STORAGE_FAILED:
    'تعذر الحفظ في هذا المتصفح. تحققي من المساحة والسماح بتخزين بيانات الموقع، ثم أعيدي المحاولة.',
  NEXT_YEAR_REQUIRED:
    'يمكن إضافة السنة التالية فقط، دون إعادة كتابة سنة موجودة.',
  HISTORY_MAPPING_REQUIRED:
    'اربطي نتيجة واحدة على الأقل بصفها في الملف التاريخي.',
  DUPLICATE_HISTORY_MAPPING: 'يوجد أكثر من ربط للصف نفسه. احذفي الربط المكرر.',
  INVALID_HISTORY_MAPPING: 'راجعي الصفوف والقيم المختارة.',
  CANCELLED: 'أُلغيت العملية. النتائج المحفوظة قبل الإلغاء ما زالت متاحة.',
  EXPORT_TEXT_TOO_LONG:
    'نص أحد الجداول أطول من سعة الشريحة. صدّري Excel للمحتوى الكامل وراجعي صياغة المصدر.',
  PROCESSING_FAILED:
    'تعذرت المعالجة في المتصفح. حاولي بملفات أقل أو متصفح محدث.',
  NO_QUESTION_COLUMNS: 'لم يُعثر على أسئلة Q1 وQ2… في الصف الأول.',
};
const fmt = (n: number | null | undefined, digits = 1) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', { maximumFractionDigits: digits });
function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  return (
    <div className="qp-table-scroll">
      <table className="qp-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Bars({
  rows,
  max = 100,
  suffix = '%',
}: {
  rows: { label: string; value: number | null; target?: number | null }[];
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="qp-bars">
      {rows.map((r, i) => (
        <div className="qp-bar-row" key={i}>
          <span>{r.label}</span>
          <div className="qp-track">
            <div
              className="qp-bar"
              style={{
                width: `${Math.min(100, Math.max(0, ((r.value || 0) / max) * 100))}%`,
              }}
            />
            {r.target != null && (
              <i
                title={`Target: ${r.target}`}
                style={{ left: `${Math.min(100, (r.target / max) * 100)}%` }}
              />
            )}
          </div>
          <b>
            {fmt(r.value)}
            {r.value !== null ? suffix : ''}
          </b>
        </div>
      ))}
    </div>
  );
}
function Printable({ pages, lang }: { pages: ReportPage[]; lang: Lang }) {
  return (
    <div id="quality-print" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {pages.map((p, i) => (
        <article className="qp-print-page" key={i}>
          <div className="qp-print-brand">Survey Quality Hub • {i + 1}</div>
          <h1>{p.title}</h1>
          {p.subtitle && <p>{p.subtitle}</p>}
          {p.lines?.map((line, j) => (
            <p key={j}>{line}</p>
          ))}
          {p.chart && (
            <Bars
              rows={p.chart.categories.map((label, j) => ({
                label,
                value: p.chart!.values[j],
              }))}
              max={p.chart.max}
              suffix={p.chart.metric === 'positivity' ? '%' : ''}
            />
          )}{' '}
          {p.headers && p.rows && (
            <DataTable headers={p.headers} rows={p.rows} />
          )}
        </article>
      ))}
    </div>
  );
}

export default function QualityPortal() {
  const [lang, setLang] = useState<Lang>('ar');
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('analysis');
  const [section, setSection] = useState<Section>('courses');
  const [year, setYear] = useState(2026);
  const [type, setType] = useState<SurveyType>('CES');
  const [items, setItems] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState('');
  const [scope, setScope] = useState('all');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [options, setOptions] = useState<AnalysisOptions>({
    min: 1,
    max: 5,
    positive: 4,
  });
  const [kinds, setKinds] = useState<Record<string, QuestionKind>>({});
  const [pages, setPages] = useState<ReportPage[]>([]);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState<HistorySheet[]>([]);
  const [historySheet, setHistorySheet] = useState('');
  const [mappings, setMappings] = useState<HistoryMapping[]>([]);
  const [mapRow, setMapRow] = useState('');
  const [mapMetric, setMapMetric] = useState('mean:overall');
  const [archive, setArchive] = useState<{ id: string; name: string }[]>([]);
  const files = useRef(new Map<string, File>());
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const baseline = useRef<Uint8Array | null>(null);
  const cancel = useRef<AbortController | null>(null);
  const data = items.find((d) => d.id === active);
  const analysis = data?.analysis;
  const course = data?.course;
  const groups = analysis
    ? [
        analysis.overall,
        ...analysis.programs,
        ...analysis.programs.flatMap((p) => p.courses || []),
      ]
    : [];
  const group: Group | undefined =
    scope === 'all'
      ? analysis?.overall
      : groups.find((g) => g.id === scope) || analysis?.overall;
  const chosen = items.filter((d) => selected.includes(d.id));
  const reportError = (e: unknown) => {
    const message = e instanceof Error ? e.message : 'PROCESSING_FAILED';
    return (
      errorMessages[message] ||
      `${t('تعذرت العملية', 'Operation failed')}: ${message}`
    );
  };
  useEffect(() => {
    void listDatasets()
      .then((d) => {
        setItems(d);
        setReady(true);
        if (localStorage.getItem('sqh-lang') === 'en') setLang('en');
      })
      .catch(() => setErrors([errorMessages.LOCAL_STORAGE_FAILED]));
  }, []);
  function open(d: Dataset) {
    setActive(d.id);
    setScope('all');
    setKinds(
      Object.fromEntries(
        (d.analysis?.questions || []).map((q) => [q.id, q.kind]),
      ),
    );
    setOptions({
      type: d.analysis?.type,
      min: d.analysis?.min,
      max: d.analysis?.max,
      positive: d.analysis?.positive,
    });
    setTab('dashboard');
  }
  async function put(d: Dataset) {
    await saveDataset(d);
    setItems((old) => [d, ...old.filter((v) => v.id !== d.id)]);
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setErrors([]);
    setNotice('');
    setProgress(0);
    cancel.current = new AbortController();
    try {
      await fn();
    } catch (e) {
      setErrors([reportError(e)]);
    } finally {
      setBusy('');
      cancel.current = null;
    }
  }
  async function upload(list: FileList | File[] | null) {
    if (!list?.length || busy) return;
    const batch = Array.from(list);
    if (list.length > 60) {
      setErrors([
        t('اختاري حتى 60 ملفًا في الدفعة.', 'Select up to 60 files per batch.'),
      ]);
      return;
    }
    await run(t('تحليل الملفات', 'Analyzing files'), async () => {
      const imported: Dataset[] = [];
      const failed: string[] = [];
      const hashes = new Set(items.map((d) => d.hash));
      for (const [i, file] of batch.entries()) {
        if (cancel.current?.signal.aborted) break;
        try {
          if (
            !/\.(xlsx|xls|docx)$/i.test(file.name) ||
            (section !== 'courses' && /\.docx$/i.test(file.name))
          )
            throw new Error('UNSUPPORTED_FILE');
          if (file.size > 16 * 1024 * 1024)
            throw new Error('WORKBOOK_TOO_LARGE');
          const bytes = await file.arrayBuffer();
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          )
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('');
          if (hashes.has(hash)) {
            failed.push(
              `${file.name}: ${t('الملف موجود مسبقًا؛ لم يُكرر.', 'Already imported; skipped.')}`,
            );
            continue;
          }
          const result = await processInBrowser<{
            analysis?: Analysis;
            course?: CourseReport;
          }>(
            'analyze',
            { bytes, docx: /\.docx$/i.test(file.name), options: { type } },
            cancel.current?.signal,
          );
          const d: Dataset = {
            id: crypto.randomUUID(),
            name: file.name,
            hash,
            created: new Date().toISOString(),
            year,
            section,
            ...result,
          };
          await put(d);
          files.current.set(d.id, file);
          setAvailableFiles((old) => [...old, d.id]);
          hashes.add(hash);
          imported.push(d);
        } catch (e) {
          failed.push(`${file.name}: ${reportError(e)}`);
        }
        setProgress(Math.round(((i + 1) / batch.length) * 100));
      }
      setErrors(failed);
      if (imported.length) {
        setSelected(imported.map((d) => d.id));
        open(imported[0]);
        setNotice(
          t(
            `حُلّل وحُفظ ${imported.length} ملفًا على هذا الجهاز.`,
            `Analyzed and saved ${imported.length} files on this device.`,
          ),
        );
      }
    });
  }
  async function confirm(file?: File) {
    if (!data) return;
    const source = file || files.current.get(data.id);
    if (!source) {
      setErrors([
        t(
          'أعيدي اختيار الملف الأصلي لإعادة الحساب.',
          'Select the original workbook to recalculate.',
        ),
      ]);
      return;
    }
    await run(t('إعادة الحساب', 'Recalculating'), async () => {
      const bytes = await source.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      )
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      if (hash !== data.hash) throw new Error('SOURCE_FILE_MISMATCH');
      const result = await processInBrowser<{ analysis: Analysis }>(
        'analyze',
        { bytes, options: { ...options, kinds } },
        cancel.current?.signal,
      );
      const updated = { ...data, ...result };
      await put(updated);
      open(updated);
    });
  }
  async function exportSelected(format: 'pptx' | 'docx' | 'xlsx' | 'preview') {
    await run(
      t('إعداد التقرير على جهازك', 'Preparing report on your device'),
      async () => {
        if (!chosen.length) throw new Error('NO_REPORTS');
        const result = await processInBrowser<Uint8Array | ReportPage[]>(
          'export',
          { items: chosen, lang, format },
          cancel.current?.signal,
        );
        if (format === 'preview') {
          setPages(result as ReportPage[]);
          setPreview(true);
        } else {
          downloadFile(
            result as Uint8Array<ArrayBuffer>,
            `quality-report-${chosen[0].year}.${format}`,
          );
          setNotice(t('بدأ تنزيل التقرير.', 'Report download started.'));
        }
      },
    );
  }
  const metrics =
    analysis && group
      ? [
          {
            key: 'mean:overall',
            label: t('المتوسط العام', 'Overall mean'),
            value: group.overall.mean,
          },
          {
            key: 'positive:overall',
            label: t('الإيجابية العامة %', 'Overall positive %'),
            value: group.overall.positivity,
          },
          {
            key: 'count:overall',
            label: t('عدد المستجيبين', 'Respondents'),
            value: group.rows,
          },
          ...analysis.questions
            .filter((q) => q.kind === 'rating')
            .flatMap((q) => [
              {
                key: `mean:${q.id}`,
                label: `${q.id} — ${t('المتوسط', 'Mean')}`,
                value: group.questions[q.id]?.mean,
              },
              {
                key: `positive:${q.id}`,
                label: `${q.id} — ${t('الإيجابية %', 'Positive %')}`,
                value: group.questions[q.id]?.positivity,
              },
            ]),
        ]
      : [];
  const selectedHistory = history.find((s) => s.name === historySheet);
  const currentMetric = metrics.find((m) => m.key === mapMetric);
  const nextYear = Math.max(2026, ...history.flatMap((s) => s.years)) + 1;
  const toggle = (id: string) =>
    setSelected((old) =>
      old.includes(id) ? old.filter((v) => v !== id) : [...old, id],
    );
  const sectionName = (s: Section) =>
    s === 'courses'
      ? t('المقررات CES وPLO', 'Courses CES & PLO')
      : s === 'students'
        ? t('استبيانات الطلاب', 'Student surveys')
        : t('استبيانات الموظفين', 'Employee surveys');
  return (
    <>
      <div className="qp-shell" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <BarChart3 />
            </div>
            <div>
              <strong>{t('منصة تحليل الجودة', 'Survey Quality Hub')}</strong>
              <small>SURVEY QUALITY HUB</small>
            </div>
          </div>
          <div className="header-actions">
            <span className="test-badge">
              {t('تصدير على جهازك • بدون AI', 'Local exports • No AI')}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                const value = lang === 'ar' ? 'en' : 'ar';
                setLang(value);
                localStorage.setItem('sqh-lang', value);
              }}
            >
              <Languages size={18} />
              {lang === 'ar' ? 'English' : 'العربية'}
            </Button>
            {/* oxlint-disable-next-line next/no-img-element */}
            <img
              className="university-logo"
              src="/university-logo.png"
              alt={t(
                'جامعة الإمام عبدالرحمن بن فيصل',
                'Imam Abdulrahman Bin Faisal University',
              )}
            />
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {t('وحدة الإحصاء وتحليل البيانات', 'STATISTICS & DATA ANALYSIS')}
              </p>
              <h1>
                {t(
                  'من النتائج إلى قرارات التحسين',
                  'From findings to improvement',
                )}
              </h1>
              <p>
                {t(
                  'المقررات والاستبيانات، في مساحة واحدة للتحليل والتقارير.',
                  'Courses and surveys, in one space for analysis and reporting.',
                )}
              </p>
            </div>
            <ShieldCheck className="heading-icon" />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="main-tabs">
              <TabsTrigger value="analysis">
                <UploadCloud />
                {t('تحليل جديد', 'New analysis')}
              </TabsTrigger>
              <TabsTrigger value="dashboard">
                <Activity />
                {t('لوحة النتائج', 'Results')}
              </TabsTrigger>
              <TabsTrigger value="history">
                <FolderClock />
                {t('التحليلات المحفوظة', 'Saved analyses')}{' '}
                <span className="count">{items.length}</span>
              </TabsTrigger>
              <TabsTrigger value="export">
                <Download />
                {t('التصدير', 'Export')}
              </TabsTrigger>
            </TabsList>
            {busy && (
              <output className="qp-progress">
                <span>
                  {busy} {progress > 0 ? `${progress}%` : ''}
                </span>
                <progress value={progress || undefined} max={100} />
                <Button
                  variant="outline"
                  onClick={() => cancel.current?.abort()}
                >
                  {t('إلغاء', 'Cancel')}
                </Button>
              </output>
            )}
            {errors.length > 0 && (
              <div className="alert error" role="alert">
                <div>
                  {errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
                <button aria-label="Close" onClick={() => setErrors([])}>
                  <X size={18} />
                </button>
              </div>
            )}
            {notice && (
              <output className="qp-notice">
                <CheckCircle2 size={18} />
                {notice}
              </output>
            )}
            <TabsContent value="analysis">
              <div className="qp-section-choices">
                {(['courses', 'students', 'employees'] as Section[]).map(
                  (s, i) => {
                    const Icon = [GraduationCap, Users, Briefcase][i];
                    return (
                      <button
                        key={s}
                        className={section === s ? 'chosen' : ''}
                        aria-pressed={section === s}
                        onClick={() => {
                          setSection(s);
                          setType(
                            s === 'courses'
                              ? 'CES'
                              : s === 'employees'
                                ? 'EMPLOYEE'
                                : 'PES',
                          );
                        }}
                      >
                        <Icon />
                        <strong>{sectionName(s)}</strong>
                        <span>
                          {s === 'courses'
                            ? t(
                                'الدرجات • النواتج • تقييم المقرر',
                                'Grades • outcomes • course evaluation',
                              )
                            : t(
                                'الأسئلة • الرضا • فرص التحسين',
                                'Questions • satisfaction • opportunities',
                              )}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
              <div className="upload-layout">
                <section className="panel">
                  <div className="section-heading">
                    <span className="step">01</span>
                    <div>
                      <h2>
                        {t('إدراج ملفات التحليل', 'Import analysis files')}
                      </h2>
                      <p>
                        {t(
                          'حتى 60 ملفًا في الدفعة • 16 MB لكل ملف',
                          'Up to 60 files per batch • 16 MB per file',
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="qp-fields">
                    <label>
                      {t('سنة التقرير', 'Reporting year')}
                      <input
                        type="number"
                        min={2022}
                        max={2200}
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      {t('نوع استبيان Excel', 'Excel survey type')}
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as SurveyType)}
                      >
                        {[
                          'CES',
                          'PLO',
                          'PES',
                          'EMPLOYEE',
                          'GRADUATE',
                          'EMPLOYER',
                          'UNKNOWN',
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The labelled native file input is keyboard accessible; drag and drop is supplemental. */}
                  <label
                    className="dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (ready && !busy) void upload(e.dataTransfer.files);
                    }}
                  >
                    <UploadCloud size={44} />
                    <strong>
                      {t(
                        'اسحبي الملفات هنا أو اختاريها',
                        'Drop files here or browse',
                      )}
                    </strong>
                    <span>
                      {section === 'courses'
                        ? 'Excel • Word (course report)'
                        : 'Excel (.xlsx / .xls)'}
                    </span>
                    <input
                      aria-label={t(
                        'اختيار ملفات التحليل',
                        'Choose analysis files',
                      )}
                      type="file"
                      multiple
                      accept={
                        section === 'courses'
                          ? '.xlsx,.xls,.docx'
                          : '.xlsx,.xls'
                      }
                      disabled={
                        !ready ||
                        !!busy ||
                        year < 2022 ||
                        year > 2200 ||
                        !Number.isInteger(year)
                      }
                      onChange={(e) => {
                        void upload(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <p className="scope-note">
                    {t(
                      'ملفات Excel: ورقة RawData بعناوين Q1 وQ2… وصف لكل استجابة. تقارير Word: النموذج المرفق للدرجات وCLO المرتبط بـPLO.',
                      'Excel: a RawData sheet with Q1, Q2… headers and one response per row. Word: the supplied course-report template with grades and CLO-to-PLO mapping.',
                    )}
                  </p>
                </section>
                <aside className="panel guide">
                  <div className="section-heading">
                    <span className="step">02</span>
                    <h2>
                      {t(
                        'تحليل واضح، وملفات جاهزة',
                        'Clear findings, ready reports',
                      )}
                    </h2>
                  </div>
                  <h3>{t('مقررات', 'Courses')}</h3>
                  <p>
                    {t(
                      'توزيع الدرجات، الفعلي مقابل المستهدف، استبيانات CES وPLO، ثم القوة والضعف وخطة تحسين مقترحة.',
                      'Grades, actual versus target, CES and PLO surveys, strengths and gaps, and a proposed improvement plan.',
                    )}
                  </p>
                  <h3>{t('استبيانات', 'Surveys')}</h3>
                  <p>
                    {t(
                      'تحليل كل سؤال بمقامه الصحيح، الاستجابات الصالحة، التعليقات وتنبيهات جودة البيانات.',
                      'Question-level valid denominators, responses, comments and data-quality flags.',
                    )}
                  </p>
                  <h3>{t('تصدير مجاني', 'Free exports')}</h3>
                  <p>
                    {t(
                      'Excel وPowerPoint وWord تُنشأ في متصفحك. PDF عبر حفظ التقرير من نافذة الطباعة. دون AI أو خدمة تصدير مدفوعة.',
                      'Excel, PowerPoint and Word are generated in your browser. Save PDF from the print dialog. No AI or paid export service.',
                    )}
                  </p>
                  <p className="qp-storage-note">
                    {t(
                      'تُحفظ النتائج في هذا المتصفح على هذا الجهاز. نزّلي نسخة احتياطية قبل مسح بيانات المتصفح أو الانتقال لجهاز آخر.',
                      'Results are saved in this browser on this device. Download a backup before clearing browser data or moving to another device.',
                    )}
                  </p>
                </aside>
              </div>
            </TabsContent>
            <TabsContent value="dashboard">
              {!data ? (
                <div className="panel qp-empty">
                  <Activity size={40} />
                  <h2>
                    {t(
                      'ابدئي بملف، ثم راجعي نتائجه هنا',
                      'Start with a file, then review its findings here',
                    )}
                  </h2>
                  <Button onClick={() => setTab('analysis')}>
                    {t('تحليل جديد', 'New analysis')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="qp-toolbar">
                    <label>
                      {t('الملف', 'Dataset')}
                      <select
                        value={active}
                        onChange={(e) => {
                          const d = items.find((v) => v.id === e.target.value);
                          if (d) open(d);
                        }}
                      >
                        {items.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} · {d.year}
                          </option>
                        ))}
                      </select>
                    </label>
                    {analysis && (
                      <label>
                        {t('نطاق النتائج', 'Results scope')}
                        <select
                          value={scope}
                          onChange={(e) => setScope(e.target.value)}
                        >
                          <option value="all">
                            {t('جميع النتائج', 'All results')}
                          </option>
                          {groups.slice(1).map((g, i) => (
                            <option value={g.id} key={`${g.id}-${i}`}>
                              {g.code} {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!selected.includes(data.id))
                          setSelected([...selected, data.id]);
                        setTab('export');
                      }}
                    >
                      <Download size={16} />
                      {t('إضافة إلى التصدير', 'Add to export')}
                    </Button>
                  </div>
                  {course && (
                    <>
                      <div className="qp-stat-grid">
                        {[
                          [course.code, t('رمز المقرر', 'Course code')],
                          [fmt(course.started, 0), t('المسجلون', 'Started')],
                          [
                            fmt(course.completed, 0),
                            t('المكتملون', 'Completed'),
                          ],
                          [
                            `${course.outcomes.filter((o) => (outcomeGap(o) ?? -1) >= 0).length}/${course.outcomes.length}`,
                            t('نواتج حققت المستهدف', 'Outcomes meeting target'),
                          ],
                        ].map(([v, label]) => (
                          <div className="panel" key={label}>
                            <span>{label}</span>
                            <strong>{v}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="panel qp-block">
                        <h2>{course.title}</h2>
                        <p>
                          {course.program} • {course.academicYear} •{' '}
                          {t('الفصل', 'Semester')} {course.semester}
                        </p>
                      </div>
                      <div className="qp-two-columns">
                        <section className="panel">
                          <h2>{t('توزيع الدرجات', 'Grade distribution')}</h2>
                          <Bars
                            rows={course.grades.map((g) => ({
                              label: g.grade,
                              value: g.count,
                            }))}
                            max={Math.max(
                              1,
                              ...course.grades.map((g) => g.count || 0),
                            )}
                            suffix=""
                          />
                        </section>
                        <section className="panel">
                          <h2>
                            {t(
                              'نواتج التعلم مقابل المستهدف',
                              'Learning outcomes against targets',
                            )}
                          </h2>
                          <p className="scope-note">
                            {t(
                              'الخط الذهبي = المستهدف • الأعمدة = الفعلي',
                              'Gold marker = target • bars = actual',
                            )}
                          </p>
                          <Bars
                            rows={course.outcomes.map((o) => ({
                              label: `CLO ${o.code}`,
                              value: o.actual,
                              target: o.target,
                            }))}
                          />
                        </section>
                      </div>
                      <section className="panel qp-block">
                        <h2>{t('CLO وربطها بـPLO', 'CLO and PLO mapping')}</h2>
                        <DataTable
                          headers={[
                            'CLO',
                            'PLO',
                            t('الوصف', 'Description'),
                            t('المستهدف %', 'Target %'),
                            t('الفعلي %', 'Actual %'),
                            t('الفجوة بالنقاط', 'Gap pp'),
                          ]}
                          rows={course.outcomes.map((o) => [
                            o.code,
                            o.plo,
                            o.description,
                            o.target,
                            o.actual,
                            fmt(outcomeGap(o)),
                          ])}
                        />
                        <p className="scope-note">
                          {t(
                            'هذا قياس مباشر من تقرير المقرر، منفصل عن رضا استبيان PLO. لا تُجمع النواتج في متوسط برنامج دون أوزان معتمدة.',
                            'This is direct course assessment, separate from PLO survey satisfaction. Outcomes are not averaged across a program without approved weights.',
                          )}
                        </p>
                      </section>
                      <section className="panel qp-block">
                        <h2>
                          {t(
                            'نقاط القوة والضعف وخطة التحسين',
                            'Strengths, gaps and improvement plan',
                          )}
                        </h2>
                        {course.outcomes.map((o) => (
                          <div className="qp-finding" key={o.code}>
                            <strong>
                              CLO {o.code} · PLO {o.plo} —{' '}
                              {outcomeGap(o) === null
                                ? t('يتطلب استكمال البيانات', 'Missing data')
                                : outcomeGap(o)! >= 0
                                  ? t('تحقق المستهدف', 'Target met')
                                  : t('يحتاج تحسينًا', 'Needs improvement')}
                            </strong>
                            <p>
                              {outcomeGap(o)! < 0
                                ? t(
                                    `الفجوة ${fmt(outcomeGap(o))} نقطة. مقترح: مراجعة أسئلة القياس، تقديم تدريبات مرتبطة بالناتج، ثم إعادة القياس مقابل ${o.target}%.`,
                                    `Gap: ${fmt(outcomeGap(o))} pp. Proposal: review assessment items, provide aligned practice, then reassess against ${o.target}%.`,
                                  )
                                : t(
                                    'متابعة القياس والتحقق من استمرار النتيجة.',
                                    'Continue monitoring and verify sustained performance.',
                                  )}
                            </p>
                          </div>
                        ))}
                        <p className="scope-note">
                          {t(
                            'المقترحات مبنية على قواعد، دون AI. المسؤول والموعد يحددان عند اعتماد الخطة.',
                            'Rule-based proposals without AI. Assign owners and deadlines when approving the plan.',
                          )}
                        </p>
                      </section>
                      {course.recommendations.length > 0 && (
                        <section className="panel qp-block">
                          <h2>
                            {t('توصيات المصدر', 'Source recommendations')}
                          </h2>
                          {course.recommendations.map((r, i) => (
                            <p key={i}>{r}</p>
                          ))}
                        </section>
                      )}
                      {course.issues.length > 0 && (
                        <div className="alert error">
                          {course.issues.join(' ')}
                        </div>
                      )}
                    </>
                  )}
                  {analysis && group && (
                    <>
                      {(analysis.needsConfirmation ||
                        analysis.type !== 'CES') && (
                        <section className="panel qp-block">
                          <h2>
                            {t(
                              'مراجعة نوع الأسئلة ومقياسها',
                              'Review question types and scale',
                            )}
                          </h2>
                          <p>
                            {t(
                              'صنّفي الأسئلة قبل اعتماد النتائج. التصنيف يُعيد الحساب من الملف الأصلي.',
                              'Classify questions before approving results. Changes recalculate from the original workbook.',
                            )}
                          </p>
                          <div className="qp-fields">
                            <label>
                              {t('النوع', 'Type')}
                              <select
                                value={options.type || analysis.type}
                                onChange={(e) =>
                                  setOptions({
                                    ...options,
                                    type: e.target.value as SurveyType,
                                  })
                                }
                              >
                                {[
                                  'CES',
                                  'PLO',
                                  'PES',
                                  'EMPLOYEE',
                                  'GRADUATE',
                                  'EMPLOYER',
                                ].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            {(['min', 'max', 'positive'] as const).map(
                              (key, i) => (
                                <label key={key}>
                                  {
                                    [
                                      t('أقل قيمة', 'Minimum'),
                                      t('أعلى قيمة', 'Maximum'),
                                      t('بداية الإيجابية', 'Positive from'),
                                    ][i]
                                  }
                                  <input
                                    type="number"
                                    value={options[key] ?? [1, 5, 4][i]}
                                    onChange={(e) =>
                                      setOptions({
                                        ...options,
                                        [key]: Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                              ),
                            )}
                          </div>
                          <div className="qp-question-kinds">
                            {analysis.questions.map((q) => (
                              <label key={q.id}>
                                <span>
                                  {q.id} {lang === 'ar' ? q.ar : q.en}
                                </span>
                                <select
                                  value={kinds[q.id] || q.kind}
                                  onChange={(e) =>
                                    setKinds({
                                      ...kinds,
                                      [q.id]: e.target.value as QuestionKind,
                                    })
                                  }
                                >
                                  <option value="unresolved">
                                    {t('اختاري النوع', 'Choose type')}
                                  </option>
                                  <option value="rating">
                                    {t('مقياس رقمي', 'Rating')}
                                  </option>
                                  <option value="open">
                                    {t('إجابة مفتوحة', 'Open text')}
                                  </option>
                                  <option value="categorical">
                                    {t('تصنيف', 'Category')}
                                  </option>
                                </select>
                              </label>
                            ))}
                          </div>
                          {availableFiles.includes(data.id) ? (
                            <Button
                              disabled={!!busy}
                              onClick={() => void confirm()}
                            >
                              {t(
                                'اعتماد وإعادة الحساب',
                                'Confirm and recalculate',
                              )}
                            </Button>
                          ) : (
                            <label className="qp-file-button">
                              {t(
                                'اختيار الملف الأصلي وإعادة الحساب',
                                'Select original file and recalculate',
                              )}
                              <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => {
                                  if (e.target.files?.[0])
                                    void confirm(e.target.files[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </section>
                      )}
                      <div className="qp-stat-grid">
                        {[
                          [fmt(group.rows, 0), t('المستجيبون', 'Respondents')],
                          [
                            fmt(group.overall.mean),
                            `${t('المتوسط', 'Mean')} / ${analysis.max}`,
                          ],
                          [
                            `${fmt(group.overall.positivity)}%`,
                            t('الإجابات الإيجابية', 'Positive responses'),
                          ],
                          [
                            fmt(group.overall.valid, 0),
                            t('إجابات صالحة', 'Valid answers'),
                          ],
                        ].map(([v, label]) => (
                          <div className="panel" key={label}>
                            <span>{label}</span>
                            <strong>{v}</strong>
                          </div>
                        ))}
                      </div>
                      {group.smallSample && (
                        <p className="qp-notice">
                          {t(
                            'أقل من 10 مستجيبين: تُفسر النتائج بحذر ولا تُعمم.',
                            'Fewer than 10 respondents: interpret cautiously without generalization.',
                          )}
                        </p>
                      )}
                      <div className="qp-two-columns">
                        <section className="panel">
                          <h2>{t('متوسط كل سؤال', 'Mean by question')}</h2>
                          <Bars
                            rows={analysis.questions
                              .filter((q) => q.kind === 'rating')
                              .map((q) => ({
                                label: q.id,
                                value: group.questions[q.id]?.mean ?? null,
                              }))}
                            max={analysis.max}
                            suffix=""
                          />
                        </section>
                        <section className="panel">
                          <h2>
                            {t(
                              'نسبة الإجابات الإيجابية',
                              'Positive response percentage',
                            )}
                          </h2>
                          <Bars
                            rows={analysis.questions
                              .filter((q) => q.kind === 'rating')
                              .map((q) => ({
                                label: q.id,
                                value:
                                  group.questions[q.id]?.positivity ?? null,
                              }))}
                          />
                        </section>
                      </div>
                      <section className="panel qp-block">
                        <h2>
                          {t('تحليل شامل للأسئلة', 'Complete question analysis')}
                        </h2>
                        <DataTable
                          headers={[
                            t('السؤال', 'Question'),
                            t('الوصف', 'Label'),
                            'n',
                            t('المتوسط', 'Mean'),
                            t('الإيجابية %', 'Positive %'),
                            t('غير صالحة/فارغة', 'Invalid/empty'),
                          ]}
                          rows={analysis.questions
                            .filter((q) => q.kind === 'rating')
                            .map((q) => {
                              const m = group.questions[q.id];
                              return [
                                q.id,
                                lang === 'ar' ? q.ar : q.en,
                                m?.valid,
                                fmt(m?.mean),
                                fmt(m?.positivity),
                                (m?.empty || 0) +
                                  (m?.nonNumeric || 0) +
                                  (m?.outOfRange || 0),
                              ];
                            })}
                        />
                        <p className="scope-note">
                          {t(
                            'الإيجابية = عدد الإجابات عند الحد المحدد أو أعلى ÷ الإجابات الصالحة. الفراغات لا تُحسب صفرًا.',
                            'Positive responses = answers at or above the threshold / valid answers. Missing values are not zero.',
                          )}
                        </p>
                      </section>
                      <section className="panel qp-block">
                        <h2>
                          {t(
                            'نقاط القوة وفرص التحسين',
                            'Strengths and improvement opportunities',
                          )}
                        </h2>
                        {analysis.questions
                          .filter((q) => q.kind === 'rating')
                          .map((q) => {
                            const m = group.questions[q.id];
                            return (
                              <div className="qp-finding" key={q.id}>
                                <strong>
                                  {q.id} —{' '}
                                  {m?.positivity == null
                                    ? t('بيانات غير كافية', 'Insufficient data')
                                    : m.positivity >= 80
                                      ? t('نقطة قوة', 'Strength')
                                      : m.positivity < 60
                                        ? t(
                                            'أولوية تحسين',
                                            'Improvement priority',
                                          )
                                        : t(
                                            'مقبول مع فرصة للتحسين',
                                            'Acceptable with improvement opportunity',
                                          )}
                                </strong>
                                <p>
                                  {lang === 'ar' ? q.ar : q.en} ·{' '}
                                  {fmt(m?.positivity)}% · n={m?.valid ?? 0}
                                </p>
                                {m?.positivity != null && m.positivity < 80 && (
                                  <p>
                                    {t(
                                      'مقترح: مراجعة التعليقات والتحقق من سبب النتيجة، ثم تحديد إجراء قابل للقياس ومتابعته في الدورة القادمة.',
                                      'Proposal: review comments, investigate the result, define a measurable action and follow up next cycle.',
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        <p className="scope-note">
                          {t(
                            'CES: الإيجابية الأقل من 60% في Q15 تجعل المقرر أولوية. تقرير التصدير يتضمن مقترحات خاصة بالأسئلة دون AI.',
                            'CES: Q15 positivity below 60% marks course priority. Exported reports include question-specific proposals without AI.',
                          )}
                        </p>
                      </section>
                      {analysis.comments.length > 0 && (
                        <section className="panel qp-block">
                          <h2>{t('التعليقات المفتوحة', 'Open comments')}</h2>
                          {scope !== 'all' && (
                            <p className="scope-note">
                              {t(
                                'التعليقات التالية تخص الملف كاملًا، وليست مصفاة حسب النطاق.',
                                'Comments below cover the entire file, not the selected scope.',
                              )}
                            </p>
                          )}
                          {analysis.comments.map((q) => (
                            <div key={q.question}>
                              <h3>{q.question}</h3>
                              {q.top.map((c, i) => (
                                <p key={i}>
                                  {c.text} <small>×{c.count}</small>
                                </p>
                              ))}
                            </div>
                          ))}
                        </section>
                      )}
                      {analysis.issues.length > 0 && (
                        <section className="panel qp-block">
                          <h2>{t('جودة البيانات', 'Data quality')}</h2>
                          <DataTable
                            headers={[
                              t('التنبيه', 'Issue'),
                              t('العدد', 'Count'),
                              t('التفصيل', 'Detail'),
                            ]}
                            rows={analysis.issues.map((v) => [
                              v.code,
                              v.count,
                              v.detail,
                            ])}
                          />
                        </section>
                      )}
                      {analysis.kind === 'historical' && (
                        <section className="panel qp-block">
                          <h2>
                            {t('النتائج التاريخية', 'Historical findings')}
                          </h2>
                          <DataTable
                            headers={[
                              t('البرنامج', 'Program'),
                              t('الاستبيان', 'Survey'),
                              t('السؤال', 'Question'),
                              t('السنة', 'Year'),
                              t('القيمة', 'Value'),
                            ]}
                            rows={(analysis.historical || []).map((v) => [
                              v.program,
                              v.survey,
                              v.label,
                              v.year,
                              v.value,
                            ])}
                          />
                        </section>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="history">
              <section className="panel">
                <div className="section-heading">
                  <span className="step">01</span>
                  <div>
                    <h2>
                      {t(
                        'مكتبة التحليلات على هذا الجهاز',
                        'Analyses on this device',
                      )}
                    </h2>
                    <p>
                      {t(
                        'اختاري الملفات المطلوب إدراجها في التقرير، أو افتحي ملفًا لمراجعة نتائجه.',
                        'Select files for the report or open a file to review its findings.',
                      )}
                    </p>
                  </div>
                </div>
                <div className="qp-toolbar">
                  <Button
                    variant="outline"
                    disabled={!items.length || !!busy}
                    onClick={() =>
                      downloadFile(
                        JSON.stringify({ version: 1, items }),
                        `quality-backup-${new Date().toISOString().slice(0, 10)}.json`,
                        'application/json',
                      )
                    }
                  >
                    {t('نسخة احتياطية', 'Download backup')}
                  </Button>
                  <label className="qp-file-button">
                    {t('استعادة نسخة', 'Restore backup')}
                    <input
                      type="file"
                      accept=".json"
                      disabled={!!busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file)
                          void run(t('استعادة', 'Restoring'), async () => {
                            if (file.size > 50 * 1024 * 1024)
                              throw new Error('WORKBOOK_TOO_LARGE');
                            const value = JSON.parse(await file.text());
                            if (
                              value.version !== 1 ||
                              !Array.isArray(value.items) ||
                              value.items.length > 500
                            )
                              throw new Error('INVALID_BACKUP');
                            for (const d of value.items) {
                              if (
                                typeof d.id !== 'string' ||
                                typeof d.name !== 'string' ||
                                typeof d.hash !== 'string' ||
                                !['courses', 'students', 'employees'].includes(
                                  d.section,
                                ) ||
                                !Number.isInteger(d.year) ||
                                d.year < 2022 ||
                                d.year > 2200 ||
                                (!d.analysis && !d.course)
                              )
                                throw new Error('INVALID_BACKUP');
                              if (
                                d.analysis &&
                                (!Array.isArray(d.analysis.questions) ||
                                  !Array.isArray(d.analysis.programs) ||
                                  !d.analysis.overall)
                              )
                                throw new Error('INVALID_BACKUP');
                              if (
                                d.course &&
                                (!Array.isArray(d.course.outcomes) ||
                                  !Array.isArray(d.course.grades))
                              )
                                throw new Error('INVALID_BACKUP');
                            }
                            for (const d of value.items) await put(d);
                            setNotice(t('استُعيدت النسخة.', 'Backup restored.'));
                          });
                      }}
                    />
                  </label>
                  <Button
                    disabled={
                      !!busy ||
                      chosen.length < 2 ||
                      chosen.some(
                        (d) =>
                          !d.analysis ||
                          d.year !== chosen[0].year ||
                          d.section !== chosen[0].section,
                      )
                    }
                    variant="outline"
                    onClick={() =>
                      void run(
                        t('دمج الاستبيانات', 'Combining surveys'),
                        async () => {
                          const a = await processInBrowser<Analysis>(
                            'merge',
                            chosen.map((d) => d.analysis),
                            cancel.current?.signal,
                          );
                          const d: Dataset = {
                            ...chosen[0],
                            id: crypto.randomUUID(),
                            hash: crypto.randomUUID(),
                            name: t(
                              `تحليل مدمج — ${chosen.length} ملفات`,
                              `Combined analysis — ${chosen.length} files`,
                            ),
                            analysis: a,
                            created: new Date().toISOString(),
                          };
                          await put(d);
                          setSelected([d.id]);
                          open(d);
                        },
                      )
                    }
                  >
                    {t(
                      'دمج الاستبيانات المتوافقة',
                      'Combine compatible surveys',
                    )}
                  </Button>
                </div>
                {!items.length ? (
                  <p className="qp-empty">
                    {t('لا توجد تحليلات محفوظة بعد.', 'No saved analyses yet.')}
                  </p>
                ) : (
                  <div className="qp-saved-list">
                    {items.map((d) => (
                      <div className="qp-saved-row" key={d.id}>
                        <input
                          type="checkbox"
                          aria-label={`${t('اختيار', 'Select')} ${d.name}`}
                          checked={selected.includes(d.id)}
                          onChange={() => toggle(d.id)}
                        />
                        <FileSpreadsheet />
                        <button onClick={() => open(d)}>
                          <strong>{d.name}</strong>
                          <small>
                            {sectionName(d.section)} · {d.year} ·{' '}
                            {d.course?.code || d.analysis?.type}{' '}
                            {d.analysis?.needsConfirmation
                              ? '• ' + t('يتطلب مراجعة', 'Review needed')
                              : ''}
                          </small>
                        </button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  `حذف التحليل المحلي «${d.name}»؟`,
                                  `Delete local analysis “${d.name}”?`,
                                ),
                              )
                            )
                              void run(
                                t('حذف التحليل', 'Deleting analysis'),
                                async () => {
                                  await deleteDataset(d.id);
                                  setItems((old) =>
                                    old.filter((v) => v.id !== d.id),
                                  );
                                  setSelected((old) =>
                                    old.filter((v) => v !== d.id),
                                  );
                                },
                              );
                          }}
                        >
                          {t('حذف', 'Delete')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="scope-note">
                  {t(
                    'الحفظ المحلي لا يتزامن بين الأجهزة. النسخة الاحتياطية تتضمن النتائج والتعليقات؛ احتفظي بها في مكان مناسب.',
                    'Local saves do not sync between devices. Backups include results and comments; keep them in an appropriate location.',
                  )}
                </p>
                <details className="qp-block">
                  <summary>
                    {t(
                      'استيراد التحليلات المحفوظة في النسخة السابقة',
                      'Import analyses saved in the previous version',
                    )}
                  </summary>
                  <p>
                    {t(
                      'تستخدم هوية المتصفح الحالية للوصول إلى محفوظاتك السابقة.',
                      'Uses the current browser identity to access your previous saved analyses.',
                    )}
                  </p>
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        t(
                          'قراءة المحفوظات السابقة',
                          'Reading previous analyses',
                        ),
                        async () => {
                          const r = await fetch('/api/reports');
                          if (!r.ok) throw new Error('ARCHIVE_UNAVAILABLE');
                          const value = (await r.json()) as {
                            reports: { id: string; name: string }[];
                          };
                          setArchive(value.reports || []);
                          if (!value.reports?.length)
                            setNotice(
                              t(
                                'لا توجد محفوظات سابقة لهوية هذا المتصفح.',
                                'No previous analyses for this browser identity.',
                              ),
                            );
                        },
                      )
                    }
                  >
                    {t('عرض المحفوظات السابقة', 'Show previous analyses')}
                  </Button>
                  {archive.map((r) => (
                    <div className="qp-saved-row" key={r.id}>
                      <span>{r.name}</span>
                      <Button
                        disabled={!!busy}
                        onClick={() =>
                          void run(
                            t('استيراد التحليل', 'Importing analysis'),
                            async () => {
                              const res = await fetch(
                                `/api/reports/${encodeURIComponent(r.id)}`,
                              );
                              if (!res.ok)
                                throw new Error('ARCHIVE_UNAVAILABLE');
                              const result = (await res.json()) as {
                                record: { created_at: string };
                                analysis: Analysis;
                              };
                              const d: Dataset = {
                                id: r.id,
                                hash: `archive:${r.id}`,
                                name: r.name,
                                year,
                                section,
                                created: result.record.created_at,
                                analysis: result.analysis,
                              };
                              await put(d);
                              open(d);
                            },
                          )
                        }
                      >
                        {t('استيراد', 'Import')}
                      </Button>
                    </div>
                  ))}
                </details>
              </section>
            </TabsContent>
            <TabsContent value="export">
              <section className="panel qp-block">
                <h2>{t('التقرير الشامل', 'Comprehensive report')}</h2>
                <p>
                  {t(
                    'اختاري الملفات ورتبيها: لوحة كل ملف، تفاصيل التحليل، القوة والضعف، ثم خطة التحسين.',
                    'Choose and order files: each dashboard, detailed findings, strengths and gaps, then improvement proposals.',
                  )}
                </p>
                <div className="qp-toolbar">
                  <Button
                    variant="outline"
                    onClick={() => setSelected(items.map((d) => d.id))}
                  >
                    {t('اختيار الكل', 'Select all')}
                  </Button>
                  <Button variant="outline" onClick={() => setSelected([])}>
                    {t('إلغاء الاختيار', 'Clear selection')}
                  </Button>
                  <span>
                    {chosen.length} {t('ملفات مختارة', 'selected files')}
                  </span>
                </div>
                <div className="qp-export-selection">
                  {items.map((d) => (
                    <label key={d.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                      {d.name} · {d.year}
                    </label>
                  ))}
                </div>
                <p className="scope-note">
                  {t(
                    'تظهر الملفات حسب ترتيب المكتبة. لتنظيمها داخل التقرير استخدمي الأسهم أدناه.',
                    'Files follow library order. Use the arrows below to set report order.',
                  )}
                </p>
                {chosen.map((d, i) => (
                  <div className="qp-order" key={d.id}>
                    <span>
                      {i + 1}. {d.name}
                    </span>
                    <button
                      aria-label={`${t('تقديم', 'Move up')} ${d.name}`}
                      disabled={i === 0}
                      onClick={() =>
                        setItems((old) => {
                          const copy = [...old];
                          const at = copy.findIndex((v) => v.id === d.id);
                          const before = copy.findIndex(
                            (v) => v.id === chosen[i - 1].id,
                          );
                          [copy[at], copy[before]] = [copy[before], copy[at]];
                          return copy;
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`${t('تأخير', 'Move down')} ${d.name}`}
                      disabled={i === chosen.length - 1}
                      onClick={() =>
                        setItems((old) => {
                          const copy = [...old];
                          const at = copy.findIndex((v) => v.id === d.id);
                          const after = copy.findIndex(
                            (v) => v.id === chosen[i + 1].id,
                          );
                          [copy[at], copy[after]] = [copy[after], copy[at]];
                          return copy;
                        })
                      }
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </section>
              <div className="qp-export-grid">
                {(['xlsx', 'pptx', 'docx', 'preview'] as const).map(
                  (format, i) => (
                    <section className="panel" key={format}>
                      <FileSpreadsheet />
                      <h2>{['Excel', 'PowerPoint', 'Word', 'PDF'][i]}</h2>
                      <p>
                        {
                          [
                            t(
                              'تحليل شامل، الجداول والنواتج وخطة التحسين.',
                              'Full analysis, tables, outcomes and improvement plan.',
                            ),
                            t(
                              'شرائح متتابعة وفق هوية التقرير المرجعي.',
                              'Sequential slides using the reference report identity.',
                            ),
                            t(
                              'تقرير قابل للتحرير والمراجعة.',
                              'Editable report for review.',
                            ),
                            t(
                              'معاينة التقرير ثم حفظه PDF من الطباعة.',
                              'Preview, then save as PDF from the print dialog.',
                            ),
                          ][i]
                        }
                      </p>
                      <Button
                        disabled={
                          !!busy ||
                          !chosen.length ||
                          chosen.some((d) => d.analysis?.needsConfirmation)
                        }
                        onClick={() => void exportSelected(format)}
                      >
                        <Download size={16} />
                        {format === 'preview'
                          ? t('معاينة PDF', 'Preview PDF')
                          : t('تنزيل', 'Download')}
                      </Button>
                    </section>
                  ),
                )}
              </div>
              <section className="panel qp-block">
                <h2>
                  {t('إضافة سنة للملف التاريخي', 'Append a historical year')}
                </h2>
                <p>
                  {t(
                    'سنوات 2022–2026 ثابتة. يُضاف عمود جديد للسنة التالية دون تعديل الخلايا الأصلية. اربطي النتائج بصفوفها وراجعي المعاينة قبل التنزيل.',
                    '2022–2026 stay fixed. A new column is appended for the next year without modifying original cells. Map results to rows and review before downloading.',
                  )}
                </p>
                <label className="qp-file-button">
                  {t('اختيار ملف المقارنة الأصلي', 'Choose historical workbook')}
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={!!busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f)
                        void run(
                          t('قراءة سنوات المقارنة', 'Reading historical years'),
                          async () => {
                            const bytes = new Uint8Array(await f.arrayBuffer());
                            const result = await processInBrowser<
                              HistorySheet[]
                            >('history', bytes, cancel.current?.signal);
                            if (!result.length)
                              throw new Error('HISTORY_TEMPLATE_REQUIRED');
                            baseline.current = bytes;
                            setHistory(result);
                            setHistorySheet(result[0].name);
                            setMappings([]);
                          },
                        );
                    }}
                  />
                </label>
                {history.length > 0 && (
                  <>
                    <p className="qp-notice">
                      {t('السنة الجديدة', 'New year')}: {nextYear} ·{' '}
                      {t(
                        'السنة في التحليل المختار يجب أن تطابقها.',
                        'The selected analysis reporting year must match.',
                      )}
                    </p>
                    <div className="qp-fields">
                      <label>
                        {t('ورقة البرنامج', 'Program sheet')}
                        <select
                          value={historySheet}
                          onChange={(e) => {
                            setHistorySheet(e.target.value);
                            setMapRow('');
                          }}
                        >
                          {history.map((s) => (
                            <option key={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('مصدر النتيجة', 'Result source')}
                        <select
                          value={active}
                          onChange={(e) => {
                            setActive(e.target.value);
                            setScope('all');
                          }}
                        >
                          <option value="">
                            {t('اختيار ملف', 'Choose file')}
                          </option>
                          {items
                            .filter((d) => d.analysis)
                            .map((d) => (
                              <option value={d.id} key={d.id}>
                                {d.name} · {d.year}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        {t('نطاق النتيجة', 'Result scope')}
                        <select
                          value={scope}
                          onChange={(e) => setScope(e.target.value)}
                        >
                          <option value="all">
                            {t('الملف كاملًا', 'Entire file')}
                          </option>
                          {groups.slice(1).map((g, i) => (
                            <option value={g.id} key={i}>
                              {g.code} {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('المؤشر', 'Metric')}
                        <select
                          value={mapMetric}
                          onChange={(e) => setMapMetric(e.target.value)}
                        >
                          {metrics.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label} = {fmt(m.value)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="qp-wide-field">
                      {t(
                        'الصف المقابل في النموذج',
                        'Corresponding template row',
                      )}
                      <select
                        value={mapRow}
                        onChange={(e) => setMapRow(e.target.value)}
                      >
                        <option value="">
                          {t(
                            'اختاري الصف بعد التحقق من الاستبيان والسؤال والفصل',
                            'Choose after checking survey, question and semester',
                          )}
                        </option>
                        {selectedHistory?.rows.map((r) => (
                          <option key={r.row} value={r.row}>
                            {r.row} — {r.survey} — {r.question} — {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant="outline"
                      disabled={
                        !mapRow ||
                        currentMetric?.value == null ||
                        data?.year !== nextYear ||
                        analysis?.needsConfirmation
                      }
                      onClick={() => {
                        if (currentMetric?.value != null && data) {
                          const entry = {
                            sheet: historySheet,
                            row: Number(mapRow),
                            value: currentMetric.value,
                            source: `${data.name} / ${group?.name} / ${currentMetric.label}`,
                          };
                          setMappings((old) => [
                            ...old.filter(
                              (m) =>
                                m.sheet !== entry.sheet || m.row !== entry.row,
                            ),
                            entry,
                          ]);
                        }
                      }}
                    >
                      {t('إضافة الربط للمعاينة', 'Add mapping to preview')}
                    </Button>
                    <DataTable
                      headers={[
                        t('الورقة', 'Sheet'),
                        t('الصف', 'Row'),
                        t('المصدر والمؤشر', 'Source and metric'),
                        String(nextYear),
                      ]}
                      rows={mappings.map((m) => [
                        m.sheet,
                        m.row,
                        m.source,
                        fmt(m.value, 4),
                      ])}
                    />
                    {mappings.map((m) => (
                      <button
                        className="qp-remove-mapping"
                        key={`${m.sheet}-${m.row}`}
                        onClick={() =>
                          setMappings((old) => old.filter((v) => v !== m))
                        }
                      >
                        {t('حذف ربط', 'Remove mapping')} {m.sheet} · {m.row}
                      </button>
                    ))}
                    <div className="qp-block">
                      <Button
                        disabled={!!busy || !mappings.length}
                        onClick={() =>
                          void run(
                            t('إضافة السنة الجديدة', 'Appending new year'),
                            async () => {
                              const bytes = await processInBrowser<Uint8Array>(
                                'append',
                                {
                                  bytes: baseline.current,
                                  year: nextYear,
                                  mappings,
                                },
                                cancel.current?.signal,
                              );
                              downloadFile(
                                bytes as Uint8Array<ArrayBuffer>,
                                `historical-comparison-through-${nextYear}.xlsx`,
                              );
                              setNotice(
                                t(
                                  'نُزّلت نسخة محدثة. ارفعيها عند إضافة السنة التالية.',
                                  'Updated copy downloaded. Use it when adding the next year.',
                                ),
                              );
                            },
                          )
                        }
                      >
                        {t(
                          'تنزيل نسخة مع السنة الجديدة',
                          'Download copy with new year',
                        )}
                      </Button>
                    </div>
                    <p className="scope-note">
                      {t(
                        'تُحفظ الرسوم الأصلية كما هي. العمود الجديد يُضاف إلى يمين الأعمدة المستخدمة؛ الصفوف غير المربوطة تبقى فارغة في السنة الجديدة.',
                        'Original charts are preserved. The new year is appended to the right of existing columns; unmapped rows stay blank in the new year.',
                      )}
                    </p>
                  </>
                )}
              </section>
            </TabsContent>
          </Tabs>
          <footer className="qp-footer">
            {t(
              'حسابات قابلة للمراجعة • لا AI • التحليل والتصدير على جهازك',
              'Reviewable calculations • No AI • Analysis and exports on your device',
            )}
          </footer>
        </main>
        {preview && (
          <dialog
            open
            className="qp-preview"
            aria-modal="true"
            aria-label={t('معاينة التقرير', 'Report preview')}
          >
            <div className="qp-preview-toolbar">
              <strong>
                {pages.length} {t('صفحة', 'pages')}
              </strong>
              <Button onClick={() => window.print()}>
                {t('طباعة / حفظ PDF', 'Print / Save PDF')}
              </Button>
              <Button variant="outline" onClick={() => setPreview(false)}>
                {t('إغلاق', 'Close')}
              </Button>
            </div>
            <p>
              {t(
                'اختاري «حفظ بصيغة PDF» في نافذة الطباعة.',
                'Choose “Save as PDF” in the print dialog.',
              )}
            </p>
            <div className="qp-preview-body">
              {pages.map((p, i) => (
                <div className="panel" key={i}>
                  <small>{i + 1}</small>
                  <h2>{p.title}</h2>
                  <p>{p.subtitle}</p>
                  {p.lines?.map((v, j) => (
                    <p key={j}>{v}</p>
                  ))}
                  {p.chart && (
                    <Bars
                      rows={p.chart.categories.map((label, j) => ({
                        label,
                        value: p.chart!.values[j],
                      }))}
                      max={p.chart.max}
                      suffix={p.chart.metric === 'positivity' ? '%' : ''}
                    />
                  )}{' '}
                  {p.headers && p.rows && (
                    <DataTable headers={p.headers} rows={p.rows} />
                  )}
                </div>
              ))}
            </div>
          </dialog>
        )}
      </div>
      <Printable pages={pages} lang={lang} />
    </>
  );
}
