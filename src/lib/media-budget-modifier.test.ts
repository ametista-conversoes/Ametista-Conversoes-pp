import { describe, expect, it } from 'vitest'
import { computeMediaBudgetModifier, projectMonthSpend } from '@/lib/media-budget-modifier'

describe('computeMediaBudgetModifier', () => {
  it('dentro da verba incluída, sem modificador', () => {
    expect(computeMediaBudgetModifier('validacao', 15_000)).toBeNull()
    expect(computeMediaBudgetModifier('validacao', 10_000)).toBeNull()
    expect(computeMediaBudgetModifier('escala', 30_000)).toBeNull()
    expect(computeMediaBudgetModifier('dominacao', 90_000)).toBeNull()
  })

  it('Validação, 1ª faixa paga (>15k-30k, 4%), sem precisar de piso', () => {
    const result = computeMediaBudgetModifier('validacao', 20_000)
    expect(result).not.toBeNull()
    expect(result?.rateApplied).toBe(0.04)
    expect(result?.rawModifier).toBe(800)
    expect(result?.floorModifier).toBe(0)
    expect(result?.modifier).toBe(800)
  })

  it('exemplo exato do contrato: Validação R$20.000 -> R$800', () => {
    const result = computeMediaBudgetModifier('validacao', 20_000)
    expect(result?.modifier).toBe(800)
  })

  it('exemplo exato do contrato: Validação R$35.000 -> elevado ao piso de R$1.200', () => {
    const result = computeMediaBudgetModifier('validacao', 35_000)
    expect(result).not.toBeNull()
    expect(result?.rateApplied).toBe(0.03)
    expect(result?.rawModifier).toBe(1_050)
    expect(result?.floorModifier).toBe(1_200) // 4% x 30.000 (faixa anterior)
    expect(result?.modifier).toBe(1_200)
  })

  it('Validação, limite exato de uma faixa (R$30.000 ainda é "até 30.000", fica na 1ª faixa)', () => {
    // Contrato: "Acima de R$15.000 até R$30.000 -> 4%" -- o teto pertence à faixa que o cita.
    const result = computeMediaBudgetModifier('validacao', 30_000)
    expect(result?.rateApplied).toBe(0.04)
  })

  it('Validação, última faixa sem teto (>60k), piso é o máximo da faixa anterior', () => {
    const result = computeMediaBudgetModifier('validacao', 61_000)
    expect(result?.rateApplied).toBe(0.02)
    expect(result?.floorModifier).toBe(1_800) // 3% x 60.000
    expect(result?.rawModifier).toBeCloseTo(1_220, 0)
    expect(result?.modifier).toBe(1_800) // piso vence
  })

  it('Escala, dentro da 1ª faixa paga (>30k-60k, 3,5%)', () => {
    const result = computeMediaBudgetModifier('escala', 40_000)
    expect(result?.rateApplied).toBe(0.035)
    expect(result?.modifier).toBeCloseTo(1_400, 0)
  })

  it('Escala, 3ª faixa (>120k, 1,5%), piso da 2ª faixa (2,5% x 120.000 = 3.000)', () => {
    const result = computeMediaBudgetModifier('escala', 125_000)
    expect(result?.rateApplied).toBe(0.015)
    expect(result?.floorModifier).toBe(3_000)
    expect(result?.rawModifier).toBeCloseTo(1_875, 0)
    expect(result?.modifier).toBe(3_000)
  })

  it('Dominação, dentro da 1ª faixa paga (>90k-180k, 3%)', () => {
    const result = computeMediaBudgetModifier('dominacao', 100_000)
    expect(result?.rateApplied).toBe(0.03)
    expect(result?.modifier).toBe(3_000)
  })

  it('Dominação, última faixa (>360k, 1%)', () => {
    const result = computeMediaBudgetModifier('dominacao', 400_000)
    expect(result?.rateApplied).toBe(0.01)
    expect(result?.floorModifier).toBe(7_200) // 2% x 360.000
    expect(result?.modifier).toBeCloseTo(7_200, 0)
  })
})

describe('projectMonthSpend', () => {
  it('projeta linearmente a partir do ritmo observado', () => {
    expect(projectMonthSpend(10_000, 10, 30)).toBeCloseTo(30_000, 0)
  })

  it('sem dias decorridos, projeção zero (evita divisão por zero)', () => {
    expect(projectMonthSpend(0, 0, 30)).toBe(0)
  })
})
