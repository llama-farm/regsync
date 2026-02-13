import { useState, useEffect } from 'react'
import { Search, FileText, Loader2, Calendar, User, History, MapPin } from 'lucide-react'
import type { PolicyDocument } from '@/types/document'
import { documentsApi } from '@/api/documentsApi'
import { DocumentChangesModal } from './DocumentChanges'
import { usePolicyFilter } from '@/hooks/usePolicyFilter'
import { scopeLevelLabels } from '@/types/location'

// Build document file URL for direct access
const getDocumentUrl = (documentId: string): string => {
  return `/api/projects/default/regsync/documents/${documentId}/file`
}

export function DocumentsList() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<PolicyDocument | null>(null)
  const { filterPolicy, location } = usePolicyFilter()

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true)
      try {
        const response = await documentsApi.listDocuments()
        setDocuments(response.documents)
      } catch {
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }
    loadDocuments()
  }, [])

  // First filter by scope (user location), then by search query
  const filteredDocuments = documents
    .filter(filterPolicy)
    .filter((doc) => {
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
              return (
                <div
                  key={doc.id}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium truncate">{doc.name}</h3>
                        {doc.short_title && (
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                            {doc.short_title}
                          </span>
                        )}
                        {doc.scope && (
                          <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                            <MapPin className="w-3 h-3" />
                            {scopeLevelLabels[doc.scope.level]}
                          </span>
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
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          Changes
                        </span>
                      </button>
                      <a
                        href={getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Document count with location context */}
      {!loading && filteredDocuments.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {filteredDocuments.length} documents visible at {location.wing}
        </div>
      )}

      {/* Document Changes Modal */}
      {selectedDoc && (
        <DocumentChangesModal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          documentId={selectedDoc.id}
          documentName={selectedDoc.name}
        />
      )}
    </div>
  )
}
