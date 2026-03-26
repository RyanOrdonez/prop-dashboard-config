import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  PlusCircle,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PageId } from '@/lib/types'

interface SidebarProps {
  currentPage: PageId
  onNavigate: (page: PageId) => void
  dashboardName: string
}

const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'payout', label: 'Payout Tracker', icon: <Wallet size={20} /> },
  { id: 'journal', label: 'Journal', icon: <BookOpen size={20} /> },
  { id: 'add-day', label: 'Add Trading Day', icon: <PlusCircle size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
]

export function Sidebar({ currentPage, onNavigate, dashboardName }: SidebarProps) {
  return (
    <aside className="flex flex-col w-64 border-r bg-card/50 h-screen sticky top-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/15">
          <TrendingUp size={20} className="text-emerald-400" />
        </div>
        <span className="font-bold text-sm text-white">{dashboardName || 'My Dashboard'}</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              currentPage === item.id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t">
        <p className="text-[11px] text-muted-foreground text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
