import { describe, expect, it } from 'vitest'
import { buildLabelFunnel, recentWeekStarts, weekMonthIso, weekRangeLabel, weekStartIso } from './label-funnel'

describe('label-funnel', () => {
  it('semana começa na segunda e conta no mês da sexta', () => {
    expect(weekStartIso('2026-10-25')).toBe('2026-10-19') // domingo
    expect(weekStartIso('2026-10-19')).toBe('2026-10-19')
    expect(weekMonthIso('2026-09-28')).toBe('2026-10-01') // sexta 02/10
    expect(weekMonthIso('2026-10-26')).toBe('2026-10-01') // sexta 30/10
    expect(weekMonthIso('2026-11-30')).toBe('2026-12-01') // sexta 04/12
  })

  it('semanas recentes e rótulo', () => {
    expect(recentWeekStarts('2026-10-26', 3)).toEqual(['2026-10-26', '2026-10-19', '2026-10-12'])
    expect(weekRangeLabel('2026-10-19')).toBe('19/10 a 25/10')
  })

  it('funil acumulado: Venda já passou por Agendado e Qualificado', () => {
    const funnel = buildLabelFunnel([
      { novo: 10, qualificado: 5, agendado: 3, venda: 2, perdido: 0 },
      { novo: 0, qualificado: 0, agendado: 0, venda: 0, perdido: 20 },
    ])
    expect(funnel).toEqual({
      leads: 40,
      qualificados: 10,
      agendados: 5,
      vendas: 2,
      qualificacaoRate: 25,
      agendamentoRate: 50,
      fechamentoRate: 40,
    })
    expect(buildLabelFunnel([]).qualificacaoRate).toBeNull()
  })
})
