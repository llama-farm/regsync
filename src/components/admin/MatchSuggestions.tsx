import { FileText, ArrowRight, Plus, Zap, Hash, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentMatch, MatchDetectionResult } from '@/types/match'
import { getConfidenceColor } from '@/types/match'

interface MatchSuggestionsProps {
  result: MatchDetectionResult
  uploadedFileName: string
  onSelectMatch: (match: DocumentMatch) => void
  onCreateNew: () => void
  onCancel: () => void
}

export function MatchSuggestions({
  result,
  uploadedFileName,
  onSelectMatch,
  onCreateNew,
  onCancel
}: MatchSuggestionsProps) {
  const { matches, extracted_title, extracted_doc_number } = result

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold font-display flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Potential Matches Found
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          We found {matches.length} existing document{matches.length !== 1 ? 's' : ''} that might be related to your upload.
        </p>
      </div>

      {/* Uploaded file info */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm font-medium mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Analyzing: {uploadedFileName}
        </p>
        {(extracted_title || extracted_doc_number) && (
          <div className="text-sm text-muted-foreground space-y-1">
            {extracted_doc_number && (
              <p>
                Document #: <span className="font-mono text-foreground">{extracted_doc_number}</span>
              </p>
            )}
            {extracted_title && (
              <p className="truncate">
                Detected title: <span className="text-foreground">{extracted_title}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Match cards */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Is this an update to one of these documents?</p>
        {matches.map((match) => (
          <MatchCard
            key={match.document.id}
            match={match}
            onSelect={() => onSelectMatch(match)}
            formatDate={formatDate}
          />
        ))}
      </div>

      {/* Create new option */}
      <div className="border-t border-border pt-4">
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Create as New Document</p>
              <p className="text-sm text-muted-foreground">
                This is not an update to any existing document
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel Upload
      </button>
    </div>
  )
}

interface MatchCardProps {
  match: DocumentMatch
  onSelect: () => void
  formatDate: (date: string) => string
}

function MatchCard({ match, onSelect, formatDate }: MatchCardProps) {
  const confidenceColors = getConfidenceColor(match.confidence)

  // Get signal icons
  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'supersedes': return '📋'
      case 'document_number': return '🔢'
      case 'filename': return '📁'
      case 'title': return '📝'
      default: return '✓'
    }
  }

  const getSignalLabel = (type: string) => {
    switch (type) {
      case 'supersedes': return 'Supersedes'
      case 'document_number': return 'Doc #'
      case 'filename': return 'Filename'
      case 'title': return 'Title'
      default: return type
    }
  }

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 bg-card border border-border rounded-lg hover:border-primary transition-colors group"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-accent rounded-lg">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-medium truncate">{match.document.name}</h4>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', confidenceColors)}>
              {match.confidence}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            {match.document.short_title && (
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                <span className="font-mono">{match.document.short_title}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Updated {formatDate(match.document.updated_at)}
            </span>
          </div>

          {/* Match signals */}
          <div className="flex flex-wrap gap-1">
            {match.signals.map((signal, i) => (
              <span
                key={i}
                className="text-xs bg-muted px-2 py-0.5 rounded flex items-center gap-1"
                title={signal.detail || ''}
              >
                {getSignalIcon(signal.type)} {getSignalLabel(signal.type)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">Update this</span>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  )
}
