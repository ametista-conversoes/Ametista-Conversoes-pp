// Fase 38 — constantes compartilhadas entre o formulário de criar/editar
// Ativo Digital (AssetFormDialog, tipo "Formulário (Google Forms)") e a
// vitrine de respostas (FormResponsesDialog, que agora só mostra o
// propósito, sem deixar editar ali). Extraído pra um lugar só pra não
// duplicar a lista de opções nos dois componentes.
export const FORM_PURPOSE_NONE = 'nenhum'

export type FormPurposeValue = 'vendas' | 'perdido' | null

export const FORM_PURPOSE_OPTIONS: { value: string; label: string }[] = [
  { value: FORM_PURPOSE_NONE, label: 'Genérico (classificação manual)' },
  { value: 'vendas', label: 'Formulário de Vendas — resposta nova já nasce "Venda"' },
  { value: 'perdido', label: 'Formulário de Objeções — resposta nova já nasce "Perdido"' },
]

export const formPurposeLabels: Record<string, string> = {
  vendas: 'Vendas',
  perdido: 'Objeções',
}
