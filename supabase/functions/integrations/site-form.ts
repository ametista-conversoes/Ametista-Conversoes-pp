// Ametista Conversões — Fase 60: corpo do webhook do formulário do site
// (widget Formulário do Elementor) normalizado num formato só.
//
// Funções puras (sem Deno/Supabase): a Edge Function `integrations` usa e o
// Vitest testa (src/lib/site-form.test.ts). O Elementor manda 3 formatos:
//   (a) urlencoded "simples": chave = rótulo do campo (ou o ID, se não tiver
//       rótulo) + metadados com nomes fixos ("Page URL", "Date"...);
//   (b) urlencoded "Dados avançados": fields[ID][value], fields[ID][title],
//       meta[page_url][value], form[name]...;
//   (c) JSON (mesmas duas formas, como objeto).

export interface SiteFormField {
  id: string
  rotulo: string
  valor: string
}

export interface SiteFormPayload {
  campos: SiteFormField[]
  meta: Record<string, string>
}

export const SITE_FORM_TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
] as const
export type SiteFormTrackingKey = (typeof SITE_FORM_TRACKING_KEYS)[number]

export interface SiteFormLead {
  campos: SiteFormField[]
  tracking: Record<SiteFormTrackingKey, string | null>
  pageUrl: string | null
  /** Telefone (só dígitos, sem 55) ou e-mail (minúsculo) — pra deduplicar. */
  contactKey: string | null
}

// Metadados do modo simples (nomes em inglês, fixos no Elementor).
const SIMPLE_META_KEYS: Record<string, string> = {
  'page url': 'page_url',
  date: 'date',
  time: 'time',
  'user agent': 'user_agent',
  'remote ip': 'remote_ip',
  'powered by': 'credit',
  'form name': 'form_name',
  'form id': 'form_id',
}

const FIELD_KEY = /^fields\[([^\]]+)\]\[([^\]]+)\]$/
const META_KEY = /^meta\[([^\]]+)\]\[([^\]]+)\]$/

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Pares chave/valor (urlencoded ou JSON) → campos + meta. */
function fromPairs(pairs: Array<[string, string]>): SiteFormPayload {
  const advanced = pairs.some(([key]) => FIELD_KEY.test(key))
  if (advanced) {
    const fields = new Map<string, { title?: string; value?: string }>()
    const meta: Record<string, string> = {}
    for (const [key, value] of pairs) {
      const field = key.match(FIELD_KEY)
      if (field) {
        const entry = fields.get(field[1]) ?? {}
        if (field[2] === 'value') entry.value = value
        if (field[2] === 'title') entry.title = value
        fields.set(field[1], entry)
        continue
      }
      const metaMatch = key.match(META_KEY)
      if (metaMatch && metaMatch[2] === 'value') meta[metaMatch[1]] = value
      else if (key === 'form[name]') meta.form_name = value
      else if (key === 'form[id]') meta.form_id = value
    }
    return {
      campos: [...fields].map(([id, f]) => ({ id, rotulo: f.title?.trim() || id, valor: f.value ?? '' })),
      meta,
    }
  }

  const campos: SiteFormField[] = []
  const meta: Record<string, string> = {}
  for (const [key, value] of pairs) {
    const metaKey = SIMPLE_META_KEYS[normalizeKey(key)]
    if (metaKey) meta[metaKey] = value
    else campos.push({ id: key, rotulo: key, valor: value })
  }
  return { campos, meta }
}

/** Achata um objeto JSON nas mesmas chaves do urlencoded
 * (`{fields: {nome: {value}}}` → `fields[nome][value]`). */
function flattenJson(value: unknown, prefix = '', out: Array<[string, string]> = []): Array<[string, string]> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      flattenJson(inner, prefix ? `${prefix}[${key}]` : key, out)
    }
  } else if (prefix) {
    out.push([prefix, value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value)])
  }
  return out
}

/** Corpo cru do webhook → campos + meta. Lança erro se o corpo não for
 * nenhum dos 3 formatos. */
export function parseSiteFormBody(contentType: string, body: string): SiteFormPayload {
  const trimmed = body.trim()
  if (contentType.includes('application/json') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON precisa ser um objeto')
    return fromPairs(flattenJson(parsed))
  }
  return fromPairs([...new URLSearchParams(trimmed)])
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_HINT = /(tel|fone|phone|whats|celular|zap)/i

/** Telefone (preferência) ou e-mail do lead, normalizado. */
export function contactKeyFrom(campos: SiteFormField[]): string | null {
  for (const campo of campos) {
    if (!PHONE_HINT.test(`${campo.id} ${campo.rotulo}`)) continue
    let digits = digitsOnly(campo.valor)
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2)
    if (digits.length >= 8) return `tel:${digits}`
  }
  for (const campo of campos) {
    const value = campo.valor.trim().toLowerCase()
    if (EMAIL.test(value)) return `email:${value}`
  }
  return null
}

/** Separa UTM/gclid/fbclid (pelo ID ou rótulo do campo) das respostas
 * comuns. Sem campo oculto de UTM, tenta a query string do page_url. */
export function toSiteFormLead(payload: SiteFormPayload): SiteFormLead {
  const tracking = Object.fromEntries(SITE_FORM_TRACKING_KEYS.map((k) => [k, null])) as Record<SiteFormTrackingKey, string | null>
  const campos: SiteFormField[] = []
  let pageUrl = payload.meta.page_url?.trim() || null

  for (const campo of payload.campos) {
    const key = [campo.id, campo.rotulo].map(normalizeKey).find((k) => (SITE_FORM_TRACKING_KEYS as readonly string[]).includes(k))
    if (key) {
      if (campo.valor.trim()) tracking[key as SiteFormTrackingKey] = campo.valor.trim()
    } else if (normalizeKey(campo.id) === 'page_url') {
      pageUrl = pageUrl ?? (campo.valor.trim() || null)
    } else {
      campos.push(campo)
    }
  }

  if (pageUrl) {
    try {
      const params = new URL(pageUrl).searchParams
      for (const key of SITE_FORM_TRACKING_KEYS) tracking[key] = tracking[key] ?? (params.get(key)?.trim() || null)
    } catch {
      // page_url sem formato de URL — fica só o que veio nos campos
    }
  }

  return { campos, tracking, pageUrl, contactKey: contactKeyFrom(campos) }
}
