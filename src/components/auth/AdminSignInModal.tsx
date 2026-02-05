import { useState } from 'react'
import { Shield, Loader2, CreditCard, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminSignInModalProps {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
}

// Demo admin credentials
const ADMIN_USER = {
  email: 'sarah.mitchell@us.af.mil',
  name: 'Capt. Sarah Mitchell',
}

export function AdminSignInModal({ isOpen, onClose, onSignIn }: AdminSignInModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('••••••••••••')

  if (!isOpen) return null

  const handleSignIn = async () => {
    setIsLoading(true)
    // Simulate authentication delay
    await new Promise((resolve) => setTimeout(resolve, 800))
    onSignIn()
    setIsLoading(false)
  }

  const handleCACClick = () => {
    // Does nothing - just for demo appearance
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold font-display">Admin Sign In</h2>
              <p className="text-xs text-muted-foreground">Policy Management Access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 pb-6">
          {/* Email field */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={ADMIN_USER.email}
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
        <div className="px-6 pb-4">
          <p className="text-center text-xs text-muted-foreground">
            Demo mode - Click Sign In to access admin features
          </p>
        </div>
      </div>
    </div>
  )
}
