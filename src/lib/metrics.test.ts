import { describe, expect, it } from 'vitest'
import {
  aggregateSnapshotKpis,
  computeMonthFinancials,
  computeRevenueFromLeads,
  computeRevenueFromSales,
  computeRoas,
} from '@/lib/metrics'
import type { PerformanceSnapshotRecord } from '@/hooks/useClientPortalData'

function makeSnapshot(overrides: Partial<PerformanceSnapshotRecord> = {}): PerformanceSnapshotRecord {
  return {
    id: crypto.randomUUID(),
    project_id: crypto.randomUUID(),
    snapshot_date: new Date().toISOString().slice(0, 10),
    spend: null,
    revenue: null,
    roas: null,
    ctr: null,
    channel: null,
    clicks: null,
    impressions: null,
    conversions: null,
    ...overrides,
  }
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

describe('aggregateSnapshotKpis', () => {
  it('sem snapshots, tudo zerado ou sem dado', () => {
    const kpis = aggregateSnapshotKpis([])
    expect(kpis).toEqual({
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      ctr: null,
      cpc: null,
      conversionRate: null,
      cpa: null,
    })
  })

  it('soma spend/impressões/cliques/conversões e calcula CTR, CPC, taxa de conversão e CPA', () => {
    const snapshots = [
      makeSnapshot({ spend: 100, impressions: 1000, clicks: 20, conversions: 4 }),
      makeSnapshot({ spend: 50, impressions: 500, clicks: 10, conversions: 1 }),
    ]
    const kpis = aggregateSnapshotKpis(snapshots)

    expect(kpis.spend).toBe(150)
    expect(kpis.impressions).toBe(1500)
    expect(kpis.clicks).toBe(30)
    expect(kpis.conversions).toBe(5)
    expect(kpis.ctr).toBeCloseTo((30 / 1500) * 100)
    expect(kpis.cpc).toBeCloseTo(150 / 30)
    expect(kpis.conversionRate).toBeCloseTo((5 / 30) * 100)
    expect(kpis.cpa).toBeCloseTo(150 / 5)
  })

  it('ignora snapshots com mais de 30 dias', () => {
    const snapshots = [
      makeSnapshot({ snapshot_date: daysAgo(5), spend: 100, clicks: 10, impressions: 100, conversions: 2 }),
      makeSnapshot({ snapshot_date: daysAgo(40), spend: 999, clicks: 999, impressions: 999, conversions: 999 }),
    ]
    const kpis = aggregateSnapshotKpis(snapshots)

    expect(kpis.spend).toBe(100)
    expect(kpis.clicks).toBe(10)
    expect(kpis.conversions).toBe(2)
  })

  it('sem cliques, CPC/taxa de conversão/CPA ficam null (evita divisão por zero)', () => {
    const kpis = aggregateSnapshotKpis([makeSnapshot({ spend: 100, impressions: 500, clicks: 0, conversions: 0 })])
    expect(kpis.cpc).toBeNull()
    expect(kpis.conversionRate).toBeNull()
    expect(kpis.cpa).toBeNull()
    expect(kpis.ctr).toBe(0)
  })
})

describe('computeRevenueFromLeads', () => {
  it('vendas = leads ÷ leads-para-fechar, receita = vendas × ticket médio', () => {
    // 100 leads, 10 leads fecham 1 venda = 10 vendas × R$200 = R$2000
    expect(computeRevenueFromLeads(100, 10, 200)).toBeCloseTo(2000)
  })

  it('sem "leads para fechar" configurado, fica null (evita divisão por zero)', () => {
    expect(computeRevenueFromLeads(100, null, 200)).toBeNull()
    expect(computeRevenueFromLeads(100, 0, 200)).toBeNull()
  })

  it('sem "ticket médio" configurado, fica null', () => {
    expect(computeRevenueFromLeads(100, 10, null)).toBeNull()
  })

  it('sem leads, vendas e receita ficam zero (não null — as premissas estão configuradas)', () => {
    expect(computeRevenueFromLeads(0, 10, 200)).toBe(0)
  })
})

describe('computeRoas', () => {
  it('receita ÷ investimento', () => {
    expect(computeRoas(3000, 1000)).toBeCloseTo(3)
  })

  it('sem investimento, ROAS fica null (evita divisão por zero)', () => {
    expect(computeRoas(3000, 0)).toBeNull()
  })
})

describe('Fase 58 — vendas informadas', () => {
  it('computeRevenueFromSales: vendas × ticket; sem vendas ou ticket = null', () => {
    expect(computeRevenueFromSales(12, 500)).toBe(6000)
    expect(computeRevenueFromSales(0, 500)).toBe(0)
    expect(computeRevenueFromSales(null, 500)).toBeNull()
    expect(computeRevenueFromSales(12, null)).toBeNull()
  })

  it('computeMonthFinancials: só o investimento do mês pedido entra no ROAS', () => {
    const snap = (snapshot_date: string, spend: number) =>
      ({ snapshot_date, spend, clicks: 0, impressions: 0, conversions: 0 }) as unknown as Parameters<typeof computeMonthFinancials>[0][number]
    const snapshots = [snap('2026-09-30', 999), snap('2026-10-01', 1000), snap('2026-10-15', 1000)]
    expect(computeMonthFinancials(snapshots, 2026, 10, 10, 800)).toEqual({ spend: 2000, revenue: 8000, roas: 4 })
    expect(computeMonthFinancials(snapshots, 2026, 10, null, 800)).toEqual({ spend: 2000, revenue: null, roas: null })
  })
})
