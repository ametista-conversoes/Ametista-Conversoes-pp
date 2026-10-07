// Ametista Conversões — Fase 48.6: período e cadência da Análise do
// Gestor, por plano/tipo. Cadência igual à de reunião (Validação
// mensal / Escala quinzenal / Dominação semanal + mensal estratégica)
// — mesmo mapeamento de `PLAN_MEETING_CADENCE_DAYS` (recurrence.ts),
// não um número novo.

import { PLAN_MEETING_CADENCE_DAYS } from './recurrence'

export type AnalysisPlan = 'validacao' | 'escala' | 'dominacao'
export type AnalysisTipo = 'periodica' | 'estrategica_mensal'

export interface AnalysisPeriod {
  periodStart: string
  periodEnd: string
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Período "corrente" esperado pra uma análise desse plano/tipo, a
 * partir de uma data de referência (por padrão, hoje):
 * - `estrategica_mensal` (só Dominação) ou plano Validação -> mês
 *   calendário inteiro.
 * - Escala -> quinzena (1–15 ou 16–fim do mês) que contém a data.
 * - Dominação `periodica` -> semana (segunda a domingo) que contém a
 *   data. */
export function resolveAnalysisPeriod(plan: AnalysisPlan, tipo: AnalysisTipo, referenceDate: Date = new Date()): AnalysisPeriod {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()

  if (tipo === 'estrategica_mensal' || plan === 'validacao') {
    return { periodStart: toIso(new Date(year, month, 1)), periodEnd: toIso(new Date(year, month + 1, 0)) }
  }

  if (plan === 'escala') {
    const day = referenceDate.getDate()
    if (day <= 15) {
      return { periodStart: toIso(new Date(year, month, 1)), periodEnd: toIso(new Date(year, month, 15)) }
    }
    const lastDay = new Date(year, month + 1, 0).getDate()
    return { periodStart: toIso(new Date(year, month, 16)), periodEnd: toIso(new Date(year, month, lastDay)) }
  }

  // Dominação `periodica` -> semana corrente, segunda a domingo.
  const dayOfWeek = referenceDate.getDay() // 0 = domingo
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { periodStart: toIso(monday), periodEnd: toIso(sunday) }
}

export function analysisCadenceLabel(plan: AnalysisPlan, tipo: AnalysisTipo): string {
  if (tipo === 'estrategica_mensal') return 'mensal estratégica'
  if (plan === 'validacao') return 'mensal'
  if (plan === 'escala') return 'quinzenal'
  return 'semanal'
}

/** Período imediatamente anterior ao informado, pra comparação "vs.
 * período anterior" — simplesmente resolve o mesmo plano/tipo a partir
 * de 1 dia antes do início do período atual (funciona pra mês,
 * quinzena e semana, sem precisar de lógica própria por tipo). */
export function previousAnalysisPeriod(plan: AnalysisPlan, tipo: AnalysisTipo, currentPeriodStart: string): AnalysisPeriod {
  const [y, m, d] = currentPeriodStart.split('-').map(Number)
  const dayBefore = new Date(y, m - 1, d - 1)
  return resolveAnalysisPeriod(plan, tipo, dayBefore)
}

/** Dias decorridos (inclusive) desde `periodStart` até `asOfDate` —
 * usado na projeção de "Ritmo de verba" (Fase 48.7). Nunca negativo. */
export function daysElapsedInPeriod(periodStart: string, asOfDate: Date = new Date()): number {
  const [y, m, d] = periodStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const diff = Math.floor((asOfDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  return Math.max(0, diff)
}

export function daysInPeriod(periodStart: string, periodEnd: string): number {
  const [sy, sm, sd] = periodStart.split('-').map(Number)
  const [ey, em, ed] = periodEnd.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
}

export { PLAN_MEETING_CADENCE_DAYS }
