import { describe, expect, it } from 'vitest'
import {
  daysUntilRecurrenceDue,
  effectiveActivityCompleted,
  effectiveTaskStatus,
  isCompletionStale,
  isRecurrenceDueAgain,
  resolveRecurrenceDays,
} from './recurrence'

describe('resolveRecurrenceDays', () => {
  it('resolves fixed intervals regardless of plan', () => {
    expect(resolveRecurrenceDays('7', null)).toBe(7)
    expect(resolveRecurrenceDays('15', 'validacao')).toBe(15)
    expect(resolveRecurrenceDays('30', 'dominacao')).toBe(30)
  })

  it('resolves plan-dependent cadences per plan tier', () => {
    expect(resolveRecurrenceDays('cadencia_reuniao', 'validacao')).toBe(30)
    expect(resolveRecurrenceDays('cadencia_reuniao', 'escala')).toBe(15)
    expect(resolveRecurrenceDays('cadencia_reuniao', 'dominacao')).toBe(7)
    expect(resolveRecurrenceDays('cadencia_otimizacao', 'validacao')).toBe(30)
    expect(resolveRecurrenceDays('cadencia_otimizacao', 'escala')).toBe(15)
    expect(resolveRecurrenceDays('cadencia_otimizacao', 'dominacao')).toBe(7)
  })

  it('cannot resolve a plan-dependent cadence without a plan', () => {
    expect(resolveRecurrenceDays('cadencia_reuniao', null)).toBeNull()
    expect(resolveRecurrenceDays('cadencia_otimizacao', null)).toBeNull()
  })
})

describe('isRecurrenceDueAgain', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('is never due without a recurrence or a completion date', () => {
    expect(isRecurrenceDueAgain(null, '2026-09-01T00:00:00Z', 'dominacao', now)).toBe(false)
    expect(isRecurrenceDueAgain('7', null, 'dominacao', now)).toBe(false)
    expect(isRecurrenceDueAgain('unica', '2026-09-01T00:00:00Z', 'dominacao', now)).toBe(false)
  })

  it('is not due before the interval elapses', () => {
    // completed 5 days ago, recurrence is 7 days
    expect(isRecurrenceDueAgain('7', '2026-09-25T12:00:00Z', null, now)).toBe(false)
  })

  it('is due once the interval elapses', () => {
    // completed 8 days ago, recurrence is 7 days
    expect(isRecurrenceDueAgain('7', '2026-09-22T12:00:00Z', null, now)).toBe(true)
  })

  it('resolves plan cadence at due-check time', () => {
    // completed 10 days ago — due for dominacao (7d), not for validacao (30d)
    const completedAt = '2026-09-20T12:00:00Z'
    expect(isRecurrenceDueAgain('cadencia_otimizacao', completedAt, 'dominacao', now)).toBe(true)
    expect(isRecurrenceDueAgain('cadencia_otimizacao', completedAt, 'validacao', now)).toBe(false)
  })
})

describe('effectiveActivityCompleted', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('mirrors raw completed when there is no recurrence', () => {
    expect(effectiveActivityCompleted(true, null, null, null, now)).toBe(true)
    expect(effectiveActivityCompleted(false, null, null, null, now)).toBe(false)
  })

  it('stays completed while inside the recurrence window', () => {
    expect(effectiveActivityCompleted(true, '30', '2026-09-25T12:00:00Z', 'validacao', now)).toBe(true)
  })

  it('reopens once the recurrence window has passed', () => {
    expect(effectiveActivityCompleted(true, '7', '2026-09-01T12:00:00Z', 'validacao', now)).toBe(false)
  })

  it('never reopens an item that was never completed', () => {
    expect(effectiveActivityCompleted(false, '7', null, 'validacao', now)).toBe(false)
  })
})

describe('effectiveTaskStatus', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('leaves non-done statuses untouched', () => {
    expect(effectiveTaskStatus('backlog', '7', null, null, now)).toBe('backlog')
    expect(effectiveTaskStatus('in_progress', '7', '2026-09-01T00:00:00Z', 'dominacao', now)).toBe('in_progress')
  })

  it('reopens a done task as "todo" once its recurrence is due', () => {
    expect(effectiveTaskStatus('done', '7', '2026-09-01T00:00:00Z', 'dominacao', now)).toBe('todo')
  })

  it('keeps a done task done while inside the recurrence window', () => {
    expect(effectiveTaskStatus('done', '30', '2026-09-25T00:00:00Z', 'validacao', now)).toBe('done')
  })
})

describe('isCompletionStale', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('is never stale without a completion date', () => {
    expect(isCompletionStale(null, 1, now)).toBe(false)
  })

  it('is not stale within the grace period', () => {
    expect(isCompletionStale('2026-09-30T06:00:00Z', 1, now)).toBe(false)
  })

  it('is stale once the grace period elapses', () => {
    expect(isCompletionStale('2026-09-28T12:00:00Z', 1, now)).toBe(true)
  })

  it('defaults the grace period to 1 day', () => {
    expect(isCompletionStale('2026-09-29T00:00:00Z', undefined, now)).toBe(true)
    expect(isCompletionStale('2026-09-30T00:00:00Z', undefined, now)).toBe(false)
  })
})

describe('daysUntilRecurrenceDue', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('is null without a recurrence or a completion date', () => {
    expect(daysUntilRecurrenceDue(null, '2026-09-25T12:00:00Z', 'dominacao', now)).toBeNull()
    expect(daysUntilRecurrenceDue('7', null, 'dominacao', now)).toBeNull()
    expect(daysUntilRecurrenceDue('unica', '2026-09-25T12:00:00Z', 'dominacao', now)).toBeNull()
  })

  it('is null when a plan-dependent cadence has no plan to resolve against', () => {
    expect(daysUntilRecurrenceDue('cadencia_otimizacao', '2026-09-25T12:00:00Z', null, now)).toBeNull()
  })

  it('counts down the days remaining until the next cycle', () => {
    // completed 2 days ago, recurrence is 7 days -> 5 days left
    expect(daysUntilRecurrenceDue('7', '2026-09-28T12:00:00Z', null, now)).toBe(5)
  })

  it('resolves plan cadence the same way isRecurrenceDueAgain does', () => {
    const completedAt = '2026-09-25T12:00:00Z'
    expect(daysUntilRecurrenceDue('cadencia_otimizacao', completedAt, 'dominacao', now)).toBe(2)
    expect(daysUntilRecurrenceDue('cadencia_otimizacao', completedAt, 'validacao', now)).toBe(25)
  })
})
