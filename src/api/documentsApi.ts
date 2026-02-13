import { apiClient, projectUrl } from './client'
import type {
  PolicyDocument,
  DocumentWithVersions,
  VersionMetadata,
  VersionWithChanges,
  ChangesSummary,
} from '@/types/document'
import type { PolicyScope } from '@/types/location'
import type { MatchDetectionResult } from '@/types/match'

interface ListDocumentsResponse {
  total: number
  documents: PolicyDocument[]
}

interface CreateDocumentResponse {
  document: PolicyDocument
  version: VersionMetadata
}

interface GetDocumentResponse {
  document: DocumentWithVersions
}

interface ListVersionsResponse {
  document_id: string
  total: number
  versions: VersionMetadata[]
}

interface UploadVersionResponse {
  version: VersionMetadata
  message: string
}

interface CompareVersionsResponse {
  changes: ChangesSummary
}

export const documentsApi = {
  // List all documents
  async listDocuments(): Promise<ListDocumentsResponse> {
    const { data } = await apiClient.get<ListDocumentsResponse>(
      projectUrl('/documents/')
    )
    return data
  },

  // Get a single document with all versions
  async getDocument(documentId: string): Promise<DocumentWithVersions> {
    const { data } = await apiClient.get<GetDocumentResponse>(
      projectUrl(`/documents/${documentId}`)
    )
    return data.document
  },

  // Create a new document with first version
  async createDocument(
    file: File,
    name: string,
    uploadedBy: string,
    shortTitle?: string,
    notes?: string,
    scope?: PolicyScope | null
  ): Promise<CreateDocumentResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    formData.append('uploaded_by', uploadedBy)
    if (shortTitle) formData.append('short_title', shortTitle)
    if (notes) formData.append('notes', notes)
    if (scope) formData.append('scope', JSON.stringify(scope))

    const { data } = await apiClient.post<CreateDocumentResponse>(
      projectUrl('/documents/'),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  // Delete a document
  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.delete(projectUrl(`/documents/${documentId}`))
  },

  // List versions for a document
  async listVersions(documentId: string): Promise<ListVersionsResponse> {
    const { data } = await apiClient.get<ListVersionsResponse>(
      projectUrl(`/documents/${documentId}/versions`)
    )
    return data
  },

  // Upload a new version
  async uploadVersion(
    documentId: string,
    file: File,
    uploadedBy: string,
    notes?: string
  ): Promise<UploadVersionResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploaded_by', uploadedBy)
    if (notes) formData.append('notes', notes)

    const { data } = await apiClient.post<UploadVersionResponse>(
      projectUrl(`/documents/${documentId}/versions`),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  // Get a specific version with changes
  async getVersion(
    documentId: string,
    versionId: string
  ): Promise<VersionWithChanges> {
    const { data } = await apiClient.get<VersionWithChanges>(
      projectUrl(`/documents/${documentId}/versions/${versionId}`)
    )
    return data
  },

  // Download document file
  async downloadFile(documentId: string, versionId?: string): Promise<Blob> {
    const url = versionId
      ? projectUrl(`/documents/${documentId}/file?version_id=${versionId}`)
      : projectUrl(`/documents/${documentId}/file`)

    const { data } = await apiClient.get<Blob>(url, { responseType: 'blob' })
    return data
  },

  // Detect changes for a version
  async detectChanges(
    documentId: string,
    versionId: string,
    useLlm = true
  ): Promise<ChangesSummary> {
    const { data } = await apiClient.post<CompareVersionsResponse>(
      projectUrl(
        `/documents/${documentId}/versions/${versionId}/detect-changes?use_llm=${useLlm}`
      )
    )
    return data.changes
  },

  // Compare two versions
  async compareVersions(
    documentId: string,
    oldVersionId: string,
    newVersionId: string
  ): Promise<ChangesSummary> {
    const { data } = await apiClient.get<ChangesSummary>(
      projectUrl(`/documents/${documentId}/compare?oldVersionId=${oldVersionId}&newVersionId=${newVersionId}`)
    )
    return data
  },

  // Approve a pending version
  async approveVersion(
    documentId: string,
    versionId: string
  ): Promise<{ message: string; version: VersionMetadata }> {
    const { data } = await apiClient.post(
      projectUrl(`/documents/${documentId}/versions/${versionId}/approve`)
    )
    return data
  },

  // Reject a pending version
  async rejectVersion(
    documentId: string,
    versionId: string
  ): Promise<{ message: string }> {
    const { data } = await apiClient.delete(
      projectUrl(`/documents/${documentId}/versions/${versionId}`)
    )
    return data
  },

  // Detect potential matches for an uploaded file
  async detectMatches(file: File): Promise<MatchDetectionResult> {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post<MatchDetectionResult>(
      projectUrl('/documents/detect-matches'),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  // Demo features

  // Get demo limits and usage
  async getLimits(): Promise<DemoLimits> {
    const { data } = await apiClient.get<DemoLimits>(projectUrl('/limits'))
    return data
  },

  // Reset session to seed state
  async resetToSeed(): Promise<{ message: string; documents_restored: number; files_cleaned: number }> {
    const { data } = await apiClient.post(projectUrl('/reset'))
    return data
  },

  // List available sample documents
  async listSamples(): Promise<{ samples: SampleDocument[] }> {
    const { data } = await apiClient.get(projectUrl('/samples'))
    return data
  },

  // Add a sample document to the session
  async addSample(sampleId: string): Promise<{ message: string; type: string; document_id?: string }> {
    const { data } = await apiClient.post(projectUrl(`/samples/${sampleId}/add`))
    return data
  },

  // Get a sample PDF file as a blob
  async getSampleFile(sampleId: string): Promise<Blob> {
    const { data } = await apiClient.get(projectUrl(`/samples/${sampleId}/file`), {
      responseType: 'blob',
    })
    return data
  },
}

// Demo types
export interface DemoLimits {
  documents: { current: number; max: number }
  storage: { current_bytes: number; max_bytes: number }
  can_upload: boolean
}

export interface SampleDocument {
  id: string
  type: 'new_document' | 'version_update'
  title: string
  short_title?: string
  description: string
  filename: string
  uploaded_by: string
  target_document_name?: string
  already_added: boolean
}
