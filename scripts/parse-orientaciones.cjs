const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIR = path.join(process.env.HOME, 'Desktop/app_selectividad/orientaciones_examenes');
const OUT = path.join(process.env.HOME, 'Desktop/app_selectividad/src/data/orientaciones');
fs.mkdirSync(OUT, { recursive: true });

const SLUG_MAP = {
  'biologia': 'biologia',
  'historia_espana': 'historia',
  'ingles': 'ingles',
  'lengua_castellana': 'lengua',
  'matematicas_aplicadas': 'mates-sociales',
  'matematicas': 'matematicas',
  'quimica': 'quimica',
};

function extractText(filePath) {
  try {
    const result = execSync(
      `pdftotext -layout "${filePath}" -`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return result.toString('utf8').trim();
  } catch(err) {
    console.error('pdftotext error:', err.message);
    return '';
  }
}

async function main() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.pdf'));
  console.log('Parseando', files.length, 'orientaciones...');

  for (const file of files) {
    const match = file.match(/Orientaciones_(.+)\.pdf$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const slug = SLUG_MAP[key];
    if (!slug) { console.log('Sin slug para:', key); continue; }

    const filePath = path.join(DIR, file);
    try {
      const text = extractText(filePath);
      const out = { subject: slug, source: file, text: text };
      fs.writeFileSync(path.join(OUT, slug + '.json'), JSON.stringify(out, null, 2), 'utf8');
      console.log('OK', slug, '(' + text.length + ' chars)');
    } catch(err) {
      console.error('FAIL', file, err.message);
    }
  }
  console.log('Listo. JSONs en src/data/orientaciones/');
}

main().catch(console.error);
