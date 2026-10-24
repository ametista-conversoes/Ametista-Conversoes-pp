import { describe, expect, it } from 'vitest'
import { normalizeMatch, titleMatches } from '../../scripts/workflow-match.mjs'

describe('normalizeMatch', () => {
  it('tira acento, minúsculas e espaços duplicados/nas pontas', () => {
    expect(normalizeMatch('  Configurar   o Pixel do Meta ')).toBe('configurar o pixel do meta')
    expect(normalizeMatch('Criação de Ativos — Revisão')).toBe('criacao de ativos — revisao')
    expect(normalizeMatch('AÇÃO çÉÍÓÚ')).toBe('acao ceiou')
    expect(normalizeMatch(null)).toBe('')
  })
})

describe('titleMatches', () => {
  it('casa pelo começo do título, ignorando acento e espaço duplo', () => {
    expect(titleMatches('Instalar o Tag Manager na landing page (WordPress)', 'instalar o tag  manager')).toBe(true)
    expect(titleMatches('Criação de Ativos — Revisão final', 'Criacao de ativos — revisao')).toBe(true)
  })

  it('não casa no meio do título nem com match vazio', () => {
    expect(titleMatches('Revisar o Tag Manager', 'tag manager')).toBe(false)
    expect(titleMatches('Qualquer coisa', '   ')).toBe(false)
  })
})
