// Ametista Conversões — recorrência genérica de itens do Workflow de
// Atividades e do Workflow de Cliente (Fase 35). A MESMA linha cicla:
// marcar como concluído grava `completed_at`; o item continua
// "concluído" até `completed_at + intervalo` passar, aí volta a
// aparecer como pendente sozinho — tudo calculado aqui, em JS puro, em
// vez de precisar de cron no banco. O intervalo pode ser fixo (7/15/30
// dias) ou "a cadência do plano do cliente" (reunião ou otimização),
// resolvido a partir do plano atual a cada checagem — uma troca de
// plano já muda o ritmo das próximas renovações sem precisar editar o
// item.

export type RecurrenceInterval = '7' | '15' | '30' | 'cadencia_reuniao' | 'cadencia_otimizacao'

export const RECURRENCE_NONE_VALUE = 'unica'

export const RECURRENCE_OPTIONS: RecurrenceInterval[] = ['7', '15', '30', 'cadencia_reuniao', 'cadencia_otimizacao']

export const recurrenceLabels: Record<RecurrenceInterval, string> = {
  '7': 'A cada 7 dias',
  '15': 'A cada 15 dias',
  '30': 'A cada 30 dias',
  cadencia_reuniao: 'Cadência de reunião do plano',
  cadencia_otimizacao: 'Cadência de otimização do plano',
}

/** Curto, pra badge — mesma ideia, sem repetir "cadência de" duas vezes
 * ao lado de um ícone/rótulo já indicando que é recorrente. */
export const recurrenceShortLabels: Record<RecurrenceInterval, string> = {
  '7': '7 dias',
  '15': '15 dias',
  '30': '30 dias',
  cadencia_reuniao: 'cadência de reunião',
  cadencia_otimizacao: 'cadência de otimização',
}

// Mesmo mapeamento de `meeting_recurrence_interval` no banco (migration-015):
// Validação = mensal · Escala = quinzenal · Dominação = semanal.
const PLAN_MEETING_CADENCE_DAYS: Record<string, number> = {
  validacao: 30,
  escala: 15,
  dominacao: 7,
}

// Cadência de otimização (Fase 35) — novo conceito, espelha a mesma
// gradação da cadência de reunião (quanto mais alto o plano, mais
// frequente o toque), mas é um número à parte, ajustável sozinho no
// futuro sem afetar a cadência de reunião.
const PLAN_OPTIMIZATION_CADENCE_DAYS: Record<string, number> = {
  validacao: 30,
  escala: 15,
  dominacao: 7,
}

/** Quantos dias um item com essa recorrência espera antes de reaparecer,
 * pro plano informado. `null` = não dá pra resolver ainda (cadência
 * dependente de plano, mas o cliente não tem plano definido). */
export function resolveRecurrenceDays(recurrence: RecurrenceInterval, plan: string | null): number | null {
  switch (recurrence) {
    case '7':
      return 7
    case '15':
      return 15
    case '30':
      return 30
    case 'cadencia_reuniao':
      return plan ? (PLAN_MEETING_CADENCE_DAYS[plan] ?? null) : null
    case 'cadencia_otimizacao':
      return plan ? (PLAN_OPTIMIZATION_CADENCE_DAYS[plan] ?? null) : null
    default:
      return null
  }
}

/** Verdadeiro quando um item concluído já passou do intervalo e deve
 * voltar a aparecer como pendente. Item sem recorrência, ou nunca
 * concluído, nunca "vence" — comportamento idêntico ao de antes da
 * Fase 35 existir. */
export function isRecurrenceDueAgain(
  recurrence: RecurrenceInterval | string | null,
  completedAt: string | null,
  plan: string | null,
  now: Date = new Date(),
): boolean {
  if (!recurrence || !completedAt) return false
  if (!RECURRENCE_OPTIONS.includes(recurrence as RecurrenceInterval)) return false
  const days = resolveRecurrenceDays(recurrence as RecurrenceInterval, plan)
  if (days == null) return false
  const dueAt = new Date(completedAt)
  dueAt.setDate(dueAt.getDate() + days)
  return now >= dueAt
}

/** Estado "efetivo" de conclusão de um item do checklist de Atividades —
 * o `completed` cru do banco, a não ser que a recorrência já tenha
 * vencido, caso em que volta a contar como pendente. */
export function effectiveActivityCompleted(
  rawCompleted: boolean,
  recurrence: RecurrenceInterval | string | null,
  completedAt: string | null,
  plan: string | null,
  now: Date = new Date(),
): boolean {
  if (!rawCompleted) return false
  return !isRecurrenceDueAgain(recurrence, completedAt, plan, now)
}

/** Mesma ideia pra tarefas do cliente (`client_tasks`), que usam um
 * status de 5 estados em vez de um booleano — "vencida" volta a
 * aparecer como "todo" (mesmo estado que o próprio Portal Cliente usa
 * ao desmarcar uma tarefa manualmente). */
export function effectiveTaskStatus(
  rawStatus: string,
  recurrence: RecurrenceInterval | string | null,
  completedAt: string | null,
  plan: string | null,
  now: Date = new Date(),
): string {
  if (rawStatus !== 'done') return rawStatus
  return isRecurrenceDueAgain(recurrence, completedAt, plan, now) ? 'todo' : rawStatus
}

/** Fase 36.1 — um item concluído (recorrente ou não) só fica junto dos
 * pendentes por `graceDays`; depois disso é candidato a entrar numa
 * seção colapsável "Concluídas" (decisão de onde fica é de quem chama,
 * essa função só diz se já passou do prazo). Item recorrente sai do
 * colapso sozinho no instante em que `isRecurrenceDueAgain` vira
 * verdadeiro — mesmo cálculo, sem precisar "desarquivar" nada, porque
 * isso nunca é um arquivamento de verdade (não mexe no banco). */
export function isCompletionStale(completedAt: string | null, graceDays = 1, now: Date = new Date()): boolean {
  if (!completedAt) return false
  const staleAt = new Date(completedAt)
  staleAt.setDate(staleAt.getDate() + graceDays)
  return now >= staleAt
}
