import { describe, expect, it } from 'vitest'
import { computePendingAnalyses } from '@/lib/pending-analysis'

const NOW = new Date(2026, 9, 7) // 07/10/2026

describe('computePendingAnalyses', () => {
  it('cliente sem plano nunca entra na lista', () => {
    const result = computePendingAnalyses([{ id: '1', name: 'A', plan: null, created_at: '2026-01-01' }], [], NOW)
    expect(result).toEqual([])
  })

  it('cliente Validação sem nenhuma análise publicada, cadastrado há mais de 30 dias -> pendente', () => {
    const result = computePendingAnalyses(
      [{ id: '1', name: 'A', plan: 'validacao', created_at: '2026-08-01T00:00:00Z' }],
      [],
      NOW,
    )
    expect(result).toHaveLength(1)
    expect(result[0].clientId).toBe('1')
    expect(result[0].cadenceDays).toBe(30)
  })

  it('cliente Escala com análise publicada há 10 dias (cadência 15 dias) -> não pendente', () => {
    const result = computePendingAnalyses(
      [{ id: '2', name: 'B', plan: 'escala', created_at: '2026-01-01T00:00:00Z' }],
      [{ client_id: '2', status: 'publicada', published_at: '2026-09-27T00:00:00Z' }],
      NOW,
    )
    expect(result).toEqual([])
  })

  it('cliente Dominação com análise publicada há 10 dias (cadência 7 dias) -> pendente', () => {
    const result = computePendingAnalyses(
      [{ id: '3', name: 'C', plan: 'dominacao', created_at: '2026-01-01T00:00:00Z' }],
      [{ client_id: '3', status: 'publicada', published_at: '2026-09-27T00:00:00Z' }],
      NOW,
    )
    expect(result).toHaveLength(1)
  })

  it('ignora análises em rascunho (só publicada conta como "cumprida")', () => {
    const result = computePendingAnalyses(
      [{ id: '4', name: 'D', plan: 'validacao', created_at: '2026-01-01T00:00:00Z' }],
      [{ client_id: '4', status: 'rascunho', published_at: null }],
      NOW,
    )
    expect(result).toHaveLength(1)
  })

  it('usa a análise publicada MAIS RECENTE quando há várias', () => {
    const result = computePendingAnalyses(
      [{ id: '5', name: 'E', plan: 'escala', created_at: '2026-01-01T00:00:00Z' }],
      [
        { client_id: '5', status: 'publicada', published_at: '2026-08-01T00:00:00Z' },
        { client_id: '5', status: 'publicada', published_at: '2026-09-30T00:00:00Z' },
      ],
      NOW,
    )
    expect(result).toEqual([])
  })
})
