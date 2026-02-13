import { ReactNode, useEffect, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { documentsApi } from '@/api/documentsApi'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isAdmin } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [lastSync, setLastSync] = useState('2 min ago')
  const [resetting, setResetting] = useState(false)
  const docCount = 4 // Static for demo

  const handleReset = async () => {
    if (!window.confirm('Reset to original demo data? Your uploads and changes will be removed.')) return
    setResetting(true)
    try {
      const result = await documentsApi.resetToSeed()
      toast.success('Demo reset', {
        description: `Restored ${result.documents_restored} documents to original state.`,
      })
      window.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
      toast.error('Reset failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setResetting(false)
    }
  }

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health', { method: 'GET' })
        setIsConnected(response.ok)
        if (response.ok) {
          setLastSync('Just now')
        }
      } catch {
        setIsConnected(false)
      }
    }

    checkConnection()
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  // Apply admin class to html element for theme switching
  useEffect(() => {
    const html = document.documentElement
    if (isAdmin) {
      html.classList.add('admin')
    } else {
      html.classList.remove('admin')
    }
    return () => {
      html.classList.remove('admin')
    }
  }, [isAdmin])

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      {/* Sync status footer */}
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground flex items-center gap-4 bg-background/50">
        <span className="flex items-center gap-1.5">
          <span className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-amber-500"
          )} />
          {isConnected ? "Connected" : "Connecting..."}
        </span>
        <span className="text-muted-foreground/60">|</span>
        <span>Last sync: {lastSync}</span>
        <span className="text-muted-foreground/60">|</span>
        <span>{docCount} policies indexed</span>
        {isAdmin && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            {resetting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            {resetting ? 'Resetting...' : 'Reset Demo'}
          </button>
        )}
      </div>
    </div>
  )
}
