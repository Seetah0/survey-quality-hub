import { mergeAnalyses, type Lang } from '@/lib/analysis';
import {
  makeDocx,
  makePptx,
  reportPages,
  legacyReportPages,
} from '@/lib/export';
import { reportManifest } from '@/lib/report-model';
import {
  assertOrigin,
  errorResponse,
  readReport,
  workspace,
  response,
} from '@/lib/storage';
export async function POST(request: Request) {
  const w = await workspace(request);
  try {
    assertOrigin(request);
    const { ids, format, lang, groupId, preview } = (await request.json()) as {
      ids: string[];
      format: string;
      lang: Lang;
      groupId?: string;
      preview?: boolean;
    };
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 20 ||
      !['pptx', 'docx'].includes(format) ||
      !['ar', 'en'].includes(lang)
    )
      throw new Error('INVALID_OPTIONS');
    const items = [];
    for (const id of ids) items.push((await readReport(id, w.owner)).analysis);
    const a = items.length === 1 ? items[0] : mergeAnalyses(items);
    if (a.needsConfirmation) throw new Error('CONFIRM_REQUIRED');
    const pages =
      format === 'docx'
        ? legacyReportPages(a, lang, groupId)
        : reportPages(a, lang, groupId);
    if (pages.length > 800) throw new Error('EXPORT_TOO_LARGE');
    const manifest = reportManifest(a, pages, groupId);
    if (preview === true) return response({ manifest }, 200, w.cookie);
    const bytes =
      format === 'pptx'
        ? await makePptx(pages, lang)
        : await makeDocx(pages, lang);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type':
          format === 'pptx'
            ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="survey-quality-report-${lang}.${format}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Report-Slides': String(manifest.slides),
        'X-Report-Charts': String(manifest.charts),
        'X-Report-Courses': String(manifest.courses),
      },
    });
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
