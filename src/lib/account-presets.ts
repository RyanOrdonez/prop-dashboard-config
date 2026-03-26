export interface AccountPreset {
  label: string
  account_type: string
  starting_balance: number
  minimum_balance: number
  daily_loss_limit: number
  first_payout_goal: number
  later_payout_goal: number
  max_payout_first3: number
  max_payout_later: number
  min_payout: number
  consistency_limit: number
  profit_split: number
  commission_per_contract: number
}

export const ACCOUNT_PRESETS: Record<string, AccountPreset> = {
  LUCID_DIRECT: {
    label: 'LucidDirect 150K',
    account_type: 'LUCID_DIRECT',
    starting_balance: 150000,
    minimum_balance: 144000,    // 150000 - 6000 MLL
    daily_loss_limit: 3000,
    first_payout_goal: 9000,
    later_payout_goal: 4500,
    max_payout_first3: 3000,    // Payouts 1-3
    max_payout_later: 3500,     // Payouts 4-6
    min_payout: 500,
    consistency_limit: 0.20,
    profit_split: 0.90,
    commission_per_contract: 0.50,
  },
  LUCID_PRO: {
    label: 'LucidPro 150K',
    account_type: 'LUCID_PRO',
    starting_balance: 150000,
    minimum_balance: 145500,    // 150000 - 4500 MLL
    daily_loss_limit: 2700,
    first_payout_goal: 1000,
    later_payout_goal: 1000,
    max_payout_first3: 3000,    // Payout 1
    max_payout_later: 3500,     // Payouts 2+
    min_payout: 500,
    consistency_limit: 0.40,
    profit_split: 0.90,
    commission_per_contract: 0.50,
  },
  LUCID_FLEX: {
    label: 'LucidFlex 150K',
    account_type: 'LUCID_FLEX',
    starting_balance: 150000,
    minimum_balance: 145500,    // 150000 - 4500 MLL
    daily_loss_limit: 0,        // No DLL on funded
    first_payout_goal: 0,       // Just net positive profit + 5 days with $250+
    later_payout_goal: 0,
    max_payout_first3: 3000,    // All payouts: 50% of profit up to $3,000
    max_payout_later: 3000,
    min_payout: 500,
    consistency_limit: 1.0,     // No consistency on funded (100% = effectively disabled)
    profit_split: 0.90,
    commission_per_contract: 0.50,
  },
  APEX_EOD: {
    label: 'Apex 150K EOD',
    account_type: 'APEX_EOD',
    starting_balance: 150000,
    minimum_balance: 145500,    // 150000 - 4500 MLL trailing EOD
    daily_loss_limit: 0,        // No fixed DLL
    first_payout_goal: 4600,    // Balance must reach $154,600 (min payout balance)
    later_payout_goal: 4600,
    max_payout_first3: 2000,    // Payouts 1-6
    max_payout_later: 2000,
    min_payout: 500,
    consistency_limit: 0.50,    // No single day > 50% of total profit
    profit_split: 1.0,          // 100% on first $25K, then 90/10
    commission_per_contract: 0.52,
  },
}

/** Get the max payout amount for a specific account type and payout number */
export function getMaxPayout(accountType: string, payoutNumber: number): number {
  switch (accountType) {
    case 'LUCID_DIRECT':
      return payoutNumber <= 3 ? 3000 : 3500
    case 'LUCID_PRO':
      return payoutNumber <= 1 ? 3000 : 3500
    case 'LUCID_FLEX':
      return 3000 // 50% of profit up to $3,000 (6 payouts then moved live)
    case 'APEX_EOD': {
      const apexSchedule: Record<number, number> = { 1: 2500, 2: 3000, 3: 3000, 4: 3000, 5: 4000, 6: 5000 }
      return apexSchedule[payoutNumber] ?? 0 // 0 = unlimited after 6th payout
    }
    default:
      return 3000
  }
}

/** Get the profit goal for a specific payout cycle */
export function getPayoutGoal(accountType: string, payoutNumber: number): number {
  switch (accountType) {
    case 'LUCID_DIRECT':
      return payoutNumber <= 1 ? 9000 : 4500
    case 'LUCID_PRO':
      return 1000
    case 'LUCID_FLEX':
      return 0 // No fixed goal, just net positive + 5 days with $250+
    case 'APEX_EOD':
      return 4600 // Balance must reach $154,600
    default:
      return 4500
  }
}

/** Get the profit split for Apex (changes after $25K withdrawn) */
export function getApexProfitSplit(totalWithdrawn: number): number {
  return totalWithdrawn < 25000 ? 1.0 : 0.90
}

/** Get eligibility rules that apply to each account type */
export function getEligibilityRules(accountType: string): string[] {
  switch (accountType) {
    case 'LUCID_DIRECT':
      return ['profit_goal', 'consistency']
    case 'LUCID_PRO':
      return ['profit_goal', 'consistency', 'above_buffer']
    case 'LUCID_FLEX':
      return ['five_profit_days', 'net_positive']
    case 'APEX_EOD':
      return ['five_profit_days_350', 'consistency', 'above_min_payout_balance']
    default:
      return ['profit_goal', 'consistency']
  }
}

export const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_PRESETS).map(([key, preset]) => ({
  value: key,
  label: preset.label,
}))
