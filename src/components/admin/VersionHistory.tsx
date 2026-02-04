import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  FileText,
  Eye,
  RotateCcw,
  ChevronRight,
  User,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { documentsApi } from '@/api/documentsApi'
import type { DocumentVersion, PolicyDocument } from '@/types/document'

// Fallback mock data
const MOCK_DOCUMENT = {
  id: '1',
  name: 'Employee Handbook v2024',
  short_title: 'EMP-HB-2024',
}

const MOCK_VERSIONS: DocumentVersion[] = [
  {
    id: 'v3',
    document_id: '1',
    version_number: 3,
    uploaded_at: '2024-06-01T14:30:00Z',
    uploaded_by: 'Capt. Sarah Mitchell',
    notes: 'Updated remote work policy (reduced eligibility from 6 to 3 months), clarified dress code requirements',
    file_size: 2456789,
    file_hash: '',
    file_name: 'employee-handbook.pdf',
    mime_type: 'application/pdf',
    status: 'published',
  },
  {
    id: 'v2',
    document_id: '1',
    version_number: 2,
    uploaded_at: '2024-03-15T10:00:00Z',
    uploaded_by: 'Lt. Col. James Anderson',
    notes: 'Added section on mental health resources, updated PTO policy',
    file_size: 2234567,
    file_hash: '',
    file_name: 'employee-handbook.pdf',
    mime_type: 'application/pdf',
    status: 'published',
  },
  {
    id: 'v1',
    document_id: '1',
    version_number: 1,
    uploaded_at: '2024-01-15T10:00:00Z',
    uploaded_by: 'Capt. Sarah Mitchell',
    notes: 'Initial document upload',
    file_size: 2100000,
    file_hash: '',
    file_name: 'employee-handbook.pdf',
    mime_type: 'application/pdf',
    status: 'published',
  },
]

export function VersionHistory() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState<PolicyDocument | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!documentId) return

      try {
        setLoading(true)
        setError(null)

        // Load document details with versions
        const doc = await documentsApi.getDocument(documentId)
        setDocument(doc)
        setVersions(doc.versions || [])
        setUsingMockData(false)
      } catch (err) {
        console.error('Failed to load document:', err)
        // Fall back to mock data
        setDocument(MOCK_DOCUMENT as unknown as PolicyDocument)
        setVersions(MOCK_VERSIONS)
        setUsingMockData(true)
        setError('Using demo data - LlamaFarm server not connected')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [documentId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  const handleRevert = (versionId: string) => {
    // TODO: Implement revert functionality
    console.log('Revert to version:', versionId)
    alert(`This would create a new version based on ${versionId}. Feature coming soon.`)
  }

  const handleView = (versionId: string) => {
    // TODO: Open document viewer
    console.log('View version:', versionId)
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-admin-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Connection status */}
      {usingMockData && error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-start gap-4">
          <div className="p-3 bg-admin-primary/10 rounded-lg">
            <FileText className="w-6 h-6 text-admin-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold font-display">
              {document?.name || 'Document'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {document?.short_title && (
                <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {document.short_title}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {versions.length} version{versions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Version timeline */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Version History</span>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />

          {/* Versions */}
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  'relative bg-card border rounded-lg p-4 ml-12 transition-all',
                  index === 0
                    ? 'border-admin-primary/50 ring-1 ring-admin-primary/20'
                    : 'border-border hover:border-admin-primary/30'
                )}
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    'absolute -left-[42px] top-6 w-4 h-4 rounded-full border-2 bg-background',
                    index === 0
                      ? 'border-admin-primary bg-admin-primary'
                      : 'border-muted-foreground'
                  )}
                />

                {/* Version header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Version {version.version_number}
                      </span>
                      {index === 0 && (
                        <span className="text-xs bg-admin-primary/10 text-admin-primary px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          version.status === 'published'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-amber-500/10 text-amber-500'
                        )}
                      >
                        {version.status}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatFileSize(version.file_size)}
                  </span>
                </div>

                {/* Version details */}
                <p className="text-sm text-muted-foreground mb-3">
                  {version.notes}
                </p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(version.uploaded_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {version.uploaded_by}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(version.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                  {index !== 0 && (
                    <button
                      onClick={() => handleRevert(version.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-admin-primary bg-admin-primary/10 hover:bg-admin-primary/20 rounded-md transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Revert to this version
                    </button>
                  )}
                  {index !== 0 && (
                    <button
                      onClick={() =>
                        navigate(`/review/${documentId}/${version.id}`)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      Compare with current
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
