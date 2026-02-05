import { createContext, useContext, useState, ReactNode } from 'react'

export interface AdminUser {
  id: string
  name: string
  title: string
}

interface AuthContextType {
  isAuthenticated: boolean
  isAdmin: boolean
  adminUser: AdminUser | null
  login: () => void
  logout: () => void
}

// Mock admin user for demo
const ADMIN_USER: AdminUser = {
  id: '1',
  name: 'Capt. Sarah Mitchell',
  title: 'Policy Administrator',
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
  const adminUser = isAuthenticated ? ADMIN_USER : null

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, adminUser, login, logout }}>
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
