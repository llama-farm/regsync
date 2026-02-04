import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, History, Upload, Eye, RefreshCw, Loader2, AlertCircle, FolderOpen } from 'lucide-react'
import type { PolicyDocument } from '@/types/document'
import { documentsApi } from '@/api/documentsApi'

interface PolicyCardProps {
  policy: PolicyDocument
  onView: () => void
  onUpdate: () => void
  onHistory: () => void
}

function PolicyCard({ policy, onView, onUpdate, onHistory }: PolicyCardProps) {
  const updatedDate = new Date(policy.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const isDatasetFile = policy.source === 'dataset'

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-admin-primary" />
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {policy.short_title || 'DOC'}
          </span>
          {isDatasetFile && (
            <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
              Designer
            </span>
          )}
        </div>
      </div>

      <h3 className="font-medium mb-2 line-clamp-2">{policy.name}</h3>

      <p className="text-sm text-muted-foreground mb-4">
        {policy.created_by ? `By ${policy.created_by} • ` : ''}
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
        {!isDatasetFile && (
          <>
            <button
              onClick={onUpdate}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-admin-primary/10 text-admin-primary hover:bg-admin-primary/20 rounded-md transition-colors"
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
          </>
        )}
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [policies, setPolicies] = useState<PolicyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPolicies = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await documentsApi.listDocuments()
      setPolicies(response.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPolicies()
  }, [])

  const versionedCount = policies.filter(p => p.source !== 'dataset').length
  const datasetCount = policies.filter(p => p.source === 'dataset').length

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-display">Policy Management</h1>
          <p className="text-muted-foreground">
            You are authorized to update the following policy documents
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPolicies}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 px-4 py-2 bg-admin-primary text-white rounded-md hover:bg-admin-primary/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload New
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-semibold">{policies.length}</div>
          <div className="text-sm text-muted-foreground">Total Files</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-semibold text-primary">{versionedCount}</div>
          <div className="text-sm text-muted-foreground">Versioned Docs</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xl font-semibold text-blue-400">{datasetCount}</div>
          <div className="text-sm text-muted-foreground">From Designer</div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={loadPolicies}
            className="ml-auto text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && policies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first policy document or add files in LlamaFarm Designer
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 px-4 py-2 bg-admin-primary text-white rounded-md hover:bg-admin-primary/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      )}

      {/* Policy grid */}
      {!loading && policies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onView={() => {
                // TODO: Open document viewer
                console.log('View', policy.id)
              }}
              onUpdate={() => navigate('/upload', { state: { documentId: policy.id } })}
              onHistory={() => navigate(`/history/${policy.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
