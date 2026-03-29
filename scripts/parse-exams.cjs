const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PREGUNTAS_DIR = path.join(ROOT, 'selectividad_preguntas');
const OUTPUT_DIR = path.join(ROOT, 'src', 'data', 'ebau');

const SUBJECT_MAP = {
  'Biologia': 'biologia',
  'Fisica': 'fisica',
  'Historia de España': 'historia',
  'Lengua castellana y literatura II-2': 'lengua',
  'Lengua_Extranjera_Ingles': 'ingles',
  'Matemáticas Aplicadas a las Ciencias Sociales II': 'mates-sociales',
  'Matematicas II': 'matematicas',
  'Quimica': 'quimica',
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

function normalizeType(raw) {
  if (!raw) return null;
  const t = raw.trim();
  const num = (t.match(/[0-9]+$/) || [''])[0];
  if (/^suplet/i.test(t)) return 'Suplente' + num;
  if (/^suplente/i.test(t)) return 'Suplente' + num;
  if (/^titular/i.test(t)) return 'Titular' + num;
  if (/^reserva/i.test(t)) return 'Reserva' + num;
  return t;
}

function parseFilename(filename) {
  const base = path.basename(filename, '.pdf');
  let fileType = null;
  if (/^examen/i.test(base)) fileType = 'examen';
  else if (/^criterio/i.test(base)) fileType = 'criterios';
  else return null;

  const rx = /^(?:examen|criterios?[a-z]*)[-_]((?:titular|reserva|suplente|suplete)[0-9]*)[-_]([ab])(?:[-_ ]|$)/i;
  const m = base.match(rx);
  if (m) {
    let variant = null;
    if (/acceso/i.test(base)) variant = 'Acceso';
    else if (/admis/i.test(base)) variant = 'Admision';
    return { fileType: fileType, examType: normalizeType(m[1]), option: m[2].toUpperCase(), variant: variant };
  }

  const sr = /^(?:examen|criterios?[a-z]*)(?:[-_][a-z]+)*[-_]((?:titular|reserva|suplente|suplete)[0-9]*)$/i;
  const ms = base.match(sr);
  if (ms) return { fileType: fileType, examType: normalizeType(ms[1]), option: null, variant: null };

  return { fileType: fileType, examType: null, option: null, variant: null };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  let total = 0, ok = 0, fail = 0;

  const subjectDirs = fs.readdirSync(PREGUNTAS_DIR);

  for (const subjectDir of subjectDirs) {
    const slug = SUBJECT_MAP[subjectDir];
    if (!slug) continue;

    const subjectPath = path.join(PREGUNTAS_DIR, subjectDir);
    console.log('\n>> ' + subjectDir);
    const questions = [];

    const yearDirs = fs.readdirSync(subjectPath)
      .filter(function(d) { return fs.statSync(path.join(subjectPath, d)).isDirectory(); })
      .sort();

    for (const yearDir of yearDirs) {
      const ym = yearDir.match(/[0-9]{4}/);
      if (!ym) continue;
      const year = parseInt(ym[0]);
      const yearPath = path.join(subjectPath, yearDir);

      const files = fs.readdirSync(yearPath)
        .filter(function(f) { return f.toLowerCase().endsWith('.pdf') && !/^tablas?[ _]/i.test(f) && !/^tabla_/i.test(f); });

      const examenes = [];
      const criteriosMap = {};

      for (const file of files) {
        const meta = parseFilename(file);
        if (!meta) continue;
        const fp = path.join(yearPath, file);
        if (meta.fileType === 'examen') {
          examenes.push(Object.assign({ file: file, filePath: fp }, meta));
        } else if (meta.fileType === 'criterios') {
          const key = meta.examType + '|' + meta.option + '|' + meta.variant;
          criteriosMap[key] = fp;
          if (!meta.option) {
            criteriosMap[meta.examType + '|A|' + meta.variant] = fp;
            criteriosMap[meta.examType + '|B|' + meta.variant] = fp;
          }
        }
      }

      for (const ex of examenes) {
        total++;
        const label = subjectDir + ' ' + year + ' ' + ex.examType + '-' + ex.option + (ex.variant ? ' (' + ex.variant + ')' : '');
        try {
          const rawQuestion = extractText(ex.filePath);
          const key1 = ex.examType + '|' + ex.option + '|' + ex.variant;
          const key2 = ex.examType + '|' + ex.option + '|null';
          const cPath = criteriosMap[key1] || criteriosMap[key2] || null;
          const rawAnswer = cPath ? extractText(cPath) : null;
          questions.push({
            id: slug + '-' + year + '-' + (ex.examType || '').toLowerCase() + '-' + (ex.option || '').toLowerCase() + (ex.variant ? '-' + ex.variant.toLowerCase() : ''),
            year: year,
            examType: ex.examType,
            option: ex.option,
            examVariant: ex.variant,
            rawQuestion: rawQuestion,
            rawAnswer: rawAnswer,
            hasCriterios: !!cPath
          });
          console.log('  OK ' + label);
          ok++;
        } catch(err) {
          console.error('  FAIL ' + label + ': ' + err.message);
          fail++;
        }
      }
    }

    const out = path.join(OUTPUT_DIR, slug + '.json');
    fs.writeFileSync(out, JSON.stringify({ subject: slug, questions: questions }, null, 2), 'utf8');
    console.log('  -> src/data/ebau/' + slug + '.json (' + questions.length + ' examenes)');
  }

  console.log('\n==============================');
  console.log('  Total : ' + total);
  console.log('  OK    : ' + ok);
  console.log('  FAIL  : ' + fail);
  console.log('==============================\n');
}

main().catch(function(err) { console.error('Error fatal:', err.message); process.exit(1); });
