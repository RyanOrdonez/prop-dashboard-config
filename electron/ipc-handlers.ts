import type { DatabaseWrapper } from './database'
import type { IpcMain, Dialog } from 'electron'
import { BrowserWindow } from 'electron'
import { parseCSVFile, parseCSVContent } from './csv-parser'
import type { ParsedTrade } from './csv-parser'

function hasUnaggregatedFills(trades: any[]): boolean {
  if (trades.length <= 1) return false
  // Group by symbol, then check for overlapping time ranges
  const bySymbol = new Map<string, any[]>()
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, [])
    bySymbol.get(t.symbol)!.push(t)
  }
  for (const symbolTrades of Array.from(bySymbol.values())) {
    const ranges = symbolTrades.map((t: any) => {
      const buyMs = new Date(t.bought_timestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2')).getTime()
      const sellMs = new Date(t.sold_timestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2')).getTime()
      return { start: Math.min(buyMs, sellMs), end: Math.max(buyMs, sellMs) }
    })
    ranges.sort((a: any, b: any) => a.start - b.start)
    let currentEnd = ranges[0].end
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].start <= currentEnd) return true // overlap found
      currentEnd = ranges[i].end
    }
  }
  return false
}

export function registerIpcHandlers(db: DatabaseWrapper, ipcMain: IpcMain, dialog: Dialog) {

  // ─── Accounts ──────────────────────────────────────────────

  ipcMain.handle('get-accounts', () => {
    return db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all()
  })

  ipcMain.handle('add-account', (_event, account: any) => {
    const stmt = db.prepare(`
      INSERT INTO accounts (
        account_id, account_name, account_type, starting_balance,
        minimum_balance, daily_loss_limit, platform,
        first_payout_goal, later_payout_goal, max_payout_first3, max_payout_later,
        min_payout, consistency_limit, profit_split, commission_per_contract
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      account.account_id,
      account.account_name || '',
      account.account_type || 'LUCID_DIRECT',
      account.starting_balance ?? 150000,
      account.minimum_balance ?? 144000,
      account.daily_loss_limit ?? 3000,
      account.platform || 'Tradovate',
      account.first_payout_goal ?? 9000,
      account.later_payout_goal ?? 4500,
      account.max_payout_first3 ?? 3000,
      account.max_payout_later ?? 3500,
      account.min_payout ?? 500,
      account.consistency_limit ?? 0.20,
      account.profit_split ?? 0.90,
      account.commission_per_contract ?? 0.50,
    )
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('update-account', (_event, id: number, account: any) => {
    const fields: string[] = []
    const values: any[] = []

    const allowedFields = [
      'account_id', 'account_name', 'account_type', 'starting_balance',
      'minimum_balance', 'daily_loss_limit', 'platform',
      'first_payout_goal', 'later_payout_goal', 'max_payout_first3', 'max_payout_later',
      'min_payout', 'consistency_limit', 'profit_split', 'commission_per_contract'
    ]

    for (const field of allowedFields) {
      if (account[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(account[field])
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')")
      values.push(id)
      db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  })

  ipcMain.handle('delete-account', (_event, id: number) => {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  })

  // ─── Trading Days ──────────────────────────────────────────

  ipcMain.handle('get-trading-days', (_event, accountId?: number) => {
    if (accountId) {
      return db.prepare(
        'SELECT * FROM trading_days WHERE account_id = ? ORDER BY trade_date DESC'
      ).all(accountId)
    }
    return db.prepare('SELECT * FROM trading_days ORDER BY trade_date DESC').all()
  })

  ipcMain.handle('get-trading-day', (_event, id: number) => {
    return db.prepare('SELECT * FROM trading_days WHERE id = ?').get(id)
  })

  ipcMain.handle('delete-trading-day', (_event, id: number) => {
    db.prepare('DELETE FROM trades WHERE trading_day_id = ?').run(id)
    db.prepare('DELETE FROM trading_days WHERE id = ?').run(id)
  })

  // ─── CSV Import ────────────────────────────────────────────

  ipcMain.handle('import-csv', async (_event, accountId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Import Tradovate Performance CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const parsed = parseCSVFile(filePath)

    // Get account for commission calculation
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any
    if (!account) throw new Error('Account not found')

    const commissions = parsed.numContracts * account.commission_per_contract
    const netPnl = Math.round((parsed.grossPnl - commissions) * 100) / 100

    // Calculate running balance
    const lastDay = db.prepare(
      'SELECT account_balance FROM trading_days WHERE account_id = ? ORDER BY trade_date DESC LIMIT 1'
    ).get(accountId) as any

    const prevBalance = lastDay ? lastDay.account_balance : account.starting_balance
    const accountBalance = Math.round((prevBalance + netPnl) * 100) / 100

    // Read raw CSV content for audit
    const fs = await import('node:fs')
    const rawCsvText = fs.readFileSync(filePath, 'utf-8')

    // Check for duplicate day
    const existingDay = db.prepare(
      'SELECT id FROM trading_days WHERE account_id = ? AND trade_date = ?'
    ).get(accountId, parsed.tradeDate) as any
    if (existingDay) {
      return {
        canceled: false,
        duplicate: true,
        tradeDate: parsed.tradeDate,
      }
    }

    // Insert trading day
    const insertDay = db.prepare(`
      INSERT INTO trading_days (
        account_id, trade_date, gross_pnl, commissions, net_pnl,
        account_balance, num_trades, num_contracts, win_count, loss_count,
        win_rate, avg_trade_pnl, avg_trade_duration_sec,
        largest_win, largest_loss, total_profit, total_loss,
        avg_win, avg_loss, max_runup, max_drawdown, expectancy, raw_csv_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const dayResult = insertDay.run(
      accountId,
      parsed.tradeDate,
      parsed.grossPnl,
      commissions,
      netPnl,
      accountBalance,
      parsed.numTrades,
      parsed.numContracts,
      parsed.winCount,
      parsed.lossCount,
      parsed.winRate,
      parsed.avgTradePnl,
      parsed.avgTradeDurationSec,
      parsed.largestWin,
      parsed.largestLoss,
      parsed.totalProfit,
      parsed.totalLoss,
      parsed.avgWin,
      parsed.avgLoss,
      parsed.maxRunup,
      parsed.maxDrawdown,
      parsed.expectancy,
      rawCsvText,
    )

    const tradingDayId = dayResult.lastInsertRowid

    // Insert individual trades
    const insertTrade = db.prepare(`
      INSERT INTO trades (
        account_id, trading_day_id, trade_date, symbol, qty,
        buy_price, sell_price, pnl, bought_timestamp, sold_timestamp,
        duration_seconds, duration_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((trades: ParsedTrade[]) => {
      for (const trade of trades) {
        insertTrade.run(
          accountId,
          tradingDayId,
          parsed.tradeDate,
          trade.symbol,
          trade.qty,
          trade.buyPrice,
          trade.sellPrice,
          trade.pnl,
          trade.boughtTimestamp,
          trade.soldTimestamp,
          trade.durationSeconds,
          trade.durationText,
        )
      }
    })

    insertMany(parsed.trades)

    // Return the saved trading day
    const savedDay = db.prepare('SELECT * FROM trading_days WHERE id = ?').get(tradingDayId)
    return { canceled: false, tradingDay: savedDay }
  })

  // ─── Trades ────────────────────────────────────────────────

  ipcMain.handle('get-trades-for-day', (_event, tradingDayId: number) => {
    const existing = db.prepare(
      'SELECT * FROM trades WHERE trading_day_id = ? ORDER BY bought_timestamp ASC'
    ).all(tradingDayId) as any[]

    // Check if trades need re-aggregation (missing duration or more fills than expected)
    const needsReaggregation = existing.some((t: any) => !t.duration_text) ||
      hasUnaggregatedFills(existing)

    if (!needsReaggregation) return existing

    // Re-parse from raw CSV, aggregate, and replace trades in DB
    const dayRow = db.prepare(
      'SELECT * FROM trading_days WHERE id = ?'
    ).get(tradingDayId) as any
    if (!dayRow?.raw_csv_text) return existing

    try {
      const parsed = parseCSVContent(dayRow.raw_csv_text)

      // Delete old trades and insert aggregated ones
      db.prepare('DELETE FROM trades WHERE trading_day_id = ?').run(tradingDayId)

      const insertTrade = db.prepare(`
        INSERT INTO trades (
          account_id, trading_day_id, trade_date, symbol, qty,
          buy_price, sell_price, pnl, bought_timestamp, sold_timestamp,
          duration_seconds, duration_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const trade of parsed.trades) {
        insertTrade.run(
          dayRow.account_id,
          tradingDayId,
          dayRow.trade_date,
          trade.symbol,
          trade.qty,
          trade.buyPrice,
          trade.sellPrice,
          trade.pnl,
          trade.boughtTimestamp,
          trade.soldTimestamp,
          trade.durationSeconds,
          trade.durationText,
        )
      }

      // Update trading day stats from re-parsed data
      db.prepare(`
        UPDATE trading_days SET
          num_trades = ?, win_count = ?, loss_count = ?, win_rate = ?,
          avg_trade_pnl = ?, avg_trade_duration_sec = ?,
          largest_win = ?, largest_loss = ?, total_profit = ?, total_loss = ?,
          avg_win = ?, avg_loss = ?, max_runup = ?, max_drawdown = ?, expectancy = ?
        WHERE id = ?
      `).run(
        parsed.numTrades, parsed.winCount, parsed.lossCount, parsed.winRate,
        parsed.avgTradePnl, parsed.avgTradeDurationSec,
        parsed.largestWin, parsed.largestLoss, parsed.totalProfit, parsed.totalLoss,
        parsed.avgWin, parsed.avgLoss, parsed.maxRunup, parsed.maxDrawdown, parsed.expectancy,
        tradingDayId,
      )

      // Return fresh aggregated trades
      return db.prepare(
        'SELECT * FROM trades WHERE trading_day_id = ? ORDER BY bought_timestamp ASC'
      ).all(tradingDayId)
    } catch (_) {
      return existing
    }
  })

  // ─── Settings ──────────────────────────────────────────────

  ipcMain.handle('get-settings', () => {
    const rows = db.prepare('SELECT key, value FROM app_settings').all() as any[]
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return settings
  })

  ipcMain.handle('set-setting', (_event, key: string, value: string) => {
    db.prepare(
      "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')"
    ).run(key, value, value)

    // Update window title when dashboard name changes
    if (key === 'dashboard_name') {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.setTitle(value)
    }
  })

  // ─── Payouts ──────────────────────────────────────────────

  ipcMain.handle('get-payouts', (_event, accountId?: number) => {
    if (accountId) {
      return db.prepare(
        'SELECT * FROM payouts WHERE account_id = ? ORDER BY payout_number ASC'
      ).all(accountId)
    }
    return db.prepare('SELECT * FROM payouts ORDER BY payout_date DESC').all()
  })

  ipcMain.handle('record-payout', (_event, payout: any) => {
    const stmt = db.prepare(`
      INSERT INTO payouts (account_id, payout_number, amount, trader_take_home, payout_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      payout.account_id,
      payout.payout_number,
      payout.amount,
      payout.trader_take_home,
      payout.payout_date || new Date().toISOString().slice(0, 10),
      payout.notes || '',
    )
    return db.prepare('SELECT * FROM payouts WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('delete-payout', (_event, id: number) => {
    db.prepare('DELETE FROM payouts WHERE id = ?').run(id)
  })

  // ─── Export / Import ───────────────────────────────────────

  ipcMain.handle('export-journal-csv', async (_event, accountId?: number) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Journal CSV',
      defaultPath: 'lucid-journal.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })

    if (result.canceled || !result.filePath) return null

    let days: any[]
    if (accountId) {
      days = db.prepare('SELECT * FROM trading_days WHERE account_id = ? ORDER BY trade_date ASC').all(accountId)
    } else {
      days = db.prepare('SELECT * FROM trading_days ORDER BY trade_date ASC').all()
    }

    const headers = 'Date,Account ID,Gross P&L,Commissions,Net P&L,Balance,Trades,Contracts,Win Rate,Expectancy\n'
    const rows = days.map((d: any) => {
      const acct = db.prepare('SELECT account_id FROM accounts WHERE id = ?').get(d.account_id) as any
      return `${d.trade_date},${acct?.account_id || ''},${d.gross_pnl},${d.commissions},${d.net_pnl},${d.account_balance},${d.num_trades},${d.num_contracts},${(d.win_rate * 100).toFixed(1)}%,${d.expectancy}`
    }).join('\n')

    const fs = await import('node:fs')
    fs.writeFileSync(result.filePath, headers + rows, 'utf-8')
    return result.filePath
  })

  ipcMain.handle('export-backup-json', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Backup',
      defaultPath: 'lucid-backup.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) return null

    const accounts = db.prepare('SELECT * FROM accounts').all()
    const tradingDays = db.prepare('SELECT * FROM trading_days').all()
    const trades = db.prepare('SELECT * FROM trades').all()
    const settings = db.prepare('SELECT * FROM app_settings').all()

    const backup = { accounts, tradingDays, trades, settings, exportedAt: new Date().toISOString() }

    const fs = await import('node:fs')
    fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8')
    return result.filePath
  })

  ipcMain.handle('import-backup-json', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Backup JSON',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) return

    const fs = await import('node:fs')
    const content = fs.readFileSync(result.filePaths[0], 'utf-8')
    const backup = JSON.parse(content)

    // TODO: Implement full backup import with conflict resolution
    // For now, this is a placeholder
    return { imported: true, accounts: backup.accounts?.length || 0 }
  })
}
