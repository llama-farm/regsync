import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  FileText,
  Eye,
  User,
  Calendar,
  AlertCircle,
  ExternalLink,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { documentsApi } from '@/api/documentsApi'
import type { DocumentVersion, PolicyDocument } from '@/types/document'

interface DocumentChangesModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
}

interface VersionWithNumber extends DocumentVersion {
  version_number: number
  is_current: boolean
}

export function DocumentChangesModal({
  isOpen,
  onClose,
  documentId,
  documentName
}: DocumentChangesModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [document, setDocument] = useState<PolicyDocument | null>(null)
  const [versions, setVersions] = useState<VersionWithNumber[]>([])
  const [viewingVersion, setViewingVersion] = useState<VersionWithNumber | null>(null)
  const [loadingChanges, setLoadingChanges] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && documentId) {
      loadVersions()
    }
  }, [isOpen, documentId])

  const loadVersions = async () => {
    setLoading(true)
    setError(null)

    try {
      const doc = await documentsApi.getDocument(documentId)
      setDocument(doc)

      // Sort by date ascending (oldest first) to assign version numbers correctly
      const sortedVersions = [...(doc.versions || [])].sort((a, b) => {
        const dateA = new Date(a.created_at || a.uploaded_at || 0).getTime()
        const dateB = new Date(b.created_at || b.uploaded_at || 0).getTime()
        return dateA - dateB
      })

      const totalVersions = sortedVersions.length

      // Map versions with version numbers
      const mappedVersions: VersionWithNumber[] = sortedVersions.map((v, idx) => ({
        ...v,
        uploaded_at: v.created_at || v.uploaded_at,
        file_size: v.size || v.file_size || 0,
        version_number: idx + 1,
        is_current: idx === totalVersions - 1,
      }))

      // Reverse so newest is first
      setVersions(mappedVersions.reverse())
    } catch (err) {
      console.error('Failed to load versions:', err)
      setError('Failed to load document versions. Make sure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  // Load changes on-demand for versions without pre-computed data
  const loadChangesForVersion = async (version: VersionWithNumber, previousVersionId: string) => {
    setLoadingChanges(prev => new Set(prev).add(version.id))

    try {
      const changes = await documentsApi.compareVersions(documentId, previousVersionId, version.id)

      // Update the version with the fetched data
      setVersions(prev => prev.map(v => {
        if (v.id === version.id) {
          return {
            ...v,
            summary: changes.summary,
            diff: {
              changes: changes.changes || [],
              stats: {
                added: changes.changes?.filter((c: { type: string }) => c.type === 'added').length || 0,
                removed: changes.changes?.filter((c: { type: string }) => c.type === 'removed').length || 0
              }
            }
          }
        }
        return v
      }))
    } catch (err) {
      console.error('Failed to load changes:', err)
      // Show notes as fallback if available
      const fallback = version.notes || 'Unable to load change details.'
      setVersions(prev => prev.map(v => {
        if (v.id === version.id) {
          return { ...v, summary: fallback }
        }
        return v
      }))
    } finally {
      setLoadingChanges(prev => {
        const next = new Set(prev)
        next.delete(version.id)
        return next
      })
    }
  }

  if (!isOpen) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return ''
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display text-lg">{documentName}</h2>
                <p className="text-sm text-muted-foreground">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </p>
              </div>
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
                <p className="text-sm text-muted-foreground">Loading version history...</p>
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
                  onClick={loadVersions}
                  className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* No versions state */}
            {!loading && !error && versions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No version history available.</p>
              </div>
            )}

            {/* Version timeline */}
            {!loading && !error && versions.length > 0 && (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border" />

                {/* Versions */}
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={cn(
                        'relative bg-background border rounded-lg p-4 ml-10 transition-all',
                        version.is_current
                          ? 'border-primary/50 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute -left-[34px] top-5 w-3 h-3 rounded-full border-2 bg-background',
                          version.is_current
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        )}
                      />

                      {/* Version header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            Version {version.version_number}
                          </span>
                          {version.is_current ? (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Current
                            </span>
                          ) : (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              Previous
                            </span>
                          )}
                        </div>
                        {version.file_size > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(version.file_size)}
                          </span>
                        )}
                      </div>

                      {/* Version notes */}
                      {version.notes && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {version.notes}
                        </p>
                      )}

                      {/* Pre-computed change summary */}
                      {version.summary && (
                        <div className="bg-accent/50 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
                            <Sparkles className="w-3 h-3" />
                            What Changed
                          </div>
                          <p className="text-sm text-foreground">
                            {version.summary}
                          </p>
                          {version.diff?.stats && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <Plus className="w-3 h-3" />
                                {version.diff.stats.added} additions
                              </span>
                              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                <Minus className="w-3 h-3" />
                                {version.diff.stats.removed} removals
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Load Changes button for versions without pre-computed data */}
                      {!version.summary && version.version_number > 1 && (() => {
                        // Find the previous version (versions array is newest first, so previous is at higher index)
                        const currentIndex = versions.findIndex(v => v.id === version.id)
                        const previousVersion = versions[currentIndex + 1]
                        if (!previousVersion) return null

                        const isLoading = loadingChanges.has(version.id)

                        return (
                          <button
                            onClick={() => loadChangesForVersion(version, previousVersion.id)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mb-3 disabled:opacity-50"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Loading changes...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                Load what changed
                              </>
                            )}
                          </button>
                        )
                      })()}

                      {/* Version details */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(version.uploaded_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          {version.uploaded_by}
                        </span>
                      </div>

                      {/* View button */}
                      <button
                        onClick={() => setViewingVersion(version)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </div>
                  ))}
                </div>
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

      {/* Document Viewer Modal */}
      {viewingVersion && documentId && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 z-[60] bg-background border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{document?.name || documentName}</h2>
                  <div className="text-xs text-muted-foreground">
                    Version {viewingVersion.version_number}
                    {viewingVersion.is_current && ' (Current)'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingVersion(null)}
                className="p-2 hover:bg-accent rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`/api/projects/default/regsync/documents/${documentId}/file?version_id=${viewingVersion.id}`}
                className="w-full h-full"
                title="Document Preview"
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Uploaded by {viewingVersion.uploaded_by} on {formatDate(viewingVersion.uploaded_at)}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/projects/default/regsync/documents/${documentId}/file?version_id=${viewingVersion.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in new tab
                </a>
                <button
                  onClick={() => setViewingVersion(null)}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
