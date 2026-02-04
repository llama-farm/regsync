import { apiClient, projectUrl } from './client'
import type { CitedSource } from '@/types/chat'

interface RAGQueryRequest {
  query: string
  database?: string
  top_k?: number
  retrieval_strategy?: 'semantic' | 'bm25' | 'hybrid'
  score_threshold?: number
}

interface RAGQueryResult {
  content: string
  score: number
  metadata: Record<string, unknown>
  chunk_id?: string
  document_id?: string
  version_id?: string
  section?: string
  updated_at?: string
  updated_by?: string
}

interface RAGQueryResponse {
  query: string
  results: RAGQueryResult[]
  total_results: number
  processing_time_ms?: number
  retrieval_strategy_used: string
  database_used: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  rag_context?: RAGQueryResult[]
}

export const chatApi = {
  // Perform RAG query (retrieval only)
  async ragQuery(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const { data } = await apiClient.post<RAGQueryResponse>(
      projectUrl('/rag/query'),
      {
        query: request.query,
        database: request.database || 'main',
        top_k: request.top_k || 5,
        retrieval_strategy: request.retrieval_strategy || 'semantic',
        score_threshold: request.score_threshold,
      }
    )
    return data
  },

  // Chat completion with optional RAG
  async chat(
    messages: ChatMessage[],
    options?: {
      ragEnabled?: boolean
      database?: string
      maxTokens?: number
      temperature?: number
    }
  ): Promise<{
    answer: string
    sources: CitedSource[]
  }> {
    const { data } = await apiClient.post<ChatCompletionResponse>(
      projectUrl('/chat/completions'),
      {
        messages,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        rag_enabled: options?.ragEnabled ?? true,
        database: options?.database || 'main',
        rag_top_k: 5,
        rag_score_threshold: 0.5,
        rag_retrieval_strategy: 'semantic',
      }
    )

    const answer = data.choices[0]?.message?.content || ''
    const sources: CitedSource[] = (data.rag_context || []).map((result) => ({
      content: result.content,
      score: result.score,
      metadata: result.metadata,
      chunk_id: result.chunk_id,
      document_id: result.document_id,
      version_id: result.version_id,
      section: result.section,
      updated_at: result.updated_at,
      updated_by: result.updated_by,
    }))

    return { answer, sources }
  },

  // Search documents (RAG query wrapper for simple searches)
  async search(query: string, topK = 5): Promise<CitedSource[]> {
    const response = await this.ragQuery({
      query,
      top_k: topK,
      retrieval_strategy: 'semantic',
    })

    return response.results.map((result) => ({
      content: result.content,
      score: result.score,
      metadata: result.metadata,
      chunk_id: result.chunk_id,
      document_id: result.document_id,
      version_id: result.version_id,
      section: result.section,
      updated_at: result.updated_at,
      updated_by: result.updated_by,
    }))
  },
}
