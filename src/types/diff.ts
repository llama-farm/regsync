// Types for document version diff feature

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber?: number
}

export interface DiffStats {
  addedLines: number
  removedLines: number
  unchangedLines: number
  totalChanges: number
}

export interface DiffResult {
  stats: DiffStats
  lines: DiffLine[]
  oldText: string
  newText: string
}

export interface AISummary {
  bullets: string[]
  raw: string
  generatedAt: string
}

export interface DocumentChanges {
  documentId: string
  documentName: string
  oldVersionId: string
  newVersionId: string
  diff: DiffResult
  aiSummary: AISummary | null
  updatedAt: string
  updatedBy: string
}

export interface LlamaFarmError {
  type: 'connection' | 'api' | 'unknown'
  message: string
}
