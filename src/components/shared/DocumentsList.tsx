import { useState, useEffect } from 'react'
import { Search, FileText, Loader2, Calendar, User, ExternalLink } from 'lucide-react'
import type { PolicyDocument } from '@/types/document'
import { documentsApi } from '@/api/documentsApi'

// Build document file URL for direct access
const getDocumentUrl = (documentId: string): string => {
  return `/api/projects/default/regsync/documents/${documentId}/file`
}

// Check if this is a real document (not mock)
const isRealDocument = (docId: string): boolean => {
  return !docId.startsWith('mock-')
}

// Mock data for additional documents (beyond what's in the database)
const MOCK_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'mock-1',
    name: 'Employee Handbook v2024',
    short_title: 'EMP-HB-2024',
    current_version_id: 'v2',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-06-01T14:30:00Z',
    created_by: 'Capt. Sarah Mitchell',
  },
  {
    id: 'mock-2',
    name: 'IT Security Policy',
    short_title: 'IT-SEC-001',
    current_version_id: 'v3',
    created_at: '2023-08-20T09:00:00Z',
    updated_at: '2025-01-09T11:15:00Z',
    created_by: 'Maj. Robert Chen',
  },
  {
    id: 'mock-3',
    name: 'Travel & Expense Guidelines',
    short_title: 'FIN-TRV-001',
    current_version_id: 'v1',
    created_at: '2024-03-10T08:00:00Z',
    updated_at: '2024-03-10T08:00:00Z',
    created_by: 'Lt. Jennifer Walsh',
  },
  {
    id: 'mock-4',
    name: 'Code of Conduct',
    short_title: 'HR-COC-001',
    current_version_id: 'v2',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-12-15T16:00:00Z',
    created_by: 'Lt. Col. James Anderson',
  },
  {
    id: 'mock-5',
    name: 'Data Privacy Procedures',
    short_title: 'IT-DPP-001',
    current_version_id: 'v1',
    created_at: '2024-05-15T09:00:00Z',
    updated_at: '2024-05-15T09:00:00Z',
    created_by: 'Maj. Robert Chen',
  },
  {
    id: 'mock-6',
    name: 'Emergency Response Protocol',
    short_title: 'OPS-ERP-001',
    current_version_id: 'v3',
    created_at: '2022-06-01T08:00:00Z',
    updated_at: '2024-11-20T14:00:00Z',
    created_by: 'Col. Michael Davis',
  },
]

export function DocumentsList() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true)
      try {
        const response = await documentsApi.listDocuments()
        // Combine real documents with mock data
        const allDocs = [...response.documents, ...MOCK_DOCUMENTS]
        // Remove duplicates by id
        const uniqueDocs = allDocs.filter(
          (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
        )
        setDocuments(uniqueDocs)
      } catch {
        // Fall back to mock data on error
        setDocuments(MOCK_DOCUMENTS)
      } finally {
        setLoading(false)
      }
    }
    loadDocuments()
  }, [])

  const filteredDocuments = documents.filter((doc) => {
    const query = searchQuery.toLowerCase()
    return (
      doc.name.toLowerCase().includes(query) ||
      doc.short_title?.toLowerCase().includes(query) ||
      doc.created_by?.toLowerCase().includes(query)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold font-display">Documents</h1>
        <p className="text-muted-foreground">
          Browse and search all policy documents
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, code, or author..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-body"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Documents list */}
      {!loading && (
        <div className="space-y-2">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No documents found matching "{searchQuery}"
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const isReal = isRealDocument(doc.id)
              const CardWrapper = isReal ? 'a' : 'div'
              const cardProps = isReal
                ? {
                    href: getDocumentUrl(doc.id),
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : {}

              return (
                <CardWrapper
                  key={doc.id}
                  {...cardProps}
                  className={`bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors block ${
                    isReal ? 'cursor-pointer group' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{doc.name}</h3>
                        {doc.short_title && (
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                            {doc.short_title}
                          </span>
                        )}
                        {isReal && (
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Updated {formatDate(doc.updated_at)}
                        </span>
                        {doc.created_by && (
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {doc.created_by}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardWrapper>
              )
            })
          )}
        </div>
      )}

      {/* Document count */}
      {!loading && filteredDocuments.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      )}
    </div>
  )
}
