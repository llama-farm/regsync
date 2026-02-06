import { FileText, Calendar, User, ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DigestDocument } from '@/types/digest'

interface DigestCardProps {
  document: DigestDocument
}

export function DigestCard({ document }: DigestCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get the most recent change
  const latestChange = document.changes[0]

  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-5 transition-all hover:border-primary/30 hover:shadow-md',
        document.is_new ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'p-2.5 rounded-lg flex-shrink-0',
              document.is_new ? 'bg-primary/10' : 'bg-accent'
            )}
          >
            <FileText
              className={cn(
                'w-5 h-5',
                document.is_new ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {document.short_title && (
                <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {document.short_title}
                </span>
              )}
              {document.is_new ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  New
                </span>
              ) : (
                <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                  Updated
                </span>
              )}
            </div>
            <h3 className="font-semibold text-foreground mt-1 line-clamp-2">
              {document.name}
            </h3>
          </div>
        </div>
      </div>

      {/* Change Summary */}
      {latestChange && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {latestChange.notes || latestChange.summary || 'Policy document updated'}
          </p>
        </div>
      )}

      {/* Multiple changes indicator */}
      {document.changes.length > 1 && (
        <div className="text-xs text-muted-foreground mb-3 pl-3 border-l-2 border-muted">
          +{document.changes.length - 1} more update{document.changes.length > 2 ? 's' : ''} this period
        </div>
      )}

      {/* Footer: Metadata + Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {latestChange && (
            <>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(latestChange.uploaded_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {latestChange.uploaded_by}
              </span>
            </>
          )}
        </div>

        <a
          href={`/api/projects/default/regsync/documents/${document.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View Document
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
