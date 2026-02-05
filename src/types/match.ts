// Match signal types for version detection
export interface MatchSignal {
  type: 'supersedes' | 'document_number' | 'filename' | 'title' | 'opr'
  weight: number
  similarity?: number
  detail?: string
}

// Document match result
export interface DocumentMatch {
  document: {
    id: string
    name: string
    short_title: string | null
    updated_at: string
    current_version_id: string
  }
  score: number
  confidence: 'high' | 'medium' | 'low'
  signals: MatchSignal[]
}

// Full match detection result
export interface MatchDetectionResult {
  matches: DocumentMatch[]
  extracted_title?: string
  extracted_doc_number?: string
  analysis_time_ms: number
}

// Helper to get human-readable signal description
export function getSignalDescription(signal: MatchSignal): string {
  switch (signal.type) {
    case 'supersedes':
      return signal.detail || 'Document states it supersedes this policy'
    case 'document_number':
      return signal.detail || 'Document number matches'
    case 'filename':
      return `Filename ${Math.round((signal.similarity || 0) * 100)}% similar`
    case 'title':
      return `Title ${Math.round((signal.similarity || 0) * 100)}% similar`
    case 'opr':
      return 'Same OPR office'
    default:
      return 'Unknown signal'
  }
}

// Helper to get confidence badge color classes
export function getConfidenceColor(confidence: DocumentMatch['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    case 'medium':
      return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30'
    case 'low':
      return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
  }
}
