import { useState, useEffect } from 'react'
import type { Account, TradingDay, Trade } from '@/lib/types'
import { formatCurrency, formatPnl, formatPercent, formatDate, formatDuration, pnlColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BarChart3, Clock, Target, TrendingUp, TrendingDown } from 'lucide-react'

interface DayDetailPageProps {
  dayId: number
  accounts: Account[]
  onBack: () => void
}

export function DayDetailPage({ dayId, accounts, onBack }: DayDetailPageProps) {
  const [day, setDay] = useState<TradingDay | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [dayData, tradesData] = await Promise.all([
          window.electronAPI.getTradingDay(dayId),
          window.electronAPI.getTradesForDay(dayId),
        ])
        setDay(dayData)
        setTrades(tradesData)
      } catch (err) {
        console.error('Failed to load day detail:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [dayId])

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!day) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-4">
          <ArrowLeft size={16} /> Back
        </Button>
        <p className="text-muted-foreground">Trading day not found.</p>
      </div>
    )
  }

  const account = accounts.find(a => a.id === day.account_id)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{formatDate(day.trade_date)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {account?.account_name || account?.account_id || 'Unknown Account'}
          </p>
        </div>
        <Badge variant={day.net_pnl >= 0 ? 'success' : 'danger'} className="ml-2 text-sm">
          {day.net_pnl >= 0 ? 'Green Day' : 'Red Day'}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-6 gap-4">
        <MiniStat label="Net P&L" value={formatPnl(day.net_pnl)} color={pnlColor(day.net_pnl)} icon={<TrendingUp size={14} />} />
        <MiniStat label="Gross P&L" value={formatPnl(day.gross_pnl)} color={pnlColor(day.gross_pnl)} icon={<BarChart3 size={14} />} />
        <MiniStat label="Commissions" value={formatCurrency(day.commissions)} icon={<Target size={14} />} />
        <MiniStat label="Win Rate" value={formatPercent(day.win_rate)} icon={<Target size={14} />} />
        <MiniStat label="Avg Duration" value={formatDuration(day.avg_trade_duration_sec)} icon={<Clock size={14} />} />
        <MiniStat label="Balance" value={formatCurrency(day.account_balance)} icon={<TrendingUp size={14} />} />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <DetailRow label="Trades" value={String(day.num_trades)} />
            <DetailRow label="Contracts" value={String(day.num_contracts)} />
            <DetailRow label="Wins / Losses" value={`${day.win_count} / ${day.loss_count}`} />
            <DetailRow label="Win Rate" value={formatPercent(day.win_rate)} />
            <DetailRow label="Avg Trade P&L" value={formatPnl(day.avg_trade_pnl)} valueColor={pnlColor(day.avg_trade_pnl)} />
            <DetailRow label="Expectancy" value={formatCurrency(day.expectancy)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win / Loss Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <DetailRow label="Largest Win" value={formatCurrency(day.largest_win)} valueColor="text-emerald-400" />
            <DetailRow label="Largest Loss" value={formatCurrency(day.largest_loss)} valueColor="text-red-400" />
            <DetailRow label="Avg Win" value={formatCurrency(day.avg_win)} valueColor="text-emerald-400" />
            <DetailRow label="Avg Loss" value={formatCurrency(day.avg_loss)} valueColor="text-red-400" />
            <DetailRow label="Total Profit" value={formatCurrency(day.total_profit)} valueColor="text-emerald-400" />
            <DetailRow label="Total Loss" value={formatCurrency(day.total_loss)} valueColor="text-red-400" />
            <DetailRow label="Max Runup" value={formatCurrency(day.max_runup)} />
            <DetailRow label="Max Drawdown" value={formatCurrency(day.max_drawdown)} />
          </CardContent>
        </Card>
      </div>

      {/* Trades Table */}
      {trades.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Individual Trades ({trades.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Symbol</th>
                    <th className="text-right py-2 pr-4">Qty</th>
                    <th className="text-right py-2 pr-4">Buy</th>
                    <th className="text-right py-2 pr-4">Sell</th>
                    <th className="text-right py-2 pr-4">P&L</th>
                    <th className="text-right py-2 pr-4">Duration</th>
                    <th className="text-left py-2">Bought</th>
                    <th className="text-left py-2">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, i) => (
                    <tr key={trade.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium">{trade.symbol}</td>
                      <td className="py-2.5 pr-4 text-right">{trade.qty}</td>
                      <td className="py-2.5 pr-4 text-right">{trade.buy_price.toFixed(2)}</td>
                      <td className="py-2.5 pr-4 text-right">{trade.sell_price.toFixed(2)}</td>
                      <td className={`py-2.5 pr-4 text-right font-medium ${pnlColor(trade.pnl)}`}>
                        {formatPnl(trade.pnl)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{trade.duration_text}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{trade.bought_timestamp}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{trade.sold_timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {day.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{day.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MiniStat({ label, value, color, icon }: { label: string; value: string; color?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-lg font-bold ${color || ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueColor || ''}`}>{value}</span>
    </div>
  )
}
