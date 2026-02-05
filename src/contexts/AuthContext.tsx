import { createContext, useContext, useState, ReactNode } from 'react'

export type UserRole = 'user' | 'admin' | 'superadmin'

export interface AdminUser {
  id: string
  name: string
  title: string
  role: UserRole
}

interface AuthContextType {
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  adminUser: AdminUser | null
  login: () => void
  logout: () => void
}

// Permissions by role
export const permissions = {
  user: ['view_policies', 'ask_questions'],
  admin: ['view_policies', 'ask_questions', 'upload_policies', 'manage_versions'],
  superadmin: ['view_policies', 'ask_questions', 'upload_policies', 'manage_versions', 'manage_admins']
} as const

// Mock admin user for demo - Sarah is a superadmin
const ADMIN_USER: AdminUser = {
  id: '1',
  name: 'Capt. Sarah Mitchell',
  title: 'Policy Administrator',
  role: 'superadmin',
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const login = () => {
    setIsAuthenticated(true)
  }

  const logout = () => {
    setIsAuthenticated(false)
  }

  // Only authenticated users are admins (no regular user login anymore)
  const isAdmin = isAuthenticated
  const isSuperAdmin = isAuthenticated && ADMIN_USER.role === 'superadmin'
  const adminUser = isAuthenticated ? ADMIN_USER : null

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, isSuperAdmin, adminUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
