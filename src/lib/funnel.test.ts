import { describe, expect, it } from 'vitest'
import { computeFunnel, endOfMonthIso, funnelGoalTargets, requiredConversionRate, type FunnelInputs } from './funnel'

const base: FunnelInputs = {
  mode: 'verba',
  budget: 3000,
  salesGoal: null,
  cpa: 30,
  ctr: 2,
  conversionRate: 5,
  qualificationRate: 40,
  leadsToClose: 10,
  averageTicket: 1500,
}

describe('computeFunnel', () => {
  it('modo verba: verba ÷ CPA = leads, e sobe o funil pelas taxas', () => {
    const r = computeFunnel(base)!
    expect(r.leads).toBe(100) // 3000 ÷ 30
    expect(r.clicks).toBe(2000) // 100 ÷ 5%
    expect(r.impressions).toBe(100000) // 2000 ÷ 2%
    expect(r.qualifiedLeads).toBe(40)
    expect(r.sales).toBe(10) // 100 ÷ 10
    expect(r.revenue).toBe(15000)
    expect(r.roas).toBe(5)
    expect(r.impliedCpc).toBe(1.5) // CPA × taxa = 30 × 5%
  })

  it('modo vendas: vendas × leads por venda = leads, verba = leads × CPA', () => {
    const r = computeFunnel({ ...base, mode: 'vendas', budget: null, salesGoal: 20 })!
    expect(r.leads).toBe(200)
    expect(r.budget).toBe(6000)
    expect(r.clicks).toBe(4000)
    expect(r.sales).toBe(20)
  })

  it('devolve null quando falta dado essencial', () => {
    expect(computeFunnel({ ...base, budget: null })).toBeNull()
    expect(computeFunnel({ ...base, ctr: 0 })).toBeNull()
    expect(computeFunnel({ ...base, mode: 'vendas', salesGoal: 5, leadsToClose: null })).toBeNull()
  })

  it('sem ficha completa, calcula o funil mas não vendas/receita', () => {
    const r = computeFunnel({ ...base, leadsToClose: null, averageTicket: null })!
    expect(r.leads).toBe(100)
    expect(r.sales).toBeNull()
    expect(r.roas).toBeNull()
  })

  it('sem taxa de qualificação, Leads Qualificados fica sem meta (não 0)', () => {
    expect(computeFunnel({ ...base, qualificationRate: null })!.qualifiedLeads).toBeNull()
  })
})

describe('auxiliares', () => {
  it('requiredConversionRate: CPC real ÷ CPA-alvo', () => {
    expect(requiredConversionRate(30, 3)).toBe(10)
    expect(requiredConversionRate(30, null)).toBeNull()
  })

  it('funnelGoalTargets mapeia cada meta', () => {
    const targets = funnelGoalTargets(base, computeFunnel(base)!)
    expect(targets.orcamento).toBe(3000)
    expect(targets.cliques).toBe(2000)
    expect(targets.cpa).toBe(30)
    expect(targets.taxa_conversao).toBe(5)
  })

  it('endOfMonthIso', () => {
    expect(endOfMonthIso('2026-10-20')).toBe('2026-10-31')
    expect(endOfMonthIso('2028-02-03')).toBe('2028-02-29')
  })
})
