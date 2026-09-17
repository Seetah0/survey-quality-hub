import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { validateZip } from './analysis';
export type HistorySheet = {
  name: string;
  years: number[];
  rows: {
    row: number;
    survey: string;
    question: string;
    label: string;
    values: Record<number, number | string | null>;
  }[];
};
export type HistoryMapping = {
  sheet: string;
  row: number;
  value: number;
  source: string;
};
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export function inspectHistory(bytes: Uint8Array): HistorySheet[] {
  validateZip(bytes);
  const wb = XLSX.read(bytes, { type: 'array', cellFormula: false });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      defval: null,
    });
    const yearRow = grid.findIndex(
      (r) =>
        r.some((v) => Number(v) === 2022) && r.some((v) => Number(v) === 2026),
    );
    if (yearRow < 0) return null;
    const columns = grid[yearRow]
      .map((v, c) => ({ year: Number(v), c }))
      .filter(
        (v) => Number.isInteger(v.year) && v.year >= 2022 && v.year <= 2200,
      );
    let survey = '';
    const rows = grid.slice(yearRow + 1).flatMap((r, i) => {
      if (r[0]) survey = String(r[0]);
      if (!r[1] && !r[2]) return [];
      return [
        {
          row: i + yearRow + 2,
          survey,
          question: String(r[1] || ''),
          label: String(r[2] || r[1] || ''),
          values: Object.fromEntries(
            columns.map(({ year, c }) => [year, r[c] ?? null]),
          ),
        },
      ];
    });
    return { name, years: columns.map((v) => v.year), rows };
  }).filter((s) => s !== null) as HistorySheet[];
}
export async function appendHistory(
  bytes: Uint8Array,
  year: number,
  mappings: HistoryMapping[],
) {
  const sheets = inspectHistory(bytes);
  const latest = Math.max(2026, ...sheets.flatMap((s) => s.years));
  if (!Number.isInteger(year) || year !== latest + 1 || year > 2200)
    throw new Error('NEXT_YEAR_REQUIRED');
  if (!mappings.length) throw new Error('HISTORY_MAPPING_REQUIRED');
  const seen = new Set<string>();
  for (const m of mappings) {
    if (
      !Number.isFinite(m.value) ||
      !sheets.find((s) => s.name === m.sheet)?.rows.some((r) => r.row === m.row)
    )
      throw new Error('INVALID_HISTORY_MAPPING');
    const key = JSON.stringify([m.sheet, m.row]);
    if (seen.has(key)) throw new Error('DUPLICATE_HISTORY_MAPPING');
    seen.add(key);
  }
  const zip = await JSZip.loadAsync(bytes);
  const parser = new DOMParser();
  const workbook = parser.parseFromString(
    await zip.file('xl/workbook.xml')!.async('string'),
    'application/xml',
  );
  const rels = parser.parseFromString(
    await zip.file('xl/_rels/workbook.xml.rels')!.async('string'),
    'application/xml',
  );
  for (const sheet of sheets) {
    const meta = Array.from(workbook.getElementsByTagName('sheet')).find(
      (s) => s.getAttribute('name') === sheet.name,
    )!;
    const target = Array.from(rels.getElementsByTagName('Relationship'))
      .find((r) => r.getAttribute('Id') === meta.getAttribute('r:id'))!
      .getAttribute('Target')!;
    const path = target.startsWith('/')
      ? target.slice(1)
      : 'xl/' + target.replace(/^\.\//, '');
    const doc = parser.parseFromString(
      await zip.file(path)!.async('string'),
      'application/xml',
    );
    const cells = Array.from(doc.getElementsByTagNameNS(S, 'c'));
    const lastCol = Math.max(
      ...cells.map((c) => XLSX.utils.decode_cell(c.getAttribute('r')!).c),
    );
    const yearCell = cells.find(
      (c) => Number(c.getElementsByTagNameNS(S, 'v')[0]?.textContent) === 2026,
    );
    if (!yearCell) throw new Error('HISTORY_TEMPLATE_REQUIRED');
    const headerRow = XLSX.utils.decode_cell(yearCell.getAttribute('r')!).r + 1;
    const newCol = XLSX.utils.encode_col(lastCol + 1);
    const data = doc.getElementsByTagNameNS(S, 'sheetData')[0];
    for (const item of [
      { row: headerRow, value: year },
      ...mappings.filter((m) => m.sheet === sheet.name),
    ]) {
      let row = Array.from(data.getElementsByTagNameNS(S, 'row')).find(
        (r) => Number(r.getAttribute('r')) === item.row,
      );
      if (!row) {
        row = doc.createElementNS(S, 'row');
        row.setAttribute('r', String(item.row));
        data.appendChild(row);
      }
      const cell = doc.createElementNS(S, 'c');
      cell.setAttribute('r', `${newCol}${item.row}`);
      if (yearCell.getAttribute('s'))
        cell.setAttribute('s', yearCell.getAttribute('s')!);
      const value = doc.createElementNS(S, 'v');
      value.appendChild(doc.createTextNode(String(item.value)));
      cell.appendChild(value);
      row.appendChild(cell);
      row.removeAttribute('spans');
    }
    const dimension = doc.getElementsByTagNameNS(S, 'dimension')[0];
    if (dimension) {
      const old = XLSX.utils.decode_range(dimension.getAttribute('ref')!);
      old.e.c = lastCol + 1;
      dimension.setAttribute('ref', XLSX.utils.encode_range(old));
    }
    zip.file(path, new XMLSerializer().serializeToString(doc));
  }
  // Existing cells, formulas, charts, styles and relationships stay in the package.
  // Append on the right so no historical references need to move.
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
