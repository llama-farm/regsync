import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { documentsApi } from '@/api/documentsApi'

interface DemoToolbarProps {
  onResetComplete: () => void
}

export function DemoToolbar({ onResetComplete }: DemoToolbarProps) {
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleReset = async () => {
    setShowConfirm(false)
    setResetting(true)
    try {
      const result = await documentsApi.resetToSeed()
      toast.success('Demo reset', {
        description: `Restored ${result.documents_restored} documents to original state.`,
      })
      onResetComplete()
    } catch (err) {
      console.error('Reset failed:', err)
      toast.error('Reset failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Demo Tools</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reset to original demo state to start fresh
          </p>
        </div>

        {showConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reset all data?</span>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md transition-colors"
            >
              {resetting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Confirm Reset'
              )}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={resetting}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo
          </button>
        )}
      </div>
    </div>
  )
}
