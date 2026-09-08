import { analyzeWorkbook } from '@/lib/analysis';
import {
  assertOrigin,
  bindings,
  digest,
  errorResponse,
  response,
  workspace,
} from '@/lib/storage';
export async function GET(request: Request) {
  const w = await workspace(request);
  try {
    const { DB } = bindings();
    const { results } = await DB.prepare(
      'SELECT id,name,created_at,bytes,type,kind,rows,status FROM reports WHERE owner = ? ORDER BY created_at DESC',
    )
      .bind(w.owner)
      .all();
    return response({ reports: results }, 200, w.cookie);
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
export async function POST(request: Request) {
  const w = await workspace(request);
  try {
    assertOrigin(request);
    if (Number(request.headers.get('content-length') || 0) > 17 * 1024 * 1024)
      throw new Error('WORKBOOK_TOO_LARGE');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name))
      throw new Error('UNSUPPORTED_FILE');
    if (file.size > 16 * 1024 * 1024) throw new Error('WORKBOOK_TOO_LARGE');
    const { DB, FILES } = bindings();
    const count = await DB.prepare(
      'SELECT COUNT(*) AS n FROM reports WHERE owner = ?',
    )
      .bind(w.owner)
      .first<{ n: number }>();
    if ((count?.n || 0) >= 100) throw new Error('WORKSPACE_LIMIT');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await digest(bytes);
    const existing = await DB.prepare(
      'SELECT id FROM reports WHERE owner = ? AND hash = ?',
    )
      .bind(w.owner, hash)
      .first<{ id: string }>();
    if (existing)
      return response({ id: existing.id, duplicate: true }, 200, w.cookie);
    const analysis = analyzeWorkbook(bytes);
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    await FILES.put(`${w.owner}/${id}/source`, bytes, {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
    await FILES.put(
      `${w.owner}/${id}/analysis.json`,
      JSON.stringify(analysis),
      { httpMetadata: { contentType: 'application/json' } },
    );
    await DB.prepare(
      'INSERT INTO reports (id,owner,name,hash,created_at,bytes,type,kind,rows,status) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(
        id,
        w.owner,
        file.name.slice(0, 200),
        hash,
        created,
        file.size,
        analysis.type,
        analysis.kind,
        analysis.overall.rows,
        analysis.needsConfirmation ? 'confirmation' : 'ready',
      )
      .run();
    return response({ id, duplicate: false }, 201, w.cookie);
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
