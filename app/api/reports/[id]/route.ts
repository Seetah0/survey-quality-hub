import { analyzeWorkbook, type AnalysisOptions } from '@/lib/analysis';
import {
  assertOrigin,
  bindings,
  digest,
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

    if (
      Number(request.headers.get('content-length') || 0) >
      17 * 1024 * 1024
    ) {
      throw new Error('WORKBOOK_TOO_LARGE');
    }

    const id = (await params).id;

    /*
     * Read the saved report and analysis from D1.
     * No original workbook is stored.
     */
    const current = await readReport(id, w.owner);

    const form = await request.formData();

    const file = form.get('file');
    const optionsRaw = form.get('options');

    if (
      !(file instanceof File) ||
      !/\.(xlsx|xls)$/i.test(file.name)
    ) {
      throw new Error('UNSUPPORTED_FILE');
    }

    if (file.size > 16 * 1024 * 1024) {
      throw new Error('WORKBOOK_TOO_LARGE');
    }

    let options: AnalysisOptions = {};

    if (typeof optionsRaw === 'string' && optionsRaw.trim()) {
      try {
        options = JSON.parse(optionsRaw) as AnalysisOptions;
      } catch {
        throw new Error('INVALID_OPTIONS');
      }
    }

    if (
      ![
        'CES',
        'PES',
        'EMPLOYEE',
        'GRADUATE',
        'EMPLOYER',
        'UNKNOWN',
      ].includes(options.type || 'UNKNOWN') ||
      (options.kinds &&
        Object.values(options.kinds).some(
          (k) =>
            ![
              'rating',
              'open',
              'categorical',
              'unresolved',
            ].includes(k),
        ))
    ) {
      throw new Error('INVALID_OPTIONS');
    }

    /*
     * Read the workbook only into memory.
     * It will not be persisted anywhere.
     */
    const bytes = new Uint8Array(await file.arrayBuffer());

    /*
     * Make sure the user is confirming the same workbook
     * that created this report.
     */
    const hash = await digest(bytes);

    if (hash !== current.record.hash) {
      throw new Error('INVALID_WORKBOOK');
    }

    /*
     * Re-run the analysis using the confirmed options.
     */
    const analysis = analyzeWorkbook(bytes, options);

    const { DB } = bindings();

    /*
     * Store only the resulting analysis JSON in D1.
     */
    await DB.prepare(
      `UPDATE reports
       SET
         type = ?,
         kind = ?,
         rows = ?,
         status = ?,
         analysis_json = ?
       WHERE id = ? AND owner = ?`,
    )
      .bind(
        analysis.type,
        analysis.kind,
        analysis.overall.rows,
        analysis.needsConfirmation ? 'confirmation' : 'ready',
        JSON.stringify(analysis),
        id,
        w.owner,
      )
      .run();

    return response(
      {
        analysis,
      },
      200,
      w.cookie,
    );
  } catch (e) {
    return errorResponse(e, w.cookie);
  }
}
