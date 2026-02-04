import { ReactNode, useEffect } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isAdmin } = useAuth()

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
    </div>
  )
}
