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

// Import documentsApi for version comparisons
import { documentsApi } from './documentsApi'

export const chatApi = {
  // Query about changes in a specific document
  // Uses version comparison instead of general RAG search
  async queryDocumentChanges(
    documentId: string,
    documentName: string
  ): Promise<{
    answer: string
    sources: CitedSource[]
  }> {
    try {
      // Get document with versions
      const doc = await documentsApi.getDocument(documentId)
      const versions = doc.versions || []

      // Sort by created_at to get chronological order
      const sortedVersions = [...versions].sort(
        (a, b) => new Date(a.created_at || a.uploaded_at).getTime() - new Date(b.created_at || b.uploaded_at).getTime()
      )

      // If only one version, no changes to report
      if (sortedVersions.length <= 1) {
        return {
          answer: `This is the first version of "${documentName}". There are no previous versions to compare against, so no changes can be reported.\n\nTo see the document contents, click "View" on the source document below.`,
          sources: [{
            content: `First version uploaded`,
            score: 1.0,
            metadata: { filename: doc.name },
            document_id: documentId,
            version_id: doc.current_version_id,
            filename: sortedVersions[0]?.filename || doc.name,
          }],
        }
      }

      // Get the current version and try to detect changes
      const currentVersion = sortedVersions[sortedVersions.length - 1]
      const previousVersion = sortedVersions[sortedVersions.length - 2]

      try {
        // Try to get changes using the detect-changes API
        const changes = await documentsApi.detectChanges(documentId, currentVersion.id, true)

        if (changes && changes.changes && changes.changes.length > 0) {
          // Format the changes into a readable response
          const changesList = changes.changes.map(c => {
            const prefix = c.type === 'added' ? '**Added:**' : c.type === 'removed' ? '**Removed:**' : '**Modified:**'
            return `- ${prefix} ${c.section}: ${c.summary}`
          }).join('\n')

          return {
            answer: `## Changes in ${documentName}\n\n${changes.summary || 'The following changes were detected:'}\n\n${changesList}\n\n*Compared Version ${sortedVersions.length} (current) with Version ${sortedVersions.length - 1}*`,
            sources: [{
              content: `Version ${sortedVersions.length}: ${changes.summary || 'Latest version'}`,
              score: 1.0,
              metadata: { filename: doc.name },
              document_id: documentId,
              version_id: currentVersion.id,
              filename: currentVersion.filename || doc.name,
            }],
          }
        }
      } catch (err) {
        console.warn('Failed to detect changes via API, using fallback:', err)
      }

      // Fallback: Return version info without detailed changes
      return {
        answer: `## ${documentName}\n\nThis document has ${sortedVersions.length} versions. The current version was uploaded on ${new Date(currentVersion.uploaded_at).toLocaleDateString()}.\n\nTo see detailed changes between versions, an administrator can use the "Compare with current" feature in the version history.\n\n**Note:** Automatic change detection is not available for this document. Please review the document directly.`,
        sources: [{
          content: `Current version (v${sortedVersions.length})`,
          score: 1.0,
          metadata: { filename: doc.name },
          document_id: documentId,
          version_id: currentVersion.id,
          filename: currentVersion.filename || doc.name,
        }],
      }
    } catch (err) {
      console.error('Failed to query document changes:', err)
      throw err
    }
  },

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
