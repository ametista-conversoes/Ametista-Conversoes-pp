import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTodayIsoDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'

// Fase 58 — "Vendas do mês" informadas pelo cliente (`client_monthly_sales`,
// migration-106). Faturamento = vendas × ticket médio; sem vendas informadas
// o faturamento/ROAS do mês fica vazio. Salvar dispara no banco o recálculo
// das metas do cliente e do relatório mensal daquele mês.

/** Primeiro dia do mês (YYYY-MM-01). Sem argumento, o mês corrente. */
export function monthStartIso(year?: number, month?: number): string {
  if (year && month) return `${year}-${String(month).padStart(2, '0')}-01`
  return `${getTodayIsoDate().slice(0, 7)}-01`
}

export interface MonthlySalesRecord {
  id: string
  client_id: string
  month: string
  sales: number
  updated_at: string
}

/** Todas as vendas informadas do cliente (uma linha por mês). */
export function useClientMonthlySales(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['monthly-sales', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_monthly_sales')
        .select('id, client_id, month, sales, updated_at')
        .eq('client_id', clientId as string)
        .order('month', { ascending: false })
      if (error) throw error
      return data as MonthlySalesRecord[]
    },
    enabled: !!clientId,
  })
}

/** Vendas informadas de um mês (`null` = ainda não informadas). */
export function salesForMonth(records: MonthlySalesRecord[] | undefined, month: string): number | null {
  return records?.find((r) => r.month === month)?.sales ?? null
}

export function useSaveMonthlySales() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, month, sales }: { clientId: string; month: string; sales: number }) => {
      const { error } = await supabase
        .from('client_monthly_sales')
        .upsert({ client_id: clientId, month, sales }, { onConflict: 'client_id,month' })
      if (error) throw error
    },
    onSuccess: (_data, { clientId }) => {
      // O gatilho no banco já recalculou metas e relatório do mês.
      queryClient.invalidateQueries({ queryKey: ['monthly-sales', clientId] })
      queryClient.invalidateQueries({ queryKey: ['manager-smart-goals'] })
      queryClient.invalidateQueries({ queryKey: ['smart-goals', clientId] })
      queryClient.invalidateQueries({ queryKey: ['monthly-report'] })
      toast.success('Vendas do mês salvas.')
    },
    onError: () => {
      toast.error('Não foi possível salvar as vendas do mês.')
    },
  })
}
