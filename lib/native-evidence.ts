import JSZip from 'jszip';
import type { Lang } from './analysis';
import type { ReportChart } from './report-model';

const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const T = 'http://schemas.openxmlformats.org/drawingml/2006/table';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const PACKAGE_R =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES =
  'http://schemas.openxmlformats.org/package/2006/content-types';

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

type NativeChartData = ReportChart & {
  comparisonValues?: (number | null)[];
  comparisonLabel?: string;
  sampleLabel?: string;
  stacked?: boolean;
};

type NativeChartOptions = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  relId?: string;
};

const textProperties = (fontSize = 900) => `
  <c:txPr>
    <a:bodyPr anchorCtr="1"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr>
        <a:defRPr sz="${fontSize}">
          <a:solidFill><a:srgbClr val="32395A"/></a:solidFill>
          <a:latin typeface="Arial"/>
          <a:ea typeface="Arial"/>
          <a:cs typeface="Arial"/>
        </a:defRPr>
      </a:pPr>
      <a:endParaRPr lang="en-US" sz="${fontSize}"/>
    </a:p>
  </c:txPr>`;

export async function nativeChart(
  data: ReportChart,
  lang: Lang,
  number: number,
  options?: NativeChartOptions,
) {
  const chartData = data as NativeChartData;
  const positive = chartData.metric === 'positivity';
  const count = chartData.categories.length;
  const end = count + 1;
  const format = positive ? '0.0%' : '0.00';
  const hasComparison = Array.isArray(chartData.comparisonValues);

  const normaliseValues = (source: readonly (number | null)[]) =>
    Array.from({ length: count }, (_, index) => {
      const value = source[index];
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      return positive ? value / 100 : value;
    });

  const values = normaliseValues(chartData.values);
  const comparisonValues = hasComparison
    ? normaliseValues(chartData.comparisonValues!)
    : undefined;

  const label =
    chartData.label ||
    (positive
      ? lang === 'ar'
        ? 'الإيجابية'
        : 'Positive responses'
      : lang === 'ar'
        ? 'المتوسط'
        : 'Mean');

  const comparisonLabel =
    chartData.comparisonLabel ||
    chartData.sampleLabel ||
    (lang === 'ar' ? 'المقارنة' : 'Comparison');

  const categoryXml = `
    <c:cat>
      <c:strRef>
        <c:f>'Chart Data'!$A$2:$A$${end}</c:f>
        <c:strCache>
          <c:ptCount val="${count}"/>
          ${chartData.categories
            .map(
              (category, index) =>
                `<c:pt idx="${index}"><c:v>${esc(category)}</c:v></c:pt>`,
            )
            .join('')}
        </c:strCache>
      </c:strRef>
    </c:cat>`;

  const seriesTextXml = (column: 'B' | 'C', text: string) => `
    <c:tx>
      <c:strRef>
        <c:f>'Chart Data'!$${column}$1</c:f>
        <c:strCache>
          <c:ptCount val="1"/>
          <c:pt idx="0"><c:v>${esc(text)}</c:v></c:pt>
        </c:strCache>
      </c:strRef>
    </c:tx>`;

  const valueXml = (column: 'B' | 'C', seriesValues: (number | null)[]) => `
    <c:val>
      <c:numRef>
        <c:f>'Chart Data'!$${column}$2:$${column}$${end}</c:f>
        <c:numCache>
          <c:formatCode>${format}</c:formatCode>
          <c:ptCount val="${count}"/>
          ${seriesValues
            .map((value, index) =>
              value === null
                ? ''
                : `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`,
            )
            .join('')}
        </c:numCache>
      </c:numRef>
    </c:val>`;

  const seriesXml = (
    index: number,
    column: 'B' | 'C',
    seriesLabel: string,
    seriesValues: (number | null)[],
    colour: string,
  ) => `
    <c:ser>
      <c:idx val="${index}"/>
      <c:order val="${index}"/>
      ${seriesTextXml(column, seriesLabel)}
      <c:spPr>
        <a:solidFill><a:srgbClr val="${colour}"/></a:solidFill>
        <a:ln><a:noFill/></a:ln>
      </c:spPr>
      ${categoryXml}
      ${valueXml(column, seriesValues)}
    </c:ser>`;

  const primaryColour = positive ? '03665F' : '32395A';
  const primarySeries = seriesXml(0, 'B', label, values, primaryColour);
  const comparisonSeries = comparisonValues
    ? seriesXml(1, 'C', comparisonLabel, comparisonValues, 'C9C19A')
    : '';

  // CT_DLbls has a strict sequence. In particular, txPr must precede
  // dLblPos and every show* element or PowerPoint may repair the chart.
  const dataLabels = `
    <c:dLbls>
      <c:numFmt formatCode="${format}" sourceLinked="0"/>
      ${textProperties()}
      <c:dLblPos val="outEnd"/>
      <c:showLegendKey val="0"/>
      <c:showVal val="1"/>
      <c:showCatName val="0"/>
      <c:showSerName val="0"/>
      <c:showPercent val="0"/>
      <c:showBubbleSize val="0"/>
      <c:showLeaderLines val="0"/>
    </c:dLbls>`;

  const grouping = chartData.stacked ? 'stacked' : 'clustered';
  const overlap = chartData.stacked ? 100 : 0;
  const categoryAxisId = 48650112;
  const valueAxisId = 48672768;

  const observedMaximum = Array.from({ length: count }, (_, index) => {
    const first = values[index] ?? 0;
    const second = comparisonValues?.[index] ?? 0;
    return chartData.stacked ? first + second : Math.max(first, second);
  }).reduce((maximum, value) => Math.max(maximum, value), 0);

  const configuredMaximum =
    typeof chartData.max === 'number' && Number.isFinite(chartData.max)
      ? positive
        ? chartData.max > 1
          ? chartData.max / 100
          : chartData.max
        : chartData.max
      : positive
        ? 1
        : 5;
  const axisMaximum = Math.max(configuredMaximum, observedMaximum, positive ? 1 : 1);
  const majorUnit = positive
    ? axisMaximum > 1
      ? 0.5
      : 0.2
    : Math.max(1, axisMaximum / 5);

  const barChartXml = `
    <c:barChart>
      <c:barDir val="col"/>
      <c:grouping val="${grouping}"/>
      <c:varyColors val="0"/>
      ${primarySeries}
      ${comparisonSeries}
      ${dataLabels}
      <c:gapWidth val="80"/>
      <c:overlap val="${overlap}"/>
      <c:axId val="${categoryAxisId}"/>
      <c:axId val="${valueAxisId}"/>
    </c:barChart>`;

  const categoryAxisXml = `
    <c:catAx>
      <c:axId val="${categoryAxisId}"/>
      <c:scaling><c:orientation val="minMax"/></c:scaling>
      <c:delete val="0"/>
      <c:axPos val="b"/>
      <c:numFmt formatCode="General" sourceLinked="1"/>
      <c:majorTickMark val="none"/>
      <c:minorTickMark val="none"/>
      <c:spPr>
        <a:ln w="9525">
          <a:solidFill><a:srgbClr val="D2DBE5"/></a:solidFill>
        </a:ln>
      </c:spPr>
      ${textProperties()}
      <c:crossAx val="${valueAxisId}"/>
      <c:crosses val="autoZero"/>
      <c:auto val="1"/>
      <c:lblAlgn val="ctr"/>
      <c:lblOffset val="100"/>
    </c:catAx>`;

  const valueAxisXml = `
    <c:valAx>
      <c:axId val="${valueAxisId}"/>
      <c:scaling>
        <c:orientation val="minMax"/>
        <c:max val="${axisMaximum}"/>
        <c:min val="0"/>
      </c:scaling>
      <c:delete val="0"/>
      <c:axPos val="l"/>
      <c:majorGridlines>
        <c:spPr>
          <a:ln w="9525">
            <a:solidFill><a:srgbClr val="D2DBE5"/></a:solidFill>
          </a:ln>
        </c:spPr>
      </c:majorGridlines>
      <c:numFmt formatCode="${format}" sourceLinked="0"/>
      <c:majorTickMark val="none"/>
      <c:minorTickMark val="none"/>
      <c:spPr><a:ln><a:noFill/></a:ln></c:spPr>
      ${textProperties()}
      <c:crossAx val="${categoryAxisId}"/>
      <c:crosses val="autoZero"/>
      <c:crossBetween val="between"/>
      <c:majorUnit val="${majorUnit}"/>
    </c:valAx>`;

  const legendXml = hasComparison
    ? `
      <c:legend>
        <c:legendPos val="t"/>
        <c:layout/>
        <c:overlay val="0"/>
        ${textProperties()}
      </c:legend>`
    : '';

  const chart = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${C}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${R}">
  <c:lang val="${lang === 'ar' ? 'ar-SA' : 'en-US'}"/>
  <c:chart>
    <c:plotArea>
      <c:layout/>
      ${barChartXml}
      ${categoryAxisXml}
      ${valueAxisXml}
      <c:spPr>
        <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
        <a:ln><a:noFill/></a:ln>
      </c:spPr>
    </c:plotArea>
    ${legendXml}
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
    <c:showDLblsOverMax val="0"/>
  </c:chart>
  <c:spPr>
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:ln><a:noFill/></a:ln>
  </c:spPr>
  <c:externalData r:id="rIdChartSnapshot1">
    <c:autoUpdate val="0"/>
  </c:externalData>
</c:chartSpace>`;

  const cell = (address: string, text: string) =>
    `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
  const numericCell = (address: string, value: number | null, style = '') =>
    value === null
      ? `<c r="${address}"${style}/>`
      : `<c r="${address}"${style}><v>${value}</v></c>`;

  const validColumn = hasComparison ? 'D' : 'C';
  const lastColumn = validColumn;
  const headerRow = `
    <row r="1">
      ${cell('A1', 'Category')}
      ${cell('B1', label)}
      ${hasComparison ? cell('C1', comparisonLabel) : ''}
      ${cell(`${validColumn}1`, 'Valid answers')}
    </row>`;

  const workbookRows = chartData.categories
    .map((category, index) => {
      const row = index + 2;
      const validValue = chartData.valid[index];
      const valid =
        typeof validValue === 'number' && Number.isFinite(validValue)
          ? validValue
          : 0;
      return `
        <row r="${row}">
          ${cell(`A${row}`, category)}
          ${numericCell(`B${row}`, values[index], ' s="1"')}
          ${comparisonValues ? numericCell(`C${row}`, comparisonValues[index], ' s="1"') : ''}
          ${numericCell(`${validColumn}${row}`, valid)}
        </row>`;
    })
    .join('');

  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${S}">
  <dimension ref="A1:${lastColumn}${end}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="${hasComparison ? 4 : 3}" width="20" customWidth="1"/>
  </cols>
  <sheetData>
    ${headerRow}
    ${workbookRows}
  </sheetData>
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${S}">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="${format}"/></numFmts>
  <fonts count="1">
    <font><sz val="11"/><name val="Arial"/><family val="2"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const book = new JSZip();
  book.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
  );
  book.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_R}">
  <Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  book.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${S}" xmlns:r="${R}">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="Chart Data" sheetId="1" r:id="rId1"/></sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`,
  );
  book.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_R}">
  <Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/>
</Relationships>`,
  );
  book.file('xl/worksheets/sheet1.xml', worksheet);
  book.file('xl/styles.xml', styles);

  const frameX = options?.x ?? 1.0;
  const frameY = options?.y ?? 2.25;
  const frameW = options?.w ?? 8.55;
  const frameH = options?.h ?? 3.35;
  const relId = options?.relId ?? 'rIdChart';

  return {
    chart,
    workbook: await book.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
    }),
    relationship: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_R}">
  <Relationship Id="rIdChartSnapshot1" Type="${R}/package" Target="../embeddings/chart${number}.xlsx"/>
</Relationships>`,
    frame: `
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="${2000 + number}" name="Editable Chart ${number}"/>
          <p:cNvGraphicFramePr/>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm>
          <a:off x="${emu(frameX)}" y="${emu(frameY)}"/>
          <a:ext cx="${emu(frameW)}" cy="${emu(frameH)}"/>
        </p:xfrm>
        <a:graphic>
          <a:graphicData uri="${C}">
            <c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="${relId}"/>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>`,
  };
}
