import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Plus, Minus, ChevronDown, ChevronUp, Check, X, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compareDocumentVersions, LlamaFarmConnectionError } from '@/services/diffService'
import type { DocumentChanges, DiffLine } from '@/types/diff'

interface UploadDiffPreviewProps {
  documentId: string
  documentName: string
  oldVersionId: string
  newVersionId: string
  onConfirm: () => void
  onCancel: () => void
}

export function UploadDiffPreview({
  documentId,
  documentName,
  oldVersionId,
  newVersionId,
  onConfirm,
  onCancel
}: UploadDiffPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changes, setChanges] = useState<DocumentChanges | null>(null)
  const [showDetails, setShowDetails] = useState(true)

  // URL to preview the new version PDF
  const previewUrl = `/api/projects/default/regsync/documents/${documentId}/file?version_id=${newVersionId}`

  useEffect(() => {
    loadDiff()
  }, [documentId, oldVersionId, newVersionId])

  const loadDiff = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await compareDocumentVersions(documentId, oldVersionId, newVersionId)
      setChanges(result)
    } catch (err) {
      if (err instanceof LlamaFarmConnectionError) {
        setError('LlamaFarm is not running. Please start LlamaFarm to preview document changes.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load document comparison')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold font-display">Review Changes</h2>
        <p className="text-muted-foreground text-sm">
          Compare the new version with the current version of {documentName}
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 bg-card border border-border rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Analyzing document changes...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 bg-card border border-border rounded-lg">
          <div className="p-3 bg-destructive/10 rounded-full mb-3">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-sm text-destructive text-center mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={loadDiff}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}

      {/* Main content: diff + PDF preview side by side */}
      {!loading && !error && changes && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left side: Changes */}
            <div className="space-y-4">
              {/* AI Summary */}
              {changes.aiSummary && (
                <div className="bg-accent/50 border border-border rounded-lg p-5">
                  <h3 className="text-sm font-medium mb-3">What Changed</h3>
                  <ul className="space-y-2">
                    {changes.aiSummary.bullets.map((bullet, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">{changes.diff.stats.addedLines}</span> lines added
                </span>
                <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Minus className="w-4 h-4" />
                  <span className="font-medium">{changes.diff.stats.removedLines}</span> lines removed
                </span>
              </div>

              {/* Detailed diff */}
              {changes.diff.lines.length > 0 && (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-sm font-medium">Detailed Changes</span>
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {showDetails && (
                    <div className="border-t border-border p-4 max-h-[400px] overflow-y-auto">
                      <div className="font-mono text-xs space-y-1">
                        {changes.diff.lines.map((line, index) => (
                          <DiffLineComponent key={index} line={line} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right side: PDF preview */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">New Version Preview</span>
              </div>
              <div className="h-[500px] lg:h-[calc(100%-48px)] min-h-[400px]">
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title="Document Preview"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Check className="w-4 h-4" />
              Confirm & Publish
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </>
      )}
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
      <span className="select-none mr-2 opacity-60">
        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
      </span>
      {line.content}
    </div>
  )
}
