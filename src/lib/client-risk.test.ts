import { describe, expect, it } from 'vitest'
import { computeClientHasProblems, getClientRiskDetails } from '@/lib/client-risk'
import type {
  ManagerAlertRecord,
  ManagerIncidentRecord,
  ManagerSmartGoalRecord,
  ManagerTaskRecord,
} from '@/hooks/useManagerPortalData'

const CLIENT_ID = 'client-1'
const OTHER_CLIENT_ID = 'client-2'

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function makeTask(overrides: Partial<ManagerTaskRecord> = {}): ManagerTaskRecord {
  return {
    id: 'task-1',
    title: 'Tarefa',
    description: null,
    client_id: CLIENT_ID,
    project_id: null,
    status: 'todo',
    priority: 'medium',
    category: null,
    due_date: null,
    archived_at: null,
    client: null,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<ManagerSmartGoalRecord> = {}): ManagerSmartGoalRecord {
  return {
    id: 'goal-1',
    title: 'Meta',
    client_id: CLIENT_ID,
    metric_type: 'roas',
    target_value: 10,
    current_value: 5,
    target_date: null,
    status: 'on_track',
    client: null,
    ...overrides,
  }
}

function makeIncident(overrides: Partial<ManagerIncidentRecord> = {}): ManagerIncidentRecord {
  return {
    id: 'incident-1',
    title: 'Incidente',
    client_id: CLIENT_ID,
    severity: 'medium',
    status: 'open',
    category: null,
    description: null,
    resolution: null,
    created_at: new Date().toISOString(),
    client: null,
    ...overrides,
  }
}

function makeAlert(overrides: Partial<ManagerAlertRecord> = {}): ManagerAlertRecord {
  return {
    id: 'alert-1',
    title: 'Alerta',
    message: null,
    client_id: CLIENT_ID,
    severity: 'medium',
    category: null,
    resolved: false,
    created_at: new Date().toISOString(),
    client: null,
    ...overrides,
  }
}

const EMPTY = { incidents: [], alerts: [], tasks: [], goals: [] }

describe('computeClientHasProblems', () => {
  it('sem nenhum sinal negativo, não está em problemas', () => {
    expect(computeClientHasProblems(CLIENT_ID, EMPTY)).toBe(false)
  })

  it('meta SMART atrasada (sem concluir) marca em problemas', () => {
    const goals = [makeGoal({ target_date: isoDaysFromNow(-5), status: 'at_risk' })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, goals })).toBe(true)
  })

  it('meta concluída com prazo no passado NÃO conta como atrasada', () => {
    const goals = [makeGoal({ target_date: isoDaysFromNow(-5), status: 'completed' })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, goals })).toBe(false)
  })

  it('1 incidente médio aberto sozinho não é suficiente', () => {
    const incidents = [makeIncident({ severity: 'medium', status: 'open' })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, incidents })).toBe(false)
  })

  it('2 incidentes médios abertos marcam em problemas', () => {
    const incidents = [makeIncident({ id: 'a' }), makeIncident({ id: 'b' })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, incidents })).toBe(true)
  })

  it('1 incidente alto/crítico aberto já é suficiente', () => {
    const incidents = [makeIncident({ severity: 'critical', status: 'open' })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, incidents })).toBe(true)
  })

  it('incidente resolvido não conta', () => {
    const incidents = [makeIncident({ severity: 'critical', status: 'resolved' })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, incidents })).toBe(false)
  })

  it('3 tarefas atrasadas sozinhas não são suficientes, 4 já marcam', () => {
    const overdueTask = () => makeTask({ id: crypto.randomUUID(), status: 'todo', due_date: isoDaysFromNow(-1) })
    const threeTasks = [overdueTask(), overdueTask(), overdueTask()]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, tasks: threeTasks })).toBe(false)

    const fourTasks = [...threeTasks, overdueTask()]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, tasks: fourTasks })).toBe(true)
  })

  it('tarefa atrasada porém concluída não conta', () => {
    const tasks = [makeTask({ status: 'done', due_date: isoDaysFromNow(-10) })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, tasks })).toBe(false)
  })

  it('1 alerta alto/crítico não resolvido já é suficiente', () => {
    const alerts = [makeAlert({ severity: 'high', resolved: false })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, alerts })).toBe(true)
  })

  it('sinais de outro cliente não afetam o cliente consultado', () => {
    const incidents = [
      makeIncident({ id: 'a', client_id: OTHER_CLIENT_ID, severity: 'critical' }),
    ]
    const goals = [makeGoal({ client_id: OTHER_CLIENT_ID, target_date: isoDaysFromNow(-5) })]
    expect(computeClientHasProblems(CLIENT_ID, { ...EMPTY, incidents, goals })).toBe(false)
  })
})

describe('getClientRiskDetails', () => {
  it('conta os sinais certos por categoria', () => {
    const details = getClientRiskDetails(CLIENT_ID, {
      incidents: [makeIncident({ severity: 'critical', status: 'open' })],
      alerts: [makeAlert({ severity: 'high', resolved: false }), makeAlert({ id: 'b', resolved: true })],
      tasks: [makeTask({ due_date: isoDaysFromNow(-1) }), makeTask({ id: 'b', due_date: null })],
      goals: [makeGoal({ target_date: isoDaysFromNow(-1), status: 'off_track' })],
    })

    expect(details.hasProblems).toBe(true)
    expect(details.overdueTasks).toBe(1)
    expect(details.overdueGoals).toBe(1)
    expect(details.activeAlerts).toBe(1)
    expect(details.activeIncidents).toBe(1)
  })
})
