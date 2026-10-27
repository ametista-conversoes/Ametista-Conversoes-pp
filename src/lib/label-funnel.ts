// Ametista Conversões — Fase 59: funil a partir das etiquetas semanais do
// WhatsApp (`client_weekly_labels`, migration-107).
//
// A semana começa na segunda e conta no mês da sua sexta (dia da contagem do
// Kit) — a mesma regra do gatilho que soma as vendas no banco.
//
// Etapas acumuladas: quem está em Agendado já passou por Qualificado, e quem
// é Venda já passou pelos dois. Perdido conta só no total de leads.

import { addDays, format, parseISO, startOfISOWeek, subWeeks } from 'date-fns'

export const LABEL_KEYS = ['novo', 'qualificado', 'agendado', 'venda', 'perdido'] as const
export type LabelKey = (typeof LABEL_KEYS)[number]

export const labelNames: Record<LabelKey, string> = {
  novo: 'Novo',
  qualificado: 'Qualificado',
  agendado: 'Agendado',
  venda: 'Venda',
  perdido: 'Perdido',
}

export type LabelCounts = Record<LabelKey, number>

/** Segunda-feira (YYYY-MM-DD) da semana de `isoDate`. */
export function weekStartIso(isoDate: string): string {
  return format(startOfISOWeek(parseISO(isoDate)), 'yyyy-MM-dd')
}

/** Mês (YYYY-MM-01) em que a semana conta: o da sua sexta. */
export function weekMonthIso(weekStart: string): string {
  return `${format(addDays(parseISO(weekStart), 4), 'yyyy-MM')}-01`
}

/** Semana atual e as `count - 1` anteriores, da mais nova pra mais antiga. */
export function recentWeekStarts(todayIso: string, count: number): string[] {
  const monday = startOfISOWeek(parseISO(todayIso))
  return Array.from({ length: count }, (_, i) => format(subWeeks(monday, i), 'yyyy-MM-dd'))
}

/** "19/10 a 25/10" */
export function weekRangeLabel(weekStart: string): string {
  const start = parseISO(weekStart)
  return `${format(start, 'dd/MM')} a ${format(addDays(start, 6), 'dd/MM')}`
}

export interface LabelFunnel {
  leads: number
  qualificados: number
  agendados: number
  vendas: number
  /** % de cada etapa sobre a anterior; `null` sem base. */
  qualificacaoRate: number | null
  agendamentoRate: number | null
  fechamentoRate: number | null
}

const rate = (part: number, base: number) => (base > 0 ? (part / base) * 100 : null)

export function buildLabelFunnel(weeks: LabelCounts[]): LabelFunnel {
  const sum = (key: LabelKey) => weeks.reduce((total, w) => total + w[key], 0)
  const vendas = sum('venda')
  const agendados = sum('agendado') + vendas
  const qualificados = sum('qualificado') + agendados
  const leads = sum('novo') + qualificados + sum('perdido')
  return {
    leads,
    qualificados,
    agendados,
    vendas,
    qualificacaoRate: rate(qualificados, leads),
    agendamentoRate: rate(agendados, qualificados),
    fechamentoRate: rate(vendas, agendados),
  }
}
