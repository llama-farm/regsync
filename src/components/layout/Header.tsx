import { useAuth } from '@/contexts/AuthContext'
import { Shield, Moon, Sun, RefreshCw, LogOut } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const { user, switchRole, isAdmin } = useAuth()
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded ${isAdmin ? 'bg-admin-primary/10' : 'bg-primary/10'}`}>
          <Shield className={`w-5 h-5 ${isAdmin ? 'text-admin-primary' : 'text-primary'}`} />
        </div>
        <span className="font-semibold text-lg tracking-tight font-display">RegSync</span>
        {isAdmin && (
          <span className="text-xs bg-admin-primary/10 text-admin-primary px-2 py-0.5 rounded font-medium">
            Admin
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Sync indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>5 nodes</span>
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Last sync: 2 min</span>
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Moon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* User badge with sign out */}
        {user && (
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
                isAdmin ? 'bg-admin-primary/10' : 'bg-accent'
              }`}
            >
              <div className="text-right">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrator' : user.title}
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  isAdmin ? 'bg-purple-500' : 'bg-blue-500'
                }`}
              />
            </div>
            <button
              onClick={switchRole}
              className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
