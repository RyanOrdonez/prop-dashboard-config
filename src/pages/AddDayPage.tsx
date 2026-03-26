import { useState } from 'react'
import type { Account, PageId } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Check, Loader2 } from 'lucide-react'

interface AddDayPageProps {
  accounts: Account[]
  onDataChange: () => void
  onNavigate: (page: PageId) => void
}

export function AddDayPage({ accounts, onDataChange, onNavigate }: AddDayPageProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    accounts.length === 1 ? accounts[0].id : null
  )
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImportCSV = async () => {
    if (!selectedAccountId) {
      setError('Please select an account first.')
      return
    }

    setIsImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const result = await window.electronAPI.importCSV(selectedAccountId)
      if (result.canceled) {
        setIsImporting(false)
        return
      }
      if (result.duplicate) {
        setError(`This trading day (${result.tradeDate}) has already been uploaded for this account. Please delete the existing day from the Journal first, then re-upload.`)
        setIsImporting(false)
        return
      }
      setImportResult(result.tradingDay)
      onDataChange()
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV')
    } finally {
      setIsImporting(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Add Trading Day</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No accounts configured yet.</p>
              <Button onClick={() => onNavigate('settings')}>Go to Settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Trading Day</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import your Tradovate performance CSV to add a new trading day.
        </p>
      </div>

      {/* Step 1: Select Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Step 1 — Select Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => { setSelectedAccountId(account.id); setError(null); setImportResult(null); }}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  selectedAccountId === account.id
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary border-transparent'
                }`}
              >
                <div>{account.account_name || account.account_id}</div>
                <div className="text-xs opacity-70 mt-0.5">{account.account_id}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Import CSV */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Step 2 — Import Tradovate CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl">
            {isImporting ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-emerald-400 animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing CSV...</p>
              </div>
            ) : importResult ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check size={24} className="text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-emerald-400">Trading day saved!</p>
                <div className="grid grid-cols-3 gap-6 mt-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-medium mt-1">{importResult.trade_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net P&L</p>
                    <p className={`text-sm font-medium mt-1 ${importResult.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${importResult.net_pnl?.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trades</p>
                    <p className="text-sm font-medium mt-1">{importResult.num_trades}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contracts</p>
                    <p className="text-sm font-medium mt-1">{importResult.num_contracts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className="text-sm font-medium mt-1">{(importResult.win_rate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-sm font-medium mt-1">${importResult.account_balance?.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button onClick={() => onNavigate('dashboard')} size="sm">
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setImportResult(null); setError(null); }}
                  >
                    Import Another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Upload size={24} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Select your Tradovate Performance CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Export from Tradovate → Performance → Download CSV
                  </p>
                </div>
                <Button
                  onClick={handleImportCSV}
                  disabled={!selectedAccountId}
                  className="mt-2 gap-2"
                >
                  <FileText size={16} />
                  Choose CSV File
                </Button>
              </div>
            )}
          </div>
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
