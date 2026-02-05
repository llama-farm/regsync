export interface CitedSource {
  content: string
  score: number
  metadata: Record<string, unknown>
  chunk_id?: string
  document_id?: string
  version_id?: string
  section?: string
  updated_at?: string
  updated_by?: string
  // Fields from LlamaFarm RAG metadata
  filename?: string
  page_number?: number
  source?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: CitedSource[]
  timestamp: string
}

export interface ChatResponse {
  answer: string
  sources: CitedSource[]
}
