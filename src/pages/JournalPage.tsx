import { useState } from 'react'
import type { Account, TradingDay } from '@/lib/types'
import { formatCurrency, formatPnl, formatPercent, formatDate, pnlColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AccountSwitcher } from '@/components/layout/AccountSwitcher'
import { BookOpen, ChevronRight, Trash2 } from 'lucide-react'
import { TradingCalendar } from '@/components/journal/TradingCalendar'

interface JournalPageProps {
  accounts: Account[]
  tradingDays: TradingDay[]
  selectedAccountId: number | null
  onSelectAccount: (id: number | null) => void
  onViewDay: (dayId: number) => void
  onDataChange: () => void
}

export function JournalPage({ accounts, tradingDays, selectedAccountId, onSelectAccount, onViewDay, onDataChange }: JournalPageProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const sortedDays = [...tradingDays].sort((a, b) => b.trade_date.localeCompare(a.trade_date))

  const handleDelete = async (dayId: number) => {
    setDeletingId(dayId)
    try {
      await window.electronAPI.deleteTradingDay(dayId)
      onDataChange()
    } catch (err) {
      console.error('Failed to delete trading day:', err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sortedDays.length} trading day{sortedDays.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <AccountSwitcher accounts={accounts} selectedAccountId={selectedAccountId} onSelect={onSelectAccount} />
      </div>

      {/* Trading Calendar */}
      <TradingCalendar tradingDays={tradingDays} onViewDay={onViewDay} />

      {sortedDays.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-16">
              <BookOpen size={40} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No trading days recorded yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Import a Tradovate CSV to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-8 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Date</span>
            <span>Status</span>
            <span className="text-right">Net P&L</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Trades</span>
            <span className="text-right">Win Rate</span>
            <span className="text-right">Expectancy</span>
            <span></span>
          </div>

          {sortedDays.map((day) => {
            const account = accounts.find(a => a.id === day.account_id)
            return (
              <button
                key={day.id}
                onClick={() => onViewDay(day.id)}
                className="grid grid-cols-8 gap-4 items-center w-full px-4 py-3.5 rounded-xl bg-card border hover:bg-secondary/50 transition-colors text-sm"
              >
                <div>
                  <span className="font-medium">{day.trade_date}</span>
                  {account && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {account.account_name || account.account_id}
                    </span>
                  )}
                </div>
                <div>
                  <Badge variant={day.net_pnl >= 0 ? 'success' : 'danger'}>
                    {day.net_pnl >= 0 ? 'Green' : 'Red'}
                  </Badge>
                </div>
                <span className={`text-right font-medium ${pnlColor(day.net_pnl)}`}>
                  {formatPnl(day.net_pnl)}
                </span>
                <span className="text-right">{formatCurrency(day.account_balance)}</span>
                <span className="text-right text-muted-foreground">{day.num_trades}</span>
                <span className="text-right text-muted-foreground">{formatPercent(day.win_rate)}</span>
                <span className="text-right text-muted-foreground">{formatCurrency(day.expectancy)}</span>
                <div className="flex items-center justify-end gap-1">
                  {confirmDeleteId === day.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs px-2"
                        disabled={deletingId === day.id}
                        onClick={(e) => { e.stopPropagation(); handleDelete(day.id); }}
                      >
                        {deletingId === day.id ? 'Deleting...' : 'Confirm'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(day.id); }}
                        title="Delete this day"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
