import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, FileText, RefreshCw, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { documentsApi, type SampleDocument } from '@/api/documentsApi'
import type { PolicyDocument } from '@/types/document'

interface SampleLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  documents: PolicyDocument[]
  canUpload: boolean
}

export function SampleLibraryModal({ isOpen, onClose, documents, canUpload }: SampleLibraryModalProps) {
  const navigate = useNavigate()
  const [samples, setSamples] = useState<SampleDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadSamples()
    }
  }, [isOpen])

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

  const handleSelect = async (sample: SampleDocument) => {
    setLoadingId(sample.id)
    try {
      // Fetch the sample PDF as a blob
      const blob = await documentsApi.getSampleFile(sample.id)
      const file = new File([blob], sample.filename, { type: 'application/pdf' })

      onClose()

      if (sample.type === 'version_update' && sample.target_document_name) {
        // Find the target document to pass as existing document
        const targetDoc = documents.find(d => d.name === sample.target_document_name)
        if (targetDoc) {
          navigate('/upload', { state: { document: targetDoc, droppedFile: file } })
        } else {
          toast.error('Target document not found', {
            description: `Could not find "${sample.target_document_name}" in your documents.`,
          })
        }
      } else {
        // New document - navigate to upload with file and suggested name
        navigate('/upload', { state: { droppedFile: file, suggestedName: sample.title, suggestedShortTitle: sample.short_title } })
      }
    } catch (err) {
      console.error('Failed to load sample file:', err)
      toast.error('Failed to load sample', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setLoadingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold font-display">Sample Documents</h2>
            <p className="text-sm text-muted-foreground">Select a document to try the upload workflow</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : samples.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sample documents available.</p>
          ) : (
            samples.map(sample => (
              <button
                key={sample.id}
                onClick={() => handleSelect(sample)}
                disabled={loadingId === sample.id || !canUpload}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex-shrink-0">
                  {sample.type === 'new_document' ? (
                    <FileText className="w-5 h-5 text-blue-400" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-amber-400" />
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{sample.description}</p>
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${
                    sample.type === 'new_document'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {sample.type === 'new_document' ? 'New Policy' : `Update to ${sample.target_document_name}`}
                  </span>
                </div>

                <div className="flex-shrink-0">
                  {loadingId === sample.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {!canUpload && (
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground text-center">
            Upload limit reached. Reset the demo to try again.
          </div>
        )}
      </div>
    </div>
  )
}
