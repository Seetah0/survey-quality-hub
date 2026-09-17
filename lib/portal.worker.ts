/// <reference lib="webworker" />
import { analyzeWorkbook, mergeAnalyses } from './analysis';
import { readCourse } from './course-report';
import { inspectHistory, appendHistory } from './history-workbook';
import { buildPortalPages, exportWorkbook } from './portal-export';
import { makePptx, makeDocx } from './export';
self.onmessage = async (event) => {
  const { operation, data } = event.data;
  try {
    let result;
    if (operation === 'analyze')
      result = data.docx
        ? { course: await readCourse(new Uint8Array(data.bytes)) }
        : {
            analysis: analyzeWorkbook(new Uint8Array(data.bytes), data.options),
          };
    else if (operation === 'merge') result = mergeAnalyses(data);
    else if (operation === 'history')
      result = inspectHistory(new Uint8Array(data));
    else if (operation === 'append')
      result = await appendHistory(
        new Uint8Array(data.bytes),
        data.year,
        data.mappings,
      );
    else if (operation === 'export') {
      const pages = buildPortalPages(data.items, data.lang);
      result =
        data.format === 'preview'
          ? pages
          : data.format === 'xlsx'
            ? exportWorkbook(data.items, data.lang)
            : data.format === 'pptx'
              ? await makePptx(pages, data.lang)
              : await makeDocx(pages, data.lang);
    } else throw new Error('UNKNOWN_OPERATION');
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'PROCESSING_FAILED',
    });
  }
};
