import fs from 'node:fs'

export interface ParsedTrade {
  symbol: string
  qty: number
  buyPrice: number
  sellPrice: number
  pnl: number
  boughtTimestamp: string
  soldTimestamp: string
  durationSeconds: number
  durationText: string
}

export interface ParsedDaySummary {
  tradeDate: string
  trades: ParsedTrade[]
  grossPnl: number
  numTrades: number
  numContracts: number
  winCount: number
  lossCount: number
  winRate: number
  avgTradePnl: number
  avgTradeDurationSec: number
  largestWin: number
  largestLoss: number
  totalProfit: number
  totalLoss: number
  avgWin: number
  avgLoss: number
  maxRunup: number
  maxDrawdown: number
  expectancy: number
}

function parsePnlValue(pnlStr: string): number {
  // Handle formats like "$35.00", "$(237.50)", "$1,795.50"
  const cleaned = pnlStr.replace(/[$,]/g, '')
  // Check for negative: $(xxx)
  const match = cleaned.match(/^\((.+)\)$/)
  if (match) {
    return -parseFloat(match[1])
  }
  return parseFloat(cleaned)
}

function parseDurationToSeconds(durationStr: string): number {
  let totalSeconds = 0
  const minMatch = durationStr.match(/(\d+)min/)
  const secMatch = durationStr.match(/(\d+)sec/)
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60
  if (secMatch) totalSeconds += parseInt(secMatch[1])
  return totalSeconds
}

function parseTimestamp(ts: string): Date {
  // Format: "03/13/2026 19:04:28"
  const [datePart, timePart] = ts.trim().split(' ')
  const [month, day, year] = datePart.split('/')
  return new Date(`${year}-${month}-${day}T${timePart}`)
}

function extractTradeDate(trades: ParsedTrade[]): string {
  if (trades.length === 0) return new Date().toISOString().split('T')[0]
  const ts = trades[0].boughtTimestamp
  const [datePart] = ts.trim().split(' ')
  const [month, day, year] = datePart.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export function parseCSVFile(filePath: string): ParsedDaySummary {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parseCSVContent(content)
}

export function parseCSVContent(content: string): ParsedDaySummary {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  // Parse header (trim to handle \r from Windows line endings)
  const headers = lines[0].split(',').map(h => h.trim())
  const symbolIdx = headers.indexOf('symbol')
  const qtyIdx = headers.indexOf('qty')
  const buyPriceIdx = headers.indexOf('buyPrice')
  const sellPriceIdx = headers.indexOf('sellPrice')
  const pnlIdx = headers.indexOf('pnl')
  const boughtTsIdx = headers.indexOf('boughtTimestamp')
  const soldTsIdx = headers.indexOf('soldTimestamp')
  const durationIdx = headers.indexOf('duration')

  if (pnlIdx === -1) throw new Error('CSV missing required "pnl" column')

  const trades: ParsedTrade[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle CSV with potential commas in values
    const cols = parseCSVLine(line)

    const pnl = parsePnlValue(cols[pnlIdx] || '0')
    const durationText = cols[durationIdx] || ''
    const durationSeconds = parseDurationToSeconds(durationText)

    trades.push({
      symbol: cols[symbolIdx] || '',
      qty: parseInt(cols[qtyIdx] || '0'),
      buyPrice: parseFloat(cols[buyPriceIdx] || '0'),
      sellPrice: parseFloat(cols[sellPriceIdx] || '0'),
      pnl,
      boughtTimestamp: cols[boughtTsIdx] || '',
      soldTimestamp: cols[soldTsIdx] || '',
      durationSeconds,
      durationText,
    })
  }

  return computeDaySummary(trades)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function formatDurationText(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  if (mins > 0 && secs > 0) return `${mins}min ${secs}sec`
  if (mins > 0) return `${mins}min`
  return `${secs}sec`
}

function aggregateTrades(trades: ParsedTrade[]): ParsedTrade[] {
  if (trades.length <= 1) return trades

  // Group by symbol first so different instruments don't merge
  const bySymbol = new Map<string, ParsedTrade[]>()
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, [])
    bySymbol.get(t.symbol)!.push(t)
  }

  const result: ParsedTrade[] = []

  Array.from(bySymbol.values()).forEach(symbolTrades => {
    // For each fill, compute its time range [start, end]
    const withRange = symbolTrades.map(t => {
      const buyMs = parseTimestamp(t.boughtTimestamp).getTime()
      const sellMs = parseTimestamp(t.soldTimestamp).getTime()
      return { trade: t, start: Math.min(buyMs, sellMs), end: Math.max(buyMs, sellMs) }
    })

    // Sort by start time
    withRange.sort((a, b) => a.start - b.start)

    // Merge overlapping intervals into groups
    const groups: (typeof withRange)[] = []
    let currentGroup = [withRange[0]]
    let currentEnd = withRange[0].end

    for (let i = 1; i < withRange.length; i++) {
      const item = withRange[i]
      if (item.start <= currentEnd) {
        // Overlaps — belongs to the same logical trade
        currentGroup.push(item)
        if (item.end > currentEnd) currentEnd = item.end
      } else {
        // No overlap — new trade
        groups.push(currentGroup)
        currentGroup = [item]
        currentEnd = item.end
      }
    }
    groups.push(currentGroup)

    // Merge each group into one aggregated trade
    for (const group of groups) {
      if (group.length === 1) {
        result.push(group[0].trade)
        continue
      }

      const fills = group.map(g => g.trade)
      const totalQty = fills.reduce((s: number, t: ParsedTrade) => s + t.qty, 0)
      const totalPnl = fills.reduce((s: number, t: ParsedTrade) => s + t.pnl, 0)
      const avgBuyPrice = fills.reduce((s: number, t: ParsedTrade) => s + t.buyPrice * t.qty, 0) / totalQty
      const avgSellPrice = fills.reduce((s: number, t: ParsedTrade) => s + t.sellPrice * t.qty, 0) / totalQty

      // Earliest bought, latest sold
      const sortedByBuy = [...fills].sort((a, b) => a.boughtTimestamp.localeCompare(b.boughtTimestamp))
      const sortedBySell = [...fills].sort((a, b) => a.soldTimestamp.localeCompare(b.soldTimestamp))
      const earliestBought = sortedByBuy[0].boughtTimestamp
      const latestSold = sortedBySell[sortedBySell.length - 1].soldTimestamp

      const buyTime = parseTimestamp(earliestBought)
      const sellTime = parseTimestamp(latestSold)
      const durationSeconds = Math.abs(Math.round((sellTime.getTime() - buyTime.getTime()) / 1000))

      result.push({
        symbol: fills[0].symbol,
        qty: totalQty,
        buyPrice: Math.round(avgBuyPrice * 100) / 100,
        sellPrice: Math.round(avgSellPrice * 100) / 100,
        pnl: Math.round(totalPnl * 100) / 100,
        boughtTimestamp: earliestBought,
        soldTimestamp: latestSold,
        durationSeconds,
        durationText: formatDurationText(durationSeconds),
      })
    }
  })

  // Sort final result by start time
  result.sort((a, b) => a.boughtTimestamp.localeCompare(b.boughtTimestamp))
  return result
}

function computeDaySummary(rawTrades: ParsedTrade[]): ParsedDaySummary {
  const tradeDate = extractTradeDate(rawTrades)
  // Aggregate split fills into logical trades
  const trades = aggregateTrades(rawTrades)
  const numTrades = trades.length
  const numContracts = rawTrades.reduce((sum, t) => sum + t.qty, 0) * 2
  const grossPnl = trades.reduce((sum, t) => sum + t.pnl, 0)

  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl <= 0)

  const winCount = winners.length
  const lossCount = losers.length
  const winRate = numTrades > 0 ? winCount / numTrades : 0

  const totalProfit = winners.reduce((sum, t) => sum + t.pnl, 0)
  const totalLoss = losers.reduce((sum, t) => sum + t.pnl, 0)

  const avgWin = winCount > 0 ? totalProfit / winCount : 0
  const avgLoss = lossCount > 0 ? totalLoss / lossCount : 0

  const largestWin = winners.length > 0 ? Math.max(...winners.map(t => t.pnl)) : 0
  const largestLoss = losers.length > 0 ? Math.min(...losers.map(t => t.pnl)) : 0

  const avgTradePnl = numTrades > 0 ? grossPnl / numTrades : 0
  const avgTradeDurationSec = numTrades > 0
    ? trades.reduce((sum, t) => sum + t.durationSeconds, 0) / numTrades
    : 0

  // Compute max run-up and max drawdown using cumulative P&L
  let cumPnl = 0
  let peakPnl = 0
  let troughPnl = 0
  let maxRunup = 0
  let maxDrawdown = 0

  // Sort trades by timestamp for sequential analysis
  const sortedTrades = [...trades].sort((a, b) => {
    const aTime = new Date(a.boughtTimestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2')).getTime()
    const bTime = new Date(b.boughtTimestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2')).getTime()
    return aTime - bTime
  })

  for (const trade of sortedTrades) {
    cumPnl += trade.pnl

    if (cumPnl > peakPnl) {
      peakPnl = cumPnl
    }
    if (cumPnl < troughPnl) {
      troughPnl = cumPnl
    }

    const runup = cumPnl - troughPnl
    const drawdown = cumPnl - peakPnl

    if (runup > maxRunup) maxRunup = runup
    if (drawdown < maxDrawdown) maxDrawdown = drawdown
  }

  const expectancy = numTrades > 0
    ? (winRate * avgWin) + ((1 - winRate) * avgLoss)
    : 0

  return {
    tradeDate,
    trades: sortedTrades,
    grossPnl: Math.round(grossPnl * 100) / 100,
    numTrades,
    numContracts,
    winCount,
    lossCount,
    winRate: Math.round(winRate * 10000) / 10000,
    avgTradePnl: Math.round(avgTradePnl * 100) / 100,
    avgTradeDurationSec: Math.round(avgTradeDurationSec * 100) / 100,
    largestWin: Math.round(largestWin * 100) / 100,
    largestLoss: Math.round(largestLoss * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalLoss: Math.round(totalLoss * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    maxRunup: Math.round(maxRunup * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
  }
}
