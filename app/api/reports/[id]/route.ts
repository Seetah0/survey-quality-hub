import { analyzeWorkbook, type AnalysisOptions } from '@/lib/analysis';
import {
  assertOrigin,
  bindings,
  errorResponse,
  readReport,
  response,
  workspace,
} from '@/lib/storage';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const w = await workspace(request);
  try {
    return response(
      await readReport((await params).id, w.owner),
      200,
      w.cookie,
    );
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const w = await workspace(request);
  try {
    assertOrigin(request);
    const id = (await params).id;
    await readReport(id, w.owner);
    const options = (await request.json()) as AnalysisOptions;
    if (
      !['CES', 'PES', 'EMPLOYEE', 'GRADUATE', 'EMPLOYER', 'UNKNOWN'].includes(
        options.type || 'UNKNOWN',
      ) ||
      (options.kinds &&
        Object.values(options.kinds).some(
          (k) => !['rating', 'open', 'categorical', 'unresolved'].includes(k),
        ))
    )
      throw new Error('INVALID_OPTIONS');
    const { DB, FILES } = bindings();
    const source = await FILES.get(`${w.owner}/${id}/source`);
    if (!source) throw new Error('NOT_FOUND');
    const analysis = analyzeWorkbook(
      new Uint8Array(await source.arrayBuffer()),
      options,
    );
    await FILES.put(`${w.owner}/${id}/analysis.json`, JSON.stringify(analysis));
    await DB.prepare(
      'UPDATE reports SET type=?,status=? WHERE id=? AND owner=?',
    )
      .bind(
        analysis.type,
        analysis.needsConfirmation ? 'confirmation' : 'ready',
        id,
        w.owner,
      )
      .run();
    return response({ analysis }, 200, w.cookie);
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
