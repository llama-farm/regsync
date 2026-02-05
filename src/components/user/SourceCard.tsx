import { FileText, ExternalLink, Clock, User, Hash, ChevronRight } from 'lucide-react'
import type { CitedSource } from '@/types/chat'
import { cn } from '@/lib/utils'

interface SourceCardProps {
  source: CitedSource
  onClick?: () => void
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

export function SourceCard({ source, onClick }: SourceCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formattedDate = formatDate(source.updated_at)
  const documentName = cleanFilename(source.filename || source.source)
  const confidencePercent = source.score ? Math.round(source.score * 100) : null
  const confidenceColor = confidencePercent && confidencePercent >= 70
    ? 'text-green-500 bg-green-500/10'
    : confidencePercent && confidencePercent >= 50
      ? 'text-amber-500 bg-amber-500/10'
      : 'text-muted-foreground bg-muted'

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left bg-muted/50 hover:bg-muted border border-border rounded-lg p-4 transition-all group",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-sm"
      )}
    >
      {/* Document name header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-medium text-sm truncate">{documentName}</span>
          {onClick && (
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          )}
        </div>
        {/* Confidence score */}
        {confidencePercent !== null && (
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded flex-shrink-0",
            confidenceColor
          )}>
            {confidencePercent}% match
          </span>
        )}
      </div>

      {/* Section/page indicator */}
      {source.section && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <Hash className="w-3 h-3" />
          <span className="font-mono">{source.section}</span>
          {source.page_number && (
            <span className="ml-2">• Page {source.page_number}</span>
          )}
        </div>
      )}

      {/* Content excerpt */}
      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
        {source.content}
      </p>

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {formattedDate && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formattedDate}
          </span>
        )}
        {source.updated_by && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {source.updated_by}
          </span>
        )}
        {onClick && (
          <span className="ml-auto flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-3 h-3" />
            View document
          </span>
        )}
      </div>
    </button>
  )
}
