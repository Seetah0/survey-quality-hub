import { mergeAnalyses, type Lang } from '@/lib/analysis';
import { makeDocx, makePptx, reportPages } from '@/lib/export';
import {
  assertOrigin,
  errorResponse,
  readReport,
  workspace,
} from '@/lib/storage';
export async function POST(request: Request) {
  const w = await workspace(request);
  try {
    assertOrigin(request);
    const { ids, format, lang, groupId } = (await request.json()) as {
      ids: string[];
      format: string;
      lang: Lang;
      groupId?: string;
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
    const pages = reportPages(a, lang, groupId);
    if (pages.length > 800) throw new Error('EXPORT_TOO_LARGE');
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
      },
    });
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
