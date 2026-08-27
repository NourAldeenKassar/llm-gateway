import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings, Cpu, MessageSquare, BookOpen, Activity, LogOut } from 'lucide-react'
import { logout } from '@/lib/api'
import { cn } from '@/lib/utils'

interface LayoutProps {
  onLogout: () => void
}

export default function Layout({ onLogout }: LayoutProps) {
  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/providers', icon: Cpu, label: 'Providers' },
    { to: '/chat', icon: MessageSquare, label: 'Chat' },
    { to: '/monitoring', icon: Activity, label: 'Monitoring' },
    { to: '/docs', icon: BookOpen, label: 'API Docs' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="flex min-h-screen max-w-[100vw] overflow-hidden">
      <aside className="w-56 border-r border-border bg-muted/30 p-4 flex flex-col">
        <div className="flex items-center gap-3 mb-8 px-2">
          <img src="/favicon.svg" alt="LLM Gateway" className="w-8 h-8" />
          <h1 className="text-lg font-semibold">LLM Gateway</h1>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <main className="flex-1 p-8 min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
