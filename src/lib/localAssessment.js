const STOPWORDS = new Set([
  'de','la','el','los','las','un','una','unos','unas','y','o','u','a','ante','bajo','con','contra','desde','durante','en',
  'entre','hacia','hasta','mediante','para','por','segun','sin','sobre','tras','que','como','cual','cuales','cuando','donde',
  'porque','muy','mas','menos','del','al','se','su','sus','es','son','ser','ha','han','fue','fueron','puede','pueden','debe',
  'deben','tiene','tienen','esta','estas','este','estos','esa','esas','ese','esos','tambien','solo','ya','si','no','lo'
])

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñü+\-/%\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
}

function unique(array) {
  return [...new Set(array)]
}

export function extractKeywords(text, limit = 8) {
  const tokens = unique(tokenize(text))
  return tokens.slice(0, limit)
}

export function assessAnswerAgainstText(userAnswer, referenceText, extraText = '') {
  const answer = normalizeText(userAnswer)
  if (!answer) {
    return {
      score: 0,
      label: 'Sin responder',
      coverage: 0,
      matchedKeywords: [],
      missingKeywords: extractKeywords(`${referenceText} ${extraText}`, 6),
    }
  }

  const keywords = extractKeywords(`${referenceText} ${extraText}`, 10)
  const matchedKeywords = keywords.filter((keyword) => answer.includes(keyword))
  const coverage = keywords.length ? matchedKeywords.length / keywords.length : 0

  const score = coverage >= 0.7 ? 2 : coverage >= 0.35 ? 1 : 0
  const label = score === 2 ? 'Muy alineada' : score === 1 ? 'Parcial' : 'Baja cobertura'

  return {
    score,
    label,
    coverage,
    matchedKeywords,
    missingKeywords: keywords.filter((keyword) => !matchedKeywords.includes(keyword)).slice(0, 5),
  }
}

export function assessChecklistCoverage(userAnswer, items) {
  const answer = normalizeText(userAnswer)
  if (!answer) {
    return {
      suggestedItems: items.map((item) => ({ ...item, suggested: false, coverage: 0, keywords: extractKeywords(item.description, 5) })),
      suggestedPoints: 0,
      maxPoints: items.reduce((sum, item) => sum + item.points, 0),
    }
  }

  const suggestedItems = items.map((item) => {
    const keywords = extractKeywords(item.description, 5)
    const matched = keywords.filter((keyword) => answer.includes(keyword))
    const coverage = keywords.length ? matched.length / keywords.length : 0
    return {
      ...item,
      keywords,
      coverage,
      suggested: coverage >= 0.34 || matched.length >= 2,
    }
  })

  const suggestedPoints = suggestedItems
    .filter((item) => item.suggested)
    .reduce((sum, item) => sum + item.points, 0)

  return {
    suggestedItems,
    suggestedPoints,
    maxPoints: items.reduce((sum, item) => sum + item.points, 0),
  }
}
