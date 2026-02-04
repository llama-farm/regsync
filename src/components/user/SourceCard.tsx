import { FileText, ExternalLink, Clock, User } from 'lucide-react'
import type { CitedSource } from '@/types/chat'

interface SourceCardProps {
  source: CitedSource
  onClick?: () => void
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

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-muted/50 hover:bg-muted border border-border rounded-lg p-3 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Section */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {source.section || 'Document Section'}
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>

          {/* Content excerpt */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {source.content}
          </p>

          {/* Metadata */}
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
            {source.score && (
              <span className="ml-auto text-primary/70">
                {Math.round(source.score * 100)}% match
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
