// Ametista Conversões — Fase 48.7: modificador por investimento em
// mídia (Anexo I do contrato, item 4) — usado no campo "Ritmo de
// verba" da Análise do Gestor quinzenal do plano Escala. Números e
// regras exatos do contrato real (Prospecção/7) Contrato/Documento do
// contrato.md, no vault do usuário):
//
// 4.2 Enquanto o investimento mensal não ultrapassar a verba incluída
//     no plano, não incide modificador.
// 4.3 Ultrapassada a verba incluída, a alíquota da faixa em que se
//     enquadra o investimento TOTAL do mês incide sobre a totalidade
//     desse investimento, não apenas sobre a parcela excedente.
// 4.4 Valor mínimo por faixa: o modificador nunca será inferior ao
//     valor máximo da faixa imediatamente anterior — um aumento do
//     investimento jamais resulta em modificador menor.
// 4.5 Apurado após o fechamento do mês, cobrado junto da mensalidade
//     seguinte.
// 4.6 Só incide sobre aumento previamente aprovado por escrito pelo
//     cliente — o app só mostra a PROJEÇÃO/aviso estimado, nunca cria
//     cobrança real (isso continua manual/humano, fora do app).

export type MediaBudgetPlan = 'validacao' | 'escala' | 'dominacao'

interface Bracket {
  /** Teto da faixa (inclusive); `null` = sem teto, última faixa. */
  upperBound: number | null
  rate: number
}

// Faixas sobre o investimento TOTAL do mês (regra 4.3) — ordenadas.
const BRACKETS: Record<MediaBudgetPlan, Bracket[]> = {
  validacao: [
    { upperBound: 30_000, rate: 0.04 }, // >15k–30k
    { upperBound: 60_000, rate: 0.03 }, // >30k–60k
    { upperBound: null, rate: 0.02 }, // >60k
  ],
  escala: [
    { upperBound: 60_000, rate: 0.035 }, // >30k–60k
    { upperBound: 120_000, rate: 0.025 }, // >60k–120k
    { upperBound: null, rate: 0.015 }, // >120k
  ],
  dominacao: [
    { upperBound: 180_000, rate: 0.03 }, // >90k–180k
    { upperBound: 360_000, rate: 0.02 }, // >180k–360k
    { upperBound: null, rate: 0.01 }, // >360k
  ],
}

export const INCLUDED_MEDIA_BUDGET: Record<MediaBudgetPlan, number> = {
  validacao: 15_000,
  escala: 30_000,
  dominacao: 90_000,
}

export interface MediaBudgetModifierResult {
  rateApplied: number
  /** Alíquota da faixa × investimento total do mês (regra 4.3). */
  rawModifier: number
  /** Piso = modificador máximo já atingido na faixa anterior (regra 4.4). */
  floorModifier: number
  /** Valor final estimado = max(rawModifier, floorModifier). */
  modifier: number
  bracketLabel: string
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** `null` quando o investimento está dentro da verba incluída (sem
 * modificador, regra 4.2). Fora dela, aplica as regras 4.3/4.4. */
export function computeMediaBudgetModifier(plan: MediaBudgetPlan, totalSpendMonth: number): MediaBudgetModifierResult | null {
  const included = INCLUDED_MEDIA_BUDGET[plan]
  if (totalSpendMonth <= included) return null

  const brackets = BRACKETS[plan]
  const index = brackets.findIndex((b) => b.upperBound === null || totalSpendMonth <= b.upperBound)
  const bracket = brackets[index]
  const rawModifier = totalSpendMonth * bracket.rate
  const floorModifier = index > 0 ? brackets[index - 1].rate * (brackets[index - 1].upperBound as number) : 0
  const lowerBound = index === 0 ? included : (brackets[index - 1].upperBound as number)
  const bracketLabel =
    bracket.upperBound === null
      ? `Acima de ${formatBrl(lowerBound)} (${(bracket.rate * 100).toLocaleString('pt-BR')}%)`
      : `${formatBrl(lowerBound)} a ${formatBrl(bracket.upperBound)} (${(bracket.rate * 100).toLocaleString('pt-BR')}%)`

  return {
    rateApplied: bracket.rate,
    rawModifier,
    floorModifier,
    modifier: Math.max(rawModifier, floorModifier),
    bracketLabel,
  }
}

/** Projeção simples de gasto do mês inteiro, a partir do ritmo
 * observado até a data de corte — usada no "Ritmo de verba" pra avisar
 * ANTES do mês terminar, não só depois do fechamento. */
export function projectMonthSpend(spendSoFar: number, daysElapsed: number, daysInMonth: number): number {
  if (daysElapsed <= 0) return 0
  return (spendSoFar / daysElapsed) * daysInMonth
}
