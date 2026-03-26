import { useState, useEffect, useCallback } from 'react'
import type { PageId, Account, TradingDay } from '@/lib/types'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardPage } from '@/pages/DashboardPage'
import { JournalPage } from '@/pages/JournalPage'
import { AddDayPage } from '@/pages/AddDayPage'
import { PayoutPage } from '@/pages/PayoutPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DayDetailPage } from '@/pages/DayDetailPage'

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tradingDays, setTradingDays] = useState<TradingDay[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardName, setDashboardName] = useState('My Dashboard')

  const loadData = useCallback(async () => {
    try {
      const [accts, days, settings] = await Promise.all([
        window.electronAPI.getAccounts(),
        window.electronAPI.getTradingDays(),
        window.electronAPI.getSettings(),
      ])
      setAccounts(accts)
      setTradingDays(days)
      if (settings.dashboard_name) setDashboardName(settings.dashboard_name)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page)
    if (page !== 'day-detail') {
      setSelectedDayId(null)
    }
  }

  const handleViewDay = (dayId: number) => {
    setSelectedDayId(dayId)
    setCurrentPage('day-detail')
  }

  const handleDataChange = () => {
    loadData()
  }

  const filteredDays = selectedAccountId
    ? tradingDays.filter(d => d.account_id === selectedAccountId)
    : tradingDays

  const selectedAccount = selectedAccountId
    ? accounts.find(a => a.id === selectedAccountId) || null
    : null

  if (isLoading) {
    return (
      <div className="dark flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dark flex h-screen overflow-hidden bg-background">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} dashboardName={dashboardName} />
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard' && (
          <DashboardPage
            accounts={accounts}
            tradingDays={filteredDays}
            allTradingDays={tradingDays}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            onViewDay={handleViewDay}
            onNavigate={handleNavigate}
          />
        )}
        {currentPage === 'payout' && (
          <PayoutPage
            accounts={accounts}
            tradingDays={filteredDays}
            allTradingDays={tradingDays}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            onDataChange={handleDataChange}
          />
        )}
        {currentPage === 'journal' && (
          <JournalPage
            accounts={accounts}
            tradingDays={filteredDays}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            onViewDay={handleViewDay}
            onDataChange={handleDataChange}
          />
        )}
        {currentPage === 'add-day' && (
          <AddDayPage
            accounts={accounts}
            onDataChange={handleDataChange}
            onNavigate={handleNavigate}
          />
        )}
        {currentPage === 'settings' && (
          <SettingsPage
            accounts={accounts}
            onDataChange={handleDataChange}
            dashboardName={dashboardName}
            onDashboardNameChange={setDashboardName}
          />
        )}
        {currentPage === 'day-detail' && selectedDayId && (
          <DayDetailPage
            dayId={selectedDayId}
            accounts={accounts}
            onBack={() => handleNavigate('journal')}
          />
        )}
      </main>
    </div>
  )
}
