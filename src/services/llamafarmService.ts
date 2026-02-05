/**
 * LlamaFarm Service - Direct integration with LlamaFarm AI
 * Used for health checks and future direct AI features
 */

const LLAMAFARM_URL = 'http://localhost:14345'
const NAMESPACE = 'default'
const PROJECT = 'regsync'

export interface LlamaFarmStatus {
  available: boolean
  error?: string
}

export interface SummaryRequest {
  text: string
  prompt?: string
  maxTokens?: number
}

export interface SummaryResponse {
  summary: string
  bullets: string[]
}

/**
 * Check if LlamaFarm server is running and accessible
 */
export async function checkLlamaFarmHealth(): Promise<LlamaFarmStatus> {
  try {
    const response = await fetch(`${LLAMAFARM_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })

    if (response.ok) {
      return { available: true }
    }

    return {
      available: false,
      error: `LlamaFarm returned status ${response.status}`
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

/**
 * Generate a summary using LlamaFarm chat completions
 */
export async function generateSummary(request: SummaryRequest): Promise<SummaryResponse> {
  const { text, prompt, maxTokens = 200 } = request

  const systemPrompt = prompt || 'Summarize the following text in 2-4 concise bullet points:'

  const response = await fetch(
    `${LLAMAFARM_URL}/v1/projects/${NAMESPACE}/${PROJECT}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\n${text}`
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LlamaFarm summary failed: ${error}`)
  }

  const data = await response.json()
  const summaryText = data.choices?.[0]?.message?.content || ''

  // Parse into bullets
  const bullets = summaryText
    .split(/(?:•|\d+\.|\n-|\n\*)/g)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 5)

  return {
    summary: summaryText,
    bullets: bullets.length > 0 ? bullets : [summaryText]
  }
}

/**
 * Generate a change summary for document comparison
 */
export async function generateChangeSummary(
  addedContent: string,
  removedContent: string,
  documentName: string
): Promise<SummaryResponse> {
  const text = `Document: ${documentName}

CONTENT ADDED:
${addedContent || 'No new content'}

CONTENT REMOVED:
${removedContent || 'No content removed'}`

  return generateSummary({
    text,
    prompt: 'Summarize these document changes in 2-4 bullet points for a policy administrator. Focus on what was added, removed, or modified:',
    maxTokens: 150
  })
}
