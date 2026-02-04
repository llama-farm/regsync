import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export type Role = 'admin' | 'user'

export interface User {
  id: string
  name: string
  role: Role
  title?: string
}

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  isSignedIn: boolean
  login: (role: Role) => void
  logout: () => void
  switchRole: () => void
  showSignIn: boolean
  setShowSignIn: (show: boolean) => void
}

const MOCK_USERS: Record<Role, User> = {
  admin: {
    id: '1',
    name: 'Capt. Sarah Mitchell',
    role: 'admin',
    title: 'Policy Administrator',
  },
  user: {
    id: '2',
    name: 'TSgt. James Thompson',
    role: 'user',
    title: 'Personnel Specialist',
  },
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [showSignIn, setShowSignIn] = useState(true)

  const login = useCallback((role: Role) => {
    setUser(MOCK_USERS[role])
    setShowSignIn(false)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setShowSignIn(true)
  }, [])

  const switchRole = useCallback(() => {
    // Show sign-in screen instead of direct switch
    setShowSignIn(true)
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'admin'
  const isSignedIn = user !== null

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isSignedIn,
        login,
        logout,
        switchRole,
        showSignIn,
        setShowSignIn,
      }}
    >
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
