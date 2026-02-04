export interface PolicyDocument {
  id: string
  name: string
  short_title: string | null
  current_version_id: string
  created_at: string
  updated_at: string
  // Optional fields for extended info
  total_versions?: number
  created_by?: string
  // Source indicates where the file came from
  // 'document' = RegSync versioned document
  // 'dataset' = LlamaFarm Designer upload
  source?: 'document' | 'dataset'
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  uploaded_at: string
  uploaded_by: string
  file_hash: string
  file_size: number
  file_name: string
  mime_type: string
  notes: string
  status: 'draft' | 'published'
}

export interface Change {
  section: string
  type: 'added' | 'modified' | 'removed'
  summary: string
  before?: string
  after?: string
}

export interface ChangesSummary {
  total_changes: number
  summary: string
  changes: Change[]
  old_version_id: string
  new_version_id: string
  compared_at: string
}

export interface VersionWithChanges extends DocumentVersion {
  changes?: ChangesSummary
}

export interface DocumentWithVersions extends PolicyDocument {
  versions: DocumentVersion[]
}

// Alias for API compatibility
export type VersionMetadata = DocumentVersion
