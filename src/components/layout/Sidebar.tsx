import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Upload,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  adminOnly?: boolean
  userOnly?: boolean
}

function NavItem({ to, icon, label, adminOnly, userOnly }: NavItemProps) {
  const { isAdmin } = useAuth()

  if (adminOnly && !isAdmin) {
    return null
  }

  if (userOnly && isAdmin) {
    return null
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          isActive
            ? isAdmin
              ? 'bg-admin-primary/10 text-admin-primary'
              : 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-border bg-card p-4 flex flex-col gap-1">
      <nav className="flex flex-col gap-1">
        {/* Admin navigation */}
        <NavItem
          to="/admin"
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Dashboard"
          adminOnly
        />
        <NavItem
          to="/upload"
          icon={<Upload className="w-4 h-4" />}
          label="Upload"
          adminOnly
        />

        {/* User navigation - combined dashboard/chat */}
        <NavItem
          to="/dashboard"
          icon={<MessageSquare className="w-4 h-4" />}
          label="Policy Assistant"
          userOnly
        />

        {/* Shared navigation - Documents at the bottom */}
        <NavItem
          to="/documents"
          icon={<FileText className="w-4 h-4" />}
          label="Documents"
        />
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          RegSync v0.1.0
        </div>
      </div>
    </aside>
  )
}
