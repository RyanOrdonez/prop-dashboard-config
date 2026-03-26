import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Account, TradingDay, Payout } from '@/lib/types'
import { computeAccountStats } from '@/lib/calculations'
import { formatCurrency, formatPnl, formatPercent, pnlColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AccountSwitcher } from '@/components/layout/AccountSwitcher'
import { getMaxPayout, getPayoutGoal, getEligibilityRules } from '@/lib/account-presets'
import { Wallet, CheckCircle2, XCircle, DollarSign, Trash2, History, Banknote, TrendingUp, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface PayoutPageProps {
  accounts: Account[]
  tradingDays: TradingDay[]
  allTradingDays: TradingDay[]
  selectedAccountId: number | null
  onSelectAccount: (id: number | null) => void
  onDataChange: () => void
}

const ACCOUNT_COLORS = [
  '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa',
  '#fb923c', '#22d3ee', '#e879f9', '#4ade80', '#f87171',
]

export function PayoutPage({ accounts, tradingDays, allTradingDays, selectedAccountId, onSelectAccount, onDataChange }: PayoutPageProps) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const loadPayouts = useCallback(async () => {
    try {
      const all = await window.electronAPI.getPayouts()
      setPayouts(all)
    } catch (err) {
      console.error('Failed to load payouts:', err)
    }
  }, [])

  useEffect(() => { loadPayouts() }, [loadPayouts])

  const handleDeletePayout = async (id: number) => {
    try {
      await window.electronAPI.deletePayout(id)
      await loadPayouts()
    } catch (err) {
      console.error('Failed to delete payout:', err)
    }
  }

  // Total real money collected across ALL accounts
  const totalRealMoney = payouts.reduce((sum, p) => sum + p.trader_take_home, 0)
  const totalWithdrawn = payouts.reduce((sum, p) => sum + p.amount, 0)
  const totalPayoutCount = payouts.length

  // ─── ALL ACCOUNTS VIEW ───────────────────────────────────────
  if (!selectedAccountId) {
    return (
      <AllAccountsView
        accounts={accounts}
        payouts={payouts}
        allTradingDays={allTradingDays}
        totalRealMoney={totalRealMoney}
        totalWithdrawn={totalWithdrawn}
        totalPayoutCount={totalPayoutCount}
        onSelectAccount={onSelectAccount}
        onDeletePayout={handleDeletePayout}
      />
    )
  }

  // ─── INDIVIDUAL ACCOUNT VIEW ─────────────────────────────────
  return (
    <SingleAccountView
      accounts={accounts}
      allTradingDays={allTradingDays}
      payouts={payouts}
      selectedAccountId={selectedAccountId}
      onSelectAccount={onSelectAccount}
      onDataChange={onDataChange}
      totalRealMoney={totalRealMoney}
      totalPayoutCount={totalPayoutCount}
      isRecording={isRecording}
      setIsRecording={setIsRecording}
      loadPayouts={loadPayouts}
      onDeletePayout={handleDeletePayout}
    />
  )
}

// ════════════════════════════════════════════════════════════════
// ALL ACCOUNTS OVERVIEW
// ════════════════════════════════════════════════════════════════

function AllAccountsView({
  accounts, payouts, allTradingDays, totalRealMoney, totalWithdrawn, totalPayoutCount,
  onSelectAccount, onDeletePayout,
}: {
  accounts: Account[]
  payouts: Payout[]
  allTradingDays: TradingDay[]
  totalRealMoney: number
  totalWithdrawn: number
  totalPayoutCount: number
  onSelectAccount: (id: number | null) => void
  onDeletePayout: (id: number) => void
}) {
  const accountMap = useMemo(() => {
    const m = new Map<number, Account>()
    accounts.forEach(a => m.set(a.id, a))
    return m
  }, [accounts])

  // Cumulative payout chart data: each payout as a bar, sorted by date
  const sortedPayouts = useMemo(() =>
    [...payouts].sort((a, b) => a.payout_date.localeCompare(b.payout_date)),
    [payouts]
  )

  const chartData = useMemo(() => {
    let cumulative = 0
    return sortedPayouts.map((p) => {
      cumulative += p.trader_take_home
      const acct = accountMap.get(p.account_id)
      return {
        label: `#${p.payout_number}`,
        date: p.payout_date,
        takeHome: p.trader_take_home,
        amount: p.amount,
        cumulative,
        accountName: acct?.account_name || acct?.account_id || 'Unknown',
        accountIdx: accounts.findIndex(a => a.id === p.account_id),
      }
    })
  }, [sortedPayouts, accountMap, accounts])

  // Per-account summary
  const perAccountSummary = useMemo(() => {
    return accounts.map((acct, idx) => {
      const acctPayouts = payouts.filter(p => p.account_id === acct.id)
      const acctDays = allTradingDays.filter(d => d.account_id === acct.id)
      const stats = computeAccountStats(acct, acctDays)
      const totalTakeHome = acctPayouts.reduce((s, p) => s + p.trader_take_home, 0)
      const totalAmount = acctPayouts.reduce((s, p) => s + p.amount, 0)
      const nextPayout = acctPayouts.length + 1
      const nextMax = getMaxPayout(acct.account_type, nextPayout)
      return {
        account: acct,
        color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
        payoutCount: acctPayouts.length,
        totalTakeHome,
        totalAmount,
        cycleProfit: stats.cycleProfit,
        nextPayoutNumber: nextPayout,
        nextMaxPayout: nextMax,
        exhausted: nextMax === -1,
      }
    })
  }, [accounts, payouts, allTradingDays])

  // Custom tooltip for chart
  const ChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
        <p className="font-medium">{d.accountName}</p>
        <p className="text-muted-foreground">{d.date}</p>
        <p className="text-emerald-400 font-medium">Take Home: {formatCurrency(d.takeHome)}</p>
        <p className="text-muted-foreground">Withdrawn: {formatCurrency(d.amount)}</p>
        <p className="text-xs text-muted-foreground mt-1">Cumulative: {formatCurrency(d.cumulative)}</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payout Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">All Accounts Overview</p>
        </div>
        <AccountSwitcher accounts={accounts} selectedAccountId={null} onSelect={onSelectAccount} />
      </div>

      {/* Real Money Collected Banner */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Banknote size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Real Money Collected</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRealMoney)}</p>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-xl font-bold">{totalPayoutCount}</p>
                <p className="text-xs text-muted-foreground">Payouts</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{formatCurrency(totalWithdrawn)}</p>
                <p className="text-xs text-muted-foreground">Total Withdrawn</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{accounts.length}</p>
                <p className="text-xs text-muted-foreground">Accounts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payout Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 size={14} />
              Payout History Chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="takeHome" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={ACCOUNT_COLORS[entry.accountIdx % ACCOUNT_COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 justify-center">
              {accounts.map((acct, idx) => (
                <div key={acct.id} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length] }} />
                  <span className="text-muted-foreground">{acct.account_name || acct.account_id}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Account Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {perAccountSummary.map((s) => (
          <Card key={s.account.id} className="cursor-pointer hover:border-emerald-500/30 transition-colors" onClick={() => onSelectAccount(s.account.id)}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="font-medium text-sm">{s.account.account_name || s.account.account_id}</span>
                <Badge variant="outline" className="text-xs ml-auto">{s.account.account_type.replace('_', ' ')}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Payouts</p>
                  <p className="text-sm font-medium">{s.payoutCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Take Home</p>
                  <p className="text-sm font-medium text-emerald-400">{formatCurrency(s.totalTakeHome)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cycle Profit</p>
                  <p className={`text-sm font-medium ${pnlColor(s.cycleProfit)}`}>{formatPnl(s.cycleProfit)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t flex justify-between text-xs text-muted-foreground">
                <span>Next: Payout #{s.nextPayoutNumber}</span>
                <span>{s.exhausted ? 'All payouts used' : `Max ${formatCurrency(s.nextMaxPayout)}`}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Payout History */}
      {sortedPayouts.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History size={14} />
              All Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...sortedPayouts].reverse().map((p) => {
                const acct = accountMap.get(p.account_id)
                const idx = accounts.findIndex(a => a.id === p.account_id)
                return (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length] }} />
                      <span className="text-sm font-medium">{acct?.account_name || acct?.account_id || 'Unknown'}</span>
                      <Badge variant="success" className="text-xs">#{p.payout_number}</Badge>
                      <span className="text-xs text-muted-foreground">{p.payout_date}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-sm font-medium text-emerald-400">{formatCurrency(p.trader_take_home)}</span>
                        <span className="text-xs text-muted-foreground ml-2">of {formatCurrency(p.amount)}</span>
                      </div>
                      <button
                        onClick={() => onDeletePayout(p.id)}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No payouts recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Select an account to check eligibility and record payouts</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SINGLE ACCOUNT VIEW
// ════════════════════════════════════════════════════════════════

function SingleAccountView({
  accounts, allTradingDays, payouts, selectedAccountId, onSelectAccount,
  onDataChange, totalRealMoney, totalPayoutCount,
  isRecording, setIsRecording, loadPayouts, onDeletePayout,
}: {
  accounts: Account[]
  allTradingDays: TradingDay[]
  payouts: Payout[]
  selectedAccountId: number
  onSelectAccount: (id: number | null) => void
  onDataChange: () => void
  totalRealMoney: number
  totalPayoutCount: number
  isRecording: boolean
  setIsRecording: (v: boolean) => void
  loadPayouts: () => Promise<void>
  onDeletePayout: (id: number) => void
}) {
  const account = accounts.find(a => a.id === selectedAccountId) || accounts[0]
  const accountDays = account ? allTradingDays.filter(d => d.account_id === account.id) : []
  const accountPayouts = account ? payouts.filter(p => p.account_id === account.id) : []

  const stats = useMemo(() => {
    if (!account) return null
    return computeAccountStats(account, accountDays)
  }, [account, accountDays])

  const nextPayoutNumber = accountPayouts.length + 1
  const maxPayout = account ? getMaxPayout(account.account_type, nextPayoutNumber) : 0
  const basePayoutGoal = account ? getPayoutGoal(account.account_type, nextPayoutNumber) : 0
  const effectiveSplit = account?.profit_split ?? 0.90
  const payoutsExhausted = maxPayout === -1

  // Dynamic effective goal: if consistency rule applies, you need enough profit
  // so your largest single day doesn't exceed the consistency limit
  const largestDayPnl = useMemo(
    () => accountDays.reduce((max, d) => Math.max(max, d.net_pnl), 0),
    [accountDays]
  )
  const consistencyAdjustedGoal = account && account.consistency_limit < 1
    ? Math.ceil((largestDayPnl / account.consistency_limit) * 100) / 100
    : 0
  const effectivePayoutGoal = Math.max(basePayoutGoal, consistencyAdjustedGoal)

  const requestedPayout = payoutsExhausted ? 0 : (maxPayout > 0 ? maxPayout : (stats?.cycleProfit ?? 0))

  const rules = account ? getEligibilityRules(account.account_type) : []
  const profitDaysOver250 = accountDays.filter(d => d.net_pnl >= 250).length
  const profitDaysOver350 = accountDays.filter(d => d.net_pnl >= 350).length
  const minTradingDays = accountDays.length >= 5

  const checks = useMemo(() => {
    if (!account || !stats) return []
    const items: { key: string; label: string; detail: string; passed: boolean }[] = []

    for (const rule of rules) {
      switch (rule) {
        case 'profit_goal': {
          items.push({ key: 'profit_goal', label: 'Profit goal reached', detail: `${formatPnl(stats.cycleProfit)} / ${formatCurrency(effectivePayoutGoal)}`, passed: stats.cycleProfit >= effectivePayoutGoal })
          break
        }
        case 'consistency': {
          const limit = account.consistency_limit
          items.push({ key: 'consistency', label: `Consistency below ${(limit * 100).toFixed(0)}%`, detail: `${formatPercent(stats.consistencyRatio)} / ${formatPercent(limit)}`, passed: stats.consistencyRatio <= limit || stats.cycleProfit <= 0 })
          break
        }
        case 'within_cycle_profit': {
          items.push({ key: 'within_cycle_profit', label: 'Payout within cycle profit', detail: `${formatCurrency(requestedPayout)} ≤ ${formatPnl(stats.cycleProfit)}`, passed: requestedPayout <= stats.cycleProfit })
          break
        }
        case 'above_buffer': {
          const buffer = account.starting_balance + (account.starting_balance - account.minimum_balance) + 100
          items.push({ key: 'above_buffer', label: 'Balance above buffer', detail: `${formatCurrency(stats.currentBalance)} ≥ ${formatCurrency(buffer)}`, passed: stats.currentBalance >= buffer })
          break
        }
        case 'five_profit_days': {
          items.push({ key: 'five_profit_days', label: '5 days with $250+ profit', detail: `${profitDaysOver250} / 5 days`, passed: profitDaysOver250 >= 5 })
          break
        }
        case 'net_positive': {
          items.push({ key: 'net_positive', label: 'Net positive profit in cycle', detail: formatPnl(stats.cycleProfit), passed: stats.cycleProfit > 0 })
          break
        }
        case 'five_profit_days_350': {
          items.push({ key: 'five_profit_days_350', label: '5 days with $350+ profit', detail: `${profitDaysOver350} / 5 days`, passed: profitDaysOver350 >= 5 })
          break
        }
        case 'above_min_payout_balance': {
          const minPayoutBalance = account.starting_balance + basePayoutGoal
          items.push({ key: 'above_min_payout_balance', label: 'Min payout balance met', detail: `${formatCurrency(stats.currentBalance)} ≥ ${formatCurrency(minPayoutBalance)}`, passed: stats.currentBalance >= minPayoutBalance })
          break
        }
      }
    }

    items.push({ key: 'min_trading_days', label: 'Minimum 5 trading days', detail: `${accountDays.length} / 5 days`, passed: minTradingDays })
    return items
  }, [account, stats, rules, effectivePayoutGoal, requestedPayout, profitDaysOver250, profitDaysOver350, accountDays.length, minTradingDays])

  const allPassed = checks.every(c => c.passed)

  const traderTakeHome = requestedPayout * effectiveSplit
  const firmShare = requestedPayout * (1 - effectiveSplit)
  const projectedBalance = (stats?.currentBalance ?? 0) - requestedPayout

  const handleRecordPayout = async () => {
    if (!account || isRecording) return
    setIsRecording(true)
    try {
      await window.electronAPI.recordPayout({
        account_id: account.id,
        payout_number: nextPayoutNumber,
        amount: requestedPayout,
        trader_take_home: traderTakeHome,
        payout_date: new Date().toISOString().slice(0, 10),
      })
      await loadPayouts()
      onDataChange()
    } catch (err) {
      console.error('Failed to record payout:', err)
    } finally {
      setIsRecording(false)
    }
  }

  if (!account || !stats) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Payout Tracker</h1>
        <p className="text-muted-foreground">Add an account first to track payouts.</p>
      </div>
    )
  }

  const goalProgress = effectivePayoutGoal > 0
    ? Math.min((stats.cycleProfit / effectivePayoutGoal) * 100, 100)
    : (stats.cycleProfit > 0 ? 100 : 0)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payout Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">{account.account_name || account.account_id}</p>
        </div>
        <AccountSwitcher accounts={accounts} selectedAccountId={selectedAccountId} onSelect={onSelectAccount} />
      </div>

      {/* Real Money Collected Banner */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Banknote size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Real Money Collected</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRealMoney)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{accountPayouts.length} payout{accountPayouts.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(accountPayouts.reduce((s, p) => s + p.trader_take_home, 0))} collected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Eligibility Checklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet size={14} />
              Payout #{nextPayoutNumber} Eligibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {effectivePayoutGoal > 0 && (
              <div className="mb-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Profit Goal Progress</span>
                  <span>{goalProgress.toFixed(0)}%</span>
                </div>
                <Progress
                  value={goalProgress}
                  className="h-2"
                  indicatorClassName={goalProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}
                />
              </div>
            )}

            {checks.map((check) => (
              <EligibilityRow key={check.key} label={check.label} detail={check.detail} passed={check.passed} />
            ))}

            <div className="pt-3 border-t">
              <div className="flex items-center gap-2">
                {allPassed ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">All checks passed — eligible for payout</span>
                  </>
                ) : (
                  <>
                    <XCircle size={18} className="text-red-400" />
                    <span className="text-sm font-medium text-red-400">Not yet eligible for payout</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Summary + Record */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign size={14} />
                Payout #{nextPayoutNumber} — Max Payout
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Payout Amount</span>
                <span className="font-bold text-lg">{payoutsExhausted ? 'All payouts used' : (maxPayout > 0 ? formatCurrency(maxPayout) : 'Unlimited')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trader Take Home ({(effectiveSplit * 100).toFixed(0)}%)</span>
                <span className="font-medium text-emerald-400">{formatCurrency(traderTakeHome)}</span>
              </div>
              {effectiveSplit < 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Firm Share ({((1 - effectiveSplit) * 100).toFixed(0)}%)</span>
                  <span className="font-medium">{formatCurrency(firmShare)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-3 border-t">
                <span className="text-muted-foreground">Projected Balance After</span>
                <span className="font-medium">{formatCurrency(projectedBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Cycle Profit</span>
                <span className={`font-medium ${pnlColor(stats.cycleProfit)}`}>{formatPnl(stats.cycleProfit)}</span>
              </div>

              <Button
                onClick={handleRecordPayout}
                disabled={isRecording || payoutsExhausted}
                className="w-full mt-2 gap-2"
                variant={allPassed && !payoutsExhausted ? 'default' : 'outline'}
              >
                <Banknote size={16} />
                {payoutsExhausted ? 'All payouts used for this account' : (isRecording ? 'Recording...' : `Record Payout #${nextPayoutNumber}`)}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Click to log this payout after it's been approved
              </p>
            </CardContent>
          </Card>

          {/* Account Payout History */}
          {accountPayouts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <History size={14} />
                  Payout History — {account.account_name || account.account_id}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {accountPayouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="success" className="text-xs">#{p.payout_number}</Badge>
                        <span className="text-sm">{p.payout_date}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-medium text-emerald-400">{formatCurrency(p.trader_take_home)}</span>
                          <span className="text-xs text-muted-foreground ml-2">of {formatCurrency(p.amount)}</span>
                        </div>
                        <button
                          onClick={() => onDeletePayout(p.id)}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Account Total</span>
                    <span className="font-medium text-emerald-400">
                      {formatCurrency(accountPayouts.reduce((s, p) => s + p.trader_take_home, 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Per-Day Progress Table ─────────────────────────────── */}
      <PayoutProgressTable account={account} accountDays={accountDays} basePayoutGoal={basePayoutGoal} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PER-DAY PROGRESS TABLE
// ════════════════════════════════════════════════════════════════

function PayoutProgressTable({ account, accountDays, basePayoutGoal }: {
  account: Account
  accountDays: TradingDay[]
  basePayoutGoal: number
}) {
  const sortedDaysChron = useMemo(
    () => [...accountDays].sort((a, b) => a.trade_date.localeCompare(b.trade_date)),
    [accountDays]
  )

  const rules = getEligibilityRules(account.account_type)
  const consistencyLimit = account.consistency_limit
  const hasProfitGoal = rules.includes('profit_goal') || rules.includes('above_min_payout_balance')
  const has350Rule = rules.includes('five_profit_days_350')
  const has250Rule = rules.includes('five_profit_days')
  const hasProfitDaysRule = has350Rule || has250Rule
  const profitDayThreshold = has350Rule ? 350 : 250
  const hasConsistency = rules.includes('consistency')
  const minPayoutBalance = account.starting_balance + basePayoutGoal

  const progressRows = useMemo(() => {
    let runningProfit = 0
    let largestDay = 0
    let profitDaysCount = 0

    return sortedDaysChron.map((day, idx) => {
      runningProfit = Math.round((runningProfit + day.net_pnl) * 100) / 100
      if (day.net_pnl > largestDay) largestDay = day.net_pnl
      if (day.net_pnl >= profitDayThreshold) profitDaysCount++

      // Dynamic effective goal: max of base goal and consistency-adjusted goal
      const consistencyGoal = consistencyLimit < 1
        ? Math.ceil((largestDay / consistencyLimit) * 100) / 100
        : 0
      const effectiveGoal = Math.max(basePayoutGoal, consistencyGoal)

      const profitProgress = effectiveGoal > 0
        ? Math.min((runningProfit / effectiveGoal) * 100, 100)
        : (runningProfit > 0 ? 100 : 0)

      const consistencyRatio = runningProfit > 0 ? largestDay / runningProfit : 0
      const consistencyMet = runningProfit <= 0 || consistencyRatio <= consistencyLimit
      const minBalanceMet = day.account_balance >= minPayoutBalance
      const profitDaysMet = profitDaysCount >= 5
      const minTradingDaysMet = (idx + 1) >= 5
      const profitGoalMet = hasProfitGoal
        ? (rules.includes('above_min_payout_balance')
          ? day.account_balance >= minPayoutBalance
          : runningProfit >= effectiveGoal)
        : runningProfit > 0

      return {
        dayNumber: idx + 1,
        date: day.trade_date,
        balance: day.account_balance,
        cycleProfit: runningProfit,
        effectiveGoal,
        profitProgress: Math.max(0, profitProgress),
        minBalanceMet,
        profitDaysMet,
        profitDaysCount,
        minTradingDaysMet,
        consistencyMet,
        consistencyRatio,
        profitGoalMet,
      }
    })
  }, [sortedDaysChron, basePayoutGoal, consistencyLimit, profitDayThreshold, hasProfitGoal, rules, account.minimum_balance, minPayoutBalance])

  // Display newest first
  const displayRows = [...progressRows].reverse()

  if (displayRows.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 size={14} />
          Payout Progress by Trading Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trade Day</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">EOD Balance</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cycle P&L</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Profit Progress</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Min Balance Met</th>
                {hasProfitDaysRule && (
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    5 Days ${profitDayThreshold}+ Met
                  </th>
                )}
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Min Trading Days</th>
                {hasConsistency && (
                  <>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Consistency Met</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Consistency %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.dayNumber} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2.5 font-medium">
                    <span>{row.dayNumber}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{row.date}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(row.balance)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${pnlColor(row.cycleProfit)}`}>
                    {formatPnl(row.cycleProfit)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${row.profitProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.max(0, row.profitProgress)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8">{row.profitProgress.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusCheck passed={row.minBalanceMet} />
                  </td>
                  {hasProfitDaysRule && (
                    <td className="px-3 py-2.5 text-center">
                      <StatusCheck passed={row.profitDaysMet} label={`${row.profitDaysCount}/5`} />
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    <StatusCheck passed={row.minTradingDaysMet} label={`${row.dayNumber}/5`} />
                  </td>
                  {hasConsistency && (
                    <>
                      <td className="px-3 py-2.5 text-center">
                        <StatusCheck passed={row.consistencyMet} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <span className={row.consistencyMet ? 'text-muted-foreground' : 'text-red-400'}>
                          {formatPercent(row.consistencyRatio)} / {formatPercent(consistencyLimit)}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusCheck({ passed, label }: { passed: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {passed ? (
        <CheckCircle2 size={14} className="text-emerald-400" />
      ) : (
        <XCircle size={14} className="text-red-400" />
      )}
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
    </span>
  )
}

function EligibilityRow({ label, detail, passed }: { label: string; detail: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <XCircle size={16} className="text-red-400" />
        )}
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant={passed ? 'success' : 'danger'} className="text-xs">
        {detail}
      </Badge>
    </div>
  )
}
