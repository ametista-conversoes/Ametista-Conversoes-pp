import { describe, expect, it } from 'vitest'
import { daysElapsedInPeriod, daysInPeriod, previousAnalysisPeriod, resolveAnalysisPeriod } from '@/lib/manager-analysis'

describe('resolveAnalysisPeriod', () => {
  it('Validação -> mês calendário inteiro, qualquer tipo', () => {
    expect(resolveAnalysisPeriod('validacao', 'periodica', new Date(2026, 9, 15))).toEqual({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    })
  })

  it('estrategica_mensal -> mês calendário inteiro, mesmo plano Dominação', () => {
    expect(resolveAnalysisPeriod('dominacao', 'estrategica_mensal', new Date(2026, 1, 10))).toEqual({
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
    })
  })

  it('Escala -> 1ª quinzena quando o dia é <= 15', () => {
    expect(resolveAnalysisPeriod('escala', 'periodica', new Date(2026, 9, 7))).toEqual({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
    })
  })

  it('Escala -> 2ª quinzena quando o dia é > 15, até o último dia real do mês', () => {
    expect(resolveAnalysisPeriod('escala', 'periodica', new Date(2026, 9, 20))).toEqual({
      periodStart: '2026-10-16',
      periodEnd: '2026-10-31',
    })
    // Fevereiro (28 dias em 2026, não bissexto)
    expect(resolveAnalysisPeriod('escala', 'periodica', new Date(2026, 1, 20))).toEqual({
      periodStart: '2026-02-16',
      periodEnd: '2026-02-28',
    })
  })

  it('Dominação periódica -> semana corrente (segunda a domingo)', () => {
    // 07/10/2026 é uma quarta-feira
    expect(resolveAnalysisPeriod('dominacao', 'periodica', new Date(2026, 9, 7))).toEqual({
      periodStart: '2026-10-05',
      periodEnd: '2026-10-11',
    })
  })

  it('Dominação periódica -> domingo conta como fim da semana corrente, não início da próxima', () => {
    // 11/10/2026 é domingo
    expect(resolveAnalysisPeriod('dominacao', 'periodica', new Date(2026, 9, 11))).toEqual({
      periodStart: '2026-10-05',
      periodEnd: '2026-10-11',
    })
  })
})

describe('previousAnalysisPeriod', () => {
  it('mês anterior pra Validação, tratando virada de ano', () => {
    expect(previousAnalysisPeriod('validacao', 'periodica', '2026-01-01')).toEqual({
      periodStart: '2025-12-01',
      periodEnd: '2025-12-31',
    })
  })

  it('quinzena anterior pra Escala (2ª -> 1ª quinzena do mesmo mês)', () => {
    expect(previousAnalysisPeriod('escala', 'periodica', '2026-10-16')).toEqual({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
    })
  })

  it('semana anterior pra Dominação periódica', () => {
    expect(previousAnalysisPeriod('dominacao', 'periodica', '2026-10-05')).toEqual({
      periodStart: '2026-09-28',
      periodEnd: '2026-10-04',
    })
  })
})

describe('daysElapsedInPeriod / daysInPeriod', () => {
  it('conta os dias corretamente, inclusive', () => {
    expect(daysInPeriod('2026-10-01', '2026-10-31')).toBe(31)
    expect(daysInPeriod('2026-10-01', '2026-10-15')).toBe(15)
    expect(daysElapsedInPeriod('2026-10-01', new Date(2026, 9, 1))).toBe(1)
    expect(daysElapsedInPeriod('2026-10-01', new Date(2026, 9, 10))).toBe(10)
  })
})
