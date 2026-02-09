import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight, Eye, Hash, Calendar, User } from 'lucide-react'
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

interface SourcesDisplayProps {
  sources: CitedSource[]
  onViewDocument: (source: CitedSource) => void
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

// Group sources by document filename
function groupByDocument(sources: CitedSource[]): Map<string, CitedSource[]> {
  const grouped = new Map<string, CitedSource[]>()

  for (const source of sources) {
    const key = source.filename || source.source || 'Unknown'
    const existing = grouped.get(key) || []
    existing.push(source)
    grouped.set(key, existing)
  }

  return grouped
}

export function SourcesDisplay({ sources, onViewDocument }: SourcesDisplayProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

  // Filter out outdated sources - users can view old versions in the document viewer
  const currentSources = sources.filter(s => s.is_current !== false)

  const groupedSources = groupByDocument(currentSources)
  // Sort documents: Current first, then Outdated, then unknown
  const documents = Array.from(groupedSources.entries()).sort((a, b) => {
    const aIsCurrent = a[1][0]?.is_current
    const bIsCurrent = b[1][0]?.is_current
    if (aIsCurrent === true && bIsCurrent !== true) return -1
    if (bIsCurrent === true && aIsCurrent !== true) return 1
    return 0
  })

  const toggleDoc = (filename: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }

  // Calculate average confidence for a document
  const getDocConfidence = (chunks: CitedSource[]): number => {
    const scores = chunks.map(c => c.score || 0)
    return Math.round((Math.max(...scores)) * 100)
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Source Documents ({documents.length})
      </p>

      <div className="space-y-2">
        {documents.map(([filename, chunks]) => {
          const isExpanded = expandedDocs.has(filename)
          const docName = cleanFilename(filename)
          const confidence = getDocConfidence(chunks)
          const confidenceColor = confidence >= 70
            ? 'text-green-500 bg-green-500/10'
            : confidence >= 50
              ? 'text-amber-500 bg-amber-500/10'
              : 'text-muted-foreground bg-muted'

          return (
            <div key={filename} className="border border-border rounded-lg overflow-hidden">
              {/* Document header - always visible */}
              <div className="bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-sm truncate block">{docName}</span>
                      {(chunks[0].updated_at || chunks[0].updated_by) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {formatDate(chunks[0].updated_at) && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(chunks[0].updated_at)}
                            </span>
                          )}
                          {chunks[0].updated_by && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {chunks[0].updated_by}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Version status badge */}
                    {chunks[0].is_current === true ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600">
                        Current
                      </span>
                    ) : chunks[0].is_current === false ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                        Outdated
                      </span>
                    ) : null}

                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded",
                      confidenceColor
                    )}>
                      {confidence}% match
                    </span>

                    <button
                      onClick={() => onViewDocument(chunks[0])}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </div>
                </div>

                {/* Chunk count and expand toggle */}
                <button
                  onClick={() => toggleDoc(filename)}
                  className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span>{chunks.length} relevant section{chunks.length !== 1 ? 's' : ''} found</span>
                </button>
              </div>

              {/* Expandable chunks */}
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {chunks.map((chunk, idx) => (
                    <div key={idx} className="p-3 bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        {chunk.page_number && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Hash className="w-3 h-3" />
                            Page {chunk.page_number}
                          </span>
                        )}
                        {chunk.score && (
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded ml-auto",
                            (chunk.score * 100) >= 70 ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                          )}>
                            {Math.round(chunk.score * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
