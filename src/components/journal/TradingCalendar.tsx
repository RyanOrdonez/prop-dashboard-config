import { useState, useMemo, useRef, useEffect } from 'react'
import type { TradingDay } from '@/lib/types'
import { formatPnl, formatPercent, pnlColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { getEconomicEventsByDate, EVENT_COLORS, EVENT_TYPE_LABELS } from '@/lib/economic-events'
import type { EconomicEvent } from '@/lib/economic-events'

interface TradingCalendarProps {
  tradingDays: TradingDay[]
  onViewDay?: (dayId: number) => void
}

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── US Market Holidays (CME Futures) ──────────────────────────

function getEasterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const first = new Date(year, month, 1)
  const dow = first.getDay()
  const day = 1 + ((dayOfWeek - dow + 7) % 7) + (n - 1) * 7
  return new Date(year, month, day)
}

function getLastDayOfMonth(year: number, month: number, dayOfWeek: number): Date {
  const last = new Date(year, month + 1, 0)
  const dow = last.getDay()
  const diff = (dow - dayOfWeek + 7) % 7
  return new Date(year, month, last.getDate() - diff)
}

function observedDate(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  const dow = d.getDay()
  if (dow === 0) d.setDate(d.getDate() + 1)
  if (dow === 6) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMarketHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>()
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  holidays.set(observedDate(year, 0, 1), "New Year's Day")
  holidays.set(fmt(getNthDayOfMonth(year, 0, 1, 3)), 'MLK Day')
  holidays.set(fmt(getNthDayOfMonth(year, 1, 1, 3)), "Presidents' Day")
  const easter = getEasterDate(year)
  const goodFriday = new Date(easter)
  goodFriday.setDate(goodFriday.getDate() - 2)
  holidays.set(fmt(goodFriday), 'Good Friday')
  holidays.set(fmt(getLastDayOfMonth(year, 4, 1)), 'Memorial Day')
  holidays.set(observedDate(year, 5, 19), 'Juneteenth')
  holidays.set(observedDate(year, 6, 4), 'Independence Day')
  holidays.set(fmt(getNthDayOfMonth(year, 8, 1, 1)), 'Labor Day')
  holidays.set(fmt(getNthDayOfMonth(year, 10, 4, 4)), 'Thanksgiving')
  holidays.set(observedDate(year, 11, 25), 'Christmas')

  return holidays
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

// ─── Event Dropdown ─────────────────────────────────────────────

function EventDropdown({ events, expanded, onToggle }: {
  events: EconomicEvent[]
  expanded: boolean
  onToggle: (e: React.MouseEvent) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  if (events.length === 0) return null

  const first = events[0]
  const hasMore = events.length > 1

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-0.5 rounded px-1 py-0 text-[8px] font-bold leading-tight ${EVENT_COLORS[first.type]}`}
      >
        {EVENT_TYPE_LABELS[first.type]}
        {hasMore && <span className="ml-0.5 opacity-80">+{events.length - 1}</span>}
      </button>
      {expanded && hasMore && (
        <div className="absolute z-50 left-0 top-full mt-0.5 rounded-md border bg-popover shadow-lg p-1.5 min-w-[140px]">
          {events.map((evt, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              <span className={`inline-block rounded px-1 py-0 text-[8px] font-bold leading-tight ${EVENT_COLORS[evt.type]}`}>
                {EVENT_TYPE_LABELS[evt.type]}
              </span>
              <span className="text-[9px] text-muted-foreground truncate">{evt.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Calendar Component ─────────────────────────────────────────

export function TradingCalendar({ tradingDays, onViewDay }: TradingCalendarProps) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  const holidays = useMemo(() => getMarketHolidays(viewYear), [viewYear])

  const economicEvents = useMemo(
    () => getEconomicEventsByDate(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = () => setExpandedDate(null)
    if (expandedDate) {
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [expandedDate])

  // Aggregate multiple trading days on the same date (All Accounts view)
  const daysByDate = useMemo(() => {
    const map = new Map<string, { netPnl: number; winRate: number; totalTrades: number; ids: number[] }>()
    for (const day of tradingDays) {
      const existing = map.get(day.trade_date)
      if (existing) {
        const prevTotalTrades = existing.totalTrades
        const newTotalTrades = prevTotalTrades + day.num_trades
        existing.netPnl += day.net_pnl
        existing.winRate = newTotalTrades > 0
          ? (existing.winRate * prevTotalTrades + day.win_rate * day.num_trades) / newTotalTrades
          : 0
        existing.totalTrades = newTotalTrades
        existing.ids.push(day.id)
      } else {
        map.set(day.trade_date, {
          netPnl: day.net_pnl,
          winRate: day.win_rate,
          totalTrades: day.num_trades,
          ids: [day.id],
        })
      }
    }
    return map
  }, [tradingDays])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay = new Date(viewYear, viewMonth + 1, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const cells: (number | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    return cells
  }, [viewYear, viewMonth])

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const weeks: (number | null)[][] = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7))
  }

  // Monthly summary
  const monthDays = tradingDays.filter((d) => {
    const [y, m] = d.trade_date.split('-').map(Number)
    return y === viewYear && m === viewMonth + 1
  })
  const monthPnl = monthDays.reduce((sum, d) => sum + d.net_pnl, 0)
  const monthGreenDays = monthDays.filter((d) => d.net_pnl > 0).length
  const monthRedDays = monthDays.filter((d) => d.net_pnl < 0).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar size={14} />
            Trading Calendar
          </CardTitle>
          <div className="flex items-center gap-3">
            {monthDays.length > 0 && (
              <span className={`text-xs font-medium ${pnlColor(monthPnl)}`}>
                {formatPnl(monthPnl)} · {monthGreenDays}W {monthRedDays}L
              </span>
            )}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevMonth}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-sm font-medium w-32 text-center">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((dayNum, di) => {
                if (dayNum === null) {
                  return <div key={di} className="min-h-[80px] bg-secondary/10 border-r border-border last:border-r-0" />
                }

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                const tradingDay = daysByDate.get(dateStr)
                const dayEvents = economicEvents.get(dateStr) || []
                const holidayName = holidays.get(dateStr)
                const isToday =
                  viewYear === now.getFullYear() &&
                  viewMonth === now.getMonth() &&
                  dayNum === now.getDate()
                const weekend = isWeekend(viewYear, viewMonth, dayNum)
                const nonTrading = weekend || !!holidayName

                return (
                  <div
                    key={di}
                    onClick={() => tradingDay && tradingDay.ids.length === 1 && onViewDay?.(tradingDay.ids[0])}
                    className={`min-h-[80px] p-1.5 border-r border-border last:border-r-0 transition-colors flex flex-col ${
                      tradingDay
                        ? 'cursor-pointer hover:bg-secondary/60'
                        : ''
                    } ${
                      tradingDay && tradingDay.netPnl >= 0
                        ? 'bg-emerald-500/5'
                        : tradingDay && tradingDay.netPnl < 0
                        ? 'bg-red-500/5'
                        : nonTrading
                        ? 'bg-secondary/15'
                        : ''
                    }`}
                  >
                    <div className={`text-xs font-medium ${
                      isToday
                        ? 'text-emerald-400'
                        : tradingDay
                        ? 'text-foreground'
                        : nonTrading
                        ? 'text-muted-foreground/30'
                        : 'text-muted-foreground/60'
                    }`}>
                      {dayNum}
                    </div>
                    {/* Holiday label */}
                    {holidayName && !tradingDay && (
                      <div className="text-[8px] text-muted-foreground/40 leading-tight mt-0.5">
                        {holidayName}
                      </div>
                    )}
                    {tradingDay && (
                      <div className="mt-0.5">
                        <div className={`text-xs font-semibold ${pnlColor(tradingDay.netPnl)}`}>
                          {formatPnl(tradingDay.netPnl)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatPercent(tradingDay.winRate, 0)}
                        </div>
                      </div>
                    )}
                    {/* Economic event badges */}
                    {dayEvents.length > 0 && (
                      <div className="mt-auto pt-0.5">
                        <EventDropdown
                          events={dayEvents}
                          expanded={expandedDate === dateStr}
                          onToggle={(e) => {
                            e.stopPropagation()
                            setExpandedDate(expandedDate === dateStr ? null : dateStr)
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Event type legend */}
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {(['fomc', 'nfp', 'cpi', 'ppi', 'gdp'] as const).map((type) => (
            <div key={type} className="flex items-center gap-1 text-[10px]">
              <span className={`inline-block rounded px-1 py-0 font-bold leading-tight ${EVENT_COLORS[type]}`}>
                {EVENT_TYPE_LABELS[type]}
              </span>
              <span className="text-muted-foreground">
                {type === 'fomc' ? 'Fed Rate Decision' : type === 'nfp' ? 'Jobs Report' : type === 'cpi' ? 'Inflation' : type === 'ppi' ? 'Producer Prices' : 'Growth'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
