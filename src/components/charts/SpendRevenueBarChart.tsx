import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR, CHART_SURFACE_COLOR } from '@/lib/chart-colors'
import { formatCurrency } from '@/lib/format'

export interface ChannelBreakdown {
  channel: string
  investimento: number
  receita: number
  // Fase 48.3 — só usados na tabela por canal do relatório em PDF
  // (mês selecionado); o gráfico de barras em si não os lê.
  conversoes?: number
  cpa?: number | null
}

interface SpendRevenueBarChartProps {
  data: ChannelBreakdown[]
}

export function SpendRevenueBarChart({ data }: SpendRevenueBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300} debounce={50}>
      <BarChart data={data} barGap={4} barCategoryGap="20%">
        <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="channel"
          stroke={CHART_AXIS_COLOR}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID_COLOR }}
          fontSize={12}
        />
        <YAxis
          stroke={CHART_AXIS_COLOR}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={90}
          tickFormatter={(value: number) => formatCurrency(value)}
        />
        <Tooltip
          cursor={{ fill: CHART_GRID_COLOR, opacity: 0.4 }}
          contentStyle={{ background: CHART_SURFACE_COLOR, border: '1px solid #1A2540', borderRadius: 8, fontSize: 13 }}
          labelStyle={{ color: '#fff' }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 13, color: CHART_AXIS_COLOR }} />
        <Bar dataKey="investimento" name="Investimento" fill={CHART_COLORS.investimento} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="receita" name="Receita" fill={CHART_COLORS.receita} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
