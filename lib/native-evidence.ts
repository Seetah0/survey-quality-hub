import JSZip from 'jszip';
import templates from './report-chart-theme.json';
import type { Lang } from './analysis';
import type { ReportChart } from './report-model';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const T = 'http://schemas.openxmlformats.org/drawingml/2006/table';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const esc = (s: string) =>
  s
    .split('')
    .filter((c) => c.charCodeAt(0) >= 32 || ['\t', '\n', '\r'].includes(c))
    .join('')
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[c]!,
    );
const emu = (n: number) => Math.round(n * 914400);

export function nativeTable(
  id: number,
  rows: string[][],
  widths: number[],
  heights: number[],
  lang: Lang,
  y = 2.27,
  fontSize = 11,
  x = 0.95,
  direction: Lang = lang,
) {
  const columns = direction === 'ar' ? [...widths].reverse() : widths;
  const body = rows
    .map(
      (r, ri) =>
        `<a:tr h="${emu(heights[ri])}">${(direction === 'ar'
          ? [...r].reverse()
          : r
        )
          .map(
            (cell) =>
              `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${cell
                .split('\n')
                .map(
                  (line) =>
                    `<a:p><a:pPr algn="${direction === 'ar' ? 'r' : 'l'}" rtl="${lang === 'ar' ? 1 : 0}"/><a:r><a:rPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}" sz="${fontSize * 100}" b="${ri === 0 ? 1 : 0}"><a:solidFill><a:srgbClr val="${ri === 0 ? 'FFFFFF' : '1D1E34'}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>${esc(line)}</a:t></a:r><a:endParaRPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}" sz="${fontSize * 100}"/></a:p>`,
                )
                .join(
                  '',
                )}</a:txBody><a:tcPr marL="40000" marR="40000" marT="32000" marB="26000" anchor="ctr"><a:lnL w="3810"><a:solidFill><a:srgbClr val="D2DBE5"/></a:solidFill></a:lnL><a:lnR w="3810"><a:solidFill><a:srgbClr val="D2DBE5"/></a:solidFill></a:lnR><a:lnT w="3810"><a:solidFill><a:srgbClr val="D2DBE5"/></a:solidFill></a:lnT><a:lnB w="3810"><a:solidFill><a:srgbClr val="D2DBE5"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="${ri === 0 ? '16375E' : ri % 2 ? 'F1F4F8' : 'FFFFFF'}"/></a:solidFill></a:tcPr></a:tc>`,
          )
          .join('')}</a:tr>`,
    )
    .join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Editable Table ${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(widths.reduce((s, w) => s + w, 0))}" cy="${emu(heights.reduce((s, h) => s + h, 0))}"/></p:xfrm><a:graphic><a:graphicData uri="${T}"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${columns.map((w) => `<a:gridCol w="${emu(w)}"/>`).join('')}</a:tblGrid>${body}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

export async function nativeChart(
  data: ReportChart,
  lang: Lang,
  number: number,
) {
  const template = templates[data.metric];
  const positive = data.metric === 'positivity';
  const values = data.values.map((v) =>
    v === null ? null : positive ? v / 100 : v,
  );
  const count = data.categories.length,
    end = count + 1,
    format = positive ? '0.0%' : '0.00';
  const label = positive
    ? lang === 'ar'
      ? 'الإيجابية'
      : 'Positive responses'
    : lang === 'ar'
      ? 'المتوسط'
      : 'Mean';
  const category = `<c:cat><c:strRef><c:f>'Chart Data'!$A$2:$A$${end}</c:f><c:strCache><c:ptCount val="${count}"/>${data.categories.map((q, i) => `<c:pt idx="${i}"><c:v>${esc(q)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>`;
  const value = `<c:val><c:numRef><c:f>'Chart Data'!$B$2:$B$${end}</c:f><c:numCache><c:formatCode>${format}</c:formatCode><c:ptCount val="${count}"/>${values.map((v, i) => (v === null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache></c:numRef></c:val>`;
  let chart = template.chartXml
    .replace('<c:cat/>', category)
    .replace('<c:val/>', value)
    .replace(/<c:tx>[\s\S]*?<\/c:tx>/, `<c:tx><c:v>${esc(label)}</c:v></c:tx>`)
    .replace(
      /<c:lang val="[^"]+"\/>/,
      `<c:lang val="${lang === 'ar' ? 'ar-SA' : 'en-US'}"/>`,
    );
  const q15 = data.categories.indexOf('Q15');
  chart = chart.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/, (match) =>
    q15 < 0 ? '' : match.replace('<c:idx val="14"/>', `<c:idx val="${q15}"/>`),
  );
  if (positive)
    chart = chart.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/, (labels) =>
      labels.replace(/sz="1050"/g, 'sz="900"'),
    );
  if (!positive)
    chart = chart
      .replace('<c:max val="5"/>', `<c:max val="${data.max}"/>`)
      .replace(
        '<c:majorUnit val="1"/>',
        `<c:majorUnit val="${Math.max(1, data.max / 5)}"/>`,
      );
  const book = new JSZip();
  for (const [p, v] of Object.entries(template.workbookParts)) book.file(p, v);
  const cell = (address: string, text: string) =>
    `<c r="${address}" t="inlineStr"><is><t>${esc(text)}</t></is></c>`;
  book.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet xmlns="${S}"><dimension ref="A1:C${end}"/><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="3" width="20" customWidth="1"/></cols><sheetData><row r="1">${cell('A1', 'Question')}${cell('B1', label)}${cell('C1', 'Valid answers')}</row>${data.categories.map((q, i) => `<row r="${i + 2}">${cell('A' + (i + 2), q)}${values[i] === null ? `<c r="B${i + 2}"/>` : `<c r="B${i + 2}" s="1"><v>${values[i]}</v></c>`}<c r="C${i + 2}"><v>${data.valid[i]}</v></c></row>`).join('')}</sheetData></worksheet>`,
  );
  book.file(
    'xl/styles.xml',
    `<styleSheet xmlns="${S}"><numFmts count="1"><numFmt numFmtId="164" formatCode="${format}"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
  );
  const content = template.workbookParts['[Content_Types].xml'].replace(
    '</Types>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  );
  book.file('[Content_Types].xml', content);
  book.file(
    'xl/_rels/workbook.xml.rels',
    template.workbookParts['xl/_rels/workbook.xml.rels'].replace(
      '</Relationships>',
      `<Relationship Id="rIdStyles" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
    ),
  );
  return {
    chart,
    workbook: await book.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
    }),
    relationship: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdChartSnapshot1" Type="${R}/package" Target="../embeddings/chart${number}.xlsx"/></Relationships>`,
    frame: `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2000" name="Editable ${positive ? 'Positivity' : 'Mean'} Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(1.0)}" y="${emu(2.25)}"/><a:ext cx="${emu(8.55)}" cy="${emu(3.35)}"/></p:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="rIdChart"/></a:graphicData></a:graphic></p:graphicFrame>`,
  };
}
