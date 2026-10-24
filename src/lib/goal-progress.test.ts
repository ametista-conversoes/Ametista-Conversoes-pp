import { describe, expect, it } from 'vitest'
import { formatGoalValue, goalProgressPercent, isAutoGoalMetric, isLowerBetterMetric } from './goal-progress'

describe('goalProgressPercent', () => {
  it('maior é melhor: atual ÷ meta, limitado a 100 na barra', () => {
    expect(goalProgressPercent('cliques', 500, 2000)).toBe(25)
    expect(goalProgressPercent('roas', 6, 4)).toBe(100)
    expect(goalProgressPercent('roas', 6, 4, { capped: false })).toBe(150)
  })

  it('menor é melhor (CPA/CPC/CPM): meta ÷ atual — subir o custo derruba o progresso', () => {
    expect(goalProgressPercent('cpa', 35, 45)).toBe(100)
    expect(goalProgressPercent('cpa', 45, 45)).toBe(100)
    expect(goalProgressPercent('cpa', 60, 45)).toBe(75)
    expect(goalProgressPercent('cpa', 90, 45)).toBe(50)
    expect(goalProgressPercent('cpc', 3, 1.5)).toBe(50)
    expect(goalProgressPercent('cpm', 35, 45, { capped: false })).toBe(129)
  })

  it('sem dado ou sem meta = 0%', () => {
    expect(goalProgressPercent('cpa', 0, 45)).toBe(0)
    expect(goalProgressPercent('cpa', null, 45)).toBe(0)
    expect(goalProgressPercent('leads', 10, 0)).toBe(0)
  })
})

describe('classificação das métricas', () => {
  it('menor é melhor só pra custos', () => {
    expect(isLowerBetterMetric('cpa')).toBe(true)
    expect(isLowerBetterMetric('ctr')).toBe(false)
    expect(isLowerBetterMetric(null)).toBe(false)
  })

  it('automáticas = o que o app mede; o resto é manual', () => {
    expect(isAutoGoalMetric('cliques')).toBe(true)
    expect(isAutoGoalMetric('vendas')).toBe(true)
    expect(isAutoGoalMetric('ticket_medio')).toBe(false)
    expect(isAutoGoalMetric('ltv')).toBe(false)
  })
})

describe('formatGoalValue', () => {
  it('tipo conhecido define o formato', () => {
    expect(formatGoalValue('cpa', 45)).toMatch(/R\$\s?45,00/)
    expect(formatGoalValue('ctr', 2.5)).toBe('2,5%')
    expect(formatGoalValue('roas', 4)).toMatch(/^4(,0)?x$/)
    expect(formatGoalValue('cliques', 2000)).toBe('2.000')
  })

  it('meta "Outro" usa a unidade escolhida', () => {
    expect(formatGoalValue('ltv', 1500, 'currency')).toMatch(/R\$\s?1\.500,00/)
    expect(formatGoalValue('margem', 30, 'percent')).toBe('30,0%')
    expect(formatGoalValue('indicacoes', 12, 'count')).toBe('12')
  })
})
