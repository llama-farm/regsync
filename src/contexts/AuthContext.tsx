import { createContext, useContext, useState, ReactNode } from 'react'

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
  login: (role: Role) => void
  logout: () => void
}

export const MOCK_USERS: Record<Role, User> = {
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

// Chat storage key - must match PolicyAssistant
const CHAT_STORAGE_KEY = 'regsync_chat_history'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with null user to show sign-in screen
  const [user, setUser] = useState<User | null>(null)

  const login = (role: Role) => {
    // Clear chat history on each sign-in for fresh start
    localStorage.removeItem(`${CHAT_STORAGE_KEY}_admin`)
    localStorage.removeItem(`${CHAT_STORAGE_KEY}_user`)
    setUser(MOCK_USERS[role])
  }

  const logout = () => {
    // Clear chat history for both roles on logout
    localStorage.removeItem(`${CHAT_STORAGE_KEY}_admin`)
    localStorage.removeItem(`${CHAT_STORAGE_KEY}_user`)
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout }}>
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
