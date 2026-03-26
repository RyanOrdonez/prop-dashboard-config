// ─── Database Row Types ──────────────────────────────────────

export interface Account {
  id: number
  account_id: string
  account_name: string
  account_type: string
  starting_balance: number
  minimum_balance: number
  daily_loss_limit: number
  platform: string
  first_payout_goal: number
  later_payout_goal: number
  max_payout_first3: number
  max_payout_later: number
  min_payout: number
  consistency_limit: number
  profit_split: number
  commission_per_contract: number
  created_at: string
  updated_at: string
}

export interface TradingDay {
  id: number
  account_id: number
  trade_date: string
  gross_pnl: number
  commissions: number
  net_pnl: number
  account_balance: number
  num_trades: number
  num_contracts: number
  win_count: number
  loss_count: number
  win_rate: number
  avg_trade_pnl: number
  avg_trade_duration_sec: number
  largest_win: number
  largest_loss: number
  total_profit: number
  total_loss: number
  avg_win: number
  avg_loss: number
  max_runup: number
  max_drawdown: number
  expectancy: number
  raw_csv_text: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Trade {
  id: number
  account_id: number
  trading_day_id: number
  trade_date: string
  symbol: string
  qty: number
  buy_price: number
  sell_price: number
  pnl: number
  bought_timestamp: string
  sold_timestamp: string
  duration_seconds: number
  duration_text: string
  created_at: string
}

// ─── Computed Types ──────────────────────────────────────────

export interface AccountStats {
  currentBalance: number
  cycleProfit: number
  totalNetPnl: number
  tradingDays: number
  largestGreenDay: number
  largestRedDay: number
  consistencyRatio: number
  consistencyPct: string
  estimatedTakeHome: number
  totalCommissions: number
  avgDailyPnl: number
  totalTrades: number
  overallWinRate: number
  avgExpectancy: number
  distanceFromMinBalance: number
  dailyLossBuffer: number
}

export interface PayoutEligibility {
  profitGoalMet: boolean
  consistencyOk: boolean
  minPayoutMet: boolean
  maxPayoutOk: boolean
  requestWithinProfit: boolean
  allPassed: boolean
  cycleProfit: number
  payoutGoal: number
  maxPayout: number
  consistencyRatio: number
}

export interface Payout {
  id: number
  account_id: number
  payout_number: number
  amount: number
  trader_take_home: number
  payout_date: string
  notes: string
  created_at: string
}

export type PageId = 'dashboard' | 'payout' | 'journal' | 'add-day' | 'settings' | 'day-detail'

export interface AppState {
  currentPage: PageId
  selectedAccountId: number | null // null = combined view
  selectedDayId: number | null
  accounts: Account[]
  tradingDays: TradingDay[]
  isLoading: boolean
}

// ─── Electron API type for window ────────────────────────────

export interface ElectronAPI {
  getAccounts: () => Promise<Account[]>
  addAccount: (account: Partial<Account>) => Promise<Account>
  updateAccount: (id: number, account: Partial<Account>) => Promise<Account>
  deleteAccount: (id: number) => Promise<void>
  getTradingDays: (accountId?: number) => Promise<TradingDay[]>
  getTradingDay: (id: number) => Promise<TradingDay>
  deleteTradingDay: (id: number) => Promise<void>
  getTradesForDay: (tradingDayId: number) => Promise<Trade[]>
  importCSV: (accountId: number) => Promise<{ canceled: boolean; tradingDay?: TradingDay; duplicate?: boolean; tradeDate?: string }>
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<void>
  getPayouts: (accountId?: number) => Promise<Payout[]>
  recordPayout: (payout: Partial<Payout>) => Promise<Payout>
  deletePayout: (id: number) => Promise<void>
  exportJournalCSV: (accountId?: number) => Promise<string | null>
  exportBackupJSON: () => Promise<string | null>
  importBackupJSON: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
