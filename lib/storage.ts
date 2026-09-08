import { env } from 'cloudflare:workers';
import type { Analysis } from './analysis';
export type ReportRecord = {
  id: string;
  owner: string;
  name: string;
  hash: string;
  created_at: string;
  bytes: number;
  type: string;
  kind: string;
  rows: number;
  status: string;
};
export function bindings() {
  const { DB, FILES } = env as unknown as { DB: D1Database; FILES: R2Bucket };
  if (!DB || !FILES) throw new Error('STORAGE_UNAVAILABLE');
  return { DB, FILES };
}
export async function digest(bytes: Uint8Array | string) {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return [
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b))),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export async function workspace(request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  const cookieName = secure ? '__Host-sqh_workspace' : 'sqh_workspace';
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + '='))
    ?.split('=')[1];
  const existing = token && /^[a-f0-9]{64}$/.test(token);
  const value = existing
    ? token
    : [...crypto.getRandomValues(new Uint8Array(32))]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
  return {
    owner: await digest(value),
    cookie: existing
      ? null
      : `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secure ? '; Secure' : ''}`,
  };
}
export function response(
  data: unknown,
  status = 200,
  cookie: string | null = null,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && origin !== new URL(request.url).origin)
  )
    throw new Error('FORBIDDEN');
}
export async function readReport(id: string, owner: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('NOT_FOUND');
  const { DB, FILES } = bindings();
  const row = await DB.prepare(
    'SELECT * FROM reports WHERE id = ? AND owner = ?',
  )
    .bind(id, owner)
    .first<ReportRecord>();
  if (!row) throw new Error('NOT_FOUND');
  const obj = await FILES.get(`${owner}/${id}/analysis.json`);
  if (!obj) throw new Error('NOT_FOUND');
  return { record: row, analysis: await obj.json<Analysis>() };
}
export function errorResponse(error: unknown, cookie: string | null = null) {
  const message = error instanceof Error ? error.message : 'ANALYSIS_FAILED';
  const allowed = [
    'INVALID_SCALE',
    'INVALID_WORKBOOK',
    'WORKBOOK_TOO_LARGE',
    'RAWDATA_REQUIRED',
    'DUPLICATE_COLUMNS',
    'EMPTY_RAWDATA',
    'NO_QUESTION_COLUMNS',
    'NO_REPORTS',
    'INCOMPATIBLE_REPORTS',
    'OVERLAPPING_COHORTS',
    'NOT_FOUND',
    'FORBIDDEN',
    'UNSUPPORTED_FILE',
    'WORKSPACE_LIMIT',
    'DUPLICATE_FILE',
    'CONFIRM_REQUIRED',
    'INVALID_OPTIONS',
    'TOO_MANY_FILES',
    'EXPORT_TOO_LARGE',
    'EXPORT_TEXT_TOO_LONG',
  ];
  const code = allowed.includes(message) ? message : 'ANALYSIS_FAILED';
  console.error('Survey operation failed:', code);
  return response(
    { error: code },
    code === 'NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : 400,
    cookie,
  );
}
