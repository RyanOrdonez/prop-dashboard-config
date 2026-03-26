import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Account, TradingDay } from '@/lib/types'
import { formatCurrency, formatPnl } from '@/lib/utils'
import { LineChart as LineChartIcon, TrendingUp } from 'lucide-react'

interface BalanceCurveProps {
  tradingDays: TradingDay[]
  accounts: Account[]
  allTradingDays: TradingDay[]
  selectedAccountId: number | null
}

const ACCOUNT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#ec4899']

export function BalanceCurve({ tradingDays, accounts, allTradingDays, selectedAccountId }: BalanceCurveProps) {

  // Single account: cycle profit per day
  const singleData = useMemo(() => {
    if (!selectedAccountId) return []
    const account = accounts.find(a => a.id === selectedAccountId)
    if (!account) return []

    const sorted = [...tradingDays].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    const data = [{ date: 'Start', profit: 0 }]
    for (const day of sorted) {
      data.push({
        date: day.trade_date.slice(5),
        profit: day.account_balance - account.starting_balance,
      })
    }
    return data
  }, [tradingDays, accounts, selectedAccountId])

  // Combined view: separate data for combined chart and per-account chart
  const combinedData = useMemo(() => {
    if (selectedAccountId) return []
    const allDates = [...new Set(allTradingDays.map(d => d.trade_date))].sort()
    if (allDates.length === 0) return []

    const data: any[] = [{ date: 'Start', combined: 0 }]
    for (const date of allDates) {
      const point: any = { date: date.slice(5) }
      let combinedProfit = 0
      for (const account of accounts) {
        const accountDays = allTradingDays
          .filter(d => d.account_id === account.id && d.trade_date <= date)
          .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
        const balance = accountDays.length > 0
          ? accountDays[accountDays.length - 1].account_balance
          : account.starting_balance
        combinedProfit += balance - account.starting_balance
      }
      point.combined = combinedProfit
      data.push(point)
    }
    return data
  }, [accounts, allTradingDays, selectedAccountId])

  const perAccountData = useMemo(() => {
    if (selectedAccountId) return []
    const allDates = [...new Set(allTradingDays.map(d => d.trade_date))].sort()
    if (allDates.length === 0) return []

    const data: any[] = [{ date: 'Start' }]
    for (const account of accounts) {
      data[0][account.account_name || account.account_id] = 0
    }

    for (const date of allDates) {
      const point: any = { date: date.slice(5) }
      for (const account of accounts) {
        const accountDays = allTradingDays
          .filter(d => d.account_id === account.id && d.trade_date <= date)
          .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
        const balance = accountDays.length > 0
          ? accountDays[accountDays.length - 1].account_balance
          : account.starting_balance
        point[account.account_name || account.account_id] = balance - account.starting_balance
      }
      data.push(point)
    }
    return data
  }, [accounts, allTradingDays, selectedAccountId])

  const hasData = selectedAccountId ? singleData.length > 1 : combinedData.length > 1

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <LineChartIcon size={14} />
            Profit Curve
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-sm text-muted-foreground">No trading data yet. Import a CSV to get started.</p>
        </CardContent>
      </Card>
    )
  }

  const pnlFormatter = (value: number) => formatPnl(value)
  const tooltipStyle = {
    backgroundColor: 'hsl(240 10% 3.9%)',
    border: '1px solid hsl(240 3.7% 15.9%)',
    borderRadius: '8px',
    fontSize: '12px',
  }

  // Single account view
  if (selectedAccountId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp size={14} />
            Cycle Profit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={singleData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="profitGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                tickFormatter={pnlFormatter}
                domain={['dataMin - 500', 'dataMax + 500']}
              />
              <ReferenceLine y={0} stroke="#a1a1aa" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatPnl(value), 'Profit']} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profitGradPos)" strokeWidth={2} name="Cycle Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  // Combined view: two charts stacked
  return (
    <div className="space-y-4">
      {/* Combined Cycle Profit */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp size={14} />
            Combined Cycle Profit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={combinedData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="combinedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                tickFormatter={pnlFormatter}
                domain={['dataMin - 500', 'dataMax + 500']}
              />
              <ReferenceLine y={0} stroke="#a1a1aa" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatPnl(value), 'Combined']} />
              <Area type="monotone" dataKey="combined" stroke="#10b981" fill="url(#combinedGrad)" strokeWidth={2} name="Combined Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per-Account Profit/Loss */}
      {accounts.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <LineChartIcon size={14} />
              Per-Account Profit / Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={perAccountData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                <defs>
                  {accounts.map((acct, i) => (
                    <linearGradient key={acct.id} id={`acctGrad-${acct.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickFormatter={pnlFormatter}
                  domain={['dataMin - 500', 'dataMax + 500']}
                />
                <ReferenceLine y={0} stroke="#a1a1aa" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatPnl(value), name]} />
                {accounts.map((acct, i) => (
                  <Area
                    key={acct.id}
                    type="monotone"
                    dataKey={acct.account_name || acct.account_id}
                    stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                    fill={`url(#acctGrad-${acct.id})`}
                    strokeWidth={2}
                    name={acct.account_name || acct.account_id}
                  />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  iconType="circle"
                  iconSize={8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
