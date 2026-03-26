import { useState } from 'react'
import type { Account } from '@/lib/types'
import { ACCOUNT_PRESETS, ACCOUNT_TYPE_OPTIONS } from '@/lib/account-presets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Settings, PlusCircle, Trash2, Download, Save } from 'lucide-react'

interface SettingsPageProps {
  accounts: Account[]
  onDataChange: () => void
}

export function SettingsPage({ accounts, onDataChange }: SettingsPageProps) {
  const [newAccountId, setNewAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState('LUCID_DIRECT')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleAddAccount = async () => {
    if (!newAccountId.trim()) {
      setMessage({ type: 'error', text: 'Account ID is required.' })
      return
    }
    if (accounts.length >= 25) {
      setMessage({ type: 'error', text: 'Maximum 25 accounts allowed.' })
      return
    }

    setIsSaving(true)
    try {
      const preset = ACCOUNT_PRESETS[newAccountType]
      await window.electronAPI.addAccount({
        account_id: newAccountId.trim(),
        account_name: newAccountName.trim() || newAccountId.trim(),
        account_type: preset.account_type,
        starting_balance: preset.starting_balance,
        minimum_balance: preset.minimum_balance,
        daily_loss_limit: preset.daily_loss_limit,
        first_payout_goal: preset.first_payout_goal,
        later_payout_goal: preset.later_payout_goal,
        max_payout_first3: preset.max_payout_first3,
        max_payout_later: preset.max_payout_later,
        min_payout: preset.min_payout,
        consistency_limit: preset.consistency_limit,
        profit_split: preset.profit_split,
        commission_per_contract: preset.commission_per_contract,
      })
      setNewAccountId('')
      setNewAccountName('')
      setMessage({ type: 'success', text: 'Account added successfully.' })
      onDataChange()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add account.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Delete this account and all its trading data? This cannot be undone.')) return
    try {
      await window.electronAPI.deleteAccount(id)
      setMessage({ type: 'success', text: 'Account deleted.' })
      onDataChange()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete account.' })
    }
  }

  const handleExportCSV = async () => {
    const path = await window.electronAPI.exportJournalCSV()
    if (path) setMessage({ type: 'success', text: `Exported to ${path}` })
  }

  const handleExportBackup = async () => {
    const path = await window.electronAPI.exportBackupJSON()
    if (path) setMessage({ type: 'success', text: `Backup saved to ${path}` })
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage accounts and app configuration.</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Settings size={14} />
            Accounts ({accounts.length}/25)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
              <div>
                <p className="text-sm font-medium">{account.account_name || account.account_id}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {account.account_id} · {account.account_type.replace('_', ' ')} · {account.platform}
                </p>
                <p className="text-xs text-muted-foreground">
                  Start: ${account.starting_balance.toLocaleString()} · Min: ${account.minimum_balance.toLocaleString()}{account.daily_loss_limit > 0 ? ` · DLL: $${account.daily_loss_limit.toLocaleString()}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteAccount(account.id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}

          {accounts.length < 25 && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Add New Account</p>
                <div>
                  <label className="text-xs text-muted-foreground">Account Type</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewAccountType(opt.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          newAccountType === opt.value
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Account ID</label>
                    <input
                      type="text"
                      value={newAccountId}
                      onChange={(e) => setNewAccountId(e.target.value)}
                      placeholder="LTD1506774605001"
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Display Name (optional)</label>
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Account 1"
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
                {ACCOUNT_PRESETS[newAccountType] && (
                  <div className="p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground grid grid-cols-4 gap-2">
                    <span>Balance: ${ACCOUNT_PRESETS[newAccountType].starting_balance.toLocaleString()}</span>
                    <span>Drawdown: ${(ACCOUNT_PRESETS[newAccountType].starting_balance - ACCOUNT_PRESETS[newAccountType].minimum_balance).toLocaleString()}</span>
                    <span>DLL: {ACCOUNT_PRESETS[newAccountType].daily_loss_limit > 0 ? `$${ACCOUNT_PRESETS[newAccountType].daily_loss_limit.toLocaleString()}` : 'None'}</span>
                    <span>Consistency: {(ACCOUNT_PRESETS[newAccountType].consistency_limit * 100).toFixed(0)}%</span>
                  </div>
                )}
                <Button onClick={handleAddAccount} disabled={isSaving} size="sm" className="gap-2">
                  <PlusCircle size={14} />
                  {isSaving ? 'Adding...' : 'Add Account'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Download size={14} />
            Data Export
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download size={14} />
            Export Journal CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportBackup} className="gap-2">
            <Save size={14} />
            Export Full Backup
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
