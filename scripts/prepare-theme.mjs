import fs from 'node:fs';
import path from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Provide sanitized template asset directory');
const out = {
  cover: fs.readFileSync(
    path.join(source, 'candidates/cover-minimal.xml'),
    'utf8',
  ),
  coverRels: fs.readFileSync(
    path.join(source, 'candidates/cover-minimal.xml.rels'),
    'utf8',
  ),
  content: fs.readFileSync(path.join(source, 'candidates/content.xml'), 'utf8'),
  contentRels: fs.readFileSync(
    path.join(source, 'candidates/content.xml.rels'),
    'utf8',
  ),
  parts: {},
  media: {},
};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else
      out.parts[
        path
          .relative(path.join(source, 'parts-sanitized'), p)
          .replaceAll('\\', '/')
      ] = fs.readFileSync(p, 'utf8');
  }
};
walk(path.join(source, 'parts-sanitized'));
for (const file of ['image1.jpeg', 'image2.jpeg', 'image4.png', 'image5.png'])
  out.media['ppt/media/' + file] = fs
    .readFileSync(path.join(source, 'media', file))
    .toString('base64');
fs.writeFileSync(
  new URL('../lib/report-theme.json', import.meta.url),
  JSON.stringify(out),
);
fs.copyFileSync(
  path.join(source, 'media/image7.png'),
  new URL('../public/university-logo.png', import.meta.url),
);
console.log('Prepared sanitized theme and university logo.');
