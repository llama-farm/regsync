import { X, FileText, ExternalLink, Calendar, User } from 'lucide-react'
import type { CitedSource } from '@/types/chat'
import { cn } from '@/lib/utils'

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

export function DocumentViewer({ source, onClose }: DocumentViewerProps) {
  const documentName = cleanFilename(source.filename || source.source)
  const confidencePercent = source.score ? Math.round(source.score * 100) : null

  // Build PDF URL from the source filename
  // The API serves files at /api/projects/default/regsync/documents/:docId/file
  // But since we only have the filename, we'll use the policies dataset path
  const pdfUrl = source.filename
    ? `/api/projects/default/regsync/policies/${source.filename}`
    : null

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
          {/* Left side - matching chunk content */}
          <div className="w-1/3 border-r border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-primary/5">
              <h3 className="text-sm font-medium">Matching Content</h3>
              <p className="text-xs text-muted-foreground">
                From LlamaFarm RAG retrieval
              </p>
            </div>
            <div className="flex-1 overflow-auto p-4">
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
          </div>

          {/* Right side - PDF viewer */}
          <div className="flex-1 flex flex-col bg-muted/30">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Document Preview</h3>
                <p className="text-xs text-muted-foreground">
                  {source.filename || 'Policy document'}
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
