import { mergeAnalyses } from '@/lib/analysis';
import {
  assertOrigin,
  errorResponse,
  readReport,
  response,
  workspace,
} from '@/lib/storage';
export async function POST(request: Request) {
  const w = await workspace(request);
  try {
    assertOrigin(request);
    const { ids } = (await request.json()) as { ids: string[] };
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 20)
      throw new Error('NO_REPORTS');
    const items = [];
    for (const id of new Set(ids))
      items.push((await readReport(id, w.owner)).analysis);
    return response({ analysis: mergeAnalyses(items) }, 200, w.cookie);
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
