import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { parseCSVContent } from './csv-parser'

// ─── Wrapper to mimic better-sqlite3 API using sql.js ──────────────

interface RunResult {
  changes: number
  lastInsertRowid: number
}

interface PreparedWrapper {
  all(...params: any[]): any[]
  get(...params: any[]): any | undefined
  run(...params: any[]): RunResult
}

export class DatabaseWrapper {
  private sqlDb: SqlJsDatabase
  private dbPath: string
  private inTransaction = false

  constructor(sqlDb: SqlJsDatabase, dbPath: string) {
    this.sqlDb = sqlDb
    this.dbPath = dbPath
  }

  prepare(sql: string): PreparedWrapper {
    const wrapper = this
    const db = this.sqlDb
    const save = () => this.save()

    return {
      all(...params: any[]): any[] {
        const stmt = db.prepare(sql)
        if (params.length > 0) stmt.bind(params)
        const rows: any[] = []
        while (stmt.step()) {
          rows.push(stmt.getAsObject())
        }
        stmt.free()
        return rows
      },
      get(...params: any[]): any | undefined {
        const stmt = db.prepare(sql)
        if (params.length > 0) stmt.bind(params)
        let row: any | undefined
        if (stmt.step()) {
          row = stmt.getAsObject()
        }
        stmt.free()
        return row
      },
      run(...params: any[]): RunResult {
        db.run(sql, params)
        const changes = db.getRowsModified()
        const lastIdRows = db.exec('SELECT last_insert_rowid() as id')
        const lastInsertRowid = lastIdRows.length > 0 ? (lastIdRows[0].values[0][0] as number) : 0
        if (!wrapper.inTransaction) save()
        return { changes, lastInsertRowid }
      },
    }
  }

  exec(sql: string): void {
    this.sqlDb.run(sql)
    this.save()
  }

  pragma(pragma: string): void {
    this.sqlDb.run(`PRAGMA ${pragma}`)
  }

  transaction<T extends (...args: any[]) => void>(fn: T): T {
    const wrapper = this
    return ((...args: any[]) => {
      wrapper.inTransaction = true
      wrapper.sqlDb.run('BEGIN TRANSACTION')
      try {
        fn(...args)
        wrapper.sqlDb.run('COMMIT')
        wrapper.inTransaction = false
        wrapper.save()
      } catch (err) {
        try { wrapper.sqlDb.run('ROLLBACK') } catch (_) { /* already rolled back */ }
        wrapper.inTransaction = false
        throw err
      }
    }) as unknown as T
  }

  save(): void {
    const data = this.sqlDb.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(this.dbPath, buffer)
  }

  close(): void {
    this.save()
    this.sqlDb.close()
  }
}

// ─── Module state ───────────────────────────────────────────────────

let db: DatabaseWrapper

export async function initDatabase(): Promise<DatabaseWrapper> {
  const dbPath = path.join(app.getPath('userData'), 'lucid-dashboard.db')

  const SQL = await initSqlJs()

  let sqlDb: SqlJsDatabase
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    sqlDb = new SQL.Database(fileBuffer)
  } else {
    sqlDb = new SQL.Database()
  }

  db = new DatabaseWrapper(sqlDb, dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  seedDefaults(db)

  return db
}

function runMigrations(db: DatabaseWrapper) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL UNIQUE,
      account_name TEXT NOT NULL DEFAULT '',
      account_type TEXT NOT NULL DEFAULT 'LUCID_DIRECT',
      starting_balance REAL NOT NULL DEFAULT 150000,
      minimum_balance REAL NOT NULL DEFAULT 144000,
      daily_loss_limit REAL NOT NULL DEFAULT 3000,
      platform TEXT NOT NULL DEFAULT 'Tradovate',
      first_payout_goal REAL NOT NULL DEFAULT 9000,
      later_payout_goal REAL NOT NULL DEFAULT 4500,
      max_payout_first3 REAL NOT NULL DEFAULT 3000,
      max_payout_later REAL NOT NULL DEFAULT 3500,
      min_payout REAL NOT NULL DEFAULT 500,
      consistency_limit REAL NOT NULL DEFAULT 0.20,
      profit_split REAL NOT NULL DEFAULT 0.90,
      commission_per_contract REAL NOT NULL DEFAULT 0.50,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS trading_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      trade_date TEXT NOT NULL,
      gross_pnl REAL NOT NULL DEFAULT 0,
      commissions REAL NOT NULL DEFAULT 0,
      net_pnl REAL NOT NULL DEFAULT 0,
      account_balance REAL NOT NULL DEFAULT 0,
      num_trades INTEGER NOT NULL DEFAULT 0,
      num_contracts INTEGER NOT NULL DEFAULT 0,
      win_count INTEGER NOT NULL DEFAULT 0,
      loss_count INTEGER NOT NULL DEFAULT 0,
      win_rate REAL NOT NULL DEFAULT 0,
      avg_trade_pnl REAL NOT NULL DEFAULT 0,
      avg_trade_duration_sec REAL NOT NULL DEFAULT 0,
      largest_win REAL NOT NULL DEFAULT 0,
      largest_loss REAL NOT NULL DEFAULT 0,
      total_profit REAL NOT NULL DEFAULT 0,
      total_loss REAL NOT NULL DEFAULT 0,
      avg_win REAL NOT NULL DEFAULT 0,
      avg_loss REAL NOT NULL DEFAULT 0,
      max_runup REAL NOT NULL DEFAULT 0,
      max_drawdown REAL NOT NULL DEFAULT 0,
      expectancy REAL NOT NULL DEFAULT 0,
      raw_csv_text TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(account_id, trade_date)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      trading_day_id INTEGER NOT NULL REFERENCES trading_days(id) ON DELETE CASCADE,
      trade_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      qty INTEGER NOT NULL,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      pnl REAL NOT NULL,
      bought_timestamp TEXT NOT NULL,
      sold_timestamp TEXT NOT NULL,
      duration_seconds REAL NOT NULL DEFAULT 0,
      duration_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Migration: rename platform_primary/platform_secondary → platform
  try {
    const cols = db.prepare("PRAGMA table_info(accounts)").all() as any[]
    const hasOldCol = cols.some((c: any) => c.name === 'platform_primary')
    if (hasOldCol) {
      db.exec(`ALTER TABLE accounts ADD COLUMN platform TEXT NOT NULL DEFAULT 'Tradovate'`)
      db.exec(`UPDATE accounts SET platform = 'Tradovate', account_type = 'LUCID_DIRECT', daily_loss_limit = 3000`)
    }
  } catch (_) { /* column already exists or migration already done */ }

  // Migration: fix Apex EOD commission to $0.52/contract and recalculate existing days
  try {
    const apexAccounts = db.prepare(
      "SELECT * FROM accounts WHERE account_type = 'APEX_EOD' AND commission_per_contract = 0.50"
    ).all() as any[]
    if (apexAccounts.length > 0) {
      db.prepare(
        "UPDATE accounts SET commission_per_contract = 0.52 WHERE account_type = 'APEX_EOD' AND commission_per_contract = 0.50"
      ).run()
      // Recalculate commissions, net_pnl, and running balances for each Apex account
      for (const acct of apexAccounts) {
        const days = db.prepare(
          'SELECT * FROM trading_days WHERE account_id = ? ORDER BY trade_date ASC'
        ).all(acct.id) as any[]
        let runningBalance = acct.starting_balance
        for (const day of days) {
          const newCommissions = Math.round(day.num_contracts * 0.52 * 100) / 100
          const newNetPnl = Math.round((day.gross_pnl - newCommissions) * 100) / 100
          runningBalance = Math.round((runningBalance + newNetPnl) * 100) / 100
          db.prepare(
            'UPDATE trading_days SET commissions = ?, net_pnl = ?, account_balance = ? WHERE id = ?'
          ).run(newCommissions, newNetPnl, runningBalance, day.id)
        }
      }
    }
  } catch (_) { /* migration safe to ignore */ }

  // Migration: backfill trade durations from stored raw_csv_text
  try {
    const zeroDurationDays = db.prepare(
      'SELECT id, raw_csv_text FROM trading_days WHERE avg_trade_duration_sec = 0 AND raw_csv_text IS NOT NULL'
    ).all() as any[]
    if (zeroDurationDays.length > 0) {
      for (const day of zeroDurationDays) {
        try {
          const parsed = parseCSVContent(day.raw_csv_text)
          // Update avg duration on the trading day
          db.prepare(
            'UPDATE trading_days SET avg_trade_duration_sec = ? WHERE id = ?'
          ).run(parsed.avgTradeDurationSec, day.id)
          // Update individual trades
          const dbTrades = db.prepare(
            'SELECT id, bought_timestamp, sold_timestamp FROM trades WHERE trading_day_id = ? ORDER BY bought_timestamp ASC'
          ).all(day.id) as any[]
          const parsedSorted = [...parsed.trades].sort((a: any, b: any) =>
            a.boughtTimestamp.localeCompare(b.boughtTimestamp)
          )
          for (let i = 0; i < Math.min(dbTrades.length, parsedSorted.length); i++) {
            db.prepare(
              'UPDATE trades SET duration_seconds = ?, duration_text = ? WHERE id = ?'
            ).run(parsedSorted[i].durationSeconds, parsedSorted[i].durationText, dbTrades[i].id)
          }
        } catch (_) { /* skip days with parse errors */ }
      }
    }
  } catch (_) { /* migration safe to ignore */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      payout_number INTEGER NOT NULL,
      amount REAL NOT NULL,
      trader_take_home REAL NOT NULL,
      payout_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

function seedDefaults(db: DatabaseWrapper) {
  // Seed default settings if not present
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
  )
  insertSetting.run('theme', 'dark')
  insertSetting.run('dashboard_name', 'My Dashboard')
  insertSetting.run('openai_api_key', '')
  insertSetting.run('openai_model', 'gpt-4')
  insertSetting.run('local_parsing_enabled', 'true')
}

export function getDb(): DatabaseWrapper {
  return db
}
