import { useState } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Layers,
  FileText,
  PlayCircle,
  Bug,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Upload,
  ClipboardCheck,
  UserPlus,
  CreditCard,
  TrendingUp,
  Coins,
  UserMinus,
  Package,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SavLogo } from '@/components/brand/SavLogo'
import { GlobalSearch } from './GlobalSearch'
import { ThemeToggle } from './ThemeToggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDataStore } from '@/store/useDataStore'
import { useAuthStore } from '@/store/useAuthStore'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/suites', label: 'Test Suites', icon: Layers },
  { to: '/cases', label: 'Test Cases', icon: FileText },
  { to: '/upload', label: 'Upload Cases', icon: Upload },
  { to: '/review', label: 'Review & Approval', icon: ClipboardCheck },
  { to: '/runs', label: 'Test Runs', icon: PlayCircle },
  { to: '/bugs', label: 'Bug Tracker', icon: Bug },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function moduleIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (/login|signup|sign-up|onboard|auth/.test(n)) return UserPlus
  if (/card/.test(n)) return CreditCard
  if (/wealth|invest/.test(n)) return TrendingUp
  if (/gold/.test(n)) return Coins
  if (/offboard/.test(n)) return UserMinus
  return Package
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const modules = useDataStore((s) => s.settings.modules)
  const pendingReview = useDataStore((s) => s.testCases.filter((c) => c.reviewStatus === 'Pending').length)
  const activeModule = location.pathname === '/cases' ? searchParams.get('module') : null
  const tester = useDataStore((s) => s.settings.currentTester)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const displayName = user?.name ?? tester
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3 overflow-y-auto">
      {nav.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive && !(item.to === '/cases' && activeModule)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/review' && pendingReview > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {pendingReview}
              </span>
            )}
          </NavLink>
        )
      })}

      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Modules
      </p>
      {modules.map((mod) => {
        const Icon = moduleIcon(mod)
        const isActive = activeModule === mod
        return (
          <NavLink
            key={mod}
            to={`/cases?module=${encodeURIComponent(mod)}`}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate" title={mod}>{mod}</span>
          </NavLink>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex items-center px-5 h-16 border-b">
          <SavLogo />
        </div>
        {sidebar}
        <div className="mt-auto border-t p-4 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold shrink-0">
            {initials}
          </span>
          <div className="min-w-0 leading-tight flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? 'QA Engineer'}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground shrink-0"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r flex flex-col drawer-in">
            <div className="flex items-center justify-between px-4 h-16 border-b">
              <SavLogo />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 px-4 lg:px-6 pt-3">
          <div className="flex h-14 items-center gap-3 rounded-2xl border bg-card/85 backdrop-blur-md shadow-sm px-3 transition-shadow hover:shadow-md">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu />
            </Button>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={logout}
                    aria-label="Sign out"
                  >
                    <LogOut />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
