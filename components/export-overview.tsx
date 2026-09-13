'use client';
import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/analysis';
type Manifest = {
  surveyType: string;
  slides: number;
  charts: number;
  courses: number;
  priorityCourses: number;
  proposedPlanSlides: number;
  dataReview: { status: string; compared: number; mismatches: number };
  designReview: string;
};
export function ExportOverview({
  ids,
  groupId,
  lang,
  disabled,
}: {
  ids: string[];
  groupId: string;
  lang: Lang;
  disabled: boolean;
}) {
  const [state, setState] = useState<{
    key: string;
    data?: Manifest;
    failed?: boolean;
  } | null>(null);
  const key = JSON.stringify({
    ids,
    groupId,
    lang,
    format: 'pptx',
    preview: true,
  });
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    void fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: key,
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Preview failed');
        const data = (await r.json()) as { manifest: Manifest };
        setState({ key, data: data.manifest });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, failed: true });
      });
    return () => controller.abort();
  }, [key, disabled]);
  if (disabled) return null;
  if (state?.key !== key)
    return (
      <p className="scope-note">
        {t('جارٍ حساب محتوى التقرير…', 'Calculating report contents…')}
      </p>
    );
  if (state.failed || !state.data)
    return (
      <p className="scope-note">
        {t(
          'تعذر عرض ملخص التصدير. حاولي تنزيل التقرير لإظهار سبب الخطأ.',
          'Export preview is unavailable. Try downloading the report to see the error.',
        )}
      </p>
    );
  const m = state.data;
  return (
    <section className="report-overview">
      <h3>{t('محتوى عرض PowerPoint', 'PowerPoint contents')}</h3>
      <dl className="report-counts">
        {[
          [m.slides, t('شريحة', 'slides')],
          [m.charts, t('رسم قابل للتعديل', 'editable charts')],
          [m.courses, t('مقررًا', 'courses')],
          [m.priorityCourses, t('مقررات أولوية', 'priority courses')],
        ].map(([value, label]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        {t('مطابقة البيانات:', 'Data reconciliation:')}{' '}
        {m.dataReview.compared.toLocaleString('en-US')}{' '}
        {t(
          'قيمة، والاختلافات خارج دقة المصدر:',
          'values; differences beyond source precision:',
        )}{' '}
        {m.dataReview.mismatches}.
      </p>
      {!m.dataReview.compared && (
        <p>
          {t(
            'لا توجد أوراق مطابقة متاحة؛ صحة الحساب وحدها لا تثبت صحة البيانات المدخلة.',
            'No reconciliation sheets are available. Correct calculations do not establish source-data accuracy.',
          )}
        </p>
      )}
      <p>
        {t(
          'مراجعة التصميم: بانتظار مراجعة العرض الناتج واعتمادك.',
          'Design review: the generated presentation awaits your review and approval.',
        )}
      </p>
      {m.surveyType === 'CES' && (
        <p className="scope-note">
          {t(
            'لكل مقرر: ملخص، متابعة التنفيذ، خطة مقترحة، متوسطات ورسم، إيجابية ورسم، ثم أولوية التحسين عند الحاجة. لا تُنشأ خطط سابقة وهمية.',
            'For each CES course: summary, implementation status, proposed plan, means with chart, positivity with chart, and improvement priority when needed. No prior plans are invented.',
          )}
        </p>
      )}
      {m.surveyType === 'CES' && (
        <p className="scope-note">
          {t(
            'بعد المقررات: نقاط القوة، مجالات التحسين، مقررات الأولوية، خطة التحسين المقترحة، نهاية التقرير.',
            'After the courses: strengths, areas for improvement, priority courses, proposed improvement plan, end of report.',
          )}
        </p>
      )}
    </section>
  );
}
