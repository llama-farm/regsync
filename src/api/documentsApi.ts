import { apiClient, projectUrl } from './client'
import { datasetsApi, type DatasetFile } from './datasetsApi'
import type {
  PolicyDocument,
  DocumentWithVersions,
  VersionMetadata,
  VersionWithChanges,
  ChangesSummary,
} from '@/types/document'

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

// Convert a dataset file to a PolicyDocument for display
function datasetFileToDocument(file: DatasetFile): PolicyDocument {
  return {
    id: file.file_hash,
    name: file.original_filename,
    short_title: file.original_filename.replace(/\.[^/.]+$/, ''),
    current_version_id: file.file_hash,
    total_versions: 1,
    created_at: file.uploaded_at,
    updated_at: file.uploaded_at,
    created_by: 'LlamaFarm Designer',
    // Mark as dataset file for UI differentiation
    source: 'dataset' as const,
  }
}

export const documentsApi = {
  // List all documents (combines versioned documents + dataset files)
  async listDocuments(): Promise<ListDocumentsResponse> {
    // Fetch both versioned documents and dataset files
    const [docsResult, datasetFiles] = await Promise.all([
      apiClient
        .get<ListDocumentsResponse>(projectUrl('/documents/'))
        .catch(() => ({ data: { total: 0, documents: [] } })),
      datasetsApi.listFiles().catch(() => []),
    ])

    // Get versioned document IDs to avoid duplicates
    const versionedDocIds = new Set(
      docsResult.data.documents.map((d) => d.id)
    )

    // Convert dataset files that aren't already versioned documents
    const datasetDocs = datasetFiles
      .filter((f) => !versionedDocIds.has(f.file_hash))
      .map(datasetFileToDocument)

    // Combine and sort by updated_at
    const allDocs = [...docsResult.data.documents, ...datasetDocs].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    return {
      total: allDocs.length,
      documents: allDocs,
    }
  },

  // List only versioned documents (original behavior)
  async listVersionedDocuments(): Promise<ListDocumentsResponse> {
    const { data } = await apiClient.get<ListDocumentsResponse>(
      projectUrl('/documents/')
    )
    return data
  },

  // List files from dataset (LlamaFarm Designer uploads)
  async listDatasetFiles(): Promise<DatasetFile[]> {
    return datasetsApi.listFiles()
  },

  // Get a single document with all versions
  async getDocument(documentId: string): Promise<DocumentWithVersions> {
    const { data } = await apiClient.get<GetDocumentResponse>(
      projectUrl(`/documents/${documentId}`)
    )
    return data.document
  },

  // Create a new document with first version
  // Also uploads to dataset for LlamaFarm Designer sync
  async createDocument(
    file: File,
    name: string,
    uploadedBy: string,
    shortTitle?: string,
    notes?: string
  ): Promise<CreateDocumentResponse> {
    // Upload to dataset first for Designer sync
    const datasetResult = await datasetsApi.uploadFile(file)

    // Then create versioned document
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    formData.append('uploaded_by', uploadedBy)
    formData.append('file_hash', datasetResult.hash) // Link to dataset file
    if (shortTitle) formData.append('short_title', shortTitle)
    if (notes) formData.append('notes', notes)

    const { data } = await apiClient.post<CreateDocumentResponse>(
      projectUrl('/documents/'),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )

    // Trigger dataset processing for RAG
    datasetsApi.processDataset().catch(console.error)

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
  // Also uploads to dataset for LlamaFarm Designer sync
  async uploadVersion(
    documentId: string,
    file: File,
    uploadedBy: string,
    notes?: string
  ): Promise<UploadVersionResponse> {
    // Upload to dataset first for Designer sync
    const datasetResult = await datasetsApi.uploadFile(file)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploaded_by', uploadedBy)
    formData.append('file_hash', datasetResult.hash) // Link to dataset file
    if (notes) formData.append('notes', notes)

    const { data } = await apiClient.post<UploadVersionResponse>(
      projectUrl(`/documents/${documentId}/versions`),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )

    // Trigger dataset processing for RAG
    datasetsApi.processDataset().catch(console.error)

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
    newVersionId: string,
    useLlm = true
  ): Promise<ChangesSummary> {
    const { data } = await apiClient.post<CompareVersionsResponse>(
      projectUrl(`/documents/${documentId}/compare`),
      {
        old_version_id: oldVersionId,
        new_version_id: newVersionId,
        use_llm: useLlm,
      }
    )
    return data.changes
  },
}
