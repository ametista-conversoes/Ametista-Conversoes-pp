import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LabelCounts } from '@/lib/label-funnel'
import { supabase } from '@/lib/supabase'

// Fase 59 — contagem semanal das etiquetas do WhatsApp (`client_weekly_labels`,
// migration-107). Salvar uma semana faz o banco somar as vendas das semanas
// do mês em `client_monthly_sales`, que por sua vez recalcula metas e
// relatório (migration-106).

export interface WeeklyLabelsRecord extends LabelCounts {
  id: string
  client_id: string
  week_start: string
  updated_at: string
}

/** Todas as semanas registradas do cliente, da mais nova pra mais antiga. */
export function useClientWeeklyLabels(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['weekly-labels', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_weekly_labels')
        .select('id, client_id, week_start, novo, qualificado, agendado, venda, perdido, updated_at')
        .eq('client_id', clientId as string)
        .order('week_start', { ascending: false })
      if (error) throw error
      return data as WeeklyLabelsRecord[]
    },
    enabled: !!clientId,
  })
}

export function useSaveWeeklyLabels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, weekStart, counts }: { clientId: string; weekStart: string; counts: LabelCounts }) => {
      const { error } = await supabase
        .from('client_weekly_labels')
        .upsert({ client_id: clientId, week_start: weekStart, ...counts }, { onConflict: 'client_id,week_start' })
      if (error) throw error
    },
    onSuccess: (_data, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-labels', clientId] })
      // Vendas do mês (soma das semanas) e o que depende delas.
      queryClient.invalidateQueries({ queryKey: ['monthly-sales', clientId] })
      queryClient.invalidateQueries({ queryKey: ['manager-smart-goals'] })
      queryClient.invalidateQueries({ queryKey: ['smart-goals', clientId] })
      queryClient.invalidateQueries({ queryKey: ['monthly-report'] })
      toast.success('Etiquetas da semana salvas.')
    },
    onError: () => {
      toast.error('Não foi possível salvar as etiquetas da semana.')
    },
  })
}
