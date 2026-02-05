/**
 * Diff Service - Frontend client for document version comparison
 * Calls the RegSync backend API which handles PDF extraction and LlamaFarm AI summaries
 */

import type { DiffResult, DiffLine, DiffStats, AISummary, DocumentChanges } from '@/types/diff'

const API_BASE = 'http://localhost:3001'

interface BackendChange {
  section: string
  type: 'added' | 'removed' | 'modified'
  summary: string
  before?: string
  after?: string
}

interface CompareResponse {
  document_id: string
  document_name: string
  old_version_id: string
  new_version_id: string
  old_version: {
    id: string
    uploaded_by: string
    created_at: string
  }
  new_version: {
    id: string
    uploaded_by: string
    created_at: string
  }
  total_changes: number
  summary: string
  changes: BackendChange[]
  compared_at: string
}

/**
 * Convert backend changes to frontend diff format
 */
function convertToDiffLines(changes: BackendChange[]): DiffLine[] {
  const lines: DiffLine[] = []

  for (const change of changes) {
    if (change.type === 'removed' && change.before) {
      lines.push({
        type: 'removed',
        content: change.before.trim()
      })
    }
    if (change.type === 'added' && change.after) {
      lines.push({
        type: 'added',
        content: change.after.trim()
      })
    }
    if (change.type === 'modified') {
      if (change.before) {
        lines.push({
          type: 'removed',
          content: change.before.trim()
        })
      }
      if (change.after) {
        lines.push({
          type: 'added',
          content: change.after.trim()
        })
      }
    }
  }

  return lines
}

/**
 * Parse AI summary into bullet points
 */
function parseAISummary(summaryText: string): AISummary {
  // Try to split by bullet points or periods
  const bullets = summaryText
    .split(/(?:•|\d+\.|\n-|\n\*)/g)
    .map(s => s.trim())
    .filter(s => s.length > 10)

  // If no good splits, use the whole text as one bullet
  const finalBullets = bullets.length > 0 ? bullets : [summaryText]

  return {
    bullets: finalBullets.slice(0, 5), // Max 5 bullets
    raw: summaryText,
    generatedAt: new Date().toISOString()
  }
}

/**
 * Compare two versions of a document
 * Returns diff data and AI-generated summary
 */
export async function compareDocumentVersions(
  documentId: string,
  oldVersionId: string,
  newVersionId: string
): Promise<DocumentChanges> {
  const url = `${API_BASE}/v1/projects/default/regsync/documents/${documentId}/compare?oldVersionId=${oldVersionId}&newVersionId=${newVersionId}`

  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))

    // Check if it's a LlamaFarm connection error
    if (response.status === 500 && error.error?.includes('LlamaFarm')) {
      throw new LlamaFarmConnectionError('LlamaFarm is not running. Please start LlamaFarm to use the diff feature.')
    }

    throw new Error(error.error || `Failed to compare versions: ${response.status}`)
  }

  const data: CompareResponse = await response.json()

  // Convert to frontend format
  const lines = convertToDiffLines(data.changes)

  const stats: DiffStats = {
    addedLines: lines.filter(l => l.type === 'added').length,
    removedLines: lines.filter(l => l.type === 'removed').length,
    unchangedLines: 0,
    totalChanges: data.total_changes
  }

  const diff: DiffResult = {
    stats,
    lines,
    oldText: '',
    newText: ''
  }

  return {
    documentId: data.document_id,
    documentName: data.document_name,
    oldVersionId: data.old_version_id,
    newVersionId: data.new_version_id,
    diff,
    aiSummary: parseAISummary(data.summary),
    updatedAt: data.new_version.created_at,
    updatedBy: data.new_version.uploaded_by
  }
}

/**
 * Get changes for a document (comparing current version to previous)
 */
export async function getDocumentChanges(
  documentId: string
): Promise<DocumentChanges | null> {
  // First, get the document versions
  const versionsUrl = `${API_BASE}/v1/projects/default/regsync/documents/${documentId}/versions`
  const versionsResponse = await fetch(versionsUrl)

  if (!versionsResponse.ok) {
    throw new Error('Failed to fetch document versions')
  }

  const versionsData = await versionsResponse.json()
  const versions = versionsData.versions || []

  // Need at least 2 versions to compare
  if (versions.length < 2) {
    return null
  }

  // Sort by created_at to get oldest and newest
  const sortedVersions = [...versions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const oldVersion = sortedVersions[sortedVersions.length - 2]
  const newVersion = sortedVersions[sortedVersions.length - 1]

  return compareDocumentVersions(documentId, oldVersion.id, newVersion.id)
}

/**
 * Check if LlamaFarm is available
 */
export async function checkLlamaFarmStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8000/health', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Custom error for LlamaFarm connection issues
 */
export class LlamaFarmConnectionError extends Error {
  type: 'connection' = 'connection'

  constructor(message: string) {
    super(message)
    this.name = 'LlamaFarmConnectionError'
  }
}
