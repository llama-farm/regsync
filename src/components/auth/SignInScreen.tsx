import { useState } from 'react'
import { Shield, Loader2, CreditCard } from 'lucide-react'
import type { Role } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface SignInScreenProps {
  onSignIn: (role: Role) => void
}

// Fake credentials for demo
const DEMO_USERS = {
  user: {
    email: 'james.thompson@us.af.mil',
    name: 'TSgt. James Thompson',
  },
  admin: {
    email: 'sarah.mitchell@us.af.mil',
    name: 'Capt. Sarah Mitchell',
  },
}

export function SignInScreen({ onSignIn }: SignInScreenProps) {
  const [selectedRole, setSelectedRole] = useState<Role>('user')
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('••••••••••••')

  const currentUser = DEMO_USERS[selectedRole]

  const handleSignIn = async () => {
    setIsLoading(true)
    // Simulate authentication delay
    await new Promise((resolve) => setTimeout(resolve, 1200))
    onSignIn(selectedRole)
  }

  const handleCACClick = () => {
    // Does nothing - just for demo appearance
  }

  return (
    <div className={cn(
      "min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-300",
      selectedRole === 'admin' && "admin"
    )}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold font-display">Policy Document Management System</h1>
        </div>

        {/* Sign in card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4 font-display">Sign In</h2>

          {/* Role toggle - small radio buttons */}
          <div className="flex items-center gap-4 mb-5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={selectedRole === 'user'}
                onChange={() => setSelectedRole('user')}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className={selectedRole === 'user' ? 'text-foreground' : 'text-muted-foreground'}>
                Personnel
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={selectedRole === 'admin'}
                onChange={() => setSelectedRole('admin')}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className={selectedRole === 'admin' ? 'text-foreground' : 'text-muted-foreground'}>
                Administrator
              </span>
            </label>
          </div>

          {/* Email field */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={currentUser.email}
              readOnly
              className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Password field */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors text-sm',
              'bg-primary hover:bg-primary/90 text-primary-foreground',
              isLoading && 'opacity-70 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-card text-muted-foreground">or</span>
            </div>
          </div>

          {/* CAC button */}
          <button
            onClick={handleCACClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors text-sm border border-border hover:bg-muted/50"
          >
            <CreditCard className="w-4 h-4" />
            Continue with CAC
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          Demo mode - Select a role to explore the system
        </p>
      </div>
    </div>
  )
}
