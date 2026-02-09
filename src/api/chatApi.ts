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
const POLICY_SYSTEM_PROMPT = `You are a policy assistant answering questions about policy documents.

OUTPUT FORMAT - YOU MUST FOLLOW THIS EXACTLY:
1. One sentence summary
2. Then use bullet points (start each line with "- ") for ALL details

CORRECT OUTPUT EXAMPLE:
The leave policy was updated effective **15 January 2026**.
- Leave balance threshold changed from **50 days** to **45 days**
- Administrative references were corrected
- Minor clarifications added throughout

WRONG (no bullets):
The policy changed the threshold from 50 to 45 days and updated references.

Keep responses under 200 words. Bold **dates** and **numbers**.

SOURCE CITATIONS:
When referencing a source, use the EXACT document name provided in the context (e.g. "JBSA-Instruction-36-2102-Telework"), NEVER use internal regulation numbers found within the document text (e.g. do NOT say "AFI 36-202" or "Air Force Instruction 36-202").

Military terms:
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
  // Enrich sources with document metadata from local documents API
  async enrichSourcesWithDocumentInfo(sources: CitedSource[]): Promise<CitedSource[]> {
    if (sources.length === 0) return sources

    try {
      // Get all documents to build a lookup map
      const { documents } = await documentsApi.listDocuments()

      // Build filename -> document info map with version status
      interface DocInfo {
        updated_at: string
        updated_by: string
        current_filename: string | null
        document_id: string
      }
      const docInfoMap = new Map<string, DocInfo>()
      for (const doc of documents) {
        // Find the current version's filename (server returns versions but type doesn't include it)
        const versions = (doc as unknown as { versions?: Array<{ id: string; filename?: string }> }).versions
        const currentVersion = versions?.find(v => v.id === doc.current_version_id)
        docInfoMap.set(doc.name, {
          updated_at: doc.updated_at,
          updated_by: 'Policy Administrator',
          current_filename: currentVersion?.filename || null,
          document_id: doc.id,
        })
      }

      // Helper to normalize filename for comparison (remove timestamp prefix and extension)
      const normalizeFilename = (f: string) => f.replace(/^\d{13}-/, '').replace(/\.pdf$/i, '').toLowerCase()

      // Enrich each source with document info and version status
      return sources.map(source => {
        const filename = source.filename || source.source || ''
        const cleanName = normalizeFilename(filename)

        // Find matching document
        for (const [docName, info] of docInfoMap) {
          if (docName.toLowerCase().includes(cleanName) || cleanName.includes(normalizeFilename(docName))) {
            // Check if this source is from the current version (compare normalized filenames)
            const currentNormalized = info.current_filename ? normalizeFilename(info.current_filename) : null
            const isCurrent = currentNormalized === cleanName
            return {
              ...source,
              updated_at: source.updated_at || info.updated_at,
              updated_by: source.updated_by || info.updated_by,
              document_id: source.document_id || info.document_id,
              is_current: isCurrent,
            }
          }
        }
        return source
      })
    } catch (err) {
      console.warn('Failed to enrich sources with document info:', err)
      return sources
    }
  },

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
      // Previous version available if needed: sortedVersions[sortedVersions.length - 2]

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

    // Step 1: Run RAG query first so we can inject context with filenames
    let ragResult: RAGQueryResponse | null = null
    if (ragEnabled) {
      try {
        ragResult = await this.ragQuery({
          query: userQuery,
          database: options?.database || DATASET,
          top_k: 5,
          retrieval_strategy: 'hybrid',
          embedding_strategy: EMBEDDING_STRATEGY,
        })
      } catch {
        ragResult = null
      }
    }

    // Step 2: Build messages with RAG context injected (including filenames)
    const hasSystemPrompt = messages.some(m => m.role === 'system')
    let messagesWithSystem = hasSystemPrompt
      ? [...messages]
      : [{ role: 'system' as const, content: POLICY_SYSTEM_PROMPT }, ...messages]

    // Inject RAG context into the prompt so the LLM sees actual document names
    if (ragResult?.results?.length) {
      const contextBlocks = ragResult.results.map((r, i) => {
        const filename = (r.metadata?.filename || r.metadata?.source || 'Unknown') as string
        // Clean filename: remove timestamp prefix and .pdf extension
        const cleanName = filename.replace(/^\d{13}-/, '').replace(/\.pdf$/i, '')
        const page = r.metadata?.page_number ? ` (Page ${r.metadata.page_number})` : ''
        return `[Source ${i + 1}: ${cleanName}${page}]\n${r.content}`
      }).join('\n\n')

      const contextMessage = `Based on the following policy documents, answer the user's question.\n\n${contextBlocks}`

      // Insert context as a system message right before the user's last message
      const lastUserIdx = messagesWithSystem.map(m => m.role).lastIndexOf('user')
      if (lastUserIdx >= 0) {
        messagesWithSystem.splice(lastUserIdx, 0, { role: 'system' as const, content: contextMessage })
      }
    }

    // Step 3: Call chat WITHOUT LlamaFarm's built-in RAG (we handle it ourselves)
    const chatResult = await apiClient.post<ChatCompletionResponse>(
      projectUrl('/chat/completions'),
      {
        messages: messagesWithSystem,
        max_tokens: options?.maxTokens || 600,
        temperature: options?.temperature || 0.7,
      }
    )

    const answer = chatResult.data.choices[0]?.message?.content || ''

    // Map RAG results to sources for the source cards
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
      filename: (result.metadata?.filename || result.metadata?.source) as string | undefined,
      page_number: result.metadata?.page_number as number | undefined,
      source: result.metadata?.source as string | undefined,
    }))

    // Enrich sources with document metadata (updated_at, updated_by) from documents API
    const enrichedSources = await this.enrichSourcesWithDocumentInfo(sources)

    return { answer, sources: enrichedSources }
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
