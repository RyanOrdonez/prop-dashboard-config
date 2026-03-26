import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  // Accounts
  getAccounts: () => Promise<any[]>
  addAccount: (account: any) => Promise<any>
  updateAccount: (id: number, account: any) => Promise<any>
  deleteAccount: (id: number) => Promise<void>

  // Trading Days
  getTradingDays: (accountId?: number) => Promise<any[]>
  getTradingDay: (id: number) => Promise<any>
  deleteTradingDay: (id: number) => Promise<void>

  // Trades
  getTradesForDay: (tradingDayId: number) => Promise<any[]>

  // CSV Import
  importCSV: (accountId: number) => Promise<any>

  // Settings
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<void>

  // Payouts
  getPayouts: (accountId?: number) => Promise<any[]>
  recordPayout: (payout: any) => Promise<any>
  deletePayout: (id: number) => Promise<void>

  // Export
  exportJournalCSV: (accountId?: number) => Promise<string>
  exportBackupJSON: () => Promise<string>
  importBackupJSON: () => Promise<void>
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Accounts
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account: any) => ipcRenderer.invoke('add-account', account),
  updateAccount: (id: number, account: any) => ipcRenderer.invoke('update-account', id, account),
  deleteAccount: (id: number) => ipcRenderer.invoke('delete-account', id),

  // Trading Days
  getTradingDays: (accountId?: number) => ipcRenderer.invoke('get-trading-days', accountId),
  getTradingDay: (id: number) => ipcRenderer.invoke('get-trading-day', id),
  deleteTradingDay: (id: number) => ipcRenderer.invoke('delete-trading-day', id),

  // Trades
  getTradesForDay: (tradingDayId: number) => ipcRenderer.invoke('get-trades-for-day', tradingDayId),

  // CSV Import
  importCSV: (accountId: number) => ipcRenderer.invoke('import-csv', accountId),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('set-setting', key, value),

  // Payouts
  getPayouts: (accountId?: number) => ipcRenderer.invoke('get-payouts', accountId),
  recordPayout: (payout: any) => ipcRenderer.invoke('record-payout', payout),
  deletePayout: (id: number) => ipcRenderer.invoke('delete-payout', id),

  // Export
  exportJournalCSV: (accountId?: number) => ipcRenderer.invoke('export-journal-csv', accountId),
  exportBackupJSON: () => ipcRenderer.invoke('export-backup-json'),
  importBackupJSON: () => ipcRenderer.invoke('import-backup-json'),
} satisfies ElectronAPI)
