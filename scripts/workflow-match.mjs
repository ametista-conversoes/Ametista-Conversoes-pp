// Normalização usada pra casar um "match" de docs/interno/workflow-detalhes.json
// com o título de um item de workflow: minúsculas, sem acento, espaços
// colapsados e sem espaço nas pontas. Espelha `workflow_match_normalize` no
// banco (migration-104) — mudar aqui exige mudar lá.

export function normalizeMatch(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** O item casa quando o título normalizado COMEÇA com o match normalizado. */
export function titleMatches(title, match) {
  const m = normalizeMatch(match)
  return m.length > 0 && normalizeMatch(title).startsWith(m)
}
