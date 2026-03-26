// 2026 High-Impact Economic Events (Red Folder)
// Sources: Federal Reserve FOMC calendar, BLS release schedule

export interface EconomicEvent {
  date: string       // YYYY-MM-DD
  name: string       // Short name
  type: 'fomc' | 'nfp' | 'cpi' | 'ppi' | 'gdp'
}

// Color coding per event type
export const EVENT_COLORS: Record<EconomicEvent['type'], string> = {
  fomc: 'bg-red-500/80 text-white',
  nfp: 'bg-amber-500/80 text-white',
  cpi: 'bg-orange-500/80 text-white',
  ppi: 'bg-yellow-500/80 text-black',
  gdp: 'bg-purple-500/80 text-white',
}

export const EVENT_TYPE_LABELS: Record<EconomicEvent['type'], string> = {
  fomc: 'FOMC',
  nfp: 'NFP',
  cpi: 'CPI',
  ppi: 'PPI',
  gdp: 'GDP',
}

// ─── 2026 Events ────────────────────────────────────────────────

const FOMC_2026: EconomicEvent[] = [
  { date: '2026-01-28', name: 'FOMC Rate Decision', type: 'fomc' },
  { date: '2026-03-18', name: 'FOMC Rate Decision + SEP', type: 'fomc' },
  { date: '2026-04-29', name: 'FOMC Rate Decision', type: 'fomc' },
  { date: '2026-06-17', name: 'FOMC Rate Decision + SEP', type: 'fomc' },
  { date: '2026-07-29', name: 'FOMC Rate Decision', type: 'fomc' },
  { date: '2026-09-16', name: 'FOMC Rate Decision + SEP', type: 'fomc' },
  { date: '2026-10-28', name: 'FOMC Rate Decision', type: 'fomc' },
  { date: '2026-12-09', name: 'FOMC Rate Decision + SEP', type: 'fomc' },
]

// NFP: First Friday of each month (Employment Situation)
const NFP_2026: EconomicEvent[] = [
  { date: '2026-01-09', name: 'Non-Farm Payrolls (Dec)', type: 'nfp' },
  { date: '2026-02-06', name: 'Non-Farm Payrolls (Jan)', type: 'nfp' },
  { date: '2026-03-06', name: 'Non-Farm Payrolls (Feb)', type: 'nfp' },
  { date: '2026-04-03', name: 'Non-Farm Payrolls (Mar)', type: 'nfp' },
  { date: '2026-05-08', name: 'Non-Farm Payrolls (Apr)', type: 'nfp' },
  { date: '2026-06-05', name: 'Non-Farm Payrolls (May)', type: 'nfp' },
  { date: '2026-07-02', name: 'Non-Farm Payrolls (Jun)', type: 'nfp' },
  { date: '2026-08-07', name: 'Non-Farm Payrolls (Jul)', type: 'nfp' },
  { date: '2026-09-04', name: 'Non-Farm Payrolls (Aug)', type: 'nfp' },
  { date: '2026-10-02', name: 'Non-Farm Payrolls (Sep)', type: 'nfp' },
  { date: '2026-11-06', name: 'Non-Farm Payrolls (Oct)', type: 'nfp' },
  { date: '2026-12-04', name: 'Non-Farm Payrolls (Nov)', type: 'nfp' },
]

// CPI: Mid-month releases (confirmed Jan-Apr from BLS, rest estimated)
const CPI_2026: EconomicEvent[] = [
  { date: '2026-01-14', name: 'CPI (Dec)', type: 'cpi' },
  { date: '2026-02-11', name: 'CPI (Jan)', type: 'cpi' },
  { date: '2026-03-11', name: 'CPI (Feb)', type: 'cpi' },
  { date: '2026-04-10', name: 'CPI (Mar)', type: 'cpi' },
  { date: '2026-05-12', name: 'CPI (Apr)', type: 'cpi' },
  { date: '2026-06-10', name: 'CPI (May)', type: 'cpi' },
  { date: '2026-07-14', name: 'CPI (Jun)', type: 'cpi' },
  { date: '2026-08-12', name: 'CPI (Jul)', type: 'cpi' },
  { date: '2026-09-16', name: 'CPI (Aug)', type: 'cpi' },
  { date: '2026-10-13', name: 'CPI (Sep)', type: 'cpi' },
  { date: '2026-11-10', name: 'CPI (Oct)', type: 'cpi' },
  { date: '2026-12-09', name: 'CPI (Nov)', type: 'cpi' },
]

// PPI: Typically day after CPI or close
const PPI_2026: EconomicEvent[] = [
  { date: '2026-01-15', name: 'PPI (Dec)', type: 'ppi' },
  { date: '2026-02-12', name: 'PPI (Jan)', type: 'ppi' },
  { date: '2026-03-12', name: 'PPI (Feb)', type: 'ppi' },
  { date: '2026-04-09', name: 'PPI (Mar)', type: 'ppi' },
  { date: '2026-05-13', name: 'PPI (Apr)', type: 'ppi' },
  { date: '2026-06-11', name: 'PPI (May)', type: 'ppi' },
  { date: '2026-07-15', name: 'PPI (Jun)', type: 'ppi' },
  { date: '2026-08-13', name: 'PPI (Jul)', type: 'ppi' },
  { date: '2026-09-17', name: 'PPI (Aug)', type: 'ppi' },
  { date: '2026-10-14', name: 'PPI (Sep)', type: 'ppi' },
  { date: '2026-11-12', name: 'PPI (Oct)', type: 'ppi' },
  { date: '2026-12-10', name: 'PPI (Nov)', type: 'ppi' },
]

// GDP Advance Estimates (quarterly)
const GDP_2026: EconomicEvent[] = [
  { date: '2026-01-29', name: 'GDP Q4 2025 (Advance)', type: 'gdp' },
  { date: '2026-02-26', name: 'GDP Q4 2025 (Second)', type: 'gdp' },
  { date: '2026-03-26', name: 'GDP Q4 2025 (Third)', type: 'gdp' },
  { date: '2026-04-29', name: 'GDP Q1 2026 (Advance)', type: 'gdp' },
  { date: '2026-05-28', name: 'GDP Q1 2026 (Second)', type: 'gdp' },
  { date: '2026-06-25', name: 'GDP Q1 2026 (Third)', type: 'gdp' },
  { date: '2026-07-29', name: 'GDP Q2 2026 (Advance)', type: 'gdp' },
  { date: '2026-08-27', name: 'GDP Q2 2026 (Second)', type: 'gdp' },
  { date: '2026-09-24', name: 'GDP Q2 2026 (Third)', type: 'gdp' },
  { date: '2026-10-29', name: 'GDP Q3 2026 (Advance)', type: 'gdp' },
  { date: '2026-11-25', name: 'GDP Q3 2026 (Second)', type: 'gdp' },
  { date: '2026-12-22', name: 'GDP Q3 2026 (Third)', type: 'gdp' },
]

const ALL_EVENTS_2026 = [
  ...FOMC_2026,
  ...NFP_2026,
  ...CPI_2026,
  ...PPI_2026,
  ...GDP_2026,
]

/** Get economic events grouped by date for a given year+month */
export function getEconomicEventsByDate(year: number, month: number): Map<string, EconomicEvent[]> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const map = new Map<string, EconomicEvent[]>()

  for (const evt of ALL_EVENTS_2026) {
    if (evt.date.startsWith(prefix)) {
      const existing = map.get(evt.date)
      if (existing) {
        existing.push(evt)
      } else {
        map.set(evt.date, [evt])
      }
    }
  }
  return map
}
