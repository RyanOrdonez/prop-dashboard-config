import { useMemo } from 'react'
import type { Account, TradingDay, PageId } from '@/lib/types'
import { computeAccountStats, computeCombinedStats } from '@/lib/calculations'
import { formatCurrency, formatPnl, formatPercent, formatDate, pnlColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AccountSwitcher } from '@/components/layout/AccountSwitcher'
import { BalanceCurve } from '@/components/dashboard/BalanceCurve'
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Percent,
  Wallet,
  Shield,
  Activity,
  Target,
  PlusCircle,
  Zap,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPayoutGoal } from '@/lib/account-presets'

interface DashboardPageProps {
  accounts: Account[]
  tradingDays: TradingDay[]
  allTradingDays: TradingDay[]
  selectedAccountId: number | null
  onSelectAccount: (id: number | null) => void
  onViewDay: (dayId: number) => void
  onNavigate: (page: PageId) => void
}

export function DashboardPage({
  accounts,
  tradingDays,
  allTradingDays,
  selectedAccountId,
  onSelectAccount,
  onViewDay,
  onNavigate,
}: DashboardPageProps) {
  const stats = useMemo(() => {
    if (selectedAccountId) {
      const account = accounts.find(a => a.id === selectedAccountId)
      if (!account) return null
      return computeAccountStats(account, tradingDays)
    }
    return computeCombinedStats(accounts, allTradingDays)
  }, [accounts, tradingDays, allTradingDays, selectedAccountId])

  const selectedAccount = selectedAccountId
    ? accounts.find(a => a.id === selectedAccountId) || null
    : null

  const payoutGoal = selectedAccount
    ? getPayoutGoal(selectedAccount.account_type, 1)
    : 0

  if (!stats) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">No account data available.</p>
      </div>
    )
  }

  const profitGoalPct = Math.min((stats.cycleProfit / payoutGoal) * 100, 100)
  const consistencyPct = Math.min(stats.consistencyRatio * 100, 100)
  const consistencyLimit = selectedAccount?.consistency_limit || 0.20

  const sortedDays = [...tradingDays].sort((a, b) => a.trade_date.localeCompare(b.trade_date))

  // For recent days: use allTradingDays in combined view, filtered tradingDays for individual
  const recentDaysSource = selectedAccountId ? tradingDays : allTradingDays
  const recentDays = [...recentDaysSource]
    .sort((a, b) => b.trade_date.localeCompare(a.trade_date))
    .slice(0, 10)

  // Performance metrics
  const perfMetrics = useMemo(() => {
    const daysSource = selectedAccountId ? tradingDays : allTradingDays
    const sorted = [...daysSource].sort((a, b) => a.trade_date.localeCompare(b.trade_date))

    const greenDays = sorted.filter(d => d.net_pnl > 0).length
    const redDays = sorted.filter(d => d.net_pnl < 0).length
    const breakEvenDays = sorted.filter(d => d.net_pnl === 0).length

    const totalProfit = sorted.reduce((s, d) => s + d.total_profit, 0)
    const totalLoss = Math.abs(sorted.reduce((s, d) => s + d.total_loss, 0))
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0

    const avgWin = greenDays > 0 ? sorted.filter(d => d.net_pnl > 0).reduce((s, d) => s + d.net_pnl, 0) / greenDays : 0
    const avgLoss = redDays > 0 ? sorted.filter(d => d.net_pnl < 0).reduce((s, d) => s + d.net_pnl, 0) / redDays : 0

    let currentStreak = 0
    let streakType: 'win' | 'loss' | 'none' = 'none'
    for (let i = sorted.length - 1; i >= 0; i--) {
      const isWin = sorted[i].net_pnl > 0
      if (i === sorted.length - 1) {
        streakType = isWin ? 'win' : 'loss'
        currentStreak = 1
      } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
        currentStreak++
      } else {
        break
      }
    }

    return { greenDays, redDays, breakEvenDays, profitFactor, avgWin, avgLoss, currentStreak, streakType }
  }, [tradingDays, allTradingDays, selectedAccountId])

  // Per-account stats for All Accounts breakdown
  const perAccountStats = useMemo(() => {
    if (selectedAccountId) return []
    return accounts.map(acct => {
      const days = allTradingDays.filter(d => d.account_id === acct.id)
      const acctStats = computeAccountStats(acct, days)
      return { account: acct, stats: acctStats }
    })
  }, [accounts, allTradingDays, selectedAccountId])

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedAccount
              ? `${selectedAccount.account_name || selectedAccount.account_id}`
              : `All Accounts (${accounts.length})`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AccountSwitcher
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelect={onSelectAccount}
          />
          <Button onClick={() => onNavigate('add-day')} size="sm" className="gap-2">
            <PlusCircle size={16} />
            Add Day
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          title="Current Balance"
          value={formatCurrency(stats.currentBalance)}
          icon={<DollarSign size={18} />}
          subtitle={`Started at ${formatCurrency(selectedAccount?.starting_balance || 150000 * accounts.length)}`}
        />
        <StatCard
          title="Total P/L"
          value={formatPnl(stats.cycleProfit)}
          icon={<TrendingUp size={18} />}
          valueColor={pnlColor(stats.cycleProfit)}
          subtitle={`${stats.tradingDays} trading day${stats.tradingDays !== 1 ? 's' : ''}`}
        />
        <StatCard
          title="Largest Green Day"
          value={formatCurrency(stats.largestGreenDay)}
          icon={<BarChart3 size={18} />}
          valueColor="text-emerald-400"
          subtitle={stats.largestRedDay < 0 ? `Worst: ${formatCurrency(stats.largestRedDay)}` : 'No red days'}
        />
        <StatCard
          title="Avg Expectancy"
          value={formatPnl(stats.avgExpectancy)}
          icon={<Percent size={18} />}
          valueColor={pnlColor(stats.avgExpectancy)}
          subtitle={`${stats.totalTrades} total trades`}
        />
        <StatCard
          title="Total Commissions"
          value={formatCurrency(stats.totalCommissions)}
          icon={<Wallet size={18} />}
          subtitle={`${stats.tradingDays} trading day${stats.tradingDays !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Profit Curves */}
      <BalanceCurve
        tradingDays={sortedDays}
        accounts={accounts}
        allTradingDays={allTradingDays}
        selectedAccountId={selectedAccountId}
      />

      {/* Account Snapshot + Performance Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield size={14} />
              Account Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedAccount ? (
              <>
                <InfoRow label="Account ID" value={selectedAccount.account_id} />
                <InfoRow label="Type" value={selectedAccount.account_type.replace('_', ' ')} />
                <InfoRow label="Platform" value={selectedAccount.platform} />
                <InfoRow label="Min Balance" value={formatCurrency(selectedAccount.minimum_balance)} />
                <InfoRow label="Daily Loss Limit" value={selectedAccount.daily_loss_limit > 0 ? formatCurrency(selectedAccount.daily_loss_limit) : 'N/A'} />
                <InfoRow label="Trading Days" value={String(stats.tradingDays)} />
                <InfoRow label="Total P&L" value={formatPnl(stats.totalNetPnl)} valueColor={pnlColor(stats.totalNetPnl)} />
              </>
            ) : (
              <>
                <InfoRow label="Accounts" value={String(accounts.length)} />
                <InfoRow label="Total Balance" value={formatCurrency(stats.currentBalance)} />
                <InfoRow label="Trading Days" value={String(stats.tradingDays)} />
                <InfoRow label="Total P&L" value={formatPnl(stats.totalNetPnl)} valueColor={pnlColor(stats.totalNetPnl)} />
                <InfoRow label="Total Trades" value={String(stats.totalTrades)} />
                <InfoRow label="Win Rate" value={formatPercent(stats.overallWinRate)} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap size={14} />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Profit Factor"
              value={perfMetrics.profitFactor === Infinity ? '∞' : perfMetrics.profitFactor.toFixed(2)}
              valueColor={perfMetrics.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'}
            />
            <InfoRow label="Green Days" value={String(perfMetrics.greenDays)} valueColor="text-emerald-400" />
            <InfoRow label="Red Days" value={String(perfMetrics.redDays)} valueColor={perfMetrics.redDays > 0 ? 'text-red-400' : undefined} />
            <InfoRow label="Avg Winning Day" value={formatPnl(perfMetrics.avgWin)} valueColor="text-emerald-400" />
            <InfoRow label="Avg Losing Day" value={perfMetrics.avgLoss < 0 ? formatPnl(perfMetrics.avgLoss) : '$0.00'} valueColor={perfMetrics.avgLoss < 0 ? 'text-red-400' : undefined} />
            <InfoRow label="Avg Daily P&L" value={formatPnl(stats.avgDailyPnl)} valueColor={pnlColor(stats.avgDailyPnl)} />
            <InfoRow
              label="Current Streak"
              value={`${perfMetrics.currentStreak} ${perfMetrics.streakType === 'win' ? 'green' : 'red'} day${perfMetrics.currentStreak !== 1 ? 's' : ''}`}
              valueColor={perfMetrics.streakType === 'win' ? 'text-emerald-400' : 'text-red-400'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Profit Goal (individual account only) */}
      {selectedAccount && payoutGoal > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target size={14} />
              Profit Goal Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{profitGoalPct.toFixed(1)}%</span>
              </div>
              <Progress
                value={profitGoalPct}
                className="h-2"
                indicatorClassName={profitGoalPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <InfoRow label="Cycle Profit" value={formatPnl(stats.cycleProfit)} valueColor={pnlColor(stats.cycleProfit)} />
              <InfoRow label="Goal" value={formatCurrency(payoutGoal)} />
              <InfoRow
                label="Remaining"
                value={stats.cycleProfit >= payoutGoal ? 'Goal reached!' : formatCurrency(payoutGoal - stats.cycleProfit)}
                valueColor={stats.cycleProfit >= payoutGoal ? 'text-emerald-400' : undefined}
              />
              <InfoRow label="Above Min Balance" value={formatCurrency(stats.distanceFromMinBalance)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Account Breakdown (All Accounts view only) */}
      {!selectedAccountId && perAccountStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users size={14} />
              Account Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {perAccountStats.map(({ account: acct, stats: acctStats }) => (
                <button
                  key={acct.id}
                  onClick={() => onSelectAccount(acct.id)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acct.id % 2 === 0 ? '#6366f1' : '#22d3ee' }} />
                    <div className="text-left">
                      <p className="text-sm font-medium">{acct.account_name || acct.account_id}</p>
                      <p className="text-xs text-muted-foreground">{acct.account_type.replace('_', ' ')} · {acct.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium">{formatCurrency(acctStats.currentBalance)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">P&L</p>
                      <p className={`font-medium ${pnlColor(acctStats.cycleProfit)}`}>{formatPnl(acctStats.cycleProfit)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="font-medium">{formatPercent(acctStats.overallWinRate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Days</p>
                      <p className="font-medium">{acctStats.tradingDays}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Days */}
      {recentDays.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity size={14} />
              Recent Trading Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentDays.map((day) => {
                const dayAccount = !selectedAccountId
                  ? accounts.find(a => a.id === day.account_id)
                  : null
                return (
                  <button
                    key={day.id}
                    onClick={() => onViewDay(day.id)}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{formatDate(day.trade_date)}</span>
                      {dayAccount && (
                        <span className="text-xs text-muted-foreground">{dayAccount.account_name || dayAccount.account_id}</span>
                      )}
                      <Badge variant={day.net_pnl >= 0 ? 'success' : 'danger'}>
                        {day.net_pnl >= 0 ? 'Green' : 'Red'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-muted-foreground">{day.num_trades} trades</span>
                      <span className="text-muted-foreground">{formatPercent(day.win_rate)}</span>
                      <span className={`font-medium ${pnlColor(day.net_pnl)}`}>
                        {formatPnl(day.net_pnl)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
  valueColor,
}: {
  title: string
  value: string
  icon: React.ReactNode
  subtitle?: string
  valueColor?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${valueColor || ''}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueColor || ''}`}>{value}</span>
    </div>
  )
}
