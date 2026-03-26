import type { Account, TradingDay, AccountStats, PayoutEligibility } from './types'

export function computeAccountStats(account: Account, days: TradingDay[]): AccountStats {
  const sortedDays = [...days].sort((a, b) => a.trade_date.localeCompare(b.trade_date))

  const currentBalance = sortedDays.length > 0
    ? sortedDays[sortedDays.length - 1].account_balance
    : account.starting_balance

  const cycleProfit = currentBalance - account.starting_balance
  const totalNetPnl = sortedDays.reduce((sum, d) => sum + d.net_pnl, 0)

  const greenDays = sortedDays.filter(d => d.net_pnl > 0)
  const redDays = sortedDays.filter(d => d.net_pnl < 0)

  const largestGreenDay = greenDays.length > 0
    ? Math.max(...greenDays.map(d => d.net_pnl))
    : 0

  const largestRedDay = redDays.length > 0
    ? Math.min(...redDays.map(d => d.net_pnl))
    : 0

  const consistencyRatio = cycleProfit > 0 && largestGreenDay > 0
    ? largestGreenDay / cycleProfit
    : 0

  const estimatedTakeHome = cycleProfit > 0
    ? cycleProfit * account.profit_split
    : 0

  const avgDailyPnl = sortedDays.length > 0
    ? totalNetPnl / sortedDays.length
    : 0

  const totalCommissions = sortedDays.reduce((sum, d) => sum + d.commissions, 0)
  const totalTrades = sortedDays.reduce((sum, d) => sum + d.num_trades, 0)
  const totalWins = sortedDays.reduce((sum, d) => sum + d.win_count, 0)
  const overallWinRate = totalTrades > 0 ? totalWins / totalTrades : 0

  const avgExpectancy = sortedDays.length > 0
    ? sortedDays.reduce((sum, d) => sum + d.expectancy, 0) / sortedDays.length
    : 0

  const distanceFromMinBalance = currentBalance - account.minimum_balance
  const lastDay = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null
  const dailyLossBuffer = lastDay
    ? account.daily_loss_limit
    : account.daily_loss_limit

  return {
    currentBalance,
    cycleProfit,
    totalNetPnl,
    tradingDays: sortedDays.length,
    largestGreenDay,
    largestRedDay,
    consistencyRatio,
    consistencyPct: `${(consistencyRatio * 100).toFixed(1)}%`,
    estimatedTakeHome,
    totalCommissions: Math.round(totalCommissions * 100) / 100,
    avgDailyPnl,
    totalTrades,
    overallWinRate,
    avgExpectancy,
    distanceFromMinBalance,
    dailyLossBuffer,
  }
}

export function computePayoutEligibility(
  account: Account,
  stats: AccountStats,
  requestedPayout: number,
  payoutNumber: number,
): PayoutEligibility {
  const payoutGoal = payoutNumber <= 1
    ? account.first_payout_goal
    : account.later_payout_goal

  const maxPayout = payoutNumber <= 3
    ? account.max_payout_first3
    : account.max_payout_later

  const profitGoalMet = stats.cycleProfit >= payoutGoal
  const consistencyOk = stats.consistencyRatio <= account.consistency_limit
  const minPayoutMet = requestedPayout >= account.min_payout
  const maxPayoutOk = requestedPayout <= maxPayout
  const requestWithinProfit = requestedPayout <= stats.cycleProfit

  return {
    profitGoalMet,
    consistencyOk,
    minPayoutMet,
    maxPayoutOk,
    requestWithinProfit,
    allPassed: profitGoalMet && consistencyOk && minPayoutMet && maxPayoutOk && requestWithinProfit,
    cycleProfit: stats.cycleProfit,
    payoutGoal,
    maxPayout,
    consistencyRatio: stats.consistencyRatio,
  }
}

export function computeCombinedStats(accounts: Account[], allDays: TradingDay[]): AccountStats {
  let totalBalance = 0
  let totalStarting = 0
  let totalNetPnl = 0
  let totalTrades = 0
  let totalWins = 0
  let largestGreenDay = 0
  let largestRedDay = 0
  let dayCount = 0
  let totalExpectancy = 0
  let totalMinBalance = 0
  let totalDLL = 0
  let totalCommissions = 0

  for (const account of accounts) {
    const accountDays = allDays.filter(d => d.account_id === account.id)
    const stats = computeAccountStats(account, accountDays)

    totalBalance += stats.currentBalance
    totalStarting += account.starting_balance
    totalNetPnl += stats.totalNetPnl
    totalTrades += stats.totalTrades
    totalWins += Math.round(stats.overallWinRate * stats.totalTrades)
    if (stats.largestGreenDay > largestGreenDay) largestGreenDay = stats.largestGreenDay
    if (stats.largestRedDay < largestRedDay) largestRedDay = stats.largestRedDay
    dayCount = Math.max(dayCount, stats.tradingDays)
    totalCommissions += stats.totalCommissions
    totalExpectancy += stats.avgExpectancy * stats.tradingDays
    totalMinBalance += account.minimum_balance
    totalDLL += account.daily_loss_limit
  }

  const cycleProfit = totalBalance - totalStarting
  const consistencyRatio = cycleProfit > 0 && largestGreenDay > 0
    ? largestGreenDay / cycleProfit
    : 0

  return {
    currentBalance: totalBalance,
    cycleProfit,
    totalNetPnl,
    tradingDays: dayCount,
    largestGreenDay,
    largestRedDay,
    consistencyRatio,
    consistencyPct: `${(consistencyRatio * 100).toFixed(1)}%`,
    estimatedTakeHome: cycleProfit > 0 ? cycleProfit * 0.9 : 0,
    totalCommissions: Math.round(totalCommissions * 100) / 100,
    avgDailyPnl: dayCount > 0 ? totalNetPnl / dayCount : 0,
    totalTrades,
    overallWinRate: totalTrades > 0 ? totalWins / totalTrades : 0,
    avgExpectancy: dayCount > 0 ? totalExpectancy / dayCount : 0,
    distanceFromMinBalance: totalBalance - totalMinBalance,
    dailyLossBuffer: totalDLL,
  }
}
