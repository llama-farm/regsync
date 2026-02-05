import { useState } from 'react'
import { useAuth, type UserRole } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { UserCircle, Shield, ShieldAlert, Trash2, Plus } from 'lucide-react'

interface AdminMember {
  id: string
  name: string
  email: string
  role: UserRole
  canRemove: boolean
}

// Mock admin list
const INITIAL_ADMINS: AdminMember[] = [
  {
    id: '1',
    name: 'Capt. Sarah Mitchell',
    email: 'sarah.mitchell@us.af.mil',
    role: 'superadmin',
    canRemove: false, // Superadmins can't be removed
  },
  {
    id: '2',
    name: 'TSgt John Smith',
    email: 'john.smith@us.af.mil',
    role: 'admin',
    canRemove: true,
  },
  {
    id: '3',
    name: 'MSgt Maria Johnson',
    email: 'maria.johnson@us.af.mil',
    role: 'admin',
    canRemove: true,
  },
  {
    id: '4',
    name: 'Col. David Williams',
    email: 'david.williams@us.af.mil',
    role: 'superadmin',
    canRemove: false, // Superadmins can't be removed
  },
]

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'superadmin':
      return <ShieldAlert className="w-4 h-4 text-amber-500" />
    case 'admin':
      return <Shield className="w-4 h-4 text-primary" />
    default:
      return <UserCircle className="w-4 h-4 text-muted-foreground" />
  }
}

function getRoleBadge(role: UserRole) {
  const baseClasses = 'px-2 py-0.5 rounded text-xs font-medium'
  switch (role) {
    case 'superadmin':
      return <span className={`${baseClasses} bg-amber-500/20 text-amber-600`}>Superadmin</span>
    case 'admin':
      return <span className={`${baseClasses} bg-primary/20 text-primary`}>Admin</span>
    default:
      return <span className={`${baseClasses} bg-muted text-muted-foreground`}>User</span>
  }
}

export function AdminManagement() {
  const { isSuperAdmin } = useAuth()
  const [admins, setAdmins] = useState<AdminMember[]>(INITIAL_ADMINS)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'superadmin'>('admin')

  const handleRemoveAdmin = (admin: AdminMember) => {
    if (!admin.canRemove) {
      toast.error('Cannot remove superadmins')
      return
    }

    setAdmins(prev => prev.filter(a => a.id !== admin.id))
    toast.success(`Removed ${admin.name} from admin list`)
  }

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault()

    if (!newEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    if (!newEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    // Check if already exists
    if (admins.some(a => a.email.toLowerCase() === newEmail.toLowerCase())) {
      toast.error('This user is already an admin')
      return
    }

    // Mock adding a new admin
    const newAdmin: AdminMember = {
      id: Date.now().toString(),
      name: newEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email: newEmail,
      role: newRole,
      canRemove: newRole === 'admin', // Only regular admins can be removed
    }

    setAdmins(prev => [...prev, newAdmin])
    setNewEmail('')
    toast.success(`Added ${newAdmin.name} as ${newRole}`)
  }

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            Only superadmins can manage administrators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage administrator access for RegSync
        </p>
      </div>

      {/* Current Admins */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-foreground">Current Administrators</h2>
        </div>
        <div className="divide-y divide-border">
          {admins.map(admin => (
            <div
              key={admin.id}
              className="px-4 py-3 flex items-center gap-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getRoleIcon(admin.role)}
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{admin.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{admin.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getRoleBadge(admin.role)}
                {admin.canRemove ? (
                  <button
                    onClick={() => handleRemoveAdmin(admin)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Remove admin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                    Cannot remove
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Admin */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-foreground">Add New Administrator</h2>
        </div>
        <form onSubmit={handleAddAdmin} className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="firstname.lastname@us.af.mil"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1.5">
                Role
              </label>
              <select
                id="role"
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'admin' | 'superadmin')}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Administrator
            </button>
          </div>
        </form>
      </div>

      {/* Help text */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
        <p className="font-medium mb-2">Role Permissions:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li><strong>Admin:</strong> Can upload policies, manage versions, and view documents</li>
          <li><strong>Superadmin:</strong> All admin permissions plus ability to manage other administrators</li>
        </ul>
      </div>
    </div>
  )
}
