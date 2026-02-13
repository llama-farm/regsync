import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, History, Upload, Eye, RefreshCw, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PolicyDocument } from '@/types/document'
import { documentsApi, type DemoLimits } from '@/api/documentsApi'
import { FullPageDropZone } from '@/components/ui/FullPageDropZone'
import { DemoBanner } from './DemoBanner'
import { SampleLibrary } from './SampleLibrary'
import { DemoToolbar } from './DemoToolbar'

interface PolicyCardProps {
  policy: PolicyDocument
  onView: () => void
  onUpdate: () => void
  onHistory: () => void
  onDelete: () => void
}

function PolicyCard({ policy, onView, onUpdate, onHistory, onDelete }: PolicyCardProps) {
  const updatedDate = new Date(policy.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {policy.short_title || 'DOC'}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
          title="Delete document"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <h3 className="font-medium mb-2 line-clamp-2 font-display">{policy.name}</h3>

      <p className="text-sm text-muted-foreground mb-4">
        Updated {updatedDate}
      </p>

      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 rounded-md transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={onUpdate}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Update
        </button>
        <button
          onClick={onHistory}
          className="flex items-center justify-center px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
          title="Version history"
        >
          <History className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [policies, setPolicies] = useState<PolicyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limits, setLimits] = useState<DemoLimits | null>(null)

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const [response, limitsResponse] = await Promise.all([
        documentsApi.listDocuments(),
        documentsApi.getLimits().catch(() => null),
      ])
      // Handle case where API returns unexpected format
      if (response?.documents && Array.isArray(response.documents)) {
        // Sort by most recently updated first
        const sorted = [...response.documents].sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        setPolicies(sorted)
      } else {
        throw new Error('Invalid API response format')
      }
      if (limitsResponse) setLimits(limitsResponse)
    } catch (err) {
      console.error('Failed to load documents:', err)
      setError('Failed to load documents. Make sure the server is running.')
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const handleView = (policy: PolicyDocument) => {
    // Open PDF in new browser tab
    const fileUrl = `/api/projects/default/regsync/documents/${policy.id}/file`
    window.open(fileUrl, '_blank')
  }

  const handleDelete = async (policy: PolicyDocument) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${policy.name}"?\n\nThis will permanently remove the document and all its versions.`
    )
    if (!confirmed) return

    try {
      await documentsApi.deleteDocument(policy.id)
      setPolicies(policies.filter(p => p.id !== policy.id))
      toast.success('Document deleted', {
        description: `${policy.name} has been removed.`,
      })
    } catch (err) {
      console.error('Failed to delete document:', err)
      toast.error('Failed to delete document', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    }
  }

  const handleFileDrop = (file: File) => {
    // Navigate to upload page with the dropped file
    navigate('/upload', { state: { droppedFile: file } })
  }

  return (
    <FullPageDropZone onFileDrop={handleFileDrop}>
    <div className="max-w-6xl mx-auto">
      <DemoBanner />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-display">Policy Management</h1>
          <p className="text-muted-foreground">
            You are authorized to update the following policy documents
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          disabled={limits ? !limits.can_upload : false}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={limits && !limits.can_upload ? 'Upload limit reached' : undefined}
        >
          <Upload className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {/* Error status */}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-semibold font-display">
                {limits ? `${limits.documents.current} / ${limits.documents.max}` : policies.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Policies</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-semibold text-green-500 font-display">{policies.length}</div>
              <div className="text-sm text-muted-foreground">Up to Date</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-semibold text-amber-500 font-display">0</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </div>
          </div>

          {/* Policy grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onView={() => handleView(policy)}
                onUpdate={() => navigate('/upload', { state: { document: policy } })}
                onHistory={() => navigate(`/history/${policy.id}`)}
                onDelete={() => handleDelete(policy)}
              />
            ))}
          </div>

          {policies.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No policy documents yet.</p>
              <p className="text-sm mt-1">Upload your first document to get started.</p>
            </div>
          )}

          <SampleLibrary
            onSampleAdded={loadDocuments}
            canUpload={limits ? limits.can_upload : true}
          />

          <DemoToolbar onResetComplete={loadDocuments} />
        </>
      )}
    </div>
    </FullPageDropZone>
  )
}
