import { useState, useEffect } from 'react'
import { X, Loader2, ChevronDown, ChevronUp, AlertCircle, Plus, Minus, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDocumentChanges, LlamaFarmConnectionError } from '@/services/diffService'
import type { DocumentChanges as DocumentChangesType, DiffLine } from '@/types/diff'

interface DocumentChangesModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
}

export function DocumentChangesModal({
  isOpen,
  onClose,
  documentId,
  documentName
}: DocumentChangesModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changes, setChanges] = useState<DocumentChangesType | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (isOpen && documentId) {
      loadChanges()
    }
  }, [isOpen, documentId])

  const loadChanges = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await getDocumentChanges(documentId)
      setChanges(result)
    } catch (err) {
      if (err instanceof LlamaFarmConnectionError) {
        setError('LlamaFarm is not running. Please start LlamaFarm to view document changes.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load document changes')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold font-display text-lg">{documentName}</h2>
            <p className="text-sm text-muted-foreground">Recent Changes</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Analyzing document changes...</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-3 bg-destructive/10 rounded-full mb-3">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{error}</p>
              <button
                onClick={loadChanges}
                className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* No changes state */}
          {!loading && !error && !changes && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No version history available for this document.</p>
            </div>
          )}

          {/* Changes content */}
          {!loading && !error && changes && (
            <div className="space-y-6">
              {/* Update info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatDate(changes.updatedAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {changes.updatedBy}
                </span>
              </div>

              {/* AI Summary */}
              {changes.aiSummary && (
                <div className="bg-accent/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">What Changed</h3>
                  <ul className="space-y-2">
                    {changes.aiSummary.bullets.map((bullet, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <Plus className="w-4 h-4" />
                  {changes.diff.stats.addedLines} added
                </span>
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <Minus className="w-4 h-4" />
                  {changes.diff.stats.removedLines} removed
                </span>
              </div>

              {/* Detailed changes toggle */}
              {changes.diff.lines.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide Detailed Changes
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show Detailed Changes
                      </>
                    )}
                  </button>

                  {/* Detailed diff */}
                  {showDetails && (
                    <div className="mt-4 bg-muted/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                      {changes.diff.lines.map((line, index) => (
                        <DiffLineComponent key={index} line={line} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg font-medium transition-colors text-sm border border-border hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function DiffLineComponent({ line }: { line: DiffLine }) {
  return (
    <div
      className={cn(
        'py-1 px-2 rounded whitespace-pre-wrap break-all',
        line.type === 'added' && 'bg-green-500/20 text-green-700 dark:text-green-300',
        line.type === 'removed' && 'bg-red-500/20 text-red-700 dark:text-red-300',
        line.type === 'unchanged' && 'text-muted-foreground'
      )}
    >
      <span className="select-none mr-2">
        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
      </span>
      {line.content}
    </div>
  )
}
