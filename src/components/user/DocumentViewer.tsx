import { useState, useEffect } from 'react'
import { X, FileText, ExternalLink, Calendar, User, History, ChevronRight, Loader2 } from 'lucide-react'
import type { CitedSource } from '@/types/chat'
import type { VersionMetadata } from '@/types/document'
import { cn } from '@/lib/utils'
import { documentsApi } from '@/api/documentsApi'

// Format date for display
function formatDate(dateString?: string): string | null {
  if (!dateString) return null
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

interface DocumentViewerProps {
  source: CitedSource
  onClose: () => void
}

// Clean up the filename to be more readable
function cleanFilename(filename?: string): string {
  if (!filename) return 'Policy Document'
  // Remove timestamp prefix (e.g., 1770253670113-)
  let cleaned = filename.replace(/^\d{13}-/, '')
  // Remove .pdf extension
  cleaned = cleaned.replace(/\.pdf$/i, '')
  // Replace hyphens and underscores with spaces
  cleaned = cleaned.replace(/[-_]/g, ' ')
  return cleaned
}

type LeftPanelTab = 'content' | 'history'

export function DocumentViewer({ source, onClose }: DocumentViewerProps) {
  const documentName = cleanFilename(source.filename || source.source)
  const confidencePercent = source.score ? Math.round(source.score * 100) : null

  const [leftTab, setLeftTab] = useState<LeftPanelTab>('content')
  const [versions, setVersions] = useState<VersionMetadata[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)

  // Build PDF URL using document API
  const currentVersionId = selectedVersionId || source.version_id
  const pdfUrl = source.document_id
    ? `/api/projects/default/regsync/documents/${source.document_id}/file${currentVersionId ? `?version_id=${currentVersionId}` : ''}`
    : null
  const currentFilename = source.filename

  // Load versions when history tab is selected
  useEffect(() => {
    if (leftTab === 'history' && source.document_id && versions.length === 0) {
      loadVersions()
    }
  }, [leftTab, source.document_id])

  const loadVersions = async () => {
    if (!source.document_id) return

    setLoadingVersions(true)
    try {
      const response = await documentsApi.listVersions(source.document_id)
      // Sort by created_at ascending so oldest is first
      const sortedVersions = [...response.versions].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      )
      // Add version numbers
      const numberedVersions = sortedVersions.map((v, idx) => ({
        ...v,
        version_number: idx + 1
      }))
      // Reverse for display (newest first)
      setVersions(numberedVersions.reverse())
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleVersionClick = (version: VersionMetadata) => {
    setSelectedVersionId(version.id)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 z-50 bg-background border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{documentName}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {source.section && (
                  <span>{source.section}</span>
                )}
                {source.page_number && (
                  <span>• Page {source.page_number}</span>
                )}
                {confidencePercent !== null && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded",
                    confidencePercent >= 70 ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                  )}>
                    {confidencePercent}% match
                  </span>
                )}
              </div>
              {(source.updated_at || source.updated_by) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {formatDate(source.updated_at) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(source.updated_at)}
                    </span>
                  )}
                  {source.updated_by && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {source.updated_by}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side - tab content */}
          <div className="w-1/3 border-r border-border flex flex-col">
            {/* Tab switcher */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setLeftTab('content')}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                  leftTab === 'content'
                    ? "bg-primary/5 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                Matching Content
              </button>
              {source.document_id && (
                <button
                  onClick={() => setLeftTab('history')}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                    leftTab === 'history'
                      ? "bg-primary/5 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <History className="w-3.5 h-3.5" />
                  Versions
                </button>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {leftTab === 'content' ? (
                <div className="p-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {source.content}
                    </p>
                  </div>

                  {/* Chunk metadata */}
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    {source.chunk_id && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Chunk ID:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                          {source.chunk_id}
                        </code>
                      </div>
                    )}
                    {source.page_number && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Page:</span>
                        <span>{source.page_number}</span>
                      </div>
                    )}
                    {confidencePercent !== null && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Relevance Score:</span>
                        <span>{confidencePercent}%</span>
                      </div>
                    )}
                    {formatDate(source.updated_at) && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Updated:</span>
                        <span>{formatDate(source.updated_at)}</span>
                      </div>
                    )}
                    {source.updated_by && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Updated By:</span>
                        <span>{source.updated_by}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  {loadingVersions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No version history available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-3">
                        Click a version to preview it
                      </p>
                      {versions.map((version) => {
                        const isSelected = selectedVersionId === version.id
                        const isCurrent = source.version_id === version.id && !selectedVersionId

                        return (
                          <button
                            key={version.id}
                            onClick={() => handleVersionClick(version)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors",
                              isSelected || isCurrent
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-accent/50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  Version {version.version_number}
                                </span>
                                {isCurrent && !selectedVersionId && (
                                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                    Current
                                  </span>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDate(version.created_at)} • {version.uploaded_by}
                            </div>
                            {version.notes && (
                              <p className="mt-1 text-xs text-muted-foreground truncate">
                                {version.notes}
                              </p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right side - PDF viewer */}
          <div className="flex-1 flex flex-col bg-muted/30">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Document Preview</h3>
                <p className="text-xs text-muted-foreground">
                  {currentFilename || 'Policy document'}
                  {selectedVersionId && selectedVersionId !== source.version_id && (
                    <span className="ml-2 text-amber-500">(older version)</span>
                  )}
                </p>
              </div>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in new tab
                </a>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#page=${source.page_number || 1}`}
                  className="w-full h-full"
                  title="Document Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Document preview not available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            The highlighted content was retrieved using LlamaFarm RAG semantic search.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
