import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, History, Upload, Eye, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import type { PolicyDocument } from '@/types/document'
import { documentsApi } from '@/api/documentsApi'

// Fallback mock data - used when API is unavailable
const MOCK_POLICIES: PolicyDocument[] = [
  {
    id: '1',
    name: 'Employee Handbook v2024',
    short_title: 'EMP-HB-2024',
    current_version_id: 'v2',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-06-01T14:30:00Z',
  },
  {
    id: '2',
    name: 'IT Security Policy',
    short_title: 'IT-SEC-001',
    current_version_id: 'v3',
    created_at: '2023-08-20T09:00:00Z',
    updated_at: '2025-01-09T11:15:00Z',
  },
  {
    id: '3',
    name: 'Travel & Expense Guidelines',
    short_title: 'FIN-TRV-001',
    current_version_id: 'v1',
    created_at: '2024-03-10T08:00:00Z',
    updated_at: '2024-03-10T08:00:00Z',
  },
  {
    id: '4',
    name: 'Code of Conduct',
    short_title: 'HR-COC-001',
    current_version_id: 'v2',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-12-15T16:00:00Z',
  },
]

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

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-purple-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {policy.short_title || 'DOC'}
          </span>
        </div>
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
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-md transition-colors"
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

// Export mock policies for use in other components
export { MOCK_POLICIES }

export function AdminDashboard() {
  const navigate = useNavigate()
  const [policies, setPolicies] = useState<PolicyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await documentsApi.listDocuments()
        // Handle case where API returns unexpected format
        if (response?.documents && Array.isArray(response.documents)) {
          setPolicies(response.documents)
          setUsingMockData(false)
        } else {
          throw new Error('Invalid API response format')
        }
      } catch (err) {
        console.error('Failed to load documents:', err)
        // Fall back to mock data
        setPolicies(MOCK_POLICIES)
        setUsingMockData(true)
        setError('Using demo data - LlamaFarm server not connected')
      } finally {
        setLoading(false)
      }
    }
    loadDocuments()
  }, [])

  const handleDownload = async (policy: PolicyDocument) => {
    try {
      const blob = await documentsApi.downloadFile(policy.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${policy.short_title || policy.name}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Document download requires LlamaFarm server connection.')
    }
  }

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
        <button
          onClick={() => navigate('/upload')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {/* Connection status */}
      {usingMockData && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl font-semibold font-display">{policies.length}</div>
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
                onView={() => handleDownload(policy)}
                onUpdate={() => navigate('/upload', { state: { document: policy } })}
                onHistory={() => navigate(`/history/${policy.id}`)}
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
        </>
      )}
    </div>
  )
}
