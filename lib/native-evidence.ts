import JSZip from 'jszip';
import templates from './report-chart-theme.json' with { type: 'json' };
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
  options?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    relId?: string;
  },
) {
  const positive = data.metric === 'positivity';

  const values = data.values.map((v) =>
    v === null
      ? null
      : positive
        ? v / 100
        : v,
  );

  const comparisonValues =
    data.comparisonValues?.map((v) =>
      v === null
        ? null
        : positive
          ? v / 100
          : v,
    );

  const count = data.categories.length;
  const end = count + 1;

  const format = positive
    ? '0.0%'
    : '0.00';

  const label =
    data.label ||
    (positive
      ? lang === 'ar'
        ? 'الإيجابية'
        : 'Positive responses'
      : lang === 'ar'
        ? 'المتوسط'
        : 'Mean');

  const comparisonLabel =
    data.comparisonLabel ||
    data.sampleLabel ||
    (lang === 'ar'
      ? 'المقارنة'
      : 'Comparison');

  /*
   * ------------------------------------------------------------
   * Category XML
   * ------------------------------------------------------------
   */

  const categoryXml = `
    <c:cat>
      <c:strRef>
        <c:f>'Chart Data'!$A$2:$A$${end}</c:f>

        <c:strCache>
          <c:ptCount val="${count}"/>

          ${data.categories
            .map(
              (category, i) => `
                <c:pt idx="${i}">
                  <c:v>${esc(category)}</c:v>
                </c:pt>
              `,
            )
            .join('')}
        </c:strCache>
      </c:strRef>
    </c:cat>
  `;

  /*
   * ------------------------------------------------------------
   * Primary value XML
   * ------------------------------------------------------------
   */

  const primaryValueXml = `
    <c:val>
      <c:numRef>
        <c:f>'Chart Data'!$B$2:$B$${end}</c:f>

        <c:numCache>
          <c:formatCode>${format}</c:formatCode>
          <c:ptCount val="${count}"/>

          ${values
            .map((value, i) =>
              value === null
                ? ''
                : `
                  <c:pt idx="${i}">
                    <c:v>${value}</c:v>
                  </c:pt>
                `,
            )
            .join('')}
        </c:numCache>
      </c:numRef>
    </c:val>
  `;

  /*
   * ------------------------------------------------------------
   * Primary series
   * ------------------------------------------------------------
   */

  const primarySeries = `
    <c:ser>
      <c:idx val="0"/>
      <c:order val="0"/>

      <c:tx>
        <c:v>${esc(label)}</c:v>
      </c:tx>

      <c:spPr>
        <a:solidFill>
          <a:srgbClr val="${data.stacked ? '2F5597' : '32395A'}"/>
        </a:solidFill>

        <a:ln w="0">
          <a:noFill/>
        </a:ln>
      </c:spPr>

      ${categoryXml}

      ${primaryValueXml}
    </c:ser>
  `;

  /*
   * ------------------------------------------------------------
   * Comparison series
   * ------------------------------------------------------------
   */

  let comparisonSeries = '';

  if (comparisonValues) {
    const comparisonValueXml = `
      <c:val>
        <c:numRef>
          <c:f>'Chart Data'!$C$2:$C$${end}</c:f>

          <c:numCache>
            <c:formatCode>${format}</c:formatCode>
            <c:ptCount val="${count}"/>

            ${comparisonValues
              .map((value, i) =>
                value === null
                  ? ''
                  : `
                    <c:pt idx="${i}">
                      <c:v>${value}</c:v>
                    </c:pt>
                  `,
              )
              .join('')}
          </c:numCache>
        </c:numRef>
      </c:val>
    `;

    comparisonSeries = `
      <c:ser>
        <c:idx val="1"/>
        <c:order val="1"/>

        <c:tx>
          <c:v>${esc(comparisonLabel)}</c:v>
        </c:tx>

        <c:spPr>
          <a:solidFill>
            <a:srgbClr val="C9C19A"/>
          </a:solidFill>

          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </c:spPr>

        ${categoryXml}

        ${comparisonValueXml}
      </c:ser>
    `;
  }

  /*
   * ------------------------------------------------------------
   * Data labels
   * ------------------------------------------------------------
   */

  const dataLabels = `
    <c:dLbls>

      <c:numFmt
        formatCode="${format}"
        sourceLinked="0"
      />

      <c:dLblPos val="outEnd"/>

      <c:showLegendKey val="0"/>
      <c:showVal val="1"/>
      <c:showCatName val="0"/>
      <c:showSerName val="0"/>
      <c:showPercent val="0"/>
      <c:showBubbleSize val="0"/>
      <c:showLeaderLines val="0"/>

      <c:txPr>
        <a:bodyPr anchorCtr="1"/>
        <a:lstStyle/>

        <a:p>
          <a:pPr>
            <a:defRPr sz="900">

              <a:solidFill>
                <a:srgbClr val="32395A"/>
              </a:solidFill>

              <a:latin typeface="Arial"/>
              <a:ea typeface="Arial"/>
              <a:cs typeface="Arial"/>

            </a:defRPr>
          </a:pPr>
        </a:p>
      </c:txPr>

    </c:dLbls>
  `;

  /*
   * ------------------------------------------------------------
   * Bar chart
   * ------------------------------------------------------------
   */

  const grouping =
    data.stacked
      ? 'stacked'
      : 'clustered';

  const overlap =
    data.stacked
      ? 100
      : 0;

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

      <c:axId val="48650112"/>
      <c:axId val="48672768"/>

    </c:barChart>
  `;

  /*
   * ------------------------------------------------------------
   * Category axis
   * ------------------------------------------------------------
   */

  const categoryAxisXml = `
    <c:catAx>

      <c:axId val="48650112"/>

      <c:scaling>
        <c:orientation val="minMax"/>
      </c:scaling>

      <c:delete val="0"/>

      <c:axPos val="b"/>

      <c:numFmt
        formatCode="General"
        sourceLinked="1"
      />

      <c:majorTickMark val="none"/>
      <c:minorTickMark val="none"/>

      <c:spPr>
        <a:ln w="9525">
          <a:solidFill>
            <a:srgbClr val="D2DBE5"/>
          </a:solidFill>
        </a:ln>
      </c:spPr>

      <c:txPr>
        <a:bodyPr anchorCtr="1"/>
        <a:lstStyle/>

        <a:p>
          <a:pPr>
            <a:defRPr sz="900">

              <a:solidFill>
                <a:srgbClr val="32395A"/>
              </a:solidFill>

              <a:latin typeface="Arial"/>
              <a:ea typeface="Arial"/>
              <a:cs typeface="Arial"/>

            </a:defRPr>
          </a:pPr>
        </a:p>
      </c:txPr>

      <c:crossAx val="48672768"/>

      <c:crosses val="autoZero"/>

      <c:auto val="1"/>

      <c:lblAlgn val="ctr"/>

      <c:lblOffset val="100"/>

    </c:catAx>
  `;

  /*
   * ------------------------------------------------------------
   * Value axis
   * ------------------------------------------------------------
   */

  const majorUnit = positive
    ? 0.2
    : Math.max(
        1,
        data.max / 5,
      );

  const valueAxisXml = `
    <c:valAx>

      <c:axId val="48672768"/>

      <c:scaling>
        <c:orientation val="minMax"/>
        <c:max val="${positive ? 1 : data.max}"/>
        <c:min val="0"/>
      </c:scaling>

      <c:delete val="0"/>

      <c:axPos val="l"/>

      <c:majorGridlines>
        <c:spPr>
          <a:ln w="9525">
            <a:solidFill>
              <a:srgbClr val="D2DBE5"/>
            </a:solidFill>
          </a:ln>
        </c:spPr>
      </c:majorGridlines>

      <c:numFmt
        formatCode="${format}"
        sourceLinked="0"
      />

      <c:majorTickMark val="none"/>
      <c:minorTickMark val="none"/>

      <c:spPr>
        <a:ln w="0">
          <a:noFill/>
        </a:ln>
      </c:spPr>

      <c:txPr>
        <a:bodyPr anchorCtr="1"/>
        <a:lstStyle/>

        <a:p>
          <a:pPr>
            <a:defRPr sz="900">

              <a:solidFill>
                <a:srgbClr val="32395A"/>
              </a:solidFill>

              <a:latin typeface="Arial"/>
              <a:ea typeface="Arial"/>
              <a:cs typeface="Arial"/>

            </a:defRPr>
          </a:pPr>
        </a:p>
      </c:txPr>

      <c:crossAx val="48650112"/>

      <c:crosses val="autoZero"/>

      <c:crossBetween val="between"/>

      <c:majorUnit val="${majorUnit}"/>

    </c:valAx>
  `;

  /*
   * ------------------------------------------------------------
   * Legend
   * ------------------------------------------------------------
   */

  const legendXml =
    comparisonValues
      ? `
        <c:legend>

          <c:legendPos val="t"/>

          <c:layout/>

          <c:overlay val="0"/>

          <c:txPr>
            <a:bodyPr/>
            <a:lstStyle/>

            <a:p>
              <a:pPr>
                <a:defRPr sz="900">

                  <a:solidFill>
                    <a:srgbClr val="32395A"/>
                  </a:solidFill>

                  <a:latin typeface="Arial"/>
                  <a:ea typeface="Arial"/>
                  <a:cs typeface="Arial"/>

                </a:defRPr>
              </a:pPr>
            </a:p>
          </c:txPr>

        </c:legend>
      `
      : '';

  /*
   * ------------------------------------------------------------
   * Full chart XML
   * ------------------------------------------------------------
   */

  const chart = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<c:chartSpace
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
>

  <c:lang val="${lang === 'ar' ? 'ar-SA' : 'en-US'}"/>

  <c:chart>

    <c:plotArea>

      <c:layout/>

      ${barChartXml}

      ${categoryAxisXml}

      ${valueAxisXml}

      <c:spPr>
        <a:solidFill>
          <a:srgbClr val="FFFFFF"/>
        </a:solidFill>

        <a:ln w="0">
          <a:noFill/>
        </a:ln>
      </c:spPr>

    </c:plotArea>

    ${legendXml}

    <c:plotVisOnly val="1"/>

    <c:dispBlanksAs val="gap"/>

  </c:chart>

  <c:spPr>
    <a:solidFill>
      <a:srgbClr val="FFFFFF"/>
    </a:solidFill>

    <a:ln w="0">
      <a:noFill/>
    </a:ln>
  </c:spPr>

  <c:externalData r:id="rIdChartSnapshot1">
    <c:autoUpdate val="0"/>
  </c:externalData>

</c:chartSpace>`;

  /*
   * ------------------------------------------------------------
   * Embedded workbook
   * ------------------------------------------------------------
   */

  const template =
    templates[data.metric];

  const book =
    new JSZip();

  for (
    const [path, value] of
    Object.entries(
      template.workbookParts,
    )
  ) {
    book.file(
      path,
      value,
    );
  }

  const cell = (
    address: string,
    text: string,
  ) =>
    `<c r="${address}" t="inlineStr"><is><t>${esc(text)}</t></is></c>`;

  const hasComparison =
    Boolean(comparisonValues);

  const lastColumn =
    hasComparison
      ? 'D'
      : 'C';

  const workbookRows =
    data.categories
      .map(
        (category, i) => {
          const row =
            i + 2;

          const primary =
            values[i] === null
              ? `<c r="B${row}"/>`
              : `<c r="B${row}" s="1"><v>${values[i]}</v></c>`;

          const comparison =
            hasComparison
              ? comparisonValues![i] === null
                ? `<c r="C${row}"/>`
                : `<c r="C${row}" s="1"><v>${comparisonValues![i]}</v></c>`
              : '';

          const validColumn =
            hasComparison
              ? 'D'
              : 'C';

          const valid =
            `<c r="${validColumn}${row}"><v>${data.valid[i] ?? 0}</v></c>`;

          return `
            <row r="${row}">
              ${cell(
                `A${row}`,
                category,
              )}

              ${primary}

              ${comparison}

              ${valid}
            </row>
          `;
        },
      )
      .join('');

  const firstRow =
    hasComparison
      ? `
        <row r="1">

          ${cell(
            'A1',
            'Category',
          )}

          ${cell(
            'B1',
            label,
          )}

          ${cell(
            'C1',
            comparisonLabel,
          )}

          ${cell(
            'D1',
            'Valid answers',
          )}

        </row>
      `
      : `
        <row r="1">

          ${cell(
            'A1',
            'Category',
          )}

          ${cell(
            'B1',
            label,
          )}

          ${cell(
            'C1',
            'Valid answers',
          )}

        </row>
      `;

  book.file(
    'xl/worksheets/sheet1.xml',
    `
      <worksheet xmlns="${S}">

        <dimension
          ref="A1:${lastColumn}${end}"
        />

        <cols>

          <col
            min="1"
            max="1"
            width="16"
            customWidth="1"
          />

          <col
            min="2"
            max="${hasComparison ? 4 : 3}"
            width="20"
            customWidth="1"
          />

        </cols>

        <sheetData>

          ${firstRow}

          ${workbookRows}

        </sheetData>

      </worksheet>
    `,
  );

  /*
   * ------------------------------------------------------------
   * Workbook styles
   * ------------------------------------------------------------
   */

  book.file(
    'xl/styles.xml',
    `
      <styleSheet xmlns="${S}">

        <numFmts count="1">

          <numFmt
            numFmtId="164"
            formatCode="${format}"
          />

        </numFmts>

        <fonts count="1">

          <font>
            <sz val="11"/>
            <name val="Arial"/>
          </font>

        </fonts>

        <fills count="2">

          <fill>
            <patternFill patternType="none"/>
          </fill>

          <fill>
            <patternFill patternType="gray125"/>
          </fill>

        </fills>

        <borders count="1">
          <border/>
        </borders>

        <cellStyleXfs count="1">

          <xf
            numFmtId="0"
            fontId="0"
            fillId="0"
            borderId="0"
          />

        </cellStyleXfs>

        <cellXfs count="2">

          <xf
            numFmtId="0"
            fontId="0"
            fillId="0"
            borderId="0"
            xfId="0"
          />

          <xf
            numFmtId="164"
            fontId="0"
            fillId="0"
            borderId="0"
            xfId="0"
            applyNumberFormat="1"
          />

        </cellXfs>

      </styleSheet>
    `,
  );

  /*
   * ------------------------------------------------------------
   * Workbook content types
   * ------------------------------------------------------------
   */

  const contentTypes =
    template.workbookParts[
      '[Content_Types].xml'
    ].replace(
      '</Types>',
      `
        <Override
          PartName="/xl/styles.xml"
          ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
        />
      </Types>
      `,
    );

  book.file(
    '[Content_Types].xml',
    contentTypes,
  );

  /*
   * ------------------------------------------------------------
   * Workbook relationships
   * ------------------------------------------------------------
   */

  book.file(
    'xl/_rels/workbook.xml.rels',

    template.workbookParts[
      'xl/_rels/workbook.xml.rels'
    ].replace(
      '</Relationships>',
      `
        <Relationship
          Id="rIdStyles"
          Type="${R}/styles"
          Target="styles.xml"
        />
      </Relationships>
      `,
    ),
  );

  /*
   * ------------------------------------------------------------
   * Chart placement
   * ------------------------------------------------------------
   */

  const frameX =
    options?.x ?? 1.0;

  const frameY =
    options?.y ?? 2.25;

  const frameW =
    options?.w ?? 8.55;

  const frameH =
    options?.h ?? 3.35;

  const relId =
    options?.relId ??
    'rIdChart';

  /*
   * ------------------------------------------------------------
   * Return chart package
   * ------------------------------------------------------------
   */

  return {
    chart,

    workbook:
      await book.generateAsync({
        type: 'uint8array',
        compression:
          'DEFLATE',
      }),

    relationship: `
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

        <Relationship
          Id="rIdChartSnapshot1"
          Type="${R}/package"
          Target="../embeddings/chart${number}.xlsx"
        />

      </Relationships>
    `,

    frame: `
      <p:graphicFrame>

        <p:nvGraphicFramePr>

          <p:cNvPr
            id="${2000 + number}"
            name="Editable Chart ${number}"
          />

          <p:cNvGraphicFramePr/>

          <p:nvPr/>

        </p:nvGraphicFramePr>

        <p:xfrm>

          <a:off
            x="${emu(frameX)}"
            y="${emu(frameY)}"
          />

          <a:ext
            cx="${emu(frameW)}"
            cy="${emu(frameH)}"
          />

        </p:xfrm>

        <a:graphic>

          <a:graphicData uri="${C}">

            <c:chart
              xmlns:c="${C}"
              xmlns:r="${R}"
              r:id="${relId}"
            />

          </a:graphicData>

        </a:graphic>

      </p:graphicFrame>
    `,
  };
}
