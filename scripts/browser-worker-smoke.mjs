import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
const directory = 'dist/client/_next/static';
const worker = (await fs.readdir(directory)).find((n) =>
  n.startsWith('portal.worker-'),
);
assert.ok(worker, 'Build the production worker first');
let respond;
const scope = {
  importScripts: () => {
    throw new Error('Unexpected importScripts');
  },
  postMessage: (value) => {
    if (respond && typeof value === 'object') respond(value);
  },
  console,
  setTimeout,
  clearTimeout,
  TextEncoder,
  TextDecoder,
  Blob,
  atob,
  btoa,
  Uint8Array,
  ArrayBuffer,
  DataView,
  Date,
  Promise,
};
scope.self = scope;
const context = vm.createContext(scope);
vm.runInContext(await fs.readFile(`${directory}/${worker}`, 'utf8'), context);
async function send(operation, data) {
  return new Promise((resolve, reject) => {
    respond = (r) => (r.error ? reject(new Error(r.error)) : resolve(r.result));
    context.self.onmessage({ data: { operation, data } });
  });
}
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet([
    {
      DegreeCode: 'Test',
      SubjCat: 'TEST101',
      CourseName: 'Synthetic',
      Expected: 1,
      Q1: 5,
      Q15: 2,
    },
  ]),
  'RawData',
);
const result = await send('analyze', {
  bytes: XLSX.write(wb, { type: 'array', bookType: 'xlsx' }),
  options: { type: 'CES' },
});
assert.equal(result.analysis.overall.rows, 1);
assert.equal(result.analysis.overall.questions.Q15.positivity, 0);
const items = [
  {
    id: 'test',
    name: 'synthetic.xlsx',
    year: 2027,
    section: 'courses',
    ...result,
  },
];
for (const format of ['xlsx', 'pptx', 'docx']) {
  const bytes = await send('export', { items, lang: 'ar', format });
  assert.ok(bytes.length > 1000);
  console.log(`${format}: ${bytes.length} bytes, browser globals only`);
}
if (process.env.COURSE_DIR) {
  for (const name of (await fs.readdir(process.env.COURSE_DIR)).filter((n) =>
    /^0[123]-.*\.docx$/.test(n),
  )) {
    const r = await send('analyze', {
      bytes: new Uint8Array(
        await fs.readFile(`${process.env.COURSE_DIR}/${name}`),
      ),
      docx: true,
    });
    assert.ok(r.course.outcomes.length >= 4);
    console.log(
      `${r.course.code}: ${r.course.outcomes.length} outcomes, ${r.course.issues.length} quality flags`,
    );
  }
}
