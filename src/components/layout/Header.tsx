import { useAuth } from '@/contexts/AuthContext'
import { Shield, Moon, Sun, RefreshCw, LogOut } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function Header() {
  const { user, logout, isAdmin } = useAuth()
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded",
          "bg-primary/10"
        )}>
          <Shield className={cn(
            "w-5 h-5",
            "text-primary"
          )} />
        </div>
        <span className="font-semibold text-lg tracking-tight font-display">RegSync</span>
        {isAdmin && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
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

        {/* User badge */}
        {user && (
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md",
              "bg-accent"
            )}>
              <div className="text-right">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrator' : user.title}
                </div>
              </div>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  "bg-primary"
                )}
              />
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
