import { describe, expect, it } from 'vitest'
import { adMetricLabel, adMetricValue, type AdTotals } from './ad-goal-metrics'

const totals: AdTotals = {
  spend: 1000,
  clicks: 400,
  impressions: 20000,
  conversions: 25,
  leadsToClose: 5,
  averageTicket: 800,
}

describe('adMetricValue', () => {
  it('usa as mesmas fórmulas do card de Performance', () => {
    expect(adMetricValue('cliques', totals)).toBe(400)
    expect(adMetricValue('impressoes', totals)).toBe(20000)
    expect(adMetricValue('conversoes', totals)).toBe(25)
    expect(adMetricValue('cpa', totals)).toBe(40)
    expect(adMetricValue('cpc', totals)).toBe(2.5)
    expect(adMetricValue('ctr', totals)).toBe(2)
    expect(adMetricValue('cpm', totals)).toBe(50)
    expect(adMetricValue('taxa_conversao', totals)).toBe(6.25)
    // 25 conversões ÷ 5 leads por venda × R$800 = R$4.000 → ROAS 4
    expect(adMetricValue('faturamento', totals)).toBe(4000)
    expect(adMetricValue('roas', totals)).toBe(4)
  })

  it('devolve null quando não dá pra calcular', () => {
    const empty: AdTotals = { ...totals, clicks: 0, impressions: 0, conversions: 0 }
    expect(adMetricValue('cpa', empty)).toBeNull()
    expect(adMetricValue('ctr', empty)).toBeNull()
    expect(adMetricValue('roas', { ...totals, leadsToClose: null })).toBeNull()
    expect(adMetricValue('ticket_medio', totals)).toBeNull()
  })
})

describe('adMetricLabel', () => {
  it('só tem rótulo pras métricas que existem nas contas de anúncio', () => {
    expect(adMetricLabel('cpa')).toBe('CPA nas contas de anúncio (últimos 30 dias)')
    expect(adMetricLabel('leads')).toContain('pixel/tag')
    expect(adMetricLabel('vendas')).toBeNull()
    expect(adMetricLabel(null)).toBeNull()
  })
})
