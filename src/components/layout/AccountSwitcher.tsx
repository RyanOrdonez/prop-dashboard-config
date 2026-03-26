import { cn } from '@/lib/utils'
import type { Account } from '@/lib/types'

interface AccountSwitcherProps {
  accounts: Account[]
  selectedAccountId: number | null
  onSelect: (accountId: number | null) => void
}

export function AccountSwitcher({ accounts, selectedAccountId, onSelect }: AccountSwitcherProps) {
  if (accounts.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
          selectedAccountId === null
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-secondary text-muted-foreground hover:text-foreground'
        )}
      >
        All Accounts
      </button>
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            selectedAccountId === account.id
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          {account.account_name || account.account_id}
        </button>
      ))}
    </div>
  )
}
