import { useAuth } from '@/contexts/AuthContext'
import { Shield, Moon, Sun, RefreshCw, LogOut } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AdminSignInModal } from '@/components/auth/AdminSignInModal'
import { LocationContext } from './LocationContext'

export function Header() {
  const { isAuthenticated, isAdmin, adminUser, login, logout } = useAuth()
  const [isDark, setIsDark] = useState(true)
  const [showSignInModal, setShowSignInModal] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  const handleSignIn = () => {
    login()
    setShowSignInModal(false)
  }

  return (
    <>
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
          {/* Location context indicator */}
          <LocationContext />

          {/* Sync indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Synced</span>
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

          {/* Admin sign-in button (when not authenticated) */}
          {!isAuthenticated && (
            <button
              onClick={() => setShowSignInModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Shield className="w-3 h-3" />
              Admin access
            </button>
          )}

          {/* User badge (when authenticated as admin) */}
          {isAuthenticated && adminUser && (
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                "bg-accent"
              )}>
                <div className="text-right">
                  <div className="text-sm font-medium">{adminUser.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {adminUser.title}
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

      {/* Admin sign-in modal */}
      <AdminSignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSignIn={handleSignIn}
      />
    </>
  )
}
