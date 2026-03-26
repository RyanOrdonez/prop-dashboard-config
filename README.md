# Prop Trading Performance Dashboard

A desktop analytics platform for tracking, analyzing, and optimizing performance across multiple proprietary trading accounts. Built to solve a real problem — prop firms have strict payout rules (profit goals, consistency limits, drawdown thresholds) that vary by account type, and no existing tool consolidates it all into one view.

## What It Does

**Import a CSV of your daily trades → get instant statistical breakdowns, running P&L curves, and real-time payout eligibility tracking.**

The app ingests raw trade execution data (timestamps, fill prices, quantities) and builds a full analytics layer on top of it:

- **Trade Aggregation Pipeline** — Raw CSV fills are parsed, grouped by overlapping time intervals, and merged into logical trades. Split fills across the same position are automatically detected and consolidated using interval overlap analysis.
- **Per-Day Statistical Engine** — Each trading day is broken down into win rate, expectancy, profit factor, average trade duration, max intraday runup/drawdown (computed via cumulative P&L sequencing), and more.
- **Multi-Account Analytics** — Manage accounts across different prop firms (Apex, Lucid, etc.) with independent balance tracking, combined profit curves, and per-account breakdowns from a single dashboard.
- **Payout Eligibility Modeling** — Each firm has unique payout rules. The app models them as configurable rulesets — consistency ratios, minimum profitable days, balance thresholds, tiered payout caps — and evaluates eligibility in real time as new data comes in.
- **Balance & Profit Curves** — Interactive time-series charts showing cycle profit per account and combined, with per-account overlays for comparison.

## How It's Structured

```
electron/
  ├── database.ts        # SQLite layer (sql.js) — schema migrations, transactions, WAL mode
  ├── csv-parser.ts      # Trade CSV ingestion — fill aggregation, duration calc, summary stats
  ├── ipc-handlers.ts    # Electron IPC bridge between main process and renderer
  └── main.ts            # App entry, window management

src/
  ├── lib/
  │   ├── calculations.ts    # Core analytics — account stats, payout eligibility, combined stats
  │   ├── account-presets.ts  # Firm-specific rule configs (payout schedules, consistency limits)
  │   ├── types.ts            # Full type system — accounts, trades, days, computed stats
  │   └── utils.ts            # Formatting helpers
  ├── pages/
  │   ├── DashboardPage.tsx   # KPI cards, profit curves, performance metrics, streaks
  │   ├── PayoutPage.tsx      # Eligibility checklist, payout history, per-day progress table
  │   ├── JournalPage.tsx     # Trading calendar, day-by-day log
  │   ├── DayDetailPage.tsx   # Individual trade breakdown with win/loss analysis
  │   ├── AddDayPage.tsx      # CSV import flow
  │   └── SettingsPage.tsx    # Account management, data export/import
  └── components/
      ├── dashboard/BalanceCurve.tsx  # Multi-series area charts (Recharts)
      └── layout/                     # Sidebar, account switcher
```

## Key Analytics

| Metric | How It's Computed |
|---|---|
| **Expectancy** | `(winRate × avgWin) + ((1 - winRate) × avgLoss)` — expected value per trade |
| **Consistency Ratio** | `largestGreenDay / cycleProfit` — must stay below firm limit (e.g., 20%) |
| **Profit Factor** | `totalProfit / totalLoss` — ratio of gross gains to gross losses |
| **Max Drawdown** | Cumulative P&L peak-to-trough within a trading day |
| **Payout Eligibility** | Rule engine evaluating profit goals, consistency, min trading days, balance thresholds per firm |

## Tech

- **TypeScript** end-to-end (Electron main + React renderer)
- **SQLite** (sql.js/WASM) with migration system, transaction support, WAL journaling
- **React 18** with hooks-based state management
- **Recharts** for interactive time-series and bar chart visualizations
- **Tailwind CSS** + Radix UI primitives for the interface
- **Vite** + Electron for fast dev iteration and native desktop packaging

## Running Locally

```bash
npm install
npm run dev        # starts Vite + Electron in dev mode
npm run package    # builds a portable Windows executable
```

## Why I Built This

I actively trade prop firm accounts and needed a way to track my performance against each firm's specific payout rules — consistency limits, tiered withdrawal caps, minimum profitable days, and more. Nothing on the market handled multiple firms with different rule structures in one place, so I built it myself. The data pipeline (CSV → parsed trades → aggregated stats → eligibility checks) mirrors the kind of ETL and analytics work I enjoy.
