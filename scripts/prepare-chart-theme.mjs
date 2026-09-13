import fs from 'node:fs/promises';
const source = JSON.parse(
  await fs.readFile(
    '../work/ces-chart-assets/ces-native-chart-bundle.json',
    'utf8',
  ),
);
const result = {};
for (const [name, key] of [
  ['mean', 'mean'],
  ['positivity', 'cumulative'],
]) {
  const part = source.charts[key];
  result[name] = {
    chartXml: part.chartXml
      .replace(/<c:cat>[\s\S]*?<\/c:cat>/, '<c:cat/>')
      .replace(/<c:val>[\s\S]*?<\/c:val>/, '<c:val/>'),
    workbookParts: { ...part.workbookParts, 'xl/worksheets/sheet1.xml': '' },
  };
}
await fs.writeFile('lib/report-chart-theme.json', JSON.stringify(result));
console.log('Prepared native chart templates without sample data.');
