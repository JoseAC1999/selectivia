#!/usr/bin/env node
'use strict'

/**
 * generate-flashcards.cjs
 * Genera src/data/flashcards/{slug}.json para cada materia EBAU.
 * Fuentes: src/data/ebau/{slug}.json, src/data/orientaciones/{slug}.json + flashcards hardcodeadas.
 */

const fs = require('fs')
const path = require('path')

const ROOT     = path.join(__dirname, '..')
const EBAU_DIR = path.join(ROOT, 'src', 'data', 'ebau')
const ORI_DIR  = path.join(ROOT, 'src', 'data', 'orientaciones')
const OUT_DIR  = path.join(ROOT, 'src', 'data', 'flashcards')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  catch { return null }
}

/** Mismo parseCriterios que ExamenesOficiales – dot-leader pattern */
function parseCriterios(rawAnswer) {
  if (!rawAnswer) return []
  const SECTION_HEADER_RE = /([A-Z]\.\d+\.|BLOQUE\s+[A-Z\d]+|EJERCICIO\s+\d+)/i
  const text = rawAnswer
    .replace(/\.{4,}[.\s]*/g, '§')
    .replace(/[ \t]{2,}/g, ' ')
  const parts = text.split('§')
  const items = []
  let groupCounter = 0
  let currentGroupId = null
  let currentGroupLabel = ''

  for (let i = 0; i < parts.length - 1; i++) {
    const after = parts[i + 1]
    const scoreMatch = after.match(/^\s*(\d+[,\s]*\d*)\s*punt\s*[oa]\s*s?/i)
    if (!scoreMatch) continue
    const pointsStr = scoreMatch[1].replace(/\s/g, '')
    const points = parseFloat(pointsStr.replace(',', '.'))
    if (isNaN(points) || points <= 0 || points > 10) continue
    let raw = parts[i]
      .replace(/^\s*\d+[,\s]*\d*\s*punt\s*[oa]\s*s?\s*/i, '')
      .replace(/PRUEBA DE[^]*?CRITERIOS ESPECÍFICOS DE CORRECCIÓN\s*/gi, '')
      .trim()
    const headerMatch = raw.match(SECTION_HEADER_RE)
    if (headerMatch) {
      const headerKey = headerMatch[1].replace(/\s+/g, ' ').trim().toUpperCase()
      if (headerKey !== currentGroupLabel) {
        currentGroupLabel = headerKey
        currentGroupId = `g${groupCounter++}`
      }
    }
    let desc = raw
      .replace(/[A-Z]\.\d+\.\s*Total\s*[\d,. ]+punt\s*[oa]\s*s?\s*/gi, '')
      .replace(/[A-Z]\.\d+\./g, '')
      .replace(/(?:BLOQUE\s+[A-Z\d]+|EJERCICIO\s+\d+)\s*/gi, '')
      .trim()
      .replace(/\s+/g, ' ')
    if (desc.length < 8) continue
    items.push({ description: desc, points, groupLabel: currentGroupLabel })
  }
  return items
}

/**
 * Extrae preguntas del rawQuestion buscando fragmentos con interrogación
 * o enunciados del tipo "Defina X", "Explica X", "Indica X".
 */
function extractQuestionsFromRaw(rawQuestion) {
  if (!rawQuestion) return []
  // Normalizar separadores
  const text = rawQuestion
    .replace(/[ \t]{3,}/g, '\n')
    .replace(/[ \t]{2}/g, '\n')
  const sentences = text.split('\n').map(s => s.trim()).filter(s => s.length > 10)
  const out = []
  for (const s of sentences) {
    // Buscar preguntas con interrogación o verbos imperativas comunes en EBAU
    if (
      /\?$/.test(s) ||
      /^(Defin[ae]|Explica|Indica|Nombra|Enumera|Razona|Describe|Clasifica|Comenta|Analiza|Compara|Justifica|Cita|Calcula)\s/i.test(s)
    ) {
      // Limpiar badges de puntos [0,5] del enunciado
      const clean = s.replace(/\[\d+[,.]?\d*\]/g, '').replace(/\s{2,}/g, ' ').trim()
      if (clean.length > 10 && clean.length < 300) out.push(clean)
    }
  }
  return out
}

// ─── Flashcards hardcodeadas por materia ──────────────────────────────────────

const HARDCODED = {

  biologia: [
    // Bloque A: Biomoléculas
    { front: '¿Qué es una biomolécuala?', back: 'Molécula orgánica o inorgánica que forma parte de los seres vivos y desempeña funciones biológicas esenciales.', topic: 'Biomoléculas', difficulty: 1 },
    { front: '¿Qué son los glúcidos y cuál es su función principal?', back: 'Biomoléculas formadas por C, H y O. Función principal: energética (glucosa → ATP). También estructural (celulosa, quitina) y de reserva (almidón, glucógeno).', topic: 'Biomoléculas', difficulty: 1 },
    { front: '¿Qué son los lípidos? Cita tres funciones.', back: 'Biomoléculas apolares, insolubles en agua. Funciones: energética de reserva (triglicéridos), estructural (fosfolípidos de membrana), reguladora (hormonas esteroideas, vitaminas liposolubles).', topic: 'Biomoléculas', difficulty: 1 },
    { front: '¿Qué es un aminoácido? ¿Cuántos hay en proteínas?', back: 'Molécula con un grupo amino (-NH₂) y un grupo carboxilo (-COOH) unidos al mismo carbono alfa. Hay 20 aminoácidos proteicos.', topic: 'Biomoléculas', difficulty: 1 },
    { front: '¿Qué es el enlace peptídico?', back: 'Unión covalente entre el grupo carboxilo de un aminoácido y el grupo amino del siguiente, con pérdida de una molécula de agua (condensación).', topic: 'Biomoléculas', difficulty: 2 },
    { front: 'Niveles de organización de las proteínas', back: '1º Estructura primaria: secuencia de aminoácidos. 2º Secundaria: α-hélice o lámina β. 3º Terciaria: plegamiento 3D. 4º Cuaternaria: varias cadenas (ej. hemoglobina).', topic: 'Biomoléculas', difficulty: 2 },
    { front: '¿Qué son los ácidos nucleicos? ¿Qué monómeros los forman?', back: 'Polímeros de nucleótidos. Cada nucleótido tiene: base nitrogenada + pentosa (ribosa o desoxirribosa) + ácido fosfórico.', topic: 'Biomoléculas', difficulty: 1 },
    { front: 'Diferencias entre ADN y ARN', back: 'ADN: doble cadena, desoxirribosa, bases A-T-G-C, función hereditaria. ARN: monocatenario, ribosa, bases A-U-G-C, función en síntesis proteica.', topic: 'Biomoléculas', difficulty: 2 },
    { front: '¿Qué es la complementariedad de bases nitrogenadas?', back: 'En ADN: A se une a T (2 puentes de hidrógeno) y G se une a C (3 puentes). Esta complementariedad permite la replicación y transcripción fiel.', topic: 'Biomoléculas', difficulty: 2 },
    // Bloque B: Genética molecular
    { front: '¿Qué es la replicación del ADN? ¿Es semiconservativa?', back: 'Proceso por el que el ADN se duplica antes de la división celular. Es semiconservativa: cada hebra parental sirve de molde para una nueva hebra, resultando en dos moléculas con una cadena original y una nueva.', topic: 'Genética molecular', difficulty: 2 },
    { front: '¿Qué es la transcripción?', back: 'Síntesis de ARNm a partir de la hebra molde del ADN, catalizada por la ARN polimerasa. Ocurre en el núcleo (eucariotas).', topic: 'Genética molecular', difficulty: 1 },
    { front: '¿Qué es la traducción?', back: 'Síntesis de proteínas en los ribosomas, usando el ARNm como molde y los ARNt como adaptadores. Proceso: inicio, elongación, terminación.', topic: 'Genética molecular', difficulty: 2 },
    { front: '¿Qué es el código genético? ¿Cuáles son sus características?', back: 'Relación entre los codones del ARNm y los aminoácidos. Es universal (mismo en todos los seres vivos), degenerado (varios codones → mismo aa), no ambiguo (un codón → un solo aa) y sin signos de puntuación (salvo codones inicio/stop).', topic: 'Genética molecular', difficulty: 2 },
    { front: '¿Qué es una mutación génica? Pon ejemplos.', back: 'Cambio en la secuencia de nucleótidos de un gen. Ejemplos: sustitución (una base por otra), inserción o deleción (desplazan el marco de lectura → frameshift).', topic: 'Genética molecular', difficulty: 2 },
    { front: 'Primera y segunda ley de Mendel', back: '1ª Ley de la uniformidad: F1 de dos líneas puras es uniforme, con el fenotipo del alelo dominante. 2ª Ley de la segregación: en F2, los alelos se separan 3:1 (fenotípico) o 1:2:1 (genotípico).', topic: 'Genética molecular', difficulty: 2 },
    { front: '¿Qué es la herencia ligada al sexo? Ejemplo.', back: 'Genes localizados en el cromosoma X (o Y). Ejemplo: daltonismo y hemofilia. Los hombres (XY) expresan el alelo recesivo con un solo alelo; las mujeres necesitan dos.', topic: 'Genética molecular', difficulty: 2 },
    // Bloque C: Biología celular
    { front: 'Diferencias entre célula procariota y eucariota', back: 'Procariota: sin membrana nuclear, sin orgánulos membranosos, ADN circular, ribosomas 70S, tamaño <10 µm. Eucariota: núcleo definido, orgánulos membranosos, ADN lineal, ribosomas 80S, mayor tamaño.', topic: 'Biología celular', difficulty: 1 },
    { front: '¿Qué es la membrana plasmática y cuál es su modelo?', back: 'Bicapa lipídica (fosfolípidos + colesterol) con proteínas integrales y periféricas. Modelo: mosaico fluido (Singer y Nicolson, 1972). Función: permeabilidad selectiva, transporte, comunicación.', topic: 'Biología celular', difficulty: 2 },
    { front: '¿Qué es la mitocondria? ¿Qué proceso ocurre en ella?', back: 'Orgánulo con doble membrana. Membrana externa lisa, interna con crestas (mayor superficie). En ella ocurre la respiración aerobia (ciclo de Krebs + cadena de transporte electrónico + fosforilación oxidativa).', topic: 'Biología celular', difficulty: 2 },
    { front: '¿Qué es el cloroplasto y qué proceso realiza?', back: 'Orgánulo exclusivo de plantas y algas. Doble membrana + tilacoides (apilados en grana) + estroma. Realiza la fotosíntesis: fase fotoquímica en tilacoide, ciclo de Calvin en estroma.', topic: 'Biología celular', difficulty: 2 },
    { front: 'Fases de la mitosis', back: 'Profase: condensación cromosomas. Metafase: alineación en placa ecuatorial. Anafase: separación cromátidas. Telofase: nueva envuelta nuclear. Resultado: 2 células hijas genéticamente idénticas a la madre.', topic: 'Biología celular', difficulty: 2 },
    { front: '¿Qué es la meiosis? ¿Para qué sirve?', back: 'División celular que produce 4 células haploides (n) a partir de una diploide (2n). Meiosis I: separación homólogos. Meiosis II: separación cromátidas. Genera variabilidad genética. Produce gametos.', topic: 'Biología celular', difficulty: 2 },
    // Bloque D: Metabolismo
    { front: '¿Qué es el metabolismo? ¿Qué es el anabolismo y el catabolismo?', back: 'Conjunto de reacciones químicas de la célula. Anabolismo: síntesis de moléculas complejas, consume energía (ATP). Catabolismo: degradación de moléculas, libera energía (produce ATP).', topic: 'Metabolismo', difficulty: 1 },
    { front: '¿Qué es la glucólisis? ¿Dónde ocurre?', back: 'Ruta catabólica que degrada glucosa (6C) en 2 moléculas de piruvato (3C), con producción neta de 2 ATP y 2 NADH. Ocurre en el citoplasma (no requiere O₂).', topic: 'Metabolismo', difficulty: 2 },
    { front: '¿Qué ocurre en la respiración aerobia? Balance energético.', back: 'Glucosa → glucólisis (2 ATP) → ciclo de Krebs (2 ATP) → cadena respiratoria (32-34 ATP) = ~36-38 ATP totales. Produce CO₂ y H₂O. Ocurre en mitocondria.', topic: 'Metabolismo', difficulty: 2 },
    { front: '¿Qué es la fermentación? Tipos.', back: 'Catabolismo anaerobio que regenera NAD⁺ sin O₂. Fermentación láctica: piruvato → lactato (músculo, Lactobacillus). Fermentación alcohólica: piruvato → etanol + CO₂ (levaduras).', topic: 'Metabolismo', difficulty: 2 },
    { front: '¿Qué es la fotosíntesis? Fases.', back: 'Proceso anabólico que transforma energía luminosa en química (glucosa). Fase fotoquímica (luz): fotólisis del agua, producción de ATP y NADPH. Fase oscura/ciclo de Calvin: fijación de CO₂ → síntesis de glucosa.', topic: 'Metabolismo', difficulty: 2 },
    // Bloque E: Biotecnología
    { front: '¿Qué es un vector de clonación? Tipos.', back: 'Molécula de ADN que se usa para introducir ADN extraño en células hospedadoras. Tipos: plásmidos bacterianos, fagos, cósmidos, cromosomas artificiales (BAC, YAC).', topic: 'Biotecnología', difficulty: 2 },
    { front: '¿Qué son las enzimas de restricción?', back: 'Endonucleasas bacterianas que cortan el ADN en secuencias específicas (palíndromos). Herramienta clave en ingeniería genética para generar fragmentos con extremos cohesivos.', topic: 'Biotecnología', difficulty: 2 },
    { front: '¿Qué es la PCR?', back: 'Reacción en cadena de la polimerasa. Amplifica in vitro una secuencia de ADN usando: ADN molde, cebadores (primers), ADN polimerasa termoestable (Taq), dNTPs. Ciclos: desnaturalización, hibridación, extensión.', topic: 'Biotecnología', difficulty: 2 },
    { front: '¿Qué es un organismo transgénico? Ejemplo.', back: 'Ser vivo al que se ha introducido ADN foráneo (transgén) en su genoma. Ejemplos: ratones knockouts, plantas Bt (resistencia a insectos con gen de Bacillus thuringiensis), insulina humana en E. coli.', topic: 'Biotecnología', difficulty: 2 },
    // Bloque F: Inmunología
    { front: '¿Qué es el sistema inmune? Tipos de inmunidad.', back: 'Sistema de defensa del organismo. Inmunidad inespecífica (innata): barreras físicas, fagocitosis, inflamación. Inmunidad específica (adaptativa): linfocitos B (anticuerpos) y T (celular). Puede ser humoral o celular.', topic: 'Inmunología', difficulty: 1 },
    { front: '¿Qué es un antígeno? ¿Y un anticuerpo?', back: 'Antígeno: molécula (proteína, polisacárido) capaz de desencadenar respuesta inmune. Anticuerpo (inmunoglobulina): glucoproteína en forma de Y producida por células plasmáticas, se une al antígeno de forma específica.', topic: 'Inmunología', difficulty: 2 },
    { front: '¿Qué son los linfocitos T? Tipos.', back: 'Linfocitos que maduran en el timo. T citotóxicos (CD8): destruyen células infectadas. T colaboradores (CD4): activan linfocitos B y macrófagos. T reguladores: frenan la respuesta inmune.', topic: 'Inmunología', difficulty: 2 },
    { front: '¿Qué es una vacuna? ¿Y la memoria inmunológica?', back: 'Vacuna: preparado con antígenos (atenuados, muertos o fragmentos) que estimula inmunidad sin provocar enfermedad. Memoria inmunológica: linfocitos de memoria generados tras la respuesta primaria, permiten respuesta secundaria más rápida e intensa.', topic: 'Inmunología', difficulty: 2 },
    { front: '¿Qué es el VIH? ¿Cómo afecta al sistema inmune?', back: 'Virus de la inmunodeficiencia humana. Infecta y destruye linfocitos T CD4 (helper), debilitando la respuesta inmune hasta producir SIDA (síndrome de inmunodeficiencia adquirida). Mecanismo: usa la maquinaria de la célula para replicarse.', topic: 'Inmunología', difficulty: 2 },
    { front: '¿Qué es la alergia?', back: 'Respuesta inmune exagerada (hipersensibilidad tipo I) ante alérgenos inocuos. Media IgE + mastocitos → liberación de histamina → síntomas (rinitis, urticaria, anafilaxia en casos graves).', topic: 'Inmunología', difficulty: 2 },
    { front: '¿Qué es la enfermedad autoinmune? Ejemplos.', back: 'El sistema inmune ataca los propios tejidos (pérdida de tolerancia). Ejemplos: lupus eritematoso sistémico, artritis reumatoide, diabetes tipo 1, esclerosis múltiple.', topic: 'Inmunología', difficulty: 2 },
    { front: '¿Qué es la teoría de la evolución de Darwin?', back: 'Las especies evolucionan por selección natural: los individuos con variantes más adaptadas al medio sobreviven y se reproducen más (supervivencia del más apto). Junto con la variabilidad heredada, explica la diversidad de los seres vivos.', topic: 'Evolución', difficulty: 1 },
    { front: '¿Qué es la ecología? Define nicho ecológico.', back: 'Ciencia que estudia las relaciones entre los seres vivos y su ambiente. Nicho ecológico: papel funcional de una especie en el ecosistema (qué come, cómo obtiene energía, cómo interacciona con otras especies).', topic: 'Ecología', difficulty: 1 },
  ],

  historia: [
    { front: '¿Qué fue el Sexenio Democrático (1868-1874)?', back: 'Período entre la Revolución Gloriosa (derrocamiento de Isabel II) y la Restauración borbónica. Incluyó el reinado de Amadeo I, la I República y la Primera Guerra Carlista. Primer intento de democracia liberal en España.', topic: 'Siglo XIX', difficulty: 2 },
    { front: '¿Qué fue el sistema de la Restauración?', back: 'Sistema político diseñado por Cánovas del Castillo (1874) basado en la alternancia pacífica en el poder de dos partidos (Liberal y Conservador) mediante el turno pacífico. Vicio: caciquismo y pucherazo electoral.', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue el Desastre del 98?', back: 'Pérdida de Cuba, Puerto Rico y Filipinas en la guerra con EE.UU. (1898). Crisis moral, política y económica. Surgimiento del Regeneracionismo (Joaquín Costa) y la Generación del 98.', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue la Semana Trágica de Barcelona (1909)?', back: 'Revuelta popular en Barcelona contra el envío de reservistas a Marruecos (guerra del Rif). Barricadas, incendio de conventos. Represión y ejecución de Francesc Ferrer i Guàrdia. Crisis del gobierno de Maura.', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue la Dictadura de Primo de Rivera (1923-1930)?', back: 'Golpe de estado apoyado por Alfonso XIII. Suspensión de la Constitución, directorio militar → civil. Obras públicas y censura. Cayó por la oposición creciente; dimitió en 1930.', topic: 'Dictadura Primo de Rivera', difficulty: 2 },
    { front: '¿Qué fue la Segunda República española?', back: 'Régimen republicano (1931-1939) proclamado tras las elecciones municipales. Constitución de 1931 (sufragio femenino, laicismo, autonomías). Reformas: agraria, militar, educativa. Polarización política → Guerra Civil.', topic: 'Segunda República', difficulty: 2 },
    { front: 'Fases de la Segunda República', back: 'Bienio reformista (1931-33): gobierno de Azaña. Bienio radical-cedista (1933-35): gobierno de Lerroux + CEDA, Revolución de Asturias (1934). Frente Popular (1936): victoria electoral izquierdas → sublevación militar.', topic: 'Segunda República', difficulty: 3 },
    { front: '¿Qué causas desencadenaron la Guerra Civil española (1936)?', back: 'Causas estructurales: desigualdad, caciquismo, conflicto religioso, cuestión territorial. Causas inmediatas: fractura política (izquierda vs derecha), Frente Popular vs CEDA-Falange, sublevación de julio de 1936 liderada por Franco, Mola y otros generales.', topic: 'Guerra Civil', difficulty: 2 },
    { front: 'Fases y resultado de la Guerra Civil española', back: 'Julio 1936: fracaso del golpe → guerra. 1936-37: frentes del Norte y Centro. 1938: batalla del Ebro (decisiva). 1939: caída de Cataluña y fin de la guerra. Victoria del bando nacional. ~500.000 muertos + exilio republicano.', topic: 'Guerra Civil', difficulty: 3 },
    { front: '¿Qué fue el franquismo? Etapas principales.', back: 'Dictadura personal del general Francisco Franco (1939-1975). Etapas: Primer franquismo o autarquía (1939-59), Desarrollismo (1960-69), Tardofranquismo y crisis (1970-75). Apoyos: Ejército, Iglesia, Falange, oligarquía.', topic: 'Franquismo', difficulty: 2 },
    { front: '¿Qué fue el Plan de Estabilización de 1959?', back: 'Plan económico que abandonó la autarquía e introdujo mecanismos de mercado: liberalización del comercio exterior, devaluación peseta, control del déficit. Abrió el período de desarrollo económico de los años 60 (el "Milagro español").', topic: 'Franquismo', difficulty: 3 },
    { front: '¿Qué fue el Desarrollismo de los años 60?', back: 'Crecimiento económico espectacular (industrialización, turismo, emigración). Tecnocracia del Opus Dei con los Planes de Desarrollo. Aparición de una nueva clase media. Persistencia del régimen autoritario.', topic: 'Franquismo', difficulty: 2 },
    { front: '¿Qué fue la Transición española?', back: 'Proceso de cambio de la dictadura a la democracia (1975-1982). Clave: muerte de Franco (1975), rey Juan Carlos I, Adolfo Suárez, Ley para la Reforma Política (1976), Constitución de 1978, 1ª elecciones democráticas (1977).', topic: 'Transición', difficulty: 2 },
    { front: '¿Qué fue la Constitución española de 1978?', back: 'Constitución aprobada en referéndum (diciembre 1978). Establece: monarquía parlamentaria, derechos fundamentales, Estado de las autonomías, separación de poderes, sufragio universal. Elaborada por consenso (padres de la Constitución).', topic: 'Transición', difficulty: 2 },
    { front: '¿Qué fue el 23-F (1981)?', back: 'Intento de golpe de estado. El teniente coronel Tejero asaltó el Congreso de los Diputados. El rey Juan Carlos I intervino en TVE defendiendo la Constitución. El golpe fracasó y reforzó la democracia.', topic: 'Transición', difficulty: 2 },
    { front: '¿Qué fue el Estado de las Autonomías?', back: 'Organización territorial creada por la Constitución de 1978. 17 comunidades autónomas con distintos niveles de competencias (vía rápida art. 151: Cataluña, País Vasco, Galicia, Andalucía; vía lenta art. 143: resto).', topic: 'Transición', difficulty: 2 },
    { front: '¿Qué fue el Estatuto de Autonomía de Andalucía?', back: 'Andalucía siguió la vía rápida (art. 151). Referéndum del 28-F de 1980 no alcanzó los requisitos pero fue interpretado positivamente. Estatuto aprobado en 1981, reformado en 2007.', topic: 'Transición', difficulty: 2 },
    { front: 'Presidentes del gobierno democrático español desde 1977', back: 'Adolfo Suárez (UCD, 1977-81), Leopoldo Calvo-Sotelo (1981-82), Felipe González (PSOE, 1982-96), José María Aznar (PP, 1996-2004), José Luis Rodríguez Zapatero (PSOE, 2004-11), Mariano Rajoy (PP, 2011-18), Pedro Sánchez (PSOE, 2018-).', topic: 'España democrática', difficulty: 3 },
    { front: '¿Qué supuso la entrada de España en la CEE (1986)?', back: 'España ingresó en la Comunidad Económica Europea en 1986, impulsando la modernización, apertura comercial y fondos estructurales. Consolidó la democracia y la integración en Europa occidental.', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue la crisis económica de 2008-2013 en España?', back: 'Consecuencia del estallido de la burbuja inmobiliaria y la crisis financiera global. Desempleo >26%, déficit público, rescate bancario, recortes sociales. El PP ganó con mayoría absoluta en 2011 prometiendo austeridad.', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue la Primera Guerra Mundial y su impacto en España?', back: 'Guerra 1914-18. España fue neutral, lo que benefició su economía (exportaciones). Pero provocó inflación y tensiones sociales. La "crisis de 1917" reunió a militares, obreros y parlamentaristas en protesta.', topic: 'Siglo XX', difficulty: 2 },
    { front: '¿Qué es el caciquismo?', back: 'Práctica política de la Restauración: poder local ejercido por caciques (notables) que controlaban los votos mediante coacción, favores y fraude electoral. Mantenía el turno pacífico entre los partidos dinásticos.', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue el Estatuto de Nüremberg y la política racial nazi? (contexto internacional)', back: 'Leyes raciales de 1935 en Alemania que privaban de derechos a los judíos. Parte del contexto internacional del ascenso de los fascismos que influyó en la polarización política española de los años 30.', topic: 'Contexto internacional', difficulty: 2 },
    { front: '¿Qué fue el Plan Marshall y cómo afectó a España?', back: 'Programa de ayuda económica de EE.UU. a Europa (1948). España fue excluida por su régimen franquista. Esta exclusión contribuyó a la autarquía y al aislamiento internacional de España hasta los pactos con EE.UU. de 1953.', topic: 'Franquismo', difficulty: 2 },
    { front: '¿Qué fue el Movimiento Nacional?', back: 'La única organización política permitida durante el franquismo, creada en 1937 al unificar Falange, Requetés y otras fuerzas del bando sublevado. Controlaba sindicatos, juventudes y medios de comunicación. Disuelto en 1977.', topic: 'Franquismo', difficulty: 2 },
    { front: '¿Qué fue la Falange Española?', back: 'Partido fascista fundado por José Antonio Primo de Rivera en 1933. Ideología: nacionalismo, anticomunismo, corporativismo, Estado totalitario. En 1937 Franco la unificó con los requetés carlistas en FET y las JONS.', topic: 'Segunda República', difficulty: 2 },
    { front: '¿Qué fue el Frente Popular (1936)?', back: 'Coalición de partidos de izquierda (republicanos, socialistas, comunistas) que ganó las elecciones de febrero de 1936. Su victoria fue el detonante inmediato del golpe de julio de 1936 que inició la Guerra Civil.', topic: 'Segunda República', difficulty: 2 },
    { front: 'Causas de la crisis del Antiguo Régimen en España (siglo XIX)', back: 'Incapacidad de la monarquía absoluta, desastre de la Guerra de la Independencia (1808-14), pérdida de las colonias americanas (1824), contradicción entre absolutismo y liberalismo burgués emergente.', topic: 'Siglo XIX', difficulty: 2 },
    { front: '¿Qué fueron las guerras carlistas?', back: 'Conflictos civiles del siglo XIX entre carlistas (absolutistas que apoyaban a Carlos Mª Isidro) y liberales isabelinos. Tres guerras: 1ª (1833-40), 2ª (1846-49), 3ª (1872-76). Fracaso carlista, consolidación del liberalismo.', topic: 'Siglo XIX', difficulty: 2 },
    { front: '¿Qué fue la Revolución industrial en España?', back: 'Llegó tarde y de forma desequilibrada. Cataluña: industria textil (algodón). País Vasco: siderurgia y metalurgia. Andalucía y Asturias: minería. El interior permaneció agrario. Raquitismo del mercado interior.', topic: 'Siglo XIX', difficulty: 2 },
    { front: '¿Qué fue el regeneracionismo?', back: 'Corriente ideológica tras el Desastre del 98 que reclamaba modernizar España ("europeización"): reforma educativa, inversión en infraestructuras, eliminación del caciquismo. Principal representante: Joaquín Costa ("cirujano de hierro").', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue el Partido Socialista Obrero Español (PSOE)?', back: 'Fundado por Pablo Iglesias en 1879. Vinculado a la UGT (sindicato). Defendió los intereses de la clase obrera desde el reformismo socialdemócrata. Durante la República fue el principal partido de izquierda parlamentaria.', topic: 'Siglo XX', difficulty: 2 },
    { front: '¿Qué fue la Ley para la Reforma Política (1976)?', back: 'Aprobada por referéndum en diciembre de 1976 (94% de votos a favor). Propuesta por Adolfo Suárez, permitió convocar elecciones libres y restablecer la democracia sin ruptura. Fue la pieza clave de la Transición.', topic: 'Transición', difficulty: 3 },
    { front: '¿Qué fueron los Pactos de la Moncloa (1977)?', back: 'Acuerdos económicos y políticos firmados por los principales partidos, sindicatos y empresarios en octubre de 1977. Objetivo: contener la inflación y la conflictividad laboral durante la Transición democrática.', topic: 'Transición', difficulty: 2 },
    { front: '¿Qué fue la Operación Anfibio? ¿Y el GRAPO?', back: 'Contexto de violencia de la Transición: ETA (organización vasca independentista) asesinó a Carrero Blanco en 1973. El GRAPO fue un grupo armado de extrema izquierda. Ambas organizaciones pusieron a prueba la democracia naciente.', topic: 'Transición', difficulty: 2 },
    { front: '¿Qué fue la Desamortización en el siglo XIX?', back: 'Proceso de venta de bienes comunales y eclesiásticos por el Estado. Principales: Mendizábal (1836, bienes del clero), Madoz (1855, bienes municipales). Objetivo: financiar el Estado y crear propietarios. No resolvió el problema agrario.', topic: 'Siglo XIX', difficulty: 2 },
    { front: '¿Qué fue la Restauración borbónica de 1874?', back: 'Retorno de los Borbones con Alfonso XII tras el golpe del general Martínez Campos (diciembre 1874). Cánovas del Castillo diseñó el sistema: Constitución de 1876, turno pacífico, sufragio censitario primero y universal (1890) después.', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue la Guerra de Marruecos (1909-1927)?', back: 'Intervención española en el Protectorado de Marruecos. Desastre de Annual (1921): derrota con miles de muertos. Investigación de responsabilidades → crisis política. Resolución final con la colaboración franco-española en Alhucemas (1925).', topic: 'Restauración', difficulty: 2 },
    { front: '¿Qué fue el Pistolerismo y la conflictividad social (1919-23)?', back: 'Período de violencia patronal y anarquista en Barcelona. Pistolerismo: contratación de pistoleros por patronal y sindicatos. Asesinatos políticos (Eduardo Dato, 1921). Crisis de gobernabilidad que facilitó el golpe de Primo de Rivera.', topic: 'Restauración', difficulty: 3 },
    { front: '¿Qué fueron los nacionalismos periféricos en España?', back: 'Movimientos de afirmación nacional en Cataluña (catalanismo: Lliga Regionalista, Mancomunitat), País Vasco (PNV, fundado por Sabino Arana, 1895) y Galicia (Rexurdimento, galleguismo). Demandan autonomía o independencia.', topic: 'Siglo XX', difficulty: 2 },
    { front: '¿Qué fue la represión franquista tras la Guerra Civil?', back: 'Depuración de funcionarios, maestros, militares republicans. Ley de Responsabilidades Políticas (1939). Ejecuciones (estimadas 30.000-50.000 en posguerra). Campos de concentración. Exilio de ~500.000 republicanos.', topic: 'Franquismo', difficulty: 2 },
    { front: '¿Qué fue la autarquía franquista (1939-59)?', back: 'Política de autosuficiencia económica inspirada en el fascismo. Intervención estatal, restricciones al comercio exterior, racionamiento. Fracasó económicamente: hambre, estraperlo, estancamiento. Obligó a cambiar de modelo en 1959.', topic: 'Franquismo', difficulty: 2 },
    { front: 'Los tecnócratas del Opus Dei en el franquismo', back: 'Economistas y técnicos vinculados al Opus Dei que accedieron a puestos clave del gobierno en los años 60 (Ullastres, Navarro Rubio, López Rodó). Impulsaron la apertura económica, los Planes de Desarrollo y el "milagro económico español".', topic: 'Franquismo', difficulty: 3 },
    { front: '¿Qué fue el Proceso de Burgos (1970)?', back: 'Juicio militar a 16 activistas de ETA en Burgos. Penas de muerte que generaron protestas internacionales y en España. Franco conmutó las penas por cadena perpetua, pero el proceso evidenció el desgaste del régimen.', topic: 'Franquismo', difficulty: 3 },
    { front: '¿Qué fue la OTAN y cuándo entró España?', back: 'Organización del Tratado del Atlántico Norte (alianza militar occidental). España ingresó en 1982 (gobierno UCD de Calvo-Sotelo). Referéndum de 1986 (gobierno PSOE, Felipe González) ratificó la permanencia con condiciones.', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue el Estatuto de Autonomía del País Vasco y Cataluña?', back: 'Cataluña: Estatut de Sau (1979). País Vasco: Estatuto de Gernika (1979). Fueron los primeros en aprobarse. Garantizaban lengua, cultura y amplio autogobierno. Cataluña amplió competencias en 2006 (nuevo Estatut).', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue el período de los gobiernos de Felipe González (1982-1996)?', back: 'Primer gobierno socialista. Modernización: entrada en CEE y OTAN, Estado de Bienestar (educación universal, sanidad pública). Casos de corrupción (GAL, Filesa) y aumento del paro → derrota en 1996 frente a Aznar.', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue el 11-M (2004) y su impacto político?', back: 'Atentados terroristas en Madrid (11 marzo 2004, Al-Qaeda, 192 muertos). Ocurrió 3 días antes de las elecciones generales. La gestión informativa del gobierno de Aznar (atribución a ETA) provocó rechazo ciudadano y victoria del PSOE de Zapatero.', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue el proceso independentista catalán (2017)?', back: 'El gobierno catalán convocó un referéndum de independencia el 1-O de 2017 (ilegal). Actuación policial violenta. Declaración unilateral de independencia (DUI). Aplicación del art. 155 CE. Juicio a líderes independentistas.', topic: 'España democrática', difficulty: 2 },
    { front: '¿Qué fue la crisis del sistema de la Restauración (1917-1923)?', back: 'Múltiple crisis en 1917: Juntas militares de defensa (militares contra favoritismos), Asamblea de Parlamentarios (catalanistas + republicanos exigen reforma política), huelga revolucionaria (UGT + CNT). El sistema no se reformó → facilitó la dictadura de 1923.', topic: 'Restauración', difficulty: 3 },
  ],

  lengua: [
    { front: '¿Qué es el comentario de texto? Fases.', back: 'Análisis global de un texto. Fases: 1) Lectura y comprensión. 2) Localización y tema. 3) Resumen/asunto. 4) Estructura. 5) Análisis de la forma (lengua y estilo). 6) Valoración crítica.', topic: 'Comentario de texto', difficulty: 2 },
    { front: 'Tipos de texto según la intención comunicativa', back: 'Narrativo, descriptivo, expositivo, argumentativo, instructivo, literario (poético, dramático). Cada uno tiene rasgos lingüísticos propios.', topic: 'Tipología textual', difficulty: 1 },
    { front: '¿Qué son las propiedades textuales?', back: 'Adecuación (ajuste a la situación comunicativa), coherencia (unidad temática, sentido global), cohesión (mecanismos lingüísticos de conexión: conectores, referencia, elipsis, sustitución, repetición).', topic: 'Propiedades textuales', difficulty: 2 },
    { front: '¿Qué es una metáfora? Ejemplo.', back: 'Figura retórica: identificación de dos realidades por semejanza, suprimiendo el nexo comparativo. Ejemplo: "tus cabellos de oro" (= rubios). Tipo: metáfora pura vs metáfora impura (símil).', topic: 'Figuras retóricas', difficulty: 1 },
    { front: '¿Qué es una hipérbole? Ejemplo.', back: 'Figura que consiste en la exageración expresiva. Ejemplo: "Te lo he dicho mil veces", "Llevo siglos esperándote".', topic: 'Figuras retóricas', difficulty: 1 },
    { front: '¿Qué es un símbolo literario? Ejemplo.', back: 'Imagen concreta que evoca una idea abstracta de forma constante. Ejemplo: en Lorca, la luna simboliza la muerte; el verde, lo vital-erótico; el negro, lo fúnebre.', topic: 'Figuras retóricas', difficulty: 2 },
    { front: '¿Qué es la ironía? ¿Y la antítesis?', back: 'Ironía: decir lo contrario de lo que se piensa, con tono burlesco. Antítesis: contraposición de dos ideas contrarias en la misma frase ("amor es odio, paz es guerra").', topic: 'Figuras retóricas', difficulty: 2 },
    { front: '¿Qué es la anáfora? ¿Y el polisíndeton?', back: 'Anáfora: repetición de palabras al comienzo de versos o frases. Polisíndeton: repetición innecesaria de conjunciones. Ambas crean ritmo y énfasis.', topic: 'Figuras retóricas', difficulty: 2 },
    { front: '¿Qué es el Romanticismo literario? Autores españoles.', back: 'Movimiento literario del siglo XIX. Rasgos: exaltación del yo, sentimientos extremos, libertad, rebeldía, interés por la historia medieval. Autores: Espronceda (El estudiante de Salamanca), Larra (artículos de costumbres), Bécquer (Rimas).', topic: 'Movimientos literarios', difficulty: 2 },
    { front: '¿Qué es el Realismo literario? Autores.', back: 'Corriente del siglo XIX: representación fiel de la realidad social. Técnica: narrador omnisciente, descripción detallada, personajes de clase media. Autores: Galdós (Fortunata y Jacinta), Clarín (La Regenta), Pardo Bazán.', topic: 'Movimientos literarios', difficulty: 2 },
    { front: '¿Qué fue el Modernismo y la Generación del 98?', back: 'Modernismo: renovación estética, musicalidad, exotismo (Rubén Darío). Generación del 98: escritores que reflexionan sobre España tras el Desastre del 98 (Unamuno, Azorín, Baroja, Valle-Inclán, Machado).', topic: 'Movimientos literarios', difficulty: 2 },
    { front: '¿Qué es el Novecentismo (Generación del 14)?', back: 'Intelectuales que propugnan rigor, europeísmo y renovación cultural. Ortega y Gasset (La deshumanización del arte), Pérez de Ayala, Juan Ramón Jiménez (poesía pura).', topic: 'Movimientos literarios', difficulty: 2 },
    { front: 'Generación del 27: rasgos y autores', back: 'Generación de poetas que combinan vanguardia y tradición clásica. Autores: García Lorca (Romancero gitano), Alberti, Aleixandre (Premio Nobel), Cernuda, Salinas, Guillén, Hernández. Referente: Góngora.', topic: 'Movimientos literarios', difficulty: 2 },
    { front: 'La narrativa de posguerra española (1940-60)', back: 'Dos corrientes: tremendismo (La familia de Pascual Duarte, Cela) y novela existencial (Nada, Carmen Laforet). Luego novela social (El Jarama, Sánchez Ferlosio). Censura franquista condicionó la literatura.', topic: 'Narrativa española', difficulty: 2 },
    { front: 'La novela española de los años 60-70: renovación formal', back: 'Influencia de nouveau roman y Faulkner. Tiempo en silencio (Martín Santos, 1962): quiebre en la narrativa. Experimentalismo: monólogo interior, perspectivas múltiples, elipsis. Juan Goytisolo, Juan Marsé.', topic: 'Narrativa española', difficulty: 3 },
    { front: '¿Qué es el teatro del absurdo? Autores españoles relacionados.', back: 'Teatro que refleja la incomunicación y sinsentido de la existencia humana (Ionesco, Beckett). En España: Arrabal. Esperpento valleinclanesco antecede esta estética.', topic: 'Teatro español', difficulty: 2 },
    { front: '¿Qué es el esperpento de Valle-Inclán?', back: 'Técnica teatral que deforma sistemáticamente la realidad (como un espejo cóncavo) para mostrar la tragedia española de modo grotesco. Obra: Luces de Bohemia (1920). Personaje: Max Estrella.', topic: 'Teatro español', difficulty: 2 },
    { front: 'Teatro de Federico García Lorca: obras y temas', back: 'Trilogía de la tierra: Bodas de sangre, Yerma, La casa de Bernarda Alba. Temas: frustración, represión social, enfrentamiento libertad-norma, destino trágico de la mujer. Lenguaje poético, simbolismo.', topic: 'Teatro español', difficulty: 2 },
    { front: '¿Qué es el texto argumentativo? Estructura.', back: 'Texto que defiende una tesis mediante argumentos. Estructura: Tesis (idea principal) + Cuerpo argumentativo (argumentos: datos, ejemplos, autoridades, causas) + Conclusión. El periodismo de opinión y ensayo son géneros argumentativos.', topic: 'Tipología textual', difficulty: 2 },
    { front: '¿Qué son los conectores textuales? Tipos.', back: 'Elementos de cohesión que relacionan ideas. Tipos: aditivos (además, asimismo), adversativos (pero, sin embargo), causales (porque, ya que), consecutivos (por tanto, en consecuencia), temporales (después, a continuación).', topic: 'Propiedades textuales', difficulty: 2 },
    { front: '¿Qué es la poesía social de posguerra? Autores.', back: 'Poesía de los años 40-50 comprometida con la realidad social de España. Blas de Otero (Pido la paz y la palabra), Gabriel Celaya (Cantos íberos). Reacción al garcilasismo esteticista y la poesía arraigada.', topic: 'Poesía española', difficulty: 2 },
    { front: '¿Qué es la deixis? Tipos.', back: 'Mecanismo deíctico: elementos que señalan personas, lugares o tiempos en el acto de habla. Deixis personal: pronombres (yo, tú). Deixis espacial: adverbios (aquí, allí). Deixis temporal: (ahora, ayer).', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué son los géneros periodísticos? Tipos.', back: 'Formas de expresión en prensa. Informativos: noticia, reportaje, crónica. De opinión: editorial, artículo, columna, crítica. Géneros mixtos: entrevista. Rasgo: función informativa vs valorativa.', topic: 'Géneros discursivos', difficulty: 2 },
    { front: 'Recursos morfosintácticos del texto argumentativo', back: 'Primera persona (implicación del autor), oraciones enunciativas y exclamativas, conectores lógicos, subjuntivo (expresar deseos/dudas), nominalizaciones, subordinadas causales y concesivas, citas de autoridad.', topic: 'Comentario de texto', difficulty: 2 },
    { front: '¿Qué es el léxico connotativo vs denotativo?', back: 'Denotativo: significado objetivo y literal de la palabra (diccionario). Connotativo: significados subjetivos, emotivos o culturales asociados. La literatura usa intensamente el léxico connotativo para crear efectos expresivos.', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué es la elipsis? ¿Y la sustitución?', back: 'Elipsis: omisión de elementos que se sobreentienden del contexto ("Juan llegó tarde y María, también [llegó tarde]"). Sustitución: reemplazar un elemento por un pronombre o sinónimo para evitar repetición.', topic: 'Propiedades textuales', difficulty: 2 },
    { front: '¿Qué es el asíndeton? ¿Y el epíteto?', back: 'Asíndeton: supresión de conjunciones para dar rapidez ("llegué, vi, vencí"). Epíteto: adjetivo que expresa una cualidad inherente al sustantivo, con función estética ("blanca nieve", "negro carbón").', topic: 'Figuras retóricas', difficulty: 2 },
    { front: 'La lírica de Miguel Hernández: temas y obras', back: 'Poeta del 27 de raíces populares. Perito en lunas (gongorismo), El rayo que no cesa (sonetos amorosos, influencia de Quevedo), Cancionero y romancero de ausencias (escrito en la cárcel, temas: amor, guerra, muerte).', topic: 'Poesía española', difficulty: 2 },
    { front: '¿Qué es la novela picaresca? Lazarillo de Tormes.', back: 'Género narrativo del Siglo de Oro. Protagonista: pícaro (antihéroe de bajo origen social), narración autobiográfica, crítica social. Lazarillo de Tormes (1554, anónimo): primer ejemplo del género.', topic: 'Narrativa española', difficulty: 2 },
    { front: 'Don Quijote de la Mancha: autor, temas, importancia.', back: 'Miguel de Cervantes (1605/1615). Parodia de novelas de caballería. Temas: ilusión vs realidad, identidad, locura. Considerada la primera novela moderna. Primera obra narrativa con ironía y perspectivas múltiples.', topic: 'Narrativa española', difficulty: 1 },
    { front: '¿Qué es el Barroco literario español? Rasgos y autores.', back: 'Siglo XVII. Rasgos: pesimismo, desengaño, conceptismo (Quevedo: agudeza conceptual) y culteranismo/gongorismo (Góngora: lenguaje oscuro y latinizante). Autores: Lope de Vega, Calderón de la Barca (teatro).', topic: 'Movimientos literarios', difficulty: 2 },
    { front: 'La Generación del 27: año que los une y características.', back: 'Se reunieron en Sevilla en 1927 para el tricentenario de Góngora. Mezclan tradición (romancero, Góngora, canción popular) con vanguardia (surrealismo, creacionismo). Ruptura en 1936 por la Guerra Civil.', topic: 'Movimientos literarios', difficulty: 2 },
    { front: '¿Qué es el Vanguardismo? Movimientos en España.', back: 'Movimientos artísticos de ruptura del siglo XX. En España: ultraísmo (1918, influencia cubista-futurista) y creacionismo (Vicente Huidobro). La vanguardia surrealista influyó en Lorca, Alberti y Aleixandre.', topic: 'Movimientos literarios', difficulty: 2 },
    { front: 'La poesía de Antonio Machado: etapas y temas.', back: 'Generación del 98. Etapas: Soledades, galerías y otros poemas (intimismo, simbolismo); Campos de Castilla (Castilla como tema, crítica social). Temas: tiempo, muerte, Dios, España, recuerdo. Estilo: sencillo y filosófico.', topic: 'Poesía española', difficulty: 2 },
    { front: '¿Qué es el stream of consciousness (monólogo interior)?', back: 'Técnica narrativa del siglo XX: representación del fluir del pensamiento del personaje sin filtro lógico ni cronológico. Influencia de Joyce y Faulkner. En España: usada por Martín Santos y la novela experimental de los 60.', topic: 'Narrativa española', difficulty: 2 },
    { front: 'La novela hispanoamericana del boom (siglo XX)', back: 'Narrativa latinoamericana de los años 60-70 de impacto mundial. Realismo mágico (García Márquez: Cien años de soledad), experimentalismo (Vargas Llosa, Cortázar, Fuentes). Influyó en la narrativa española.', topic: 'Narrativa española', difficulty: 2 },
    { front: '¿Qué es un texto expositivo? Rasgos lingüísticos.', back: 'Texto que explica o informa objetivamente sobre un tema. Rasgos: tercera persona o impersonal, léxico técnico/especializado, subordinadas causales y consecutivas, oraciones enunciativas, conectores explicativos (es decir, esto es, o sea).', topic: 'Tipología textual', difficulty: 2 },
    { front: '¿Qué es el nivel pragmático del análisis lingüístico?', back: 'Estudio del uso del lenguaje en contexto comunicativo. Incluye: intención comunicativa, presuposiciones, implicaturas, actos de habla (directivos, declarativos, expresivos, etc.). Complementa el análisis morfosintáctico y semántico.', topic: 'Lingüística del texto', difficulty: 3 },
    { front: '¿Qué es el registro lingüístico?', back: 'Variedad de la lengua condicionada por el contexto comunicativo. Formal (uso culto, sin contracciones, léxico preciso) vs informal (coloquial, elipsis, frases hechas). La adecuación textual implica usar el registro apropiado.', topic: 'Lingüística del texto', difficulty: 1 },
    { front: '¿Qué es la perífrasis verbal? Tipos.', back: 'Construcción verbal formada por verbo auxiliar + infinitivo/gerundio/participio. Aspectuales: ir a + infinitivo (inminencia), estar + gerundio (acción en curso), llevar + participio (acción terminada). Modales: deber + infinitivo (obligación).', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué es la silepsis? ¿Y el hipérbaton?', back: 'Silepsis: concordancia por significado, no por forma ("La gente gritaban"). Hipérbaton: alteración del orden normal de los elementos oracionales por efecto estético ("De su propio destino era dueño"). Frecuente en poesía barroca.', topic: 'Figuras retóricas', difficulty: 2 },
    { front: 'El teatro del siglo XVII: Lope de Vega y Calderón', back: 'Lope de Vega: crea la comedia nacional española (mezcla lo trágico y lo cómico, tres actos, polimetría). Calderón de la Barca: teatro filosófico y conceptual. La vida es sueño (libre albedrío vs destino). El alcalde de Zalamea.', topic: 'Teatro español', difficulty: 2 },
    { front: '¿Qué es la voz narrativa? Tipos de narrador.', back: 'Tipo de narrador según la persona: omnisciente (3ª persona, todo lo sabe), protagonista (1ª persona, perspectiva subjetiva), testigo (1ª persona que observa pero no es protagonista), múltiple (varias voces). Afecta al punto de vista y la fiabilidad.', topic: 'Narrativa española', difficulty: 2 },
    { front: 'La lírica medieval española: géneros', back: 'Jarchas: primeras manifestaciones líricas en mozárabe (s. XI). Cantigas de amor y amigo: lírica galaico-portuguesa (s. XIII). Poesía castellana: Romancero (romances épico-líricos), Coplas de Jorge Manrique (elegía).', topic: 'Movimientos literarios', difficulty: 2 },
    { front: 'La narrativa medieval: El Libro del Buen Amor', back: 'Juan Ruiz, Arcipreste de Hita (s. XIV). Obra miscelánea: parodia de amor cortés, fábulas, debates, crítica social. Ambigüedad interpretativa: ¿enseña a amar o a evitarlo? Obra clave de la literatura medieval castellana.', topic: 'Narrativa española', difficulty: 2 },
    { front: '¿Qué es la función poética del lenguaje?', back: 'Según Jakobson, la función poética centra el mensaje en sí mismo (forma del mensaje). Se manifiesta en: ritmo, metro, rima, figuras retóricas, paralelismos. Es la función dominante en la literatura, aunque convive con otras funciones.', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué es el monema? Tipos.', back: 'Unidad mínima con significado. Lexema (raíz): parte que aporta significado léxico (cant- en cantar). Morfema: aporta significado gramatical. Morfemas flexivos: número, género, persona, tiempo (cant-aba-mos). Morfemas derivativos: prefijos y sufijos que cambian significado.', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué son los actos de habla?', back: 'Teoría de Austin/Searle: cada enunciado realiza una acción. Acto locutivo (lo que se dice), ilocutivo (la intención: afirmar, preguntar, ordenar, prometer) y perlocutivo (el efecto en el oyente). Relevante para el análisis pragmático de textos.', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué es el Modernismo en Hispanoamérica? Rubén Darío.', back: 'Movimiento literario de finales del XIX. Influencia del parnasianismo y simbolismo francés. Rubén Darío (nicaragüense): Azul (1888), Prosas profanas. Rasgos: musicalidad, exotismo, riqueza léxica, cisnes, princesas, evasión de la realidad burguesa.', topic: 'Movimientos literarios', difficulty: 2 },
    { front: '¿Qué es la oración compuesta? Tipos de subordinación.', back: 'Oración con varias proposiciones. Coordinación: unidas por conjunciones (y, pero, o). Subordinación: una proposición depende de otra. Tipos: sustantiva (función de sustantivo), adjetiva/relativa (modifica un sustantivo), adverbial (tiempo, causa, condición, concesión).', topic: 'Lingüística del texto', difficulty: 2 },
    { front: '¿Qué es la sátira literaria? Autores en España.', back: 'Texto que critica vicios y defectos humanos/sociales con humor e ironía. En la literatura española: Quevedo (sátiras en prosa y verso), Larra (artículos de costumbres: "Vuelva usted mañana"), Valle-Inclán (esperpento).', topic: 'Géneros discursivos', difficulty: 2 },
  ],

  ingles: [
    { front: 'Present Perfect vs Past Simple', back: 'Present Perfect (have/has + past participle): connects past to present, with "ever, never, already, just, yet, since, for". Past Simple: completed action at a specific past time (yesterday, in 1990, last week).', topic: 'Grammar', difficulty: 2 },
    { front: 'Modal verbs: uses', back: 'Can/could (ability, permission). May/might (possibility). Must/have to (obligation). Should/ought to (advice). Would (conditional, polite requests). Needn\'t / don\'t have to (lack of obligation). Mustn\'t (prohibition).', topic: 'Grammar', difficulty: 2 },
    { front: 'Conditional sentences: types', back: 'Type 0: general truth (If you heat water, it boils). Type 1: real future (If it rains, I\'ll stay). Type 2: hypothetical present (If I had money, I would travel). Type 3: unreal past (If I had studied, I would have passed).', topic: 'Grammar', difficulty: 2 },
    { front: 'Reported speech: key changes', back: 'Tense shifts: present → past, past simple → past perfect, will → would, can → could. Pronoun and time/place changes: now → then, today → that day, here → there, this → that, yesterday → the day before.', topic: 'Grammar', difficulty: 2 },
    { front: 'Passive voice: formation', back: 'Subject + be (conjugated) + past participle. Active: "They built the bridge." Passive: "The bridge was built." Use: when agent is unknown, unimportant, or to give prominence to the object.', topic: 'Grammar', difficulty: 2 },
    { front: 'Relative clauses: defining vs non-defining', back: 'Defining (no commas): identifies which one ("The book that I read..."). Non-defining (commas): adds extra info ("My brother, who lives in London,..."). Note: in non-defining, "that" cannot be used.', topic: 'Grammar', difficulty: 2 },
    { front: 'Key connectors for EBAU essays', back: 'Addition: furthermore, in addition, moreover. Contrast: however, nevertheless, although, despite. Cause: because, due to, since. Result: therefore, consequently. Exemplification: for example, such as. Conclusion: in conclusion, to sum up.', topic: 'Writing', difficulty: 2 },
    { front: 'How to write a for-and-against essay', back: 'Introduction (topic + thesis). Body para 1: arguments for (with examples). Body para 2: arguments against (with examples). Conclusion: balanced summary + personal opinion. Use formal language, connectors, topic sentences.', topic: 'Writing', difficulty: 2 },
    { front: 'Letter writing: formal vs informal', back: 'Formal: Dear Mr./Ms. + surname, full sentences, formal vocabulary, Yours sincerely/faithfully. Informal: Dear + first name, contractions, colloquial language, Best wishes/Love. EBAU often asks for a formal letter or email.', topic: 'Writing', difficulty: 2 },
    { front: 'Key vocabulary: environment', back: 'Climate change, global warming, greenhouse gases, carbon footprint, renewable energy, deforestation, biodiversity, sustainable development, recycling, pollution (air/water/noise), endangered species.', topic: 'Vocabulary', difficulty: 1 },
    { front: 'Key vocabulary: technology and social media', back: 'Artificial intelligence, social networking, cyberbullying, digital divide, privacy, data protection, online shopping, influencer, algorithm, fake news, streaming, app, virtual reality.', topic: 'Vocabulary', difficulty: 1 },
    { front: 'Key vocabulary: health and lifestyle', back: 'Mental health, well-being, obesity, junk food, sedentary lifestyle, work-life balance, stress, anxiety, gym, fitness, vaccination, public healthcare, healthy habits.', topic: 'Vocabulary', difficulty: 1 },
    { front: 'Reading comprehension strategy', back: '1. Skim for gist (main idea). 2. Read questions carefully. 3. Scan for specific information. 4. Pay attention to paraphrasing (answers rarely use exact words from the text). 5. Eliminate clearly wrong options in multiple-choice.', topic: 'Reading', difficulty: 1 },
    { front: 'Gerunds vs Infinitives: key verbs', back: 'Gerund after: enjoy, avoid, finish, consider, keep, mind, suggest, recommend, deny. Infinitive after: want, hope, decide, plan, promise, agree, manage, afford, seem. Both (different meaning): remember, forget, stop, try.', topic: 'Grammar', difficulty: 2 },
    { front: 'Question tags: formation', back: 'Positive statement → negative tag. Negative statement → positive tag. Use same auxiliary as in the main clause. Examples: "She is coming, isn\'t she?", "They didn\'t call, did they?", "You\'d like some, wouldn\'t you?"', topic: 'Grammar', difficulty: 2 },
    { front: 'Key vocabulary: education and work', back: 'Gap year, distance learning, higher education, degree, scholarship, internship, unemployment, minimum wage, job interview, CV/résumé, remote work, freelance, career prospects.', topic: 'Vocabulary', difficulty: 1 },
    { front: 'Phrasal verbs: common examples', back: 'Give up (dejar), carry out (realizar), turn down (rechazar), look after (cuidar), find out (descubrir), get over (superar), come across (encontrar), put off (posponer), set up (establecer), bring up (criar/mencionar).', topic: 'Vocabulary', difficulty: 2 },
    { front: 'How to summarise a text (EBAU)', back: 'Read the whole text first. Identify main ideas (one per paragraph). Write in own words — paraphrase. Keep it brief (one third of original). Avoid copying sentences. Do NOT include your opinion.', topic: 'Reading', difficulty: 2 },
    { front: 'Narrative tenses: past simple, past continuous, past perfect', back: 'Past simple: main events (She left). Past continuous: background action (It was raining). Past perfect: action before another past action (He had finished before she arrived). These three tenses are used together in storytelling.', topic: 'Grammar', difficulty: 2 },
    { front: 'Key vocabulary: society and culture', back: 'Immigration, integration, discrimination, gender equality, multiculturalism, poverty, inequality, volunteering, NGO, human rights, social media influence, cultural identity.', topic: 'Vocabulary', difficulty: 1 },
    { front: 'Articles: a/an vs the vs zero article', back: 'A/an: first mention, one of many (a book). The: specific, already mentioned, unique (the Moon). Zero article: generalizations with plural/uncountable (Dogs are loyal), proper nouns (Spain), meals, languages.', topic: 'Grammar', difficulty: 2 },
    { front: 'Prepositions of time: at, in, on', back: 'At: precise time (at 5 pm), holiday period (at Christmas). In: months/seasons/years (in July, in 2024), parts of day (in the morning). On: specific days/dates (on Monday, on 3rd March).', topic: 'Grammar', difficulty: 1 },
    { front: 'Future tenses: will, going to, present continuous', back: 'Will: spontaneous decision or prediction ("I\'ll help you", "It will rain"). Going to: plan or evidence ("I\'m going to travel", "Look, it\'s going to rain"). Present continuous: arranged future ("I\'m meeting Tom tomorrow").', topic: 'Grammar', difficulty: 2 },
    { front: 'Adjective order in noun phrases', back: 'Opinion → Size → Age → Shape → Colour → Origin → Material → Purpose + Noun. Example: "a beautiful small old round blue French silver cooking pot". In practice, max 3-4 adjectives are typical.', topic: 'Grammar', difficulty: 2 },
    { front: 'Comparative and superlative adjectives', back: 'Short adj: -er / -est (faster, fastest). Long adj: more/most (more beautiful). Irregular: good/better/best, bad/worse/worst, far/farther/farthest. As...as (equality). Less...than (inferiority).', topic: 'Grammar', difficulty: 1 },
    { front: 'Countable vs uncountable nouns', back: 'Countable: a book, two books. Uncountable: water, information, advice, news, money, furniture, luggage. With uncountable: some/any/much/a little (NOT many/a few/a number of). A piece of information. An item of news.', topic: 'Grammar', difficulty: 2 },
    { front: 'Key vocabulary: science and research', back: 'Experiment, hypothesis, evidence, findings, breakthrough, innovation, genetic engineering, nanotechnology, stem cells, clinical trial, peer review, scientific consensus, funding, ethical implications.', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Key vocabulary: politics and global issues', back: 'Democracy, dictatorship, election, referendum, policy, legislation, human rights, conflict resolution, refugee, asylum seeker, sanctions, diplomacy, international relations, United Nations, globalisation.', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Discourse markers for speaking/writing fluency', back: 'To begin: First of all, To start with. To add: Moreover, In addition, Besides. To contrast: On the other hand, In contrast. To conclude: All in all, To sum up, In conclusion. To exemplify: For instance, Such as.', topic: 'Writing', difficulty: 2 },
    { front: 'Expressing opinion in formal writing', back: 'In my opinion/view, I believe/think/consider that, It seems to me that, I would argue that, It can be argued that. In academic writing: evidence suggests that, research shows that. Avoid "I think" in formal essays.', topic: 'Writing', difficulty: 2 },
    { front: 'Spelling rules: -ing and -ed forms', back: '-ing: double consonant after short vowel + single consonant (running, sitting). Drop final -e before -ing (making). -ed: double consonant (planned, stopped). Irregular past: know/knew/known, take/took/taken.', topic: 'Grammar', difficulty: 1 },
    { front: 'Confusing word pairs', back: 'Affect (verb) / Effect (noun). Advice (noun) / Advise (verb). Accept / Except. Lose / Loose. Its (possessive) / It\'s (it is). Their / There / They\'re. Principle / Principal. Compliment / Complement.', topic: 'Vocabulary', difficulty: 2 },
    { front: 'False friends: English-Spanish', back: 'Actually = en realidad (≠ actualmente). Eventually = finalmente (≠ eventualmente). Sensible = sensato (≠ sensible). Library = biblioteca (≠ librería). Embarrassed = avergonzado (≠ embarazada). Sympathetic = comprensivo (≠ simpático).', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Prepositional phrases: common collocations', back: 'Interested in, good at, different from, depend on, responsible for, aware of, similar to, satisfied with, afraid of, benefit from, result in, consist of, refer to, accuse of, congratulate on.', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Discourse coherence: pronouns and reference', back: 'Pronouns (he, she, it, they, this, that, these, those) refer back to previously mentioned nouns or ideas. Synonyms and paraphrases avoid repetition. Cohesive devices: the former/the latter, the former option, as mentioned above.', topic: 'Reading', difficulty: 2 },
    { front: 'Cambridge-style EBAU text: key structure', back: 'EBAU reading texts are typically journalistic or academic (300-400 words). Tasks: true/false with justification, gap-filling, vocabulary in context, or summary. Read whole text first. Justify T/F answers with a quote from the text.', topic: 'Reading', difficulty: 2 },
    { front: 'Idiomatic expressions: common ones in EBAU texts', back: 'Take for granted (dar por sentado), get rid of (deshacerse de), look forward to (tener ganas de), make up for (compensar), come up with (ocurrírsele), deal with (lidiar con), come across (encontrar), carry out (llevar a cabo).', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Cohesion devices in English texts', back: 'Reference: personal pronouns, demonstratives. Substitution: one(s), do/does/did. Ellipsis: omission of repeated elements. Conjunction: and, but, because, although. Lexical cohesion: repetition, synonym, antonym, collocation.', topic: 'Writing', difficulty: 2 },
    { front: 'How to write an opinion essay (EBAU format)', back: 'Para 1: Introduction - hook + background + thesis. Para 2: First argument + example. Para 3: Counterargument + rebuttal. Para 4: Second argument + example. Para 5: Conclusion - restate thesis + final thought. 180-220 words.', topic: 'Writing', difficulty: 2 },
    { front: 'Uses of "have": auxiliary, main verb, causative', back: 'Auxiliary: I have finished. Main verb: I have a car. Causative have: "I had my hair cut" (someone else did it). "Have to" = obligation. "Have got" = possession (informal). "Have had" = present perfect of "have".', topic: 'Grammar', difficulty: 2 },
    { front: 'EBAU Inglés: texto de comprensión (Writing B)', back: 'Second writing task in EBAU Andalucía: usually "Write about..." or "What do you think about...". 120-150 words. Use an essay structure, include your opinion, use varied connectors, check grammar/spelling. Time: ~15 minutes.', topic: 'Writing', difficulty: 2 },
    { front: 'Describing graphs and trends (academic English)', back: 'Rise/increase/go up. Fall/decrease/drop/decline. Remain steady/stable. Peak at (máximo). Reach a low of (mínimo). Fluctuate. Adverbs: dramatically, significantly, slightly, gradually, sharply.', topic: 'Writing', difficulty: 2 },
    { front: 'Sentence transformations: key patterns', back: 'Active→Passive: "They made errors" → "Errors were made". Direct→Reported: "He said, I am tired" → "He said he was tired". Conditional paraphrase: "Unless you study, you won\'t pass" = "If you don\'t study, you won\'t pass".', topic: 'Grammar', difficulty: 2 },
    { front: 'British vs American English: key differences', back: 'Vocab: lift/elevator, flat/apartment, autumn/fall, biscuit/cookie, football/soccer. Spelling: colour/color, organise/organize, centre/center. Grammar: in British English, "have got" is common; in American, "have" alone.', topic: 'Vocabulary', difficulty: 1 },
    { front: 'Idioms related to time', back: 'Once in a blue moon (raramente). In the nick of time (justo a tiempo). Hit the deadline (cumplir el plazo). Around the clock (24 horas). Time flies (el tiempo vuela). Better late than never. Run out of time (quedarse sin tiempo).', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Intensifiers and hedges in English', back: 'Intensifiers: absolutely, definitely, certainly, extremely, highly, totally. Hedges (for uncertainty): apparently, supposedly, it seems, might, could, tends to, generally, in many cases. EBAU essays benefit from hedging academic claims.', topic: 'Writing', difficulty: 2 },
    { front: 'Word formation: prefixes and suffixes', back: 'Prefixes: un- (unhappy), re- (redo), pre- (preview), mis- (misunderstand), over- (overdo). Suffixes: -tion (action), -ness (happiness), -ful (beautiful), -less (hopeless), -ment (achievement), -ity (creativity), -ous (famous).', topic: 'Vocabulary', difficulty: 2 },
    { front: 'Zero and first conditionals: uses', back: 'Zero: general truths, scientific facts (If you add salt to ice, it melts). First: likely future situations (If it rains tomorrow, I\'ll stay in). Both use simple tenses. Contrast with second/third for hypothetical/unreal situations.', topic: 'Grammar', difficulty: 1 },
    { front: 'Complex sentences: subordinate clauses', back: 'Noun clause: I think that she is right. Relative clause: The man who called is my father. Adverbial clause: Although it was late, she kept working. Participle clause: Having finished the exam, he left. These enrich essay writing.', topic: 'Grammar', difficulty: 2 },
    { front: 'Quantifiers: much, many, a lot, few, little', back: 'Much + uncountable (much water). Many + countable (many books). A lot of / lots of = both. A few / few + countable (a few friends = some; few = very little). A little / little + uncountable (a little hope = some; little = very little).', topic: 'Grammar', difficulty: 2 },
    { front: 'Subject-verb agreement: special cases', back: 'Collective nouns (team, family): singular or plural in British English. Either/neither/each/every + singular verb. None = singular or plural. "The news is" / "The police are". "One of + plural noun" → singular verb.', topic: 'Grammar', difficulty: 2 },
  ],

  matematicas: [
    // Álgebra
    { front: '¿Qué es una matriz? Operaciones básicas.', back: 'Tabla rectangular de números ordenados en filas y columnas. Operaciones: suma (mismas dimensiones), multiplicación escalar, producto de matrices (número de columnas de A = filas de B), traspuesta, determinante, inversa.', topic: 'Álgebra lineal', difficulty: 1 },
    { front: '¿Cómo se calcula el determinante de una matriz 2×2?', back: 'Para A = [[a,b],[c,d]]: det(A) = ad - bc. Para 3×3: regla de Sarrus o desarrollo por una fila/columna usando menores y cofactores.', topic: 'Álgebra lineal', difficulty: 2 },
    { front: '¿Cómo se calcula la matriz inversa?', back: 'A⁻¹ = (1/det(A)) · adj(A)ᵀ. Condición: det(A) ≠ 0 (matriz regular). Método alternativo para sistemas: por filas (Gauss-Jordan).', topic: 'Álgebra lineal', difficulty: 2 },
    { front: 'Sistemas de ecuaciones: método de Gauss y regla de Cramer', back: 'Gauss: escalonamiento de la matriz ampliada. Cramer: xᵢ = det(Aᵢ)/det(A), solo si det(A) ≠ 0. Clasificación (Rouché-Frobenius): rang(A) = rang(A|b) = n → compatible determinado, < n → indeterminado, ≠ → incompatible.', topic: 'Álgebra lineal', difficulty: 3 },
    { front: '¿Qué es un determinante y para qué sirve?', back: 'Número asociado a una matriz cuadrada. Sirve para: conocer si la matriz es invertible (det ≠ 0), resolver sistemas (Cramer), calcular áreas y volúmenes, transformaciones geométricas.', topic: 'Álgebra lineal', difficulty: 2 },
    // Cálculo
    { front: 'Definición de límite de una función', back: 'lim(x→a) f(x) = L si f(x) se acerca a L cuando x se acerca a a, independientemente del camino. El límite existe si y solo si los límites laterales (izquierdo y derecho) son iguales.', topic: 'Análisis', difficulty: 2 },
    { front: 'Definición de derivada', back: 'f\'(a) = lim(h→0) [f(a+h)-f(a)]/h. Representa la pendiente de la tangente a la curva en x=a y la tasa de cambio instantánea.', topic: 'Análisis', difficulty: 2 },
    { front: 'Reglas de derivación: producto, cociente, cadena', back: 'Producto: (fg)\' = f\'g + fg\'. Cociente: (f/g)\' = (f\'g - fg\')/g². Cadena: [f(g(x))]\' = f\'(g(x))·g\'(x).', topic: 'Análisis', difficulty: 2 },
    { front: '¿Qué son los extremos relativos? ¿Cómo se calculan?', back: 'Máximo relativo: f\'(a)=0 y f\'\'(a)<0. Mínimo relativo: f\'(a)=0 y f\'\'(a)>0. Método: 1) f\'(x)=0 → puntos críticos. 2) f\'\'(x) en cada punto crítico o análisis del signo de f\'.', topic: 'Análisis', difficulty: 2 },
    { front: '¿Qué es la integral definida? Teorema fundamental del cálculo.', back: 'La integral definida ∫ₐᵇ f(x)dx representa el área bajo la curva entre a y b. T.F.C.: ∫ₐᵇ f(x)dx = F(b) - F(a), donde F es una primitiva de f.', topic: 'Análisis', difficulty: 2 },
    { front: 'Fórmulas de integración más usadas en EBAU', back: '∫xⁿdx = xⁿ⁺¹/(n+1)+C (n≠-1). ∫eˣdx = eˣ+C. ∫(1/x)dx = ln|x|+C. ∫sin(x)dx = -cos(x)+C. ∫cos(x)dx = sin(x)+C. ∫kf(x)dx = k∫f(x)dx.', topic: 'Análisis', difficulty: 2 },
    // Geometría
    { front: 'Operaciones con vectores: producto escalar', back: 'u·v = |u||v|cos(θ) = u₁v₁ + u₂v₂ + u₃v₃. Si u·v = 0 → vectores perpendiculares. Módulo: |u| = √(u₁² + u₂² + u₃²).', topic: 'Geometría', difficulty: 2 },
    { front: 'Ecuación de la recta en el plano: formas', back: 'Explícita: y = mx + n. Implícita: ax + by + c = 0. Vectorial: (x,y) = (x₀,y₀) + t(d₁,d₂). Paramétrica: x = x₀+td₁, y = y₀+td₂. Pendiente: m = (y₂-y₁)/(x₂-x₁).', topic: 'Geometría', difficulty: 2 },
    { front: 'Distancias en geometría analítica', back: 'Entre dos puntos: d = √[(x₂-x₁)²+(y₂-y₁)²]. De un punto a una recta ax+by+c=0: d = |ax₀+by₀+c|/√(a²+b²). Punto medio: M = ((x₁+x₂)/2, (y₁+y₂)/2).', topic: 'Geometría', difficulty: 2 },
    { front: '¿Qué es el producto vectorial?', back: 'u × v = determinante de la matriz formada por los vectores i,j,k en la primera fila y las componentes de u y v. Es perpendicular a u y v. |u×v| = área del paralelogramo que forman u y v.', topic: 'Geometría', difficulty: 3 },
    // Estadística
    { front: 'Parámetros estadísticos de centralización', back: 'Media aritmética: x̄ = Σxᵢfᵢ/n. Mediana: valor que deja el 50% por encima y 50% por debajo. Moda: valor de mayor frecuencia absoluta.', topic: 'Estadística', difficulty: 1 },
    { front: 'Parámetros estadísticos de dispersión', back: 'Varianza: s² = Σfᵢ(xᵢ-x̄)²/n. Desviación típica: s = √s². Coeficiente de variación: CV = s/x̄ (compara dispersiones de distintas distribuciones).', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la distribución normal? Propiedades.', back: 'Distribución simétrica en forma de campana centrada en µ con desviación típica σ. Propiedades: el 68% de datos está en [µ-σ, µ+σ], 95% en [µ-2σ, µ+2σ], 99.7% en [µ-3σ, µ+3σ]. Se tipifica: Z = (X-µ)/σ.', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la recta de regresión? ¿Para qué sirve?', back: 'Recta que mejor ajusta la nube de puntos (mínimos cuadrados). y sobre x: y = a + bx donde b = Σ(xᵢ-x̄)(yᵢ-ȳ)/Σ(xᵢ-x̄)². Se usa para predicciones. Bondad del ajuste: r² (coef. determinación).', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la probabilidad? Regla de Laplace.', back: 'Medida de la verosimilitud de un suceso. Regla de Laplace (equiprobabilidad): P(A) = casos favorables / casos posibles. Axiomas de Kolmogorov: 0 ≤ P(A) ≤ 1, P(Ω)=1, P(A∪B)=P(A)+P(B) si A∩B=∅.', topic: 'Probabilidad', difficulty: 1 },
    { front: '¿Qué es la probabilidad condicionada y la independencia?', back: 'P(A|B) = P(A∩B)/P(B). Sucesos independientes: P(A∩B) = P(A)·P(B). Teorema de Bayes: P(Aᵢ|B) = P(Aᵢ)·P(B|Aᵢ) / ΣP(Aⱼ)·P(B|Aⱼ).', topic: 'Probabilidad', difficulty: 3 },
    { front: '¿Qué es la distribución binomial?', back: 'X ~ B(n, p): n ensayos independientes, probabilidad p de éxito. P(X=k) = C(n,k)·pᵏ·(1-p)ⁿ⁻ᵏ. Media: µ = np. Varianza: σ² = np(1-p). Se aproxima a N cuando n grande.', topic: 'Probabilidad', difficulty: 2 },
    { front: 'Continuidad de una función: condiciones', back: 'f es continua en x=a si: 1) f(a) existe. 2) lim(x→a) f(x) existe. 3) lim(x→a) f(x) = f(a). Si se rompe alguna condición → discontinuidad (evitable, salto, asintótica).', topic: 'Análisis', difficulty: 2 },
    { front: 'Regla de L\'Hôpital', back: 'Para límites de forma 0/0 o ∞/∞: lim f(x)/g(x) = lim f\'(x)/g\'(x). Aplicable repetidamente si la indeterminación persiste.', topic: 'Análisis', difficulty: 2 },
    { front: 'Área entre dos curvas', back: '∫ₐᵇ |f(x) - g(x)| dx, donde f(x) ≥ g(x) en [a,b]. Si se cruzan, dividir en subintervalos. Importante: calcular la integral con valor absoluto o dividir en dos partes.', topic: 'Análisis', difficulty: 3 },
    { front: 'Teorema del valor medio de Lagrange', back: 'Si f es continua en [a,b] y derivable en (a,b), existe c ∈ (a,b) tal que f\'(c) = [f(b)-f(a)]/(b-a). Interpretación: la pendiente media de la secante es igual a la pendiente de la tangente en algún punto interior.', topic: 'Análisis', difficulty: 3 },
    { front: '¿Qué es un número complejo? Formas de expresarlo.', back: 'z = a + bi donde a,b ∈ ℝ y i² = -1. Parte real: a. Parte imaginaria: b. Módulo: |z| = √(a²+b²). Argumento: θ = arctan(b/a). Forma polar: z = |z|(cosθ + i·sinθ). Forma exponencial: z = |z|·eⁱθ.', topic: 'Números complejos', difficulty: 2 },
    { front: 'Operaciones con números complejos', back: 'Suma: (a+bi)+(c+di) = (a+c)+(b+d)i. Producto: (a+bi)(c+di) = (ac-bd)+(ad+bc)i. Conjugado: ā = a-bi. División: z₁/z₂ = z₁·z̄₂/|z₂|². Módulo del producto: |z₁·z₂| = |z₁|·|z₂|.', topic: 'Números complejos', difficulty: 2 },
    { front: 'Cómo calcular la ecuación de la recta tangente', back: 'Tangente a y = f(x) en x = a: y - f(a) = f\'(a)(x - a). Pendiente = f\'(a). Normal (perpendicular a la tangente): y - f(a) = -1/f\'(a) · (x-a) (si f\'(a) ≠ 0).', topic: 'Análisis', difficulty: 2 },
    { front: '¿Qué son las sucesiones? Tipos principales.', back: 'Sucesión: lista ordenada de números. Tipos: aritmética (razón constante d), geométrica (razón constante q), recurrente (aₙ depende de términos anteriores). Convergente: tiene límite finito; divergente: el límite es ±∞.', topic: 'Análisis', difficulty: 1 },
    { front: 'Método de integración por partes', back: '∫u·dv = u·v - ∫v·du. Elegir u y dv: LIATE (Logarítmica, Inversa trigon., Algebraica, Trigonométrica, Exponencial — u es la primera que aparezca). Ejemplo: ∫x·eˣdx con u=x, dv=eˣdx.', topic: 'Análisis', difficulty: 3 },
    { front: 'Progresiones aritméticas: fórmulas', back: 'aₙ = a₁ + (n-1)d. Suma: Sₙ = n(a₁+aₙ)/2 = n[2a₁+(n-1)d]/2. Media aritmética: a_m = (a_(m-1)+a_(m+1))/2 (el término central es la media de sus vecinos).', topic: 'Álgebra', difficulty: 1 },
    { front: 'Recta en el espacio: formas vectorial, paramétrica, simétrica', back: 'Vectorial: r = P + t·d. Paramétrica: x=x₀+td₁, y=y₀+td₂, z=z₀+td₃. Simétrica: (x-x₀)/d₁ = (y-y₀)/d₂ = (z-z₀)/d₃. El vector director d = (d₁,d₂,d₃) define la dirección.', topic: 'Geometría', difficulty: 2 },
    { front: 'Ecuación del plano en el espacio', back: 'Ecuación general: ax + by + cz + d = 0, donde (a,b,c) es el vector normal. Si pasa por P₀ y tiene normal n: n·(P-P₀) = 0. Plano determinado por 3 puntos no alineados o por 2 rectas que se cortan.', topic: 'Geometría', difficulty: 2 },
    { front: 'Posiciones relativas de rectas y planos en el espacio', back: 'Dos rectas: paralelas (vectores proporcionales), coincidentes, secantes (un punto en común), cruzadas (no paralelas, no se cortan). Recta-plano: paralela, secante, contenida. Dos planos: paralelos, coincidentes, secantes (forman una recta).', topic: 'Geometría', difficulty: 2 },
    { front: 'Cónicas: tipos y ecuaciones canónicas', back: 'Circunferencia: x²+y²=r². Elipse: x²/a²+y²/b²=1. Hipérbola: x²/a²-y²/b²=1 (o al revés). Parábola: y²=4px o x²=4py. Cada cónica se obtiene cortando un cono con un plano en diferente ángulo.', topic: 'Geometría', difficulty: 2 },
    { front: 'Matrices: propiedades de la inversa', back: '(A⁻¹)⁻¹ = A. (AB)⁻¹ = B⁻¹A⁻¹. (Aᵀ)⁻¹ = (A⁻¹)ᵀ. det(A⁻¹) = 1/det(A). La inversa solo existe si det(A) ≠ 0 (matriz regular/no singular).', topic: 'Álgebra lineal', difficulty: 2 },
    { front: 'Teorema de Bolzano', back: 'Si f es continua en [a,b] y f(a)·f(b) < 0 (signos opuestos), entonces existe c ∈ (a,b) tal que f(c) = 0. Aplicación: demostrar la existencia de raíces (ceros) de funciones continuas.', topic: 'Análisis', difficulty: 2 },
    { front: 'Tabla de derivadas básicas', back: '(xⁿ)\' = nxⁿ⁻¹. (eˣ)\' = eˣ. (ln x)\' = 1/x. (sin x)\' = cos x. (cos x)\' = -sin x. (tan x)\' = sec²x = 1+tan²x. (aˣ)\' = aˣ·ln a. (arctan x)\' = 1/(1+x²). (arcsin x)\' = 1/√(1-x²).', topic: 'Análisis', difficulty: 2 },
    { front: 'Propiedades de los logaritmos', back: 'log(ab) = log a + log b. log(a/b) = log a - log b. log(aⁿ) = n·log a. log_b a = log a / log b (cambio de base). log_b b = 1. log_b 1 = 0. Estos se aplican para resolver ecuaciones logarítmicas y exponenciales.', topic: 'Álgebra', difficulty: 1 },
    { front: '¿Qué son las funciones trigonométricas? Valores notables.', back: 'sin, cos, tan, cot, sec, csc. Valores: sin 0°=0, sin 30°=1/2, sin 45°=√2/2, sin 60°=√3/2, sin 90°=1. cos 0°=1, cos 30°=√3/2, cos 45°=√2/2, cos 60°=1/2, cos 90°=0. tan 45°=1.', topic: 'Trigonometría', difficulty: 2 },
    { front: 'Identidades trigonométricas fundamentales', back: 'sin²x + cos²x = 1. 1 + tan²x = sec²x. sin(a±b) = sin a·cos b ± cos a·sin b. cos(a±b) = cos a·cos b ∓ sin a·sin b. sin(2a) = 2·sin a·cos a. cos(2a) = cos²a - sin²a.', topic: 'Trigonometría', difficulty: 2 },
    { front: 'Problemas de optimización con derivadas', back: 'Pasos: 1) Definir la variable a optimizar y la restricción. 2) Expresar la función a optimizar en términos de una sola variable. 3) Derivar e igualar a 0. 4) Verificar si es máximo o mínimo con f\'\'.', topic: 'Análisis', difficulty: 3 },
    { front: 'Resolución de ecuaciones exponenciales', back: 'aˣ = b → x = log_a b = ln b / ln a. Ecuaciones del tipo e²ˣ - 3eˣ + 2 = 0: sustituir t = eˣ → cuadrática en t. Siempre verificar que la solución dé base positiva.', topic: 'Álgebra', difficulty: 2 },
    { front: 'Resolución de inecuaciones cuadráticas', back: 'ax²+bx+c > 0: calcular raíces, el paraboloide es positivo fuera del intervalo [r₁,r₂] (si a>0). ax²+bx+c < 0: positivo dentro del intervalo (r₁,r₂). Si no tiene raíces reales: siempre positivo (a>0) o siempre negativo (a<0).', topic: 'Álgebra', difficulty: 2 },
    { front: '¿Qué es la interpolación estadística?', back: 'Método para estimar el valor de una variable dentro del rango de datos conocidos. Interpolación lineal: y = y₁ + (y₂-y₁)·(x-x₁)/(x₂-x₁). La extrapolación (fuera del rango) es menos fiable.', topic: 'Estadística', difficulty: 2 },
    { front: 'Determinante de una matriz 3×3: desarrollo por la primera fila', back: 'det(A) = a₁₁·C₁₁ + a₁₂·C₁₂ + a₁₃·C₁₃, donde Cᵢⱼ = (-1)^(i+j)·Mᵢⱼ (cofactor) y Mᵢⱼ es el menor (determinante de la submatriz sin la fila i y columna j). Regla de Sarrus como alternativa.', topic: 'Álgebra lineal', difficulty: 2 },
    { front: '¿Qué es la función inversa? ¿Cómo se calcula?', back: 'f⁻¹ existe si f es biyectiva. Para calcular: 1) Escribir y = f(x). 2) Despejar x en términos de y. 3) Intercambiar x e y → f⁻¹(x). Dom(f⁻¹) = Im(f). La gráfica de f⁻¹ es la reflexión de f respecto a y = x.', topic: 'Análisis', difficulty: 2 },
    { front: '¿Qué son los números irracionales? Ejemplos.', back: 'Números reales que no pueden expresarse como fracción p/q (p,q enteros, q≠0). Ejemplos: √2, √3, π, e. Tienen decimales infinitos no periódicos. Junto con los racionales forman los números reales ℝ.', topic: 'Álgebra', difficulty: 1 },
    { front: '¿Qué es la función valor absoluto? Propiedades.', back: '|x| = x si x≥0; -x si x<0. Propiedades: |x|≥0, |x·y|=|x|·|y|, |x/y|=|x|/|y|, |x+y|≤|x|+|y| (desigualdad triangular). Gráfica: V con vértice en (0,0). Para resolver |f(x)|=k: f(x)=k o f(x)=-k.', topic: 'Álgebra', difficulty: 2 },
  ],

  'mates-sociales': [
    // Álgebra
    { front: '¿Qué es una matriz? Tipos especiales.', back: 'Tabla de números en filas y columnas. Tipos: matriz cuadrada (n×n), identidad (I), nula (ceros), triangular (superior/inferior), simétrica (A = Aᵀ), antisimétrica (A = -Aᵀ).', topic: 'Álgebra lineal', difficulty: 1 },
    { front: 'Propiedades del producto de matrices', back: 'No conmutativo: AB ≠ BA (generalmente). Asociativo: (AB)C = A(BC). Distributivo: A(B+C) = AB+AC. Traspuesta del producto: (AB)ᵀ = BᵀAᵀ.', topic: 'Álgebra lineal', difficulty: 2 },
    { front: 'Regla de Cramer para sistemas de ecuaciones', back: 'Si det(A) ≠ 0: xᵢ = det(Aᵢ)/det(A), donde Aᵢ es la matriz A con la columna i sustituida por los términos independientes.', topic: 'Álgebra lineal', difficulty: 2 },
    { front: 'Discusión de sistemas: teorema de Rouché-Frobenius', back: 'rang(A) = rang(A|b) = n → Compatible Determinado (solución única). rang(A) = rang(A|b) < n → Compatible Indeterminado (infinitas soluciones). rang(A) ≠ rang(A|b) → Incompatible.', topic: 'Álgebra lineal', difficulty: 2 },
    // Funciones y análisis
    { front: 'Dominio de funciones: fracciones y raíces', back: 'Función racional f(x)=P(x)/Q(x): Dom = ℝ - {zeros de Q}. Función con raíz cuadrada √f(x): Dom = {x: f(x) ≥ 0}. Con logaritmo ln(f(x)): Dom = {x: f(x) > 0}.', topic: 'Funciones', difficulty: 1 },
    { front: 'Asíntotas de una función', back: 'Vertical: x=a si lim(x→a±) f(x) = ±∞. Horizontal: y=L si lim(x→±∞) f(x) = L. Oblicua: y=mx+n si m = lim f(x)/x y n = lim [f(x)-mx] cuando x→±∞.', topic: 'Funciones', difficulty: 2 },
    { front: 'Derivada y monotonía de una función', back: 'f creciente donde f\' > 0, decreciente donde f\' < 0. Máximos/mínimos: f\'=0 y cambio de signo de f\'. Punto de inflexión: f\'\'=0 y cambio de signo de f\'\'.', topic: 'Funciones', difficulty: 2 },
    { front: '¿Qué es la integral definida aplicada a economía?', back: '∫ₐᵇ f(x)dx = área bajo la curva entre a y b. Excedente del consumidor: área entre la curva de demanda y el precio de equilibrio. Excedente del productor: área entre precio de equilibrio y la curva de oferta.', topic: 'Funciones', difficulty: 3 },
    // Estadística bidimensional
    { front: '¿Qué es la correlación lineal?', back: 'Mide la fuerza y dirección de la relación lineal entre dos variables. Coeficiente de correlación: r = Sxy/(Sx·Sy), con -1 ≤ r ≤ 1. |r| cercano a 1 → fuerte correlación; cercano a 0 → sin correlación.', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la recta de regresión de y sobre x?', back: 'y = ȳ + (Sxy/Sx²)(x - x̄), donde Sxy = covarianza, Sx² = varianza de x. Permite predecir y dado x. El coeficiente de determinación r² indica el % de variabilidad de y explicado por x.', topic: 'Estadística', difficulty: 2 },
    { front: 'Parámetros estadísticos: media, varianza, desviación típica', back: 'Media: x̄ = Σxᵢfᵢ/n. Varianza: s² = Σfᵢ(xᵢ-x̄)²/n = media de x² - x̄². Desviación típica: s = √s². Coef. variación: s/x̄.', topic: 'Estadística', difficulty: 1 },
    { front: '¿Qué es una distribución de frecuencias? Tipos de frecuencias.', back: 'Tabla que organiza datos estadísticos. Frecuencia absoluta (nᵢ): nº de veces que aparece cada valor. Frecuencia relativa (fᵢ = nᵢ/n). Frecuencia acumulada (Nᵢ o Fᵢ): suma de frecuencias anteriores.', topic: 'Estadística', difficulty: 1 },
    // Probabilidad
    { front: '¿Qué es la distribución normal? Tipificación.', back: 'Distribución continua, simétrica, con forma de campana. Caracterizada por µ (media) y σ (desv. típica). Tipificación: Z = (X-µ)/σ → N(0,1). Se usa la tabla de la normal estándar para calcular probabilidades.', topic: 'Probabilidad', difficulty: 2 },
    { front: '¿Qué es la distribución binomial? Cuándo se usa.', back: 'X ~ B(n,p): n ensayos Bernoulli independientes, prob. éxito p. P(X=k) = C(n,k)pᵏ(1-p)ⁿ⁻ᵏ. Media: np. Varianza: np(1-p). Se aproxima a N cuando n≥30 y np≥5.', topic: 'Probabilidad', difficulty: 2 },
    { front: 'Probabilidad: axiomas y propiedades', back: 'P(Ω)=1, 0≤P(A)≤1. P(Aᶜ) = 1-P(A). P(A∪B) = P(A)+P(B)-P(A∩B). Si A y B incompatibles: P(A∪B)=P(A)+P(B). Regla de Laplace: P = favorables/posibles.', topic: 'Probabilidad', difficulty: 1 },
    { front: 'Probabilidad condicionada y teorema de Bayes', back: 'P(A|B) = P(A∩B)/P(B). Teorema total: P(B) = ΣP(Aᵢ)·P(B|Aᵢ). Bayes: P(Aᵢ|B) = P(Aᵢ)·P(B|Aᵢ) / P(B). Útil para actualizar probabilidades con nueva información.', topic: 'Probabilidad', difficulty: 3 },
    { front: '¿Qué son las combinaciones y permutaciones?', back: 'Permutaciones sin repetición: P(n,r) = n!/(n-r)!. Con repetición: nʳ. Combinaciones sin repetición: C(n,r) = n!/[r!(n-r)!]. Con repetición: C(n+r-1, r). El factorial: n! = n·(n-1)···2·1.', topic: 'Probabilidad', difficulty: 2 },
    // Economía aplicada
    { front: '¿Qué es el interés simple e interés compuesto?', back: 'Interés simple: I = C·r·t, Cn = C(1+rt). Interés compuesto: Cn = C(1+r)ⁿ. El interés compuesto capitaliza los intereses generados (se suman al capital).', topic: 'Matemática financiera', difficulty: 2 },
    { front: '¿Qué es una progresión aritmética?', back: 'Sucesión en la que cada término se obtiene sumando una razón constante d. Término general: aₙ = a₁ + (n-1)d. Suma de n términos: Sₙ = n(a₁+aₙ)/2.', topic: 'Sucesiones', difficulty: 1 },
    { front: '¿Qué es una progresión geométrica?', back: 'Sucesión en la que cada término se obtiene multiplicando por una razón constante q. Término general: aₙ = a₁·qⁿ⁻¹. Suma de n términos: Sₙ = a₁(qⁿ-1)/(q-1) (q≠1).', topic: 'Sucesiones', difficulty: 2 },
    { front: 'Inecuaciones lineales y sistemas', back: 'Resolver ax + b > 0: mismas operaciones que ecuaciones, pero al multiplicar/dividir por número negativo se invierte el signo. Sistema de inecuaciones en dos variables: región del plano (intersección de semiplanos).', topic: 'Álgebra lineal', difficulty: 2 },
    { front: '¿Qué es el excedente del consumidor?', back: 'Diferencia entre lo que un consumidor estaría dispuesto a pagar y lo que realmente paga. Gráficamente: área entre la curva de demanda y el precio de mercado. Cálculo: ∫₀^q D(q)dq - p·q.', topic: 'Funciones', difficulty: 3 },
    { front: '¿Qué es la función de demanda? Elasticidad.', back: 'Función que relaciona el precio con la cantidad demandada (pendiente negativa). Elasticidad-precio: ε = (ΔQ/Q)/(ΔP/P). ε < -1: elástica (variación precio afecta mucho). -1 < ε < 0: inelástica. ε = -1: unitaria.', topic: 'Funciones', difficulty: 3 },
    { front: 'Integrales por descomposición en fracciones simples', back: 'Para ∫P(x)/Q(x)dx donde grado P < grado Q: descomponer Q en factores y escribir la fracción como suma de fracciones simples con coeficientes A, B, C... Determinar los coeficientes igualando numeradores.', topic: 'Funciones', difficulty: 3 },
    { front: 'Función exponencial y logarítmica: propiedades', back: 'f(x)=aˣ: creciente si a>1, decreciente si 0<a<1. Pasa siempre por (0,1). f(x)=log_a(x): inversa de la exponencial. Dominio: x>0. Asíntota vertical en x=0. Pasa por (1,0). ln x = log_e x.', topic: 'Funciones', difficulty: 2 },
    { front: '¿Cómo se calcula la moda en datos agrupados?', back: 'Clase modal: la de mayor frecuencia absoluta. Moda = Li + [(ni - ni-1)/((ni - ni-1) + (ni - ni+1))] · a, donde Li es límite inferior, ni la frecuencia de la clase modal, a la amplitud.', topic: 'Estadística', difficulty: 3 },
    { front: '¿Cómo se calcula la mediana en datos agrupados?', back: 'Localizar la clase que contiene la mediana (donde la frecuencia acumulada supera n/2). Mediana = Li + [(n/2 - Ni-1)/ni] · a, donde Ni-1 es la frecuencia acumulada anterior y a la amplitud del intervalo.', topic: 'Estadística', difficulty: 3 },
    { front: 'Coeficiente de correlación de Pearson: interpretación', back: 'r = Sxy/(Sx·Sy). r = 1: correlación lineal positiva perfecta. r = -1: negativa perfecta. r = 0: sin correlación lineal (puede existir otra). |r| > 0.8: correlación fuerte. 0.5-0.8: moderada. < 0.5: débil.', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué son los números índice? ¿Para qué sirven?', back: 'Medidas estadísticas que expresan el cambio relativo de una magnitud respecto a un período base. Índice de precios al consumo (IPC): mide la inflación. Índice de Laspeyres vs Paasche (diferente ponderación).', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la programación lineal?', back: 'Optimizar (maximizar/minimizar) una función objetivo lineal sujeta a restricciones lineales (inecuaciones). Método gráfico (2 variables): región factible (poliedro), el óptimo está en un vértice. Aplicaciones: producción, logística.', topic: 'Álgebra lineal', difficulty: 3 },
    { front: '¿Qué es una variable aleatoria discreta vs continua?', back: 'Discreta: toma valores aislados (ej. nº cara dados). Continua: toma valores en un intervalo (ej. peso, temperatura). Discreta usa tabla de probabilidades; continua usa función de densidad f(x) con ∫f(x)dx = 1.', topic: 'Probabilidad', difficulty: 2 },
    { front: 'Distribución normal tipificada N(0,1): uso de tablas', back: 'Para X ~ N(µ,σ), tipificar: Z = (X-µ)/σ ~ N(0,1). Usar tabla de la normal para P(Z < z). P(Z > z) = 1 - P(Z < z). P(a < Z < b) = P(Z < b) - P(Z < a). Simetría: P(Z < -z) = P(Z > z).', topic: 'Probabilidad', difficulty: 2 },
    { front: '¿Qué son los sucesos excluyentes e incompatibles?', back: 'Sucesos mutuamente excluyentes (incompatibles): A∩B = ∅ → P(A∪B) = P(A)+P(B). Sucesos complementarios: P(Aᶜ) = 1-P(A). Sucesos independientes: P(A∩B) = P(A)·P(B) (ocurrencia de A no afecta a P(B)).', topic: 'Probabilidad', difficulty: 2 },
    { front: 'Matemática financiera: descuento comercial', back: 'Descuento simple: D = N·d·t, donde N = nominal, d = tasa, t = tiempo. Efectivo: E = N - D = N(1-dt). Tasa efectiva anual (TAE): relaciona el tipo nominal con la capitalización real. Útil para comparar productos financieros.', topic: 'Matemática financiera', difficulty: 2 },
    { front: '¿Qué es una anualidad?', back: 'Serie de pagos o cobros iguales en períodos regulares. Anualidad ordinaria (pagos al final del período) vs anticipada (al inicio). Valor actual: VA = a·[1-(1+i)⁻ⁿ]/i. Valor futuro: VF = a·[(1+i)ⁿ-1]/i.', topic: 'Matemática financiera', difficulty: 3 },
    { front: '¿Cómo se calcula el rango en estadística?', back: 'Rango = valor máximo - valor mínimo. Es la medida de dispersión más sencilla pero muy sensible a valores extremos (atípicos). Para datos agrupados: rango = límite superior del último intervalo - límite inferior del primero.', topic: 'Estadística', difficulty: 1 },
    { front: 'Tabla de frecuencias: construcción', back: 'Para datos cuantitativos continuos: 1) Determinar nº de clases (Regla de Sturges: k ≈ 1+3.32·log n). 2) Calcular amplitud: a = rango/k. 3) Construir intervalos, contar frecuencias absolutas, calcular relativas y acumuladas.', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la varianza? ¿Cómo se calcula en datos agrupados?', back: 's² = Σfᵢ(xᵢ-x̄)²/n. Fórmula equivalente: s² = Σfᵢxᵢ²/n - x̄². En datos agrupados, xᵢ es la marca de clase (punto medio del intervalo). La desviación típica es s = √s².', topic: 'Estadística', difficulty: 2 },
    { front: 'Criterio de la segunda derivada para extremos', back: 'Si f\'(a)=0: f\'\'(a)<0 → máximo local. f\'\'(a)>0 → mínimo local. f\'\'(a)=0 → no concluyente (analizar signo de f\'). Si f\'\'(a)=0 y f\'\'\' ≠ 0 → punto de inflexión.', topic: 'Funciones', difficulty: 2 },
    { front: '¿Qué es la covarianza?', back: 'Sxy = Σfᵢⱼ(xᵢ-x̄)(yⱼ-ȳ)/(n) = Σfᵢⱼxᵢyⱼ/n - x̄·ȳ. Mide la relación lineal entre dos variables. Sxy > 0: relación directa. Sxy < 0: inversa. Sxy = 0: sin relación lineal (pero puede haber no lineal).', topic: 'Estadística', difficulty: 2 },
    { front: 'Sistema de inecuaciones: programación lineal básica', back: 'Pasos: 1) Definir variables. 2) Formular función objetivo (maximizar/minimizar). 3) Plantear restricciones como inecuaciones. 4) Graficar región factible. 5) Evaluar función objetivo en los vértices. El óptimo es el mayor/menor valor.', topic: 'Álgebra lineal', difficulty: 3 },
    { front: '¿Qué es la proporción muestral? ¿Y el intervalo de confianza?', back: 'Proporción muestral: p̂ = x/n. IC para proporción: p̂ ± z_(α/2)·√[p̂(1-p̂)/n]. IC para media (σ conocida): x̄ ± z_(α/2)·σ/√n. Para IC 95%: z = 1.96. Para 99%: z = 2.58.', topic: 'Estadística', difficulty: 3 },
    { front: '¿Qué es la tasa de variación media? ¿Y la instantánea?', back: 'Tasa media en [a,b]: [f(b)-f(a)]/(b-a) = pendiente de la secante. Tasa instantánea en x=a: f\'(a) = pendiente de la tangente. Aplicaciones en economía: coste marginal (derivada del coste total).', topic: 'Funciones', difficulty: 2 },
    { front: '¿Qué es el beneficio económico? Cálculo con derivadas.', back: 'Beneficio B(q) = Ingresos I(q) - Costes C(q). Máximo beneficio: B\'(q)=0 → I\'(q)=C\'(q) (ingreso marginal = coste marginal). Verificar con B\'\'(q)<0. Umbral rentabilidad: B(q)=0.', topic: 'Funciones', difficulty: 3 },
    { front: '¿Qué es la función de distribución acumulada F(x)?', back: 'F(x) = P(X ≤ x). Para discreta: F(x) = Σ P(X=xᵢ) para xᵢ≤x. Para continua: F(x) = ∫_{-∞}^x f(t)dt. Propiedades: F no decreciente, F(-∞)=0, F(+∞)=1, P(a<X≤b)=F(b)-F(a).', topic: 'Probabilidad', difficulty: 3 },
    { front: '¿Qué son los cuartiles y la caja de bigotes?', back: 'Q1 (25%), Q2 = mediana (50%), Q3 (75%). IQR = Q3-Q1 (rango intercuartílico). Diagrama de caja y bigotes: muestra Q1, Q2, Q3, mínimo y máximo. Valores atípicos: fuera de [Q1-1.5·IQR, Q3+1.5·IQR].', topic: 'Estadística', difficulty: 2 },
    { front: '¿Qué es la función creciente/decreciente? Criterio.', back: 'f creciente en I si: para todo x₁<x₂ en I, f(x₁)<f(x₂). Criterio diferencial: si f\'(x)>0 en I → f creciente; si f\'(x)<0 → decreciente. La función puede ser creciente sin ser derivable (ej. |x| en x=0).', topic: 'Funciones', difficulty: 2 },
    { front: '¿Qué es la interpolación y la extrapolación?', back: 'Interpolación: estimar valores dentro del rango de datos conocidos usando la recta de regresión y=a+bx. Más fiable. Extrapolación: estimar fuera del rango, menos fiable. Para una x dada, sustituir en la recta de regresión.', topic: 'Estadística', difficulty: 2 },
    { front: 'Función de densidad de probabilidad continua: propiedades', back: 'f(x) ≥ 0. ∫_{-∞}^∞ f(x)dx = 1. P(a<X<b) = ∫_a^b f(x)dx. P(X=c)=0 para cualquier valor c (la probabilidad de un punto es 0 en distribuciones continuas). Media: µ = ∫x·f(x)dx.', topic: 'Probabilidad', difficulty: 3 },
    { front: '¿Qué es la moda ponderada vs moda de datos agrupados?', back: 'Para datos simples: valor con mayor frecuencia absoluta. Para datos agrupados: usar la fórmula de la clase modal. Si hay dos modas: distribución bimodal. La moda es la única medida de centralización aplicable a datos cualitativos.', topic: 'Estadística', difficulty: 2 },
  ],

  quimica: [
    // Enlace químico
    { front: '¿Qué es el enlace iónico? Propiedades.', back: 'Atracción electrostática entre iones de cargas opuestas. Se forma entre metales (dan electrones, catión) y no metales (reciben, anión). Propiedades: alto punto de fusión/ebullición, solubles en agua, conductores en disolución.', topic: 'Enlace químico', difficulty: 1 },
    { front: '¿Qué es el enlace covalente? Tipos.', back: 'Compartición de pares de electrones entre dos átomos. Simple (un par), doble (dos pares), triple (tres pares). Puede ser polar (electronegatividades diferentes) o apolar (misma electronegatividad). Covalente coordinado/dativo: ambos electrones del enlace los aporta el mismo átomo.', topic: 'Enlace químico', difficulty: 2 },
    { front: '¿Qué es el enlace metálico?', back: 'En metales: electrones deslocalizados ("mar de electrones") que rodean los cationes metálicos en red. Explica: maleabilidad, ductilidad, conductividad eléctrica y térmica, brillo metálico.', topic: 'Enlace químico', difficulty: 2 },
    { front: '¿Qué es la electronegatividad? ¿Afecta al enlace?', back: 'Tendencia de un átomo a atraer electrones del enlace. Aumenta hacia la derecha y hacia arriba en la tabla periódica. Si la diferencia de electronegatividad > 1.7 → iónico; < 0.4 → apolar; 0.4-1.7 → polar.', topic: 'Enlace químico', difficulty: 2 },
    { front: '¿Qué son las fuerzas intermoleculares?', back: 'Interacciones entre moléculas: puentes de hidrógeno (H-F, H-O, H-N; más fuertes), dipolo-dipolo (moléculas polares), fuerzas de London (dispersion; presentes en todas las moléculas, más fuertes cuanto mayor la masa molar).', topic: 'Enlace químico', difficulty: 2 },
    // Reacciones
    { front: '¿Qué es el ajuste de una reacción química? Métodos.', back: 'Balancear la ecuación para que el número de átomos de cada elemento sea igual en reactivos y productos (conservación de la masa). Métodos: tanteo (prueba y error) y redox (cambio de número de oxidación).', topic: 'Reacciones químicas', difficulty: 1 },
    { front: '¿Qué es el concepto de mol? Ley de Avogadro.', back: 'Mol: cantidad de sustancia que contiene 6.022×10²³ partículas (Nº Avogadro). 1 mol de cualquier gas a condiciones normales (0°C, 1 atm) ocupa 22.4 L (ley de Avogadro: volúmenes iguales de gases a igual T y P tienen el mismo nº de partículas).', topic: 'Reacciones químicas', difficulty: 1 },
    { front: 'Estequiometría: cálculos de moles y masas', back: 'Pasos: 1) Ajustar la ecuación. 2) Convertir datos a moles (masa/M molar). 3) Usar proporciones molares de la ecuación ajustada. 4) Convertir moles del producto a la magnitud pedida.', topic: 'Reacciones químicas', difficulty: 2 },
    { front: '¿Qué son las reacciones redox? ¿Cómo identificarlas?', back: 'Reacciones con transferencia de electrones. Oxidación: pérdida de electrones (aumento del nº oxidación). Reducción: ganancia de electrones (disminución). Agente oxidante: se reduce. Agente reductor: se oxida.', topic: 'Reacciones redox', difficulty: 2 },
    // Termodinámica
    { front: '¿Qué es la entalpía de reacción (ΔH)?', back: 'Calor intercambiado a presión constante. ΔH < 0 → reacción exotérmica (desprende calor). ΔH > 0 → reacción endotérmica (absorbe calor). Ley de Hess: ΔH de una reacción es igual a la suma de los ΔH de las etapas individuales.', topic: 'Termodinámica', difficulty: 2 },
    { front: '¿Qué es la entropía (ΔS) y la energía de Gibbs (ΔG)?', back: 'Entropía: medida del desorden del sistema. ΔG = ΔH - TΔS. Espontaneidad: ΔG < 0 → espontánea; ΔG > 0 → no espontánea; ΔG = 0 → equilibrio.', topic: 'Termodinámica', difficulty: 3 },
    // Equilibrio químico
    { front: '¿Qué es la constante de equilibrio (Kc)?', back: 'Para aA + bB ⇌ cC + dD: Kc = [C]ᶜ[D]ᵈ / [A]ᵃ[B]ᵇ. Kc grande → equilibrio desplazado hacia productos. Kc pequeña → hacia reactivos. Kc depende de la temperatura.', topic: 'Equilibrio químico', difficulty: 2 },
    { front: 'Principio de Le Chatelier', back: 'Si se perturba un sistema en equilibrio, este se desplazará en la dirección que minimize la perturbación. Perturbaciones: aumento de reactivos → desplaza a productos; aumento T → favorece reacción endotérmica; aumento P → favorece el lado con menos moles de gas.', topic: 'Equilibrio químico', difficulty: 2 },
    // Ácido-base
    { front: '¿Qué es un ácido y una base? Teorías: Arrhenius, Brønsted-Lowry.', back: 'Arrhenius: ácido produce H⁺ en agua, base produce OH⁻. Brønsted-Lowry: ácido cede protones (H⁺), base los acepta. Par conjugado: ácido-base que difieren en un H⁺.', topic: 'Ácido-base', difficulty: 2 },
    { front: '¿Qué es el pH? ¿Cómo se calcula?', back: 'pH = -log[H₃O⁺]. Escala: 0-14. pH<7: ácido. pH=7: neutro. pH>7: básico. Agua pura: Kw = [H⁺][OH⁻] = 10⁻¹⁴ a 25°C → pH+pOH=14.', topic: 'Ácido-base', difficulty: 2 },
    // Química orgánica
    { front: '¿Qué es la isomería? Tipos principales.', back: 'Compuestos con misma fórmula molecular pero diferente estructura. Isomería estructural: cadena (diferente ramificación), posición (diferente posición del grupo funcional), función (diferente grupo funcional). Estereoisomería: espacial (cis-trans, óptica).', topic: 'Química orgánica', difficulty: 2 },
    { front: '¿Qué son los grupos funcionales? Ejemplos.', back: 'Grupos de átomos que determinan las propiedades del compuesto. Ejemplos: -OH (alcohol), -CHO (aldehído), -CO- (cetona), -COOH (ácido carboxílico), -COO- (éster), -NH₂ (amina), -CO-NH- (amida).', topic: 'Química orgánica', difficulty: 2 },
    { front: '¿Qué es la reacción de sustitución nucleófila? ¿Y la eliminación?', back: 'Sustitución: un nucleófilo (anión o molécula con par libre) reemplaza a un grupo saliente (SN1, SN2). Eliminación: formación de un doble enlace por pérdida de HX (E1, E2). Condiciones determinan cuál domina.', topic: 'Química orgánica', difficulty: 3 },
    { front: '¿Qué son los hidrocarburos? Tipos y nomenclatura.', back: 'Compuestos de C e H. Alcanos (C-C simple, -ano), alquenos (C=C, -eno), alquinos (C≡C, -ino), aromáticos (anillo bencénico). Nomenclatura IUPAC: cadena principal + prefijo numérico + sufijo del grupo funcional.', topic: 'Química orgánica', difficulty: 2 },
    { front: '¿Qué es la saponificación?', back: 'Hidrólisis básica de un éster para obtener alcohol + sal del ácido carboxílico (jabón). Triglicérido + NaOH → glicerina + jabón (sales de ácidos grasos). Base de la fabricación de jabones.', topic: 'Química orgánica', difficulty: 2 },
    // Cinética
    { front: '¿Qué es la cinética química? Factores que afectan la velocidad.', back: 'Estudio de la velocidad de las reacciones. Factores: concentración (más reactivos → más colisiones), temperatura (más energía cinética → más colisiones eficaces, regla de van\'t Hoff), superficie de contacto, catalizador (disminuye la energía de activación).', topic: 'Cinética', difficulty: 2 },
    { front: '¿Qué es un catalizador?', back: 'Sustancia que aumenta la velocidad de reacción disminuyendo la energía de activación, sin consumirse en la reacción. Catálisis homogénea: mismo estado físico que los reactivos. Heterogénea: diferente estado. Enzimas: catalizadores biológicos.', topic: 'Cinética', difficulty: 2 },
    // Tabla periódica y estructura atómica
    { front: '¿Qué es el número atómico y el número másico?', back: 'Número atómico (Z): número de protones del núcleo (define el elemento). Número másico (A): suma de protones y neutrones. Isótopos: mismo Z, diferente A (mismo elemento, diferente nº de neutrones).', topic: 'Estructura atómica', difficulty: 1 },
    { front: '¿Qué es la configuración electrónica?', back: 'Distribución de los electrones en los orbitales atómicos según el principio de Aufbau (menor energía primero), regla de Hund (máximo spin) y principio de exclusión de Pauli (no dos e⁻ con los cuatro números cuánticos iguales).', topic: 'Estructura atómica', difficulty: 2 },
    { front: 'Propiedades periódicas: radio, electroafinidad, energía de ionización', back: 'Radio atómico: aumenta hacia abajo y hacia la izquierda. Energía de ionización (E para extraer un e⁻): aumenta hacia arriba y hacia la derecha. Electroafinidad (E al captar un e⁻): aumenta hacia la derecha y hacia arriba.', topic: 'Estructura atómica', difficulty: 2 },
    { front: '¿Qué es la geometría molecular? Teoría VSEPR.', back: 'La teoría VSEPR predice la geometría basándose en la repulsión entre pares de electrones. Formas comunes: lineal (2 pares), trigonal plana (3), tetraédrica (4), piramidal trigonal (3+1 libre), angular (2+2 libres).', topic: 'Enlace químico', difficulty: 2 },
    { front: '¿Qué es la hibridación del carbono?', back: 'sp³: 4 enlaces sigma, geometría tetraédrica (metano). sp²: 3 enlaces sigma + 1 pi, geometría trigonal plana (etileno). sp: 2 sigma + 2 pi, lineal (acetileno). La hibridación determina la geometría de los compuestos orgánicos.', topic: 'Química orgánica', difficulty: 2 },
    { front: 'Equilibrio ácido-base: Ka, Kb y relación con pH', back: 'Ka = [H⁺][A⁻]/[HA] → pKa = -log Ka. Ácido fuerte: Ka grande, disociación completa. Ácido débil: Ka pequeño, disociación parcial. Ka·Kb = Kw. Para ácido débil: [H⁺] ≈ √(Ka·C).', topic: 'Ácido-base', difficulty: 3 },
    { front: '¿Qué es la electroquímica? Pila galvánica vs electrólisis.', back: 'Electroquímica: conversión entre energía química y eléctrica. Pila galvánica (Volta): reacción espontánea genera electricidad. Electrólisis: corriente eléctrica fuerza una reacción no espontánea (producción de Al, recubrimientos electrolíticos).', topic: 'Reacciones redox', difficulty: 2 },
    { front: '¿Qué es el potencial de reducción estándar (E°)?', back: 'Medida de la tendencia de una semirreacción a reducirse. Se mide respecto al electrodo estándar de hidrógeno (E°=0). Más positivo → mayor tendencia a reducirse. FEM de la pila = E°(cátodo) - E°(ánodo). Reacción espontánea si FEM > 0.', topic: 'Reacciones redox', difficulty: 3 },
    { front: '¿Qué es el grado de disociación?', back: 'α = fracción de moléculas disociadas = n_disociadas/n_total. α = 1 para electrolitos fuertes (disociación completa), α ≪ 1 para electrolitos débiles. Relación con Ka: para ácido débil HA, Ka ≈ α²·C (aproximación de Ostwald).', topic: 'Ácido-base', difficulty: 3 },
    { front: '¿Qué es la solubilidad? Producto de solubilidad (Kps).', back: 'Solubilidad: máxima cantidad de soluto que se disuelve en un disolvente a una T. Kps = [A^m⁺]^n·[B^n-]^m para el equilibrio AB(s) ⇌ nA^m⁺(aq) + mB^n⁻(aq). Efecto del ion común: disminuye la solubilidad.', topic: 'Equilibrio químico', difficulty: 3 },
    { front: '¿Qué es la fórmula empírica vs molecular?', back: 'Fórmula empírica: relación mínima de átomos (mínimos cocientes enteros). Fórmula molecular: número real de átomos por molécula (múltiplo de la empírica). Ejemplo: glucosa, fórmula empírica CH₂O, molecular C₆H₁₂O₆.', topic: 'Reacciones químicas', difficulty: 1 },
    { front: '¿Qué es la concentración molar (molaridad)?', back: 'M = n/V (mol/L). Otras unidades: molalidad (mol/kg disolvente), fracción molar, ppm. Para preparar una disolución a partir de otra: C₁V₁ = C₂V₂ (dilución). Relación masa-moles: n = m/M_molar.', topic: 'Reacciones químicas', difficulty: 1 },
    { front: '¿Qué es la alcanos? Propiedades físicas.', back: 'Hidrocarburos saturados (solo enlaces simples C-C y C-H). Fórmula general: CₙH₂ₙ₊₂. Propiedades: apolares (fuerzas de London), punto de ebullición aumenta con la cadena, insolubles en agua. Fuente: petróleo, gas natural.', topic: 'Química orgánica', difficulty: 1 },
    { front: '¿Qué es la polimerización? Tipos.', back: 'Reacción que une muchos monómeros para formar un polímero. Adición: el monómero con doble enlace se abre y se unen sin pérdida de átomos (polietileno, PVC). Condensación: con pérdida de una molécula pequeña (agua) (nylon, poliéster).', topic: 'Química orgánica', difficulty: 2 },
    { front: '¿Qué son los ácidos carboxílicos? Reacciones.', back: 'Grupo funcional: -COOH. Carácter ácido (ceden H⁺). Reacciones: esterificación (RCOOH + R\'OH → RCOOR\' + H₂O), neutralización (RCOOH + NaOH → RCOONa + H₂O), reducción (→ aldehído/alcohol). Ejemplos: ácido acético, fórmico.', topic: 'Química orgánica', difficulty: 2 },
    { front: '¿Qué es la reacción de combustión?', back: 'Oxidación completa de un hidrocarburo con O₂: CₓHᵧ + O₂ → CO₂ + H₂O. Parcial (con poco O₂): produce CO (gas tóxico). La energía de combustión (ΔH combustión) siempre es negativa (exotérmica).', topic: 'Reacciones químicas', difficulty: 1 },
    { front: '¿Qué es la primera ley de la termodinámica?', back: 'Conservación de la energía: ΔU = Q - W. ΔU = variación de energía interna, Q = calor absorbido por el sistema, W = trabajo realizado por el sistema. A presión constante: ΔH = Q_p (entalpía = calor a presión cte).', topic: 'Termodinámica', difficulty: 2 },
    { front: 'Calor específico y capacidad calorífica', back: 'Calor específico (c): energía necesaria para elevar 1°C la temperatura de 1 g de sustancia. Q = m·c·ΔT. Capacidad calorífica (C): Q = C·ΔT. Agua: c = 4.18 J/(g·°C), muy alta (termorregulación biológica).', topic: 'Termodinámica', difficulty: 2 },
    { front: '¿Qué es la energía de enlace? ¿Cómo calcular ΔH?', back: 'Energía necesaria para romper 1 mol de un enlace en fase gaseosa. ΔH_reacción ≈ Σ(energías de enlace rotos) - Σ(energías de enlace formados). Romper enlaces requiere energía (+), formar enlaces libera energía (-).', topic: 'Termodinámica', difficulty: 2 },
    { front: '¿Qué es la constante de velocidad (k)?', back: 'En la ley de velocidad v = k·[A]^m·[B]^n: k depende de la temperatura (ecuación de Arrhenius: k = A·e^(-Ea/RT)). Al aumentar T, k aumenta. El orden de reacción (m+n) se determina experimentalmente, no de la estequiometría.', topic: 'Cinética', difficulty: 3 },
    { front: '¿Qué son los polímeros inorgánicos? Silicatos.', back: 'Los silicatos son los minerales más abundantes en la corteza terrestre. Unidad: tetraedro SiO₄⁴⁻. Se pueden unir formando cadenas, láminas o estructuras tridimensionales (cuarzo: SiO₂). Base de cerámica, vidrio y cemento.', topic: 'Química inorgánica', difficulty: 2 },
    { front: '¿Qué es la química verde?', back: 'Principios para diseñar procesos y productos químicos que reduzcan o eliminen el uso y generación de sustancias peligrosas. Objetivos: economía atómica, disolventes seguros, menor consumo energético, fuentes renovables.', topic: 'Química inorgánica', difficulty: 1 },
    { front: '¿Qué son los óxidos? Tipos y reactividad.', back: 'Compuestos de O con otro elemento. Óxidos básicos (metales + O₂): reaccionan con agua → hidróxidos. Óxidos ácidos/anhídridos (no metales + O₂): reaccionan con agua → ácidos oxácidos. Reacción ácido-base entre ellos → sal + agua.', topic: 'Química inorgánica', difficulty: 1 },
    { front: 'Nomenclatura IUPAC de compuestos inorgánicos', back: 'Óxidos: monóxido de carbono (CO), dióxido de carbono (CO₂). Hidróxidos: hidróxido de sodio. Sales: cloruro de sodio. Ácidos: ácido clorhídrico (HCl), sulfúrico (H₂SO₄), nítrico (HNO₃). Prefijos numéricos: mono-, di-, tri-.', topic: 'Química inorgánica', difficulty: 2 },
    { front: '¿Qué son las disoluciones tampón?', back: 'Disoluciones que resisten cambios de pH al añadir ácido o base. Compuestas por un ácido débil y su base conjugada (o viceversa). Ejemplo: CH₃COOH/CH₃COO⁻. pH ≈ pKa + log([base]/[ácido]) (ecuación de Henderson-Hasselbalch).', topic: 'Ácido-base', difficulty: 3 },
    { front: '¿Qué es la valoración ácido-base? ¿Cómo se calcula el punto de equivalencia?', back: 'Técnica para determinar la concentración de un ácido o base desconocida añadiendo un patrón (volumen conocido y concentración conocida) hasta el punto de equivalencia (moles ácido = moles base). n_a = n_b → C_a·V_a = C_b·V_b.', topic: 'Ácido-base', difficulty: 2 },
    { front: '¿Qué es la reacción de sustitución electrofílica aromática?', back: 'Reacción característica del benceno: un electrófilo sustituye un H del anillo aromático. Tipos: nitración (-NO₂ con HNO₃+H₂SO₄), sulfonación (-SO₃H), halogenación (-Cl/-Br con catalizador FeCl₃), alquilación y acilación de Friedel-Crafts.', topic: 'Química orgánica', difficulty: 3 },
    { front: '¿Qué son los fenoles, éteres y aminas?', back: 'Fenoles: -OH unido a anillo aromático (ácido carbólico, antiséptico). Éteres: R-O-R\' (disolventes, anestesia: éter etílico). Aminas: derivados del amoniaco (R-NH₂). Aminas aromáticas: anilina. Todas son bases de Lewis.', topic: 'Química orgánica', difficulty: 2 },
  ],
}

// ─── Extracción de preguntas desde datos EBAU ─────────────────────────────────

function extractFromEbau(slug) {
  const filePath = path.join(EBAU_DIR, `${slug}.json`)
  const data = readJson(filePath)
  if (!data) { console.warn(`  ⚠ No se encontró ${slug}.json en ebau/`); return [] }

  const cards = []
  let globalId = 0

  for (const q of data.questions) {
    // Extraer preguntas del rawQuestion
    const questions = extractQuestionsFromRaw(q.rawQuestion)
    // Extraer criterios del rawAnswer
    const criterios = parseCriterios(q.rawAnswer)

    // Parear preguntas con criterios (índice a índice)
    const pairLen = Math.min(questions.length, criterios.length)
    for (let i = 0; i < pairLen; i++) {
      const front = questions[i]
      const back = criterios[i].description
      if (front && back && front.length > 10 && back.length > 8) {
        cards.push({
          front,
          back,
          topic: criterios[i].groupLabel || `EBAU ${q.year}`,
          source: 'ebau',
          difficulty: Math.min(3, Math.max(1, Math.round(criterios[i].points)))
        })
        globalId++
      }
    }

    // Si hay más criterios que preguntas, añadir solo el criterio como flashcard de definición
    for (let i = pairLen; i < criterios.length; i++) {
      const desc = criterios[i].description
      if (desc.length > 20) {
        cards.push({
          front: `Criterio EBAU: ${desc.substring(0, 80)}${desc.length > 80 ? '…' : ''}`,
          back: desc,
          topic: criterios[i].groupLabel || `EBAU ${q.year}`,
          source: 'ebau',
          difficulty: 2
        })
      }
    }
  }

  // Deduplicar por front similar
  const seen = new Set()
  return cards.filter(c => {
    const key = c.front.toLowerCase().slice(0, 50)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Extracción desde orientaciones ──────────────────────────────────────────

function extractFromOrientaciones(slug) {
  const filePath = path.join(ORI_DIR, `${slug}.json`)
  const data = readJson(filePath)
  if (!data || !data.text) { console.warn(`  ⚠ No se encontró ${slug}.json en orientaciones/`); return [] }

  const cards = []
  const text = data.text

  // Buscar patrones "X es/son Y" o "X: descripción" para definiciones
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20)
  const defRe = /^(.{5,60}?)(?:\s+(?:es|son|se define como|consiste en|se denomina))\s+(.{10,200})/i

  for (const line of lines) {
    const m = line.match(defRe)
    if (m) {
      const term = m[1].trim()
      const def  = m[2].trim()
      // Filtrar líneas que no son definiciones reales
      if (term.split(' ').length <= 6 && def.length > 15) {
        cards.push({
          front: `¿Qué ${m[0].match(/\bson\b/) ? 'son' : 'es'} ${term}?`,
          back: def,
          topic: 'Orientaciones',
          source: 'orientaciones',
          difficulty: 2
        })
      }
    }
  }

  return cards.slice(0, 15) // Limitar para no inundar
}

// ─── Generar flashcards para una materia ─────────────────────────────────────

function generateForSubject(slug) {
  console.log(`\n📚 Generando flashcards para: ${slug}`)

  const hardcoded = (HARDCODED[slug] || []).map((c, i) => ({
    id: `${slug}-h-${String(i + 1).padStart(3, '0')}`,
    front: c.front,
    back: c.back,
    topic: c.topic,
    source: 'teoria',
    difficulty: c.difficulty ?? 1
  }))

  const ebauCards = extractFromEbau(slug).map((c, i) => ({
    id: `${slug}-e-${String(i + 1).padStart(3, '0')}`,
    ...c
  }))

  const oriCards = extractFromOrientaciones(slug).map((c, i) => ({
    id: `${slug}-o-${String(i + 1).padStart(3, '0')}`,
    ...c
  }))

  // Combinar, priorizar hardcoded
  const all = [...hardcoded, ...ebauCards, ...oriCards]

  // Deduplicar globalmente por front
  const seen = new Set()
  const unique = all.filter(c => {
    const key = c.front.toLowerCase().replace(/[^a-záéíóúñ\s]/gi, '').slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Obtener temas únicos
  const topics = [...new Set(unique.map(c => c.topic))]

  console.log(`  ✓ ${unique.length} flashcards generadas (${hardcoded.length} teoria, ${ebauCards.length} ebau, ${oriCards.length} orientaciones)`)
  if (unique.length < 50) {
    console.warn(`  ⚠ ALERTA: solo ${unique.length} cards — mínimo requerido: 50`)
  }

  return {
    subject: slug,
    topics,
    flashcards: unique
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SLUGS = ['biologia', 'historia', 'lengua', 'ingles', 'matematicas', 'mates-sociales', 'quimica']

console.log('🃏 Generador de flashcards EBAU — Selectivia\n')

for (const slug of SLUGS) {
  const result = generateForSubject(slug)
  const outPath = path.join(OUT_DIR, `${slug}.json`)
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`  → Guardado en src/data/flashcards/${slug}.json`)
}

console.log('\n✅ Generación completada.')
