'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderClock,
  Languages,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  TriangleAlert,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  type Analysis,
  type Group,
  type Lang,
  type QuestionKind,
  type SurveyType,
  formatMetric,
} from '@/lib/analysis';
type Report = {
  id: string;
  name: string;
  created_at: string;
  bytes: number;
  type: string;
  kind: string;
  rows: number;
  status: string;
};
const errors: Record<string, [string, string]> = {
  EXPORT_TOO_LARGE: [
    'التقرير يتجاوز 800 صفحة. اختاري نطاقًا أصغر للتصدير.',
    'The report exceeds 800 pages. Choose a smaller export scope.',
  ],
  EXPORT_TEXT_TOO_LONG: [
    'أحد نصوص الجدول طويل جدًا لعرضه كاملًا. اختصري نص السؤال في نسخة من الملف ثم أعيدي رفعها.',
    'A table cell is too long to display fully. Shorten the question in a copy of the workbook and upload it again.',
  ],
  ANALYSIS_FAILED: [
    'تعذر إكمال العملية. حاولي مجددًا.',
    'The operation failed. Please try again.',
  ],
  RAWDATA_REQUIRED: [
    'لم أجد ورقة RawData أو جدول نتائج تاريخية معروفًا.',
    'No RawData sheet or recognized historical table was found.',
  ],
  WORKBOOK_TOO_LARGE: [
    'الملف يتجاوز حدود المعالجة: 16 ميجابايت أو 50 ألف استجابة.',
    'The file exceeds processing limits: 16 MB or 50,000 responses.',
  ],
  UNSUPPORTED_FILE: [
    'اختاري ملف XLSX أو XLS.',
    'Choose an XLSX or XLS workbook.',
  ],
  INVALID_SCALE: [
    'تحققي من حدود المقياس وتعريف الإيجابية.',
    'Check the scale and positive-answer threshold.',
  ],
  INCOMPATIBLE_REPORTS: [
    'لا يمكن دمج استبيانات تختلف في النوع أو الأسئلة أو المقياس أو تعريف الإيجابية.',
    'These reports have different types, questions, scales or positivity definitions and cannot be pooled.',
  ],
  OVERLAPPING_COHORTS: [
    'توجد مجموعات مقررات متداخلة بين الملفات؛ اعرضيها منفصلة لتجنب تكرار الاستجابات.',
    'Course cohorts overlap. Review these files separately to avoid double-counting.',
  ],
  CONFIRM_REQUIRED: [
    'أكملي تأكيد النوع والأسئلة قبل التصدير.',
    'Confirm the survey type and questions before export.',
  ],
  DUPLICATE_COLUMNS: [
    'يوجد تكرار في أسماء أعمدة الأسئلة.',
    'Question columns contain duplicate names.',
  ],
  EMPTY_RAWDATA: [
    'ورقة RawData لا تحتوي استجابات.',
    'RawData contains no responses.',
  ],
  NOT_FOUND: [
    'الملف غير موجود في مساحة هذا المتصفح.',
    'This file is not available in this browser workspace.',
  ],
  WORKSPACE_LIMIT: [
    'وصلت المساحة إلى حد 100 ملف.',
    'This workspace has reached the 100-file limit.',
  ],
  NO_QUESTION_COLUMNS: [
    'لا توجد أعمدة أسئلة معرّفة مثل Q1. يلزم ضبط بنية الملف.',
    'No question columns such as Q1 were found. The workbook structure needs mapping.',
  ],
};
const issues: Record<string, [string, string]> = {
  empty: ['إجابات فارغة مستبعدة', 'Blank answers excluded'],
  'non-numeric': ['قيم غير رقمية مستبعدة', 'Non-numeric values excluded'],
  'out-of-range': ['درجات خارج المقياس', 'Scores outside the scale'],
  'unresolved-questions': [
    'أسئلة تحتاج تحديد النوع',
    'Questions awaiting type confirmation',
  ],
  'conflicting-expected': [
    'تعارض في العدد المتوقع',
    'Conflicting expected counts',
  ],
  'response-over-100': [
    'معدل الاستجابة يتجاوز 100%',
    'Response rate exceeds 100%',
  ],
  'excel-reference-errors': [
    'أخطاء مراجع أو حسابات في Excel',
    'Excel reference or calculation errors',
  ],
  'program-title-mismatch': [
    'اسم البرنامج داخل الورقة مختلف عن اسمها',
    'Program title differs from the worksheet name',
  ],
};
function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
    >
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue>
          {options.find((o) => o.value === value)?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Hub() {
  const [lang, setLang] = useState<Lang>('ar'),
    [tab, setTab] = useState('analysis'),
    [reports, setReports] = useState<Report[]>([]),
    [ids, setIds] = useState<string[]>([]),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [workspaceReady, setWorkspaceReady] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [messages, setMessages] = useState<string[]>([]),
    [notice, setNotice] = useState(''),
    [groupId, setGroupId] = useState('all'),
    [type, setType] = useState<SurveyType>('UNKNOWN'),
    [min, setMin] = useState('1'),
    [max, setMax] = useState('5'),
    [positive, setPositive] = useState('4'),
    [kinds, setKinds] = useState<Record<string, QuestionKind>>({}),
    [resultView, setResultView] = useState('questions');
  const initialization = useRef<Promise<Report[]> | null>(null);
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en),
    f = (n: number | null, d = 2) => formatMetric(n, d, lang),
    pct = (n: number | null) => (n === null ? f(null) : f(n, 1) + '%');
  const errorText = (code: string) =>
    errors[code]?.[lang === 'ar' ? 0 : 1] ||
    t('تعذر إكمال العملية.', 'The operation could not be completed.');
  const api = async (url: string, init?: RequestInit) => {
    const r = await fetch(url, init);
    if (!r.ok) {
      const e = (await r
        .json()
        .catch(() => ({ error: 'ANALYSIS_FAILED' }))) as { error: string };
      throw new Error(e.error);
    }
    return r.json() as Promise<{
      reports: Report[];
      id: string;
      duplicate: boolean;
      analysis: Analysis;
    }>;
  };
  const refresh = async () => {
    const data = await api('/api/reports');
    setReports(data.reports);
    return data.reports as Report[];
  };
  const initializeWorkspace = () => {
    // Share the first request across effects; no upload may race its cookie.
    initialization.current ||= refresh();
    initialization.current
      .then(() => setWorkspaceReady(true))
      .catch((e) => {
        initialization.current = null;
        setMessages([errorText(e.message)]);
      });
  };
  useEffect(() => {
    initializeWorkspace();
    const saved = localStorage.getItem('sqh_language');
    if (saved === 'ar' || saved === 'en') queueMicrotask(() => setLang(saved));
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Initialize once after hydration; the shared promise prevents duplicate session requests.
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('sqh_language', lang);
  }, [lang]);
  const setResult = (a: Analysis) => {
    setAnalysis(a);
    setGroupId('all');
    setType(a.type);
    setMin(String(a.min));
    setMax(String(a.max));
    setPositive(String(a.positive));
    setKinds(Object.fromEntries(a.questions.map((q) => [q.id, q.kind])));
  };
  const load = async (selected: string[]) => {
    if (!selected.length) return;
    setBusy(true);
    setMessages([]);
    try {
      const data =
        selected.length === 1
          ? await api('/api/reports/' + selected[0])
          : await api('/api/combined', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: selected }),
            });
      setIds(selected);
      setResult(data.analysis);
      setTab('dashboard');
    } catch (e) {
      setMessages([errorText((e as Error).message)]);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (files: File[]) => {
    if (!files.length || busy || !workspaceReady) return;
    if (files.length > 20) {
      setMessages([
        t(
          'اختاري حتى 20 ملفًا في المرة الواحدة.',
          'Choose up to 20 files at a time.',
        ),
      ]);
      return;
    }
    setBusy(true);
    setMessages([]);
    setNotice('');
    setProgress(0);
    const saved: string[] = [],
      failures: string[] = [];
    let duplicates = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const body = new FormData();
        body.set('file', files[i]);
        const data = await api('/api/reports', { method: 'POST', body });
        saved.push(data.id);
        if (data.duplicate) duplicates++;
      } catch (e) {
        failures.push(`${files[i].name}: ${errorText((e as Error).message)}`);
      }
      setProgress(((i + 1) / files.length) * 100);
    }
    try {
      await refresh();
      if (saved.length) {
        const data = await api('/api/reports/' + saved[0]);
        setIds([saved[0]]);
        setResult(data.analysis);
        setTab('dashboard');
        setNotice(
          t(
            `تم حفظ ${saved.length} ملف${duplicates ? '؛ الملفات المكررة عُرضت دون تكرار' : ''}.`,
            `Saved ${saved.length} file(s)${duplicates ? '; duplicates were reused without double-counting' : ''}.`,
          ),
        );
      }
    } catch (e) {
      failures.push(errorText((e as Error).message));
    }
    setMessages(failures);
    setBusy(false);
  };
  const confirm = async () => {
    if (ids.length !== 1) return;
    setBusy(true);
    setMessages([]);
    try {
      const data = await api('/api/reports/' + ids[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          min: Number(min),
          max: Number(max),
          positive: Number(positive),
          kinds,
        }),
      });
      setResult(data.analysis);
      await refresh();
    } catch (e) {
      setMessages([errorText((e as Error).message)]);
    } finally {
      setBusy(false);
    }
  };
  const exportFile = async (format: 'pptx' | 'docx') => {
    setBusy(true);
    setMessages([]);
    try {
      const r = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, format, lang, groupId }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error: string }).error);
      const blob = await r.blob(),
        url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey-quality-report-${lang}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(
        t(
          'التقرير جاهز وتم بدء تنزيله.',
          'The report is ready and the download has started.',
        ),
      );
    } catch (e) {
      setMessages([errorText((e as Error).message)]);
    } finally {
      setBusy(false);
    }
  };
  const groupOptions = [
    { value: 'all', label: t('جميع البرامج', 'All programs') },
    ...(analysis?.programs.flatMap((p) => [
      { value: p.id, label: p.code + ' · ' + p.name },
      ...(p.levels?.flatMap((l) => [
        {
          value: l.id,
          label: `${p.code} ← ${t('المستوى', 'Level')} ${l.level}`,
        },
        ...(l.courses || []).map((c) => ({
          value: c.id,
          label: `${p.code} · ${l.level} · ${c.code}`,
        })),
      ]) || []),
    ]) || []),
  ];
  const group = useMemo(() => {
    if (!analysis) return null;
    if (groupId === 'all') return analysis.overall;
    for (const p of analysis.programs) {
      if (p.id === groupId) return p;
      for (const l of p.levels || []) {
        if (l.id === groupId) return l;
        const c = l.courses?.find((c) => c.id === groupId);
        if (c) return c;
      }
    }
    return analysis.overall;
  }, [analysis, groupId]);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'read_survey_result',
          title: 'Read current survey result',
          description:
            'Read the currently displayed analysis summary and selected scope. Does not upload or export files.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: unknown) => {
            if (
              input === null ||
              typeof input !== 'object' ||
              Object.keys(input).length
            )
              throw new Error('No arguments are accepted');
            return {
              type: analysis?.type || null,
              scope: groupId,
              rows: group?.rows ?? null,
              mean: group?.overall.mean ?? null,
              positivity: group?.overall.positivity ?? null,
              needsConfirmation: analysis?.needsConfirmation ?? null,
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [analysis, group, groupId]);
  const bandLabel = (b: string | null) =>
    b === 'high'
      ? t('جودة مرتفعة', 'High quality')
      : b === 'acceptable'
        ? t('مقبول', 'Acceptable')
        : b === 'improve'
          ? t('يحتاج إلى تحسين', 'Needs improvement')
          : t('غير مصنف', 'Not classified');
  const badge = (value: string | null) => (
    <span className={`result-badge ${value || 'none'}`}>
      {bandLabel(value)}
    </span>
  );
  const empty = (
    <section className="panel empty">
      <FileSpreadsheet size={42} />
      <h2>{t('ابدئي بإضافة ملف استبيان', 'Start by adding a survey file')}</h2>
      <p>
        {t(
          'ستظهر النتائج وخيارات التصدير بعد رفع الملف.',
          'Results and exports appear after uploading a file.',
        )}
      </p>
      <Button onClick={() => setTab('analysis')}>
        {t('إضافة ملف', 'Add a file')}
      </Button>
    </section>
  );
  return (
    <div className="hub" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <BarChart3 />
          </span>
          <div>
            <strong>{t('منصة جودة الاستبيانات', 'Survey Quality Hub')}</strong>
            <small>SURVEY QUALITY HUB</small>
          </div>
        </div>
        <div className="header-actions">
          <span className="test-badge">
            {t('نسخة اختبار', 'Testing version')}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              setLang(lang === 'ar' ? 'en' : 'ar');
              setNotice('');
              setMessages([]);
            }}
          >
            <Languages size={18} />
            {lang === 'ar' ? 'English' : 'العربية'}
          </Button>
          {/* A small local, already optimized brand asset; no remote image processing. */}
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
                'من الاستجابات إلى قرارات التحسين',
                'From responses to improvement',
              )}
            </h1>
            <p>
              {t(
                'ارفعي ملفات الاستبيانات، راجعي النتائج، ثم صدّري التقرير.',
                'Upload survey files, review findings, and export your report.',
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
              {t('الملفات المحفوظة', 'Saved files')}{' '}
              <span className="count">{reports.length}</span>
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download />
              {t('التصدير', 'Export')}
            </TabsTrigger>
          </TabsList>
          {messages.length > 0 && (
            <div role="alert" className="alert error">
              <TriangleAlert />
              <div>
                {messages.map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
              </div>
            </div>
          )}
          {notice && (
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- This live region contains block content.
            <div className="alert success" role="status">
              <CheckCircle2 />
              <p>{notice}</p>
            </div>
          )}
          {busy && (
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Progress contains a block element.
            <div className="loading" role="status">
              <LoaderCircle className="spin" />
              {t('جارٍ المعالجة…', 'Processing…')}
              <Progress value={progress || 25} />
            </div>
          )}
          <TabsContent value="analysis">
            <div className="upload-layout">
              <section className="panel">
                <div className="section-heading">
                  <span className="step">01</span>
                  <div>
                    <h2>{t('ملفات الاستبيانات', 'Survey files')}</h2>
                    <p>
                      {t(
                        'حتى 20 ملفًا في الدفعة، بحد 16 ميجابايت لكل ملف.',
                        'Up to 20 files per batch, 16 MB per file.',
                      )}
                    </p>
                  </div>
                </div>
                {!workspaceReady && (
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- This live region includes an interactive retry control.
                  <div className="privacy-note" role="status">
                    {t('جارٍ تجهيز مساحة الحفظ…', 'Preparing your workspace…')}
                    {messages.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMessages([]);
                          initializeWorkspace();
                        }}
                      >
                        {t('إعادة المحاولة', 'Retry')}
                      </Button>
                    )}
                  </div>
                )}
                {/* The nested native file input provides keyboard activation; these handlers add file drag-and-drop. */}
                {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                <label
                  className={`dropzone ${busy || !workspaceReady ? 'disabled' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!busy && workspaceReady)
                      void upload([...e.dataTransfer.files]);
                  }}
                >
                  <span className="upload-icon">
                    <UploadCloud size={34} />
                  </span>
                  <strong>
                    {t('اسحبي ملفات Excel إلى هنا', 'Drop Excel files here')}
                  </strong>
                  <span>
                    {t(
                      'أو اضغطي لاختيار الملفات من جهازك',
                      'or click to browse your computer',
                    )}
                  </span>
                  <input
                    disabled={busy || !workspaceReady}
                    type="file"
                    multiple
                    accept=".xlsx,.xls"
                    aria-label={t(
                      'اختيار ملفات الاستبيان',
                      'Choose survey files',
                    )}
                    onChange={(e) => {
                      void upload([...(e.target.files || [])]);
                      e.target.value = '';
                    }}
                  />
                  <small>XLSX · XLS</small>
                </label>
                <div className="privacy-note">
                  <ShieldCheck size={18} />
                  {t(
                    'حفظ على الخادم في مساحة خاصة بهذا المتصفح، دون تسجيل دخول.',
                    'Server storage in a workspace private to this browser. No sign-in.',
                  )}
                </div>
              </section>
              <aside className="panel guide">
                <span className="step">02</span>
                <h2>
                  {t(
                    'تحليل يعرف بياناتك',
                    'Analysis that understands your data',
                  )}
                </h2>
                <p>
                  {t(
                    'يُكتشف النوع من المحتوى، ويطلب الموقع التأكيد عند نقص المؤشرات.',
                    'Type is detected from content; the site asks for confirmation when evidence is insufficient.',
                  )}
                </p>
                {[
                  [
                    FileSpreadsheet,
                    'RawData',
                    t('المصدر الأساسي للحساب', 'The response source'),
                  ],
                  [
                    BarChart3,
                    t('متوسطات ونسب موزونة', 'Weighted metrics'),
                    t(
                      'مقارنة تراعي عدد الإجابات الصحيحة',
                      'Comparisons reflect valid answer counts',
                    ),
                  ],
                  [
                    Download,
                    'PowerPoint · Word',
                    t(
                      'ثيم التقرير المعتمد وهوية الألوان',
                      'Your report theme and brand palette',
                    ),
                  ],
                ].map(([Icon, title, desc], i) => {
                  const C = Icon as typeof FileSpreadsheet;
                  return (
                    <div className="guide-row" key={i}>
                      <C />
                      <div>
                        <strong>{String(title)}</strong>
                        <span>{String(desc)}</span>
                      </div>
                    </div>
                  );
                })}
                <p className="muted-note">
                  {t(
                    'البيانات التاريخية تُعرض منفصلة عن الاستجابات الخام.',
                    'Historical aggregates are shown separately from raw responses.',
                  )}
                </p>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="dashboard">
            {!analysis || !group ? (
              empty
            ) : (
              <>
                <div className="results-toolbar">
                  <div>
                    <span className="type-tag">
                      {analysis.kind === 'historical'
                        ? t('نتائج تاريخية', 'Historical')
                        : analysis.type}
                    </span>
                    <span className="muted">
                      {ids.length === 1
                        ? reports.find((r) => r.id === ids[0])?.name
                        : t(
                            `${ids.length} ملفات مجمعة`,
                            `${ids.length} pooled files`,
                          )}
                    </span>
                  </div>
                  {analysis.kind === 'raw' && (
                    <Picker
                      value={groupId}
                      onChange={setGroupId}
                      options={groupOptions}
                      label={t('نطاق التحليل', 'Analysis scope')}
                    />
                  )}
                </div>
                {analysis.needsConfirmation && (
                  <section className="panel confirmation">
                    <div className="alert warning">
                      <TriangleAlert />
                      <div>
                        <h2>
                          {t(
                            'تأكيد بنية الاستبيان',
                            'Confirm the survey structure',
                          )}
                        </h2>
                        <p>
                          {t(
                            'بعض المؤشرات غير كافية. حددي النوع والمقياس وأنواع الأسئلة قبل اعتماد النتائج.',
                            'Some evidence is insufficient. Confirm the type, scale and question kinds before using these results.',
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="form-grid">
                      <label>
                        {t('نوع الاستبيان', 'Survey type')}
                        <Picker
                          value={type}
                          onChange={(v) => setType(v as SurveyType)}
                          label={t('النوع', 'Type')}
                          options={[
                            'UNKNOWN',
                            'CES',
                            'PES',
                            'EMPLOYEE',
                            'GRADUATE',
                            'EMPLOYER',
                          ].map((v) => ({
                            value: v,
                            label:
                              v === 'UNKNOWN'
                                ? t('غير محدد', 'Unspecified')
                                : v,
                          }))}
                        />
                      </label>
                      {type !== 'CES' &&
                        [
                          [
                            'min',
                            min,
                            setMin,
                            t('بداية المقياس', 'Scale minimum'),
                          ],
                          [
                            'max',
                            max,
                            setMax,
                            t('نهاية المقياس', 'Scale maximum'),
                          ],
                          [
                            'positive',
                            positive,
                            setPositive,
                            t('بداية الإيجابية', 'Positive from'),
                          ],
                        ].map(([name, value, setter, label]) => (
                          <label key={String(name)}>
                            {String(label)}
                            <input
                              className="number-input"
                              aria-label={String(label)}
                              type="number"
                              value={String(value)}
                              onChange={(e) =>
                                (setter as (s: string) => void)(e.target.value)
                              }
                            />
                          </label>
                        ))}
                    </div>
                    <div className="question-config">
                      {analysis.questions
                        .filter(
                          (q) =>
                            !(type === 'CES' && Number(q.id.slice(1)) <= 19),
                        )
                        .map((q) => (
                          <div key={q.id}>
                            <span>
                              {q.id} · {q[lang]}
                            </span>
                            <Picker
                              value={kinds[q.id] || 'unresolved'}
                              onChange={(v) =>
                                setKinds({
                                  ...kinds,
                                  [q.id]: v as QuestionKind,
                                })
                              }
                              label={q.id}
                              options={[
                                {
                                  value: 'unresolved',
                                  label: t(
                                    'يحتاج تأكيدًا',
                                    'Needs confirmation',
                                  ),
                                },
                                {
                                  value: 'rating',
                                  label: t('مقياسي', 'Rating'),
                                },
                                {
                                  value: 'open',
                                  label: t('مفتوح', 'Open-ended'),
                                },
                                {
                                  value: 'categorical',
                                  label: t('تصنيفي', 'Categorical'),
                                },
                              ]}
                            />
                          </div>
                        ))}
                    </div>
                    <Button
                      disabled={busy || type === 'UNKNOWN'}
                      onClick={confirm}
                    >
                      {t('تأكيد وإعادة التحليل', 'Confirm and reanalyse')}
                    </Button>
                  </section>
                )}
                {analysis.kind === 'historical' ? (
                  <Historical analysis={analysis} lang={lang} />
                ) : (
                  <>
                    <div className="stats-grid">
                      <div className="stat">
                        <span>
                          {t('الاستجابات الفعلية', 'Actual responses')}
                        </span>
                        <strong>{f(group.rows, 0)}</strong>
                        <small>
                          {t('من المتوقع', 'of expected')}{' '}
                          {f(group.expected, 0)}
                        </small>
                      </div>
                      <div className="stat">
                        <span>{t('المتوسط الموزون', 'Weighted mean')}</span>
                        <strong>
                          {f(group.overall.mean)} <em>/ {analysis.max}</em>
                        </strong>
                        {badge(group.overall.meanBand)}
                      </div>
                      <div className="stat">
                        <span>{t('نسبة الإيجابية', 'Positive answers')}</span>
                        <strong>{pct(group.overall.positivity)}</strong>
                        {badge(group.overall.positivityBand)}
                      </div>
                      <div className="stat">
                        <span>{t('معدل الاستجابة', 'Response rate')}</span>
                        <strong>{pct(group.responseRate)}</strong>
                        <small>
                          {t(
                            'عدد المستجيبين ÷ المتوقع',
                            'Respondents / expected count',
                          )}
                        </small>
                      </div>
                    </div>
                    {group.smallSample && (
                      <div className="alert warning">
                        <TriangleAlert />
                        {t(
                          'حجم العينة أقل من 10 استجابات؛ فسّري النتائج بحذر.',
                          'The sample has fewer than 10 responses. Interpret results with caution.',
                        )}
                      </div>
                    )}
                    {group.expected === null && (
                      <p className="scope-note">
                        {t(
                          'المتوقع غير متاح لهذا النطاق، أو يتقاطع المستوى مع مجموعة مقرر؛ لم يُكرر العدد المتوقع.',
                          'Expected count is unavailable for this scope or shared across levels; it has not been duplicated.',
                        )}
                      </p>
                    )}
                    <Tabs
                      value={resultView}
                      onValueChange={(v) => setResultView(String(v))}
                    >
                      <TabsList className="result-tabs">
                        <TabsTrigger value="questions">
                          {t('الأسئلة', 'Questions')}
                        </TabsTrigger>
                        <TabsTrigger value="compare">
                          {t('المقارنات والأولويات', 'Comparisons & priorities')}
                        </TabsTrigger>
                        <TabsTrigger value="comments">
                          {t('الإجابات المفتوحة', 'Open responses')}
                        </TabsTrigger>
                        <TabsTrigger value="quality">
                          {t('جودة البيانات', 'Data quality')}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="questions">
                        <section className="panel">
                          <div className="section-title">
                            <h2>
                              {t(
                                'الإيجابية حسب السؤال',
                                'Positivity by question',
                              )}
                            </h2>
                            <span>
                              {analysis.positive}–{analysis.max} ·{' '}
                              {t('إجابات إيجابية', 'positive scores')}
                            </span>
                          </div>
                          <ChartContainer
                            config={{
                              positivity: {
                                label: t('الإيجابية', 'Positivity'),
                                color: '#3b5378',
                              },
                            }}
                            className="question-chart"
                          >
                            <BarChart
                              data={analysis.questions
                                .filter((q) => q.kind === 'rating')
                                .map((q) => ({
                                  name: q.id,
                                  positivity: group.questions[q.id]?.positivity,
                                }))}
                            >
                              <CartesianGrid
                                vertical={false}
                                stroke="#e4e9f0"
                              />
                              <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => v + '%'}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar
                                dataKey="positivity"
                                fill="#3b5378"
                                radius={[5, 5, 0, 0]}
                              />
                            </BarChart>
                          </ChartContainer>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {[
                                  t('السؤال', 'Question'),
                                  t('الإجابات الصحيحة', 'Valid answers'),
                                  t('المتوسط', 'Mean'),
                                  t('الإيجابية', 'Positivity'),
                                ].map((h) => (
                                  <TableHead key={h}>{h}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analysis.questions
                                .filter((q) => q.kind === 'rating')
                                .map((q) => {
                                  const m = group.questions[q.id];
                                  return (
                                    <TableRow key={q.id}>
                                      <TableCell>
                                        <b className="question-id">{q.id}</b>
                                        {q[lang]}
                                      </TableCell>
                                      <TableCell>
                                        {f(m.valid, 0)}
                                        {m.valid < 10 && (
                                          <span className="tiny-alert">
                                            {t('عينة صغيرة', 'Small sample')}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <strong>{f(m.mean)}</strong>
                                        {badge(m.meanBand)}
                                      </TableCell>
                                      <TableCell>
                                        <strong>{pct(m.positivity)}</strong>
                                        {badge(m.positivityBand)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                          <p className="scope-note">
                            {t(
                              'التصنيفان مستقلان. المقام يختلف حسب الإجابات الصحيحة لكل سؤال، والتقريب عند العرض فقط.',
                              'Mean and positivity are classified independently. Each question uses its own valid-answer denominator; rounding is for display only.',
                            )}
                          </p>
                        </section>
                      </TabsContent>
                      <TabsContent value="compare">
                        <section className="panel">
                          <h2>{t('مقارنة البرامج', 'Program comparison')}</h2>
                          <Comparison
                            groups={analysis.programs}
                            lang={lang}
                            onSelect={setGroupId}
                          />
                        </section>
                        {analysis.type === 'CES' && (
                          <section className="panel section-space">
                            <h2>
                              {t('مقررات أولوية التحسين', 'Priority courses')}
                            </h2>
                            <p className="scope-note">
                              {t(
                                'إيجابية Q15 أقل من 60%، بصرف النظر عن المتوسط.',
                                'Q15 positivity below 60%, regardless of the mean.',
                              )}
                            </p>
                            <Comparison
                              groups={analysis.programs
                                .flatMap((p) => p.courses || [])
                                .filter((c) => c.priority)}
                              lang={lang}
                              priority
                            />
                          </section>
                        )}
                      </TabsContent>
                      <TabsContent value="comments">
                        <section className="panel">
                          <h2>
                            {t(
                              'قراءة وصفية للإجابات المفتوحة',
                              'Descriptive review of open responses',
                            )}
                          </h2>
                          <p className="scope-note">
                            {t(
                              'هذا القسم يحلل الملف كاملًا ويعرض أكثر 20 إجابة وكلمة تكرارًا. التكرارات من النصوص الفعلية، وليست درجات أو تقييمًا للمشاعر.',
                              'This section analyzes the whole file and shows the top 20 responses and terms. Frequencies come from actual text, not scores or sentiment ratings.',
                            )}
                          </p>
                          {analysis.comments.map((c) => (
                            <div key={c.question} className="comment-section">
                              <h3>
                                {c.question}{' '}
                                <span className="muted">
                                  {c.count} {t('إجابة', 'responses')}
                                </span>
                              </h3>
                              <div className="term-list">
                                {c.terms.slice(0, 20).map((r) => (
                                  <span key={r.text}>
                                    {r.text} <b>{r.count}</b>
                                  </span>
                                ))}
                              </div>
                              <Table>
                                <TableBody>
                                  {c.top.slice(0, 20).map((r, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="comment-text">
                                        {r.text}
                                      </TableCell>
                                      <TableCell>{r.count}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))}
                          {!analysis.comments.length && (
                            <p>
                              {t(
                                'لا توجد أسئلة مفتوحة معرّفة.',
                                'No open-ended questions are defined.',
                              )}
                            </p>
                          )}
                        </section>
                      </TabsContent>
                      <TabsContent value="quality">
                        <section className="panel">
                          <h2>
                            {t(
                              'فحص جودة البيانات والمطابقة',
                              'Data quality and reconciliation',
                            )}
                          </h2>
                          <div className="quality-list">
                            {analysis.issues.length ? (
                              analysis.issues.map((i, n) => (
                                <div key={n}>
                                  <TriangleAlert />
                                  <span>
                                    {issues[i.code]?.[lang === 'ar' ? 0 : 1] ||
                                      i.code}
                                    {i.detail ? ' · ' + i.detail : ''}
                                  </span>
                                  <strong>{i.count}</strong>
                                </div>
                              ))
                            ) : (
                              <div>
                                <CheckCircle2 />
                                <span>
                                  {t(
                                    'لم تُرصد قيم مستبعدة في الأسئلة المقياسية.',
                                    'No excluded values were found in rating questions.',
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                          {analysis.validation.map((v, i) => (
                            <div className="validation-row" key={i}>
                              <strong>{v.source}</strong>
                              <span>
                                {v.compared
                                  ? `${v.matched} / ${v.compared} ${t('مطابقة ضمن دقة المصدر', 'match within source precision')}`
                                  : t(
                                      'لا تتوفر أعمدة مطابقة موثوقة',
                                      'No reliable matching columns available',
                                    )}
                              </span>
                              {v.mismatches > 0 && (
                                <b>
                                  {v.mismatches} {t('اختلاف', 'differences')}
                                </b>
                              )}
                            </div>
                          ))}
                          <p className="scope-note">
                            {t(
                              'الملخصات للمطابقة فقط. الفراغ والنص والدرجات خارج المقياس لا تدخل الحسابات.',
                              'Summaries are verification only. Blank, text and out-of-scale scores are excluded.',
                            )}
                          </p>
                        </section>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="history">
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>{t('ملفاتك المحفوظة', 'Your saved files')}</h2>
                  <p className="scope-note">
                    {t(
                      'محفوظة على الخادم ومرتبطة بهذا المتصفح. مسح ملفات الارتباط يفقد الوصول إلى هذه المساحة.',
                      'Stored on the server and linked to this browser. Clearing cookies removes access to this workspace.',
                    )}
                  </p>
                </div>
                <Button
                  disabled={busy || selectedIds.length < 2}
                  onClick={() => load(selectedIds)}
                >
                  {t('دمج الملفات المحددة', 'Pool selected files')} (
                  {selectedIds.length})
                </Button>
              </div>
              {!reports.length ? (
                <p>{t('لا توجد ملفات محفوظة بعد.', 'No saved files yet.')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('تحديد', 'Select')}</TableHead>
                      <TableHead>{t('الملف', 'File')}</TableHead>
                      <TableHead>{t('النوع', 'Type')}</TableHead>
                      <TableHead>{t('الاستجابات', 'Responses')}</TableHead>
                      <TableHead>{t('عرض', 'View')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={t('تحديد ', 'Select ') + r.name}
                            checked={selectedIds.includes(r.id)}
                            onCheckedChange={(v) =>
                              setSelectedIds(
                                v
                                  ? [...selectedIds, r.id]
                                  : selectedIds.filter((id) => id !== r.id),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <strong>{r.name}</strong>
                          <small className="block muted">
                            {new Date(r.created_at).toLocaleString(
                              lang === 'ar' ? 'ar-SA' : 'en-GB',
                            )}{' '}
                            · {f(r.bytes / 1024, 0)} KB
                          </small>
                        </TableCell>
                        <TableCell>
                          {r.kind === 'historical'
                            ? t('تاريخي', 'Historical')
                            : r.type}
                          {r.status === 'confirmation' && (
                            <span className="tiny-alert">
                              {t('تأكيد مطلوب', 'Confirmation needed')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.kind === 'historical' ? '—' : f(r.rows, 0)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            onClick={() => load([r.id])}
                            disabled={busy}
                          >
                            <ArrowUpRight size={16} />
                            {t('عرض', 'Open')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </TabsContent>
          <TabsContent value="export">
            {!analysis ? (
              empty
            ) : (
              <section className="panel">
                <div className="section-title">
                  <div>
                    <h2>{t('تصدير التقرير', 'Export report')}</h2>
                    <p className="scope-note">
                      {t(
                        'يتضمن التقرير نطاق النتائج المختار وبنفس الحسابات المعروضة.',
                        'Exports use the selected result scope and the same calculations shown on screen.',
                      )}
                    </p>
                  </div>
                  <span className="type-tag">
                    {lang === 'ar' ? 'العربية' : 'English'}
                  </span>
                </div>
                {analysis.kind === 'raw' && (
                  <Picker
                    value={groupId}
                    onChange={setGroupId}
                    options={groupOptions}
                    label={t('نطاق التقرير', 'Report scope')}
                  />
                )}
                <div className="export-grid">
                  <div>
                    <span className="file-type ppt">P</span>
                    <h3>PowerPoint</h3>
                    <p>
                      {t(
                        'قالب التقرير المرفق · 4:3 · شرائح ديناميكية حسب البيانات',
                        'Your supplied template · 4:3 · slides generated from the data',
                      )}
                    </p>
                    <Button
                      disabled={busy || analysis.needsConfirmation}
                      onClick={() => exportFile('pptx')}
                    >
                      <Download />
                      {t('تنزيل العرض', 'Download presentation')}
                    </Button>
                  </div>
                  <div>
                    <span className="file-type word">W</span>
                    <h3>Word</h3>
                    <p>
                      {t(
                        'تقرير قابل للتحرير، بالجداول والنتائج والمنهجية',
                        'Editable report with tables, findings and methodology',
                      )}
                    </p>
                    <Button
                      disabled={busy || analysis.needsConfirmation}
                      onClick={() => exportFile('docx')}
                    >
                      <Download />
                      {t('تنزيل التقرير', 'Download report')}
                    </Button>
                  </div>
                </div>
                {analysis.needsConfirmation && (
                  <p className="alert warning">
                    {t(
                      'أكملي تأكيد الاستبيان من لوحة النتائج أولًا.',
                      'Confirm the survey structure in Results first.',
                    )}
                  </p>
                )}
              </section>
            )}
          </TabsContent>
        </Tabs>
        <footer>
          <span>
            {t(
              'جودة البيانات أولًا. الخلايا الفارغة لا تتحول إلى أصفار.',
              'Data quality first. Empty answers never become zeros.',
            )}
          </span>
          <span>CES · PES · EMPLOYEE · GRADUATE · EMPLOYER</span>
        </footer>
      </main>
    </div>
  );
}
function Comparison({
  groups,
  lang,
  onSelect,
  priority = false,
}: {
  groups: Group[];
  lang: Lang;
  onSelect?: (id: string) => void;
  priority?: boolean;
}) {
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en),
    f = (n: number | null, d = 2) => formatMetric(n, d, lang);
  return groups.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          {[
            t('البرنامج / المقرر', 'Program / course'),
            t('الاستجابات', 'Responses'),
            t('المتوسط', 'Mean'),
            priority ? 'Q15 %' : t('الإيجابية %', 'Positivity %'),
            t('الاستجابة %', 'Response %'),
          ].map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g, i) => (
          <TableRow key={g.id + i}>
            <TableCell>
              {onSelect ? (
                <button className="text-link" onClick={() => onSelect(g.id)}>
                  {g.code} · {g.name}
                </button>
              ) : (
                <>
                  <strong>{g.code}</strong>
                  <small className="block muted">
                    {g.program} · {g.name}
                  </small>
                </>
              )}
            </TableCell>
            <TableCell>
              {g.rows}
              {g.smallSample && (
                <span className="tiny-alert">
                  {t('عينة صغيرة', 'Small sample')}
                </span>
              )}
            </TableCell>
            <TableCell>{f(g.overall.mean)}</TableCell>
            <TableCell>
              {f(
                priority
                  ? (g.questions.Q15?.positivity ?? null)
                  : g.overall.positivity,
                1,
              )}
            </TableCell>
            <TableCell>{f(g.responseRate, 1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <p className="scope-note">
      {t('لا توجد نتائج في هذا القسم.', 'No results in this section.')}
    </p>
  );
}
function Historical({ analysis, lang }: { analysis: Analysis; lang: Lang }) {
  const [program, setProgram] = useState('all'),
    [survey, setSurvey] = useState('all'),
    [page, setPage] = useState(0);
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en),
    records = analysis.historical || [];
  const rows = records.filter(
    (r) =>
      (program === 'all' || r.program === program) &&
      (survey === 'all' || r.survey === survey),
  );
  return (
    <section className="panel">
      <h2>{t('سجل النتائج التاريخية', 'Historical result register')}</h2>
      <p className="scope-note">
        {t(
          'قيم مجمّعة من المصدر، وليست استجابات فردية. لا يُحسب متوسط عام لغياب أعداد الإجابات الصحيحة لكل قيمة.',
          'Source aggregates, not individual responses. No overall average is calculated because valid-response denominators are missing.',
        )}
      </p>
      <div className="filters">
        <Picker
          value={program}
          onChange={(v) => {
            setProgram(v);
            setPage(0);
          }}
          label={t('البرنامج', 'Program')}
          options={[
            { value: 'all', label: t('كل البرامج', 'All programs') },
            ...[...new Set(records.map((r) => r.program))].map((p) => ({
              value: p,
              label: p,
            })),
          ]}
        />
        <Picker
          value={survey}
          onChange={(v) => {
            setSurvey(v);
            setPage(0);
          }}
          label={t('الاستبيان', 'Survey')}
          options={[
            { value: 'all', label: t('كل الاستبيانات', 'All surveys') },
            ...[...new Set(records.map((r) => r.survey))].map((p) => ({
              value: p,
              label: p,
            })),
          ]}
        />
      </div>
      {analysis.issues.map((i, n) => (
        <p className="scope-note" key={n}>
          {issues[i.code]?.[lang === 'ar' ? 0 : 1] || i.code}: {i.count}
        </p>
      ))}
      <Table>
        <TableHeader>
          <TableRow>
            {[
              t('البرنامج', 'Program'),
              t('الاستبيان / السؤال', 'Survey / question'),
              t('السنة', 'Year'),
              t('القيمة', 'Value'),
              t('المصدر', 'Source'),
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(page * 25, page * 25 + 25).map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.program}</TableCell>
              <TableCell>
                <strong>{r.survey}</strong>
                <small className="block">
                  {r.question} · {r.label}
                </small>
              </TableCell>
              <TableCell>{r.year}</TableCell>
              <TableCell>{formatMetric(r.value, 2, lang)}</TableCell>
              <TableCell>{r.cell}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="pagination">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronRight />
          {t('السابق', 'Previous')}
        </Button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(rows.length / 25))} ·{' '}
          {rows.length} {t('قيمة', 'values')}
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 25 >= rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('التالي', 'Next')}
          <ChevronLeft />
        </Button>
      </div>
    </section>
  );
}
