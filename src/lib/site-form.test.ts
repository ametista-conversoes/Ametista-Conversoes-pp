import { describe, expect, it } from 'vitest'
import { contactKeyFrom, parseSiteFormBody, toSiteFormLead } from '../../supabase/functions/integrations/site-form.ts'

const FORM = 'application/x-www-form-urlencoded'

describe('parseSiteFormBody', () => {
  it('(a) urlencoded simples: chave = rótulo, metadados do Elementor viram meta', () => {
    const body = new URLSearchParams({
      Nome: 'Maria Silva',
      WhatsApp: '(11) 98888-7777',
      utm_content: '#001 | VID | Teste | v1',
      Date: 'outubro 27, 2026',
      'Page URL': 'https://clinica.com.br/lp/',
    }).toString()
    expect(parseSiteFormBody(FORM, body)).toEqual({
      campos: [
        { id: 'Nome', rotulo: 'Nome', valor: 'Maria Silva' },
        { id: 'WhatsApp', rotulo: 'WhatsApp', valor: '(11) 98888-7777' },
        { id: 'utm_content', rotulo: 'utm_content', valor: '#001 | VID | Teste | v1' },
      ],
      meta: { date: 'outubro 27, 2026', page_url: 'https://clinica.com.br/lp/' },
    })
  })

  it('(b) urlencoded "Dados avançados": fields[ID][value/title] e meta[...][value]', () => {
    const body = new URLSearchParams({
      'fields[name][id]': 'name',
      'fields[name][title]': 'Nome',
      'fields[name][value]': 'João',
      'fields[utm_source][title]': '',
      'fields[utm_source][value]': 'google',
      'meta[page_url][title]': 'URL da página',
      'meta[page_url][value]': 'https://site.com/lp',
      'form[name]': 'Contato LP',
    }).toString()
    expect(parseSiteFormBody(FORM, body)).toEqual({
      campos: [
        { id: 'name', rotulo: 'Nome', valor: 'João' },
        { id: 'utm_source', rotulo: 'utm_source', valor: 'google' },
      ],
      meta: { page_url: 'https://site.com/lp', form_name: 'Contato LP' },
    })
  })

  it('(c) JSON, nas duas formas', () => {
    expect(parseSiteFormBody('application/json', JSON.stringify({ Nome: 'Ana', Interesse: 'Clareamento' })).campos).toEqual([
      { id: 'Nome', rotulo: 'Nome', valor: 'Ana' },
      { id: 'Interesse', rotulo: 'Interesse', valor: 'Clareamento' },
    ])
    const advanced = { fields: { email: { title: 'E-mail', value: 'ana@x.com' } }, meta: { page_url: { value: 'https://a.com' } } }
    expect(parseSiteFormBody('application/json', JSON.stringify(advanced))).toEqual({
      campos: [{ id: 'email', rotulo: 'E-mail', valor: 'ana@x.com' }],
      meta: { page_url: 'https://a.com' },
    })
    expect(() => parseSiteFormBody('application/json', '[1,2]')).toThrow()
  })
})

describe('toSiteFormLead', () => {
  it('tira UTM/gclid das respostas (pelo ID ou rótulo, sem diferenciar maiúsculas)', () => {
    const lead = toSiteFormLead({
      campos: [
        { id: 'name', rotulo: 'Nome', valor: 'João' },
        { id: 'field_1', rotulo: 'UTM_Campaign', valor: 'Clareamento' },
        { id: 'gclid', rotulo: 'gclid', valor: 'abc' },
        { id: 'utm_term', rotulo: 'utm_term', valor: '' },
      ],
      meta: {},
    })
    expect(lead.campos).toEqual([{ id: 'name', rotulo: 'Nome', valor: 'João' }])
    expect(lead.tracking).toMatchObject({ utm_campaign: 'Clareamento', gclid: 'abc', utm_term: null, utm_source: null })
  })

  it('sem campo oculto, pega a UTM da query string do page_url', () => {
    const lead = toSiteFormLead({
      campos: [{ id: 'utm_source', rotulo: 'utm_source', valor: 'meta' }],
      meta: { page_url: 'https://site.com/lp?utm_source=google&utm_content=%23001%20%7C%20VID' },
    })
    expect(lead.pageUrl).toBe('https://site.com/lp?utm_source=google&utm_content=%23001%20%7C%20VID')
    expect(lead.tracking.utm_source).toBe('meta') // campo oculto vence
    expect(lead.tracking.utm_content).toBe('#001 | VID')
  })
})

describe('contactKeyFrom', () => {
  it('telefone (sem 55 e sem máscara) tem preferência; senão e-mail minúsculo', () => {
    expect(contactKeyFrom([{ id: 'whatsapp', rotulo: 'WhatsApp', valor: '+55 (11) 98888-7777' }])).toBe('tel:11988887777')
    expect(contactKeyFrom([{ id: 'email', rotulo: 'E-mail', valor: ' Ana@X.com ' }])).toBe('email:ana@x.com')
    expect(contactKeyFrom([{ id: 'nome', rotulo: 'Nome', valor: 'Ana' }])).toBeNull()
  })
})
