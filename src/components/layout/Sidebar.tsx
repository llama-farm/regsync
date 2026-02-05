import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  adminOnly?: boolean
  superAdminOnly?: boolean
  userOnly?: boolean
  end?: boolean
}

function NavItem({ to, icon, label, adminOnly, superAdminOnly, userOnly, end }: NavItemProps) {
  const { isAdmin, isSuperAdmin } = useAuth()

  if (superAdminOnly && !isSuperAdmin) {
    return null
  }

  if (adminOnly && !isAdmin) {
    return null
  }

  if (userOnly && isAdmin) {
    return null
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
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
        {/* Admin: Policy Management dashboard */}
        <NavItem
          to="/admin"
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Policy Management"
          adminOnly
          end
        />

        {/* Policy Assistant - available to all users */}
        <NavItem
          to="/"
          icon={<MessageSquare className="w-4 h-4" />}
          label="Policy Assistant"
          end
        />

        {/* Shared: Documents list */}
        <NavItem
          to="/documents"
          icon={<FileText className="w-4 h-4" />}
          label="Documents"
        />

        {/* Admin Management - superadmin only */}
        <NavItem
          to="/admin/management"
          icon={<Users className="w-4 h-4" />}
          label="Admin Management"
          superAdminOnly
        />
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center font-mono">
          RegSync v0.1.0
        </div>
      </div>
    </aside>
  )
}
