import { apiClient, projectUrl, DATASET } from './client'
import type { CitedSource } from '@/types/chat'

// Default embedding strategy for the nomic-ai model configured in llamafarm.yaml
const EMBEDDING_STRATEGY = 'default_embeddings'

interface RAGQueryRequest {
  query: string
  database?: string
  top_k?: number
  retrieval_strategy?: 'semantic' | 'bm25' | 'hybrid'
  embedding_strategy?: string
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

// System prompt to help with military terminology and policy interpretation
const POLICY_SYSTEM_PROMPT = `You are a policy assistant for the 73rd Medical Wing. Your role is to help personnel understand Air Force regulations and local policies.

When answering questions:
1. Use the retrieved document context to provide accurate, specific answers
2. Cite the relevant section or paragraph when possible
3. If the context doesn't contain the answer, say so clearly
4. Use clear, concise language appropriate for military personnel

Military terminology reference:
- PCS (Permanent Change of Station) - when someone transfers to a new base
- TDY (Temporary Duty) - short-term assignments away from home station
- CRO (Change of Reporting Official) - when a rater or supervisor changes
- OPR (Officer Performance Report) - officer evaluations
- EPR (Enlisted Performance Report) - enlisted evaluations
- Rater - the supervisor who writes the evaluation
- Additional Rater - secondary evaluator, typically the rater's supervisor
- Close-out date - the end date of an evaluation period

When a user asks about a "rater PCS'ing" or "supervisor leaving", they are asking about Change of Reporting Official (CRO) procedures.`

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
        database: request.database || DATASET,
        top_k: request.top_k || 5,
        retrieval_strategy: request.retrieval_strategy || 'semantic',
        embedding_strategy: request.embedding_strategy || EMBEDDING_STRATEGY,
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
    const ragEnabled = options?.ragEnabled ?? true
    const userQuery = messages.filter(m => m.role === 'user').pop()?.content || ''

    // Prepend system prompt if not already present
    const hasSystemPrompt = messages.some(m => m.role === 'system')
    const messagesWithSystem = hasSystemPrompt
      ? messages
      : [{ role: 'system' as const, content: POLICY_SYSTEM_PROMPT }, ...messages]

    // Run RAG query in parallel with chat to get sources
    // LlamaFarm chat API uses RAG internally but doesn't return source metadata
    const ragPromise = ragEnabled
      ? this.ragQuery({
          query: userQuery,
          database: options?.database || DATASET,
          top_k: 5,
          retrieval_strategy: 'hybrid',
          embedding_strategy: EMBEDDING_STRATEGY,
        }).catch(() => null)
      : Promise.resolve(null)

    const chatPromise = apiClient.post<ChatCompletionResponse>(
      projectUrl('/chat/completions'),
      {
        messages: messagesWithSystem,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        // LlamaFarm expects flat RAG parameters (not nested rag object)
        // hybrid retrieval combines semantic (embeddings) with BM25 (keyword) search
        // for better coverage of military acronyms and terminology
        ...(ragEnabled && {
          rag_enabled: true,
          database: options?.database || DATASET,
          rag_top_k: 8,
          rag_retrieval_strategy: 'hybrid',
        }),
      }
    )

    // Wait for both to complete
    const [ragResult, chatResult] = await Promise.all([ragPromise, chatPromise])

    const answer = chatResult.data.choices[0]?.message?.content || ''

    // Map RAG results to sources
    const sources: CitedSource[] = (ragResult?.results || []).map((result) => ({
      content: result.content,
      score: result.score,
      metadata: result.metadata,
      chunk_id: result.chunk_id,
      document_id: result.document_id,
      version_id: result.version_id,
      section: result.section || (result.metadata?.page_number ? `Page ${result.metadata.page_number}` : undefined),
      updated_at: result.updated_at,
      updated_by: result.updated_by,
      // Extract additional fields from LlamaFarm metadata
      filename: (result.metadata?.filename || result.metadata?.source) as string | undefined,
      page_number: result.metadata?.page_number as number | undefined,
      source: result.metadata?.source as string | undefined,
    }))

    return { answer, sources }
  },

  // Search documents (RAG query wrapper for simple searches)
  // Uses hybrid retrieval for better keyword + semantic matching
  async search(query: string, topK = 8): Promise<CitedSource[]> {
    const response = await this.ragQuery({
      query,
      database: DATASET,
      top_k: topK,
      retrieval_strategy: 'hybrid',
      embedding_strategy: EMBEDDING_STRATEGY,
    })

    return response.results.map((result) => ({
      content: result.content,
      score: result.score,
      metadata: result.metadata,
      chunk_id: result.chunk_id,
      document_id: result.document_id,
      version_id: result.version_id,
      section: result.section || (result.metadata?.page_number ? `Page ${result.metadata.page_number}` : undefined),
      updated_at: result.updated_at,
      updated_by: result.updated_by,
      // Extract additional fields from LlamaFarm metadata
      filename: (result.metadata?.filename || result.metadata?.source) as string | undefined,
      page_number: result.metadata?.page_number as number | undefined,
      source: result.metadata?.source as string | undefined,
    }))
  },
}
