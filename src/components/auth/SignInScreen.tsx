import { useState } from 'react'
import { Shield, Loader2, UserCircle, ShieldCheck } from 'lucide-react'
import type { Role } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface SignInScreenProps {
  onSignIn: (role: Role) => void
}

export function SignInScreen({ onSignIn }: SignInScreenProps) {
  const [selectedRole, setSelectedRole] = useState<Role>('user')
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    // Simulate authentication delay
    await new Promise((resolve) => setTimeout(resolve, 1200))
    onSignIn(selectedRole)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold font-display">RegSync</h1>
          <p className="text-muted-foreground mt-1">
            Policy Document Management System
          </p>
        </div>

        {/* Sign in card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-1 font-display">Sign In</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Select your role to continue
          </p>

          {/* Role selection */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => setSelectedRole('user')}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                selectedRole === 'user'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  selectedRole === 'user'
                    ? 'bg-primary/10'
                    : 'bg-muted'
                )}
              >
                <UserCircle
                  className={cn(
                    'w-6 h-6',
                    selectedRole === 'user'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <div className="font-medium">Personnel</div>
                <div className="text-sm text-muted-foreground">
                  TSgt. James Thompson
                </div>
              </div>
              <div
                className={cn(
                  'ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  selectedRole === 'user'
                    ? 'border-primary'
                    : 'border-muted-foreground/30'
                )}
              >
                {selectedRole === 'user' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                selectedRole === 'admin'
                  ? 'border-purple-500 bg-purple-500/5'
                  : 'border-border hover:border-purple-500/50'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  selectedRole === 'admin'
                    ? 'bg-purple-500/10'
                    : 'bg-muted'
                )}
              >
                <ShieldCheck
                  className={cn(
                    'w-6 h-6',
                    selectedRole === 'admin'
                      ? 'text-purple-500'
                      : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <div className="font-medium">Administrator</div>
                <div className="text-sm text-muted-foreground">
                  Capt. Sarah Mitchell
                </div>
              </div>
              <div
                className={cn(
                  'ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  selectedRole === 'admin'
                    ? 'border-purple-500'
                    : 'border-muted-foreground/30'
                )}
              >
                {selectedRole === 'admin' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                )}
              </div>
            </button>
          </div>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors',
              selectedRole === 'admin'
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground',
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Demo mode - Select a role to explore the system
        </p>
      </div>
    </div>
  )
}
