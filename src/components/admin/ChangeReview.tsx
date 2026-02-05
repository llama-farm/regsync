import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, X, ChevronDown, ChevronRight, FileText, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Change, ChangesSummary } from '@/types/document'
import { documentsApi } from '@/api/documentsApi'
import { useAuth } from '@/contexts/AuthContext'

interface ChangeItemProps {
  change: Change
  isExpanded: boolean
  onToggle: () => void
}

function ChangeItem({ change, isExpanded, onToggle }: ChangeItemProps) {
  const typeColors = {
    added: 'bg-green-500/10 text-green-500 border-green-500/20',
    modified: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    removed: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded border',
            typeColors[change.type]
          )}
        >
          {change.type.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{change.section}</p>
          <p className="text-sm text-muted-foreground truncate">
            {change.summary}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="grid grid-cols-2 gap-4">
            {change.before && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  BEFORE
                </p>
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded text-sm whitespace-pre-wrap">
                  {change.before}
                </div>
              </div>
            )}
            {change.after && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  AFTER
                </p>
                <div className="p-3 bg-green-500/5 border border-green-500/20 rounded text-sm whitespace-pre-wrap">
                  {change.after}
                </div>
              </div>
            )}
            {!change.before && change.after && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  NEW CONTENT
                </p>
                <div className="p-3 bg-green-500/5 border border-green-500/20 rounded text-sm whitespace-pre-wrap">
                  {change.after}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ChangeReview() {
  const { documentId, versionId } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set([0]))
  const [changes, setChanges] = useState<ChangesSummary | null>(null)
  const [documentName, setDocumentName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!documentId || !versionId) return

      try {
        setLoading(true)
        setError(null)

        // Get document info to find versions
        const doc = await documentsApi.getDocument(documentId)
        setDocumentName(doc.name)

        const versions = doc.versions || []

        // Find pending version (if any) - this is what we're reviewing
        const pendingVersion = versions.find((v: any) => v.status === 'pending')
        if (pendingVersion) {
          setPendingVersionId(pendingVersion.id)
        }

        if (versions.length < 2) {
          setError('Need at least 2 versions to compare')
          return
        }

        // Compare the old version (versionId param) with the newest version
        // The newest version is either pending or the current version
        const newestVersion = pendingVersion || versions[versions.length - 1]
        const comparison = await documentsApi.compareVersions(
          documentId,
          versionId,  // old version (current published)
          newestVersion.id  // new version (pending or latest)
        )

        setChanges(comparison)
      } catch (err) {
        console.error('Failed to load comparison:', err)
        setError('Failed to load comparison. Make sure the server is running.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [documentId, versionId])

  const toggleChange = (index: number) => {
    setExpandedChanges((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleApprove = async () => {
    if (!documentId || !pendingVersionId) {
      // No pending version - just go back
      navigate('/admin')
      return
    }

    try {
      setApproving(true)
      await documentsApi.approveVersion(documentId, pendingVersionId)
      toast.success('Version published!', {
        description: `${documentName} has been updated and is now available to users.`,
      })
      navigate('/admin')
    } catch (err) {
      console.error('Failed to approve:', err)
      const message = err instanceof Error ? err.message : 'Failed to approve version'
      setError(message)
      toast.error('Approval failed', {
        description: message,
      })
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!documentId || !pendingVersionId) {
      // No pending version - just go back
      navigate(`/history/${documentId}`)
      return
    }

    try {
      setRejecting(true)
      await documentsApi.rejectVersion(documentId, pendingVersionId)
      toast.info('Version rejected', {
        description: 'The pending version has been removed.',
      })
      navigate(`/history/${documentId}`)
    } catch (err) {
      console.error('Failed to reject:', err)
      const message = err instanceof Error ? err.message : 'Failed to reject version'
      setError(message)
      toast.error('Rejection failed', {
        description: message,
      })
      setRejecting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !changes) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(`/history/${documentId}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Version History
        </button>
        <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-4 py-3 rounded-md">
          <AlertCircle className="w-5 h-5" />
          <span>{error || 'No changes data available'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(`/history/${documentId}`)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Version History
      </button>

      {/* Pending version banner */}
      {pendingVersionId && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span><strong>Pending Review:</strong> This version has not been published yet. Review the changes below and approve or reject.</span>
        </div>
      )}


      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              {documentName || 'Document'}
            </span>
          </div>
          <h1 className="text-2xl font-semibold font-display">Review Changes</h1>
          <p className="text-muted-foreground">
            Comparing versions • {changes.total_changes} change{changes.total_changes !== 1 ? 's' : ''} detected
          </p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium mb-1">AI Summary</p>
        <p className="text-sm text-muted-foreground">{changes.summary}</p>
      </div>

      {/* Changes list */}
      {changes.changes.length > 0 ? (
        <div className="space-y-3 mb-6">
          {changes.changes.map((change, index) => (
            <ChangeItem
              key={index}
              change={change}
              isExpanded={expandedChanges.has(index)}
              onToggle={() => toggleChange(index)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-medium mb-1">No Content Changes Detected</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The document content appears to be identical. Any differences may be in formatting, metadata, or file structure only.
          </p>
        </div>
      )}

      {/* Action buttons - only shown to admins */}
      {isAdmin ? (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {approving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Approve & Publish
              </>
            )}
          </button>
          <button
            onClick={handleReject}
            disabled={approving || rejecting}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            {rejecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Reject Changes
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => navigate(`/history/${documentId}`)}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </button>
        </div>
      )}
    </div>
  )
}
