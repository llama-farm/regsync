import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  FileText,
  Eye,
  RotateCcw,
  User,
  Calendar,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { documentsApi } from '@/api/documentsApi'
import { useAuth } from '@/contexts/AuthContext'
import type { DocumentVersion, PolicyDocument } from '@/types/document'

export function VersionHistory() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [document, setDocument] = useState<PolicyDocument | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingVersion, setViewingVersion] = useState<DocumentVersion | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!documentId) return

      try {
        setLoading(true)
        setError(null)

        // Load document details with versions
        const doc = await documentsApi.getDocument(documentId)
        setDocument(doc)
        // Map API fields to component expected fields
        // Sort by created_at ascending so version 1 is oldest
        const sortedVersions = [...(doc.versions || [])].sort(
          (a: any, b: any) => new Date(a.created_at || a.uploaded_at).getTime() - new Date(b.created_at || b.uploaded_at).getTime()
        )
        const mappedVersions = sortedVersions.map((v: any, idx: number) => ({
          ...v,
          uploaded_at: v.created_at || v.uploaded_at,
          file_size: v.size || v.file_size || 0,
          version_number: idx + 1, // Version 1 = oldest, Version N = newest
          status: v.status || 'published',
          is_current: v.id === doc.current_version_id,
        }))
        // Reverse so newest is shown first
        setVersions(mappedVersions.reverse())
      } catch (err) {
        console.error('Failed to load document:', err)
        setError('Failed to load document. Make sure the server is running.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [documentId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  const handleRevert = (versionId: string) => {
    // TODO: Implement revert functionality
    console.log('Revert to version:', versionId)
    alert(`This would create a new version based on ${versionId}. Feature coming soon.`)
  }

  const handleView = (version: DocumentVersion) => {
    setViewingVersion(version)
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold font-display">
              {document?.name || 'Document'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {document?.short_title && (
                <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {document.short_title}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {versions.length} version{versions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Version timeline */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Version History</span>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />

          {/* Versions */}
          <div className="space-y-4">
            {versions.map((version) => {
              const isCurrent = (version as any).is_current
              return (
              <div
                key={version.id}
                className={cn(
                  'relative bg-card border rounded-lg p-4 ml-12 transition-all',
                  isCurrent
                    ? 'border-primary/50 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                )}
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    'absolute -left-[42px] top-6 w-4 h-4 rounded-full border-2 bg-background',
                    isCurrent
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  )}
                />

                {/* Version header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Version {version.version_number}
                      </span>
                      {(version as any).is_current && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      {version.status === 'pending' && (
                        <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded">
                          Pending Review
                        </span>
                      )}
                      {version.status === 'published' && !(version as any).is_current && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          Published
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatFileSize(version.file_size)}
                  </span>
                </div>

                {/* Version details */}
                <p className="text-sm text-muted-foreground mb-3">
                  {version.notes}
                </p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(version.uploaded_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {version.uploaded_by}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(version)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                  {!isCurrent && isAdmin && version.status !== 'pending' && (
                    <button
                      onClick={() => handleRevert(version.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Revert to this version
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {viewingVersion && documentId && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 z-50 bg-background border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{document?.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Version {viewingVersion.version_number}</span>
                    {viewingVersion.status === 'pending' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                        Pending Review
                      </span>
                    )}
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
    </div>
  )
}
