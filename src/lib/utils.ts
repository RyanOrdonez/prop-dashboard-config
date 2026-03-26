import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  const isNegative = value < 0
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return isNegative ? `$(${formatted})` : `$${formatted}`
}

export function formatPnl(value: number): string {
  const formatted = formatCurrency(value)
  return value >= 0 ? `+${formatted}` : formatted
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}sec`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins}min ${secs}sec` : `${mins}min`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function pnlColor(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-zinc-400'
}

export function pnlBg(value: number): string {
  if (value > 0) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (value < 0) return 'bg-red-500/10 text-red-400 border-red-500/20'
  return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
}
