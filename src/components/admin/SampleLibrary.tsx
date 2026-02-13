import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Plus, Check, FileText, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { documentsApi, type SampleDocument } from '@/api/documentsApi'

interface SampleLibraryProps {
  onSampleAdded: () => void
  canUpload: boolean
}

export function SampleLibrary({ onSampleAdded, canUpload }: SampleLibraryProps) {
  const [expanded, setExpanded] = useState(false)
  const [samples, setSamples] = useState<SampleDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (expanded && samples.length === 0) {
      loadSamples()
    }
  }, [expanded])

  const loadSamples = async () => {
    setLoading(true)
    try {
      const result = await documentsApi.listSamples()
      setSamples(result.samples)
    } catch (err) {
      console.error('Failed to load samples:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (sample: SampleDocument) => {
    setAddingId(sample.id)
    try {
      const result = await documentsApi.addSample(sample.id)
      toast.success(
        result.type === 'new_document' ? 'Document added' : 'Version added',
        {
          description: result.type === 'version_update'
            ? `New version pending approval for ${sample.target_document_name}`
            : `${sample.title} added to library`,
        }
      )
      // Update the sample's already_added status
      setSamples(prev =>
        prev.map(s => s.id === sample.id ? { ...s, already_added: true } : s)
      )
      onSampleAdded()
    } catch (err) {
      console.error('Failed to add sample:', err)
      toast.error('Failed to add sample', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setAddingId(null)
    }
  }

  const availableCount = samples.filter(s => !s.already_added).length

  if (samples.length === 0 && !expanded) {
    return (
      <div className="mt-6">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          <span>Try It Out - Sample Documents</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>Try It Out - Sample Documents</span>
        {availableCount > 0 && (
          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            {availableCount} available
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : samples.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No sample documents available yet.</p>
          ) : (
            samples.map(sample => (
              <div
                key={sample.id}
                className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
              >
                <div className="flex-shrink-0">
                  {sample.type === 'new_document' ? (
                    <FileText className="w-4 h-4 text-blue-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{sample.title}</span>
                    {sample.short_title && (
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {sample.short_title}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      sample.type === 'new_document'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {sample.type === 'new_document' ? 'New Policy' : 'Version Update'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{sample.description}</p>
                </div>

                <div className="flex-shrink-0">
                  {sample.already_added ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Check className="w-3.5 h-3.5" />
                      Added
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAdd(sample)}
                      disabled={addingId === sample.id || !canUpload}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingId === sample.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Add
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
