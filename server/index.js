/**
 * RegSync Local API Server
 * Document management backend with LlamaFarm RAG integration
 * Supports per-session isolation for demo deployment
 */

import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')
import fastDiff from 'fast-diff'
import stringSimilarity from 'string-similarity'
import {
  getWeekBounds,
  getMonthBounds,
  formatPeriodLabel,
  computeDigest,
  getPreviousWeek,
  getPreviousMonth,
  validateArchiveLimit
} from './digest.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// LlamaFarm configuration
const LLAMAFARM_URL = process.env.LLAMAFARM_URL || 'http://localhost:14345'
const LLAMAFARM_NAMESPACE = 'default'
const LLAMAFARM_PROJECT = 'regsync'
const LLAMAFARM_DATASET = 'policies'

// Data directories
const DATA_DIR = path.join(__dirname, '..', 'data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

// Seed directories (read-only baseline)
const SEED_DIR = path.join(__dirname, '..', 'seed')
const SEED_POLICIES_DIR = path.join(SEED_DIR, 'policies')
const SEED_METADATA_FILE = path.join(SEED_DIR, 'documents.json')
const SEED_SAMPLES_DIR = path.join(SEED_DIR, 'samples')
const SEED_SAMPLES_MANIFEST = path.join(SEED_SAMPLES_DIR, 'manifest.json')

// Demo limits
const DEMO_MAX_DOCUMENTS = 20
const DEMO_MAX_STORAGE_BYTES = 200 * 1024 * 1024 // 200MB

// Session expiry (2 hours)
const SESSION_TTL_MS = 2 * 60 * 60 * 1000

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// ============================================
// Session Management
// ============================================

// Load seed metadata template (once at startup)
let seedMetadata = { documents: [] }
if (fs.existsSync(SEED_METADATA_FILE)) {
  try {
    seedMetadata = JSON.parse(fs.readFileSync(SEED_METADATA_FILE, 'utf-8'))
    console.log(`Loaded seed data: ${seedMetadata.documents.length} documents`)
  } catch (err) {
    console.error('Failed to load seed metadata:', err.message)
  }
}

// In-memory session store: Map<sessionId, { metadata, createdAt, uploadedFiles }>
const sessions = new Map()

function createSession() {
  return {
    metadata: JSON.parse(JSON.stringify(seedMetadata)), // deep copy
    createdAt: Date.now(),
    uploadedFiles: [] // track files uploaded by this session for cleanup
  }
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createSession())
    console.log(`New session created: ${sessionId} (total: ${sessions.size})`)
  }
  const session = sessions.get(sessionId)
  session.lastAccess = Date.now()
  return session
}

function loadMetadata(sessionId) {
  return getSession(sessionId).metadata
}

function saveMetadata(sessionId, data) {
  const session = getSession(sessionId)
  session.metadata = data
}

// Session cleanup - evict expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now()
  let evicted = 0
  for (const [sessionId, session] of sessions) {
    if (now - (session.lastAccess || session.createdAt) > SESSION_TTL_MS) {
      // Clean up uploaded files for this session
      for (const filename of session.uploadedFiles) {
        const filePath = path.join(UPLOADS_DIR, filename)
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch {}
      }
      sessions.delete(sessionId)
      evicted++
    }
  }
  if (evicted > 0) {
    console.log(`Session cleanup: evicted ${evicted} expired sessions (remaining: ${sessions.size})`)
  }
}, 30 * 60 * 1000) // Every 30 minutes

// ============================================
// Middleware
// ============================================

app.use(cors({ credentials: true, origin: true }))
app.use(express.json())

// Session middleware - assigns/reads session cookie
app.use((req, res, next) => {
  // Parse cookies manually (lightweight, no dependency)
  const cookies = {}
  const cookieHeader = req.headers.cookie
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=')
      cookies[name] = rest.join('=')
    })
  }

  let sessionId = cookies['regsync_session']
  if (!sessionId) {
    sessionId = uuidv4()
    // Set cookie: HttpOnly for security, SameSite=Lax for cross-origin
    res.setHeader('Set-Cookie', `regsync_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`)
  }
  req.sessionId = sessionId
  next()
})

// File upload configuration - uploads go to shared uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB limit

// ============================================
// File Resolution Helpers
// ============================================

// Resolve a PDF filename to its actual path on disk
// Checks: seed/policies first, then data/uploads
function resolveFilePath(filename) {
  const seedPath = path.join(SEED_POLICIES_DIR, filename)
  if (fs.existsSync(seedPath)) return seedPath

  const uploadPath = path.join(UPLOADS_DIR, filename)
  if (fs.existsSync(uploadPath)) return uploadPath

  // Legacy: check old data/policies path for backward compatibility
  const legacyPath = path.join(DATA_DIR, 'policies', filename)
  if (fs.existsSync(legacyPath)) return legacyPath

  return null
}

// ============================================
// LlamaFarm RAG Helpers
// ============================================

// Delete file from LlamaFarm RAG dataset by filename
async function deleteFromLlamaFarm(filename) {
  try {
    const listUrl = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`
    const listResponse = await fetch(listUrl)

    if (!listResponse.ok) {
      console.error('Failed to list LlamaFarm files')
      return { success: false, error: 'Failed to list files' }
    }

    const dataset = await listResponse.json()
    const files = dataset.details?.files_metadata || []

    const file = files.find(f =>
      f.original_file_name === filename ||
      f.original_file_name.endsWith(filename) ||
      filename.endsWith(f.original_file_name.replace(/^\d+-/, ''))
    )

    if (!file) {
      console.log('File not found in LlamaFarm:', filename)
      return { success: true }
    }

    const deleteUrl = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}/data/${file.hash}`
    const response = await fetch(deleteUrl, { method: 'DELETE' })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`LlamaFarm delete failed (${response.status}):`, errorText)
      return { success: false, error: errorText }
    }

    console.log('✓ File deleted from LlamaFarm RAG:', filename)
    return { success: true }
  } catch (error) {
    console.error('LlamaFarm delete error:', error.message)
    return { success: false, error: error.message }
  }
}

// Upload file to LlamaFarm RAG dataset
async function uploadToLlamaFarm(filePath, originalName, metadata = {}) {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    const blob = new Blob([fileBuffer], { type: 'application/pdf' })

    const formData = new FormData()
    formData.append('file', blob, originalName)

    const url = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}/data?auto_process=true`

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`LlamaFarm upload failed (${response.status}):`, errorText)
      return { success: false, error: errorText }
    }

    const result = await response.json()
    console.log('✓ File uploaded to LlamaFarm RAG:', originalName)
    return { success: true, result }
  } catch (error) {
    console.error('LlamaFarm upload error:', error.message)
    return { success: false, error: error.message }
  }
}

// Upload text content to LlamaFarm RAG dataset (for change summaries)
async function uploadTextToLlamaFarm(text, filename) {
  try {
    const blob = new Blob([text], { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', blob, filename)

    const url = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}/data?auto_process=true`

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`LlamaFarm text upload failed (${response.status}):`, errorText)
      return { success: false, error: errorText }
    }

    const result = await response.json()
    console.log('✓ Text uploaded to LlamaFarm RAG:', filename)
    return { success: true, result }
  } catch (error) {
    console.error('LlamaFarm text upload error:', error.message)
    return { success: false, error: error.message }
  }
}

// Delete change summary from LlamaFarm (by document ID pattern)
async function deleteChangeSummaryFromLlamaFarm(documentId) {
  try {
    const listUrl = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`
    const listResponse = await fetch(listUrl)

    if (!listResponse.ok) {
      console.log('Could not list LlamaFarm files for change summary cleanup')
      return { success: false }
    }

    const dataset = await listResponse.json()
    const files = dataset.details?.files_metadata || []

    const summaryFile = files.find(f =>
      f.original_file_name === `${documentId}_changes.txt` ||
      f.original_file_name?.includes(`${documentId}_changes`)
    )

    if (!summaryFile) {
      console.log('No existing change summary found for document:', documentId)
      return { success: true }
    }

    const deleteUrl = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}/data/${summaryFile.hash}`
    const response = await fetch(deleteUrl, { method: 'DELETE' })

    if (response.ok) {
      console.log('✓ Old change summary deleted from LlamaFarm:', documentId)
    }
    return { success: response.ok }
  } catch (error) {
    console.error('Change summary delete error:', error.message)
    return { success: false, error: error.message }
  }
}

// ============================================
// Document Processing Helpers
// ============================================

// Format compare result into searchable text for RAG
function formatChangeSummary(docName, shortTitle, compareResult) {
  const lines = [
    `DOCUMENT CHANGES: ${docName}`,
    `Short Title: ${shortTitle || 'N/A'}`,
    `Updated: ${compareResult.new_version?.created_at || new Date().toISOString()}`,
    `Updated By: ${compareResult.new_version?.uploaded_by || 'Unknown'}`,
    '',
    'SUMMARY OF CHANGES:',
    compareResult.summary || 'No summary available.',
    '',
    'DETAILED CHANGES:'
  ]

  if (compareResult.changes && compareResult.changes.length > 0) {
    for (const change of compareResult.changes) {
      lines.push(`- ${change.type.toUpperCase()}: ${change.section}`)
      lines.push(`  ${change.summary}`)
    }
  } else {
    lines.push('No detailed changes recorded.')
  }

  return lines.join('\n')
}

// Store change summary in LlamaFarm RAG (replaces any existing summary)
async function storeChangeSummary(sessionId, documentId, docName, shortTitle, oldVersionId, newVersionId) {
  try {
    if (!oldVersionId) {
      console.log('Skipping change summary - first version, nothing to compare')
      return { success: true, skipped: true }
    }

    const metadata = loadMetadata(sessionId)
    const doc = metadata.documents.find(d => d.id === documentId)
    if (!doc) {
      console.log('Document not found for change summary')
      return { success: false, error: 'Document not found' }
    }

    const oldVersion = doc.versions.find(v => v.id === oldVersionId)
    const newVersion = doc.versions.find(v => v.id === newVersionId)

    if (!oldVersion || !newVersion) {
      console.log('Versions not found for change summary')
      return { success: false, error: 'Versions not found' }
    }

    const oldFilePath = resolveFilePath(oldVersion.filename)
    const newFilePath = resolveFilePath(newVersion.filename)

    if (!oldFilePath || !newFilePath) {
      console.log('PDF files not found for change summary')
      return { success: false, error: 'PDF files not found' }
    }

    const [oldText, newText] = await Promise.all([
      extractPdfText(oldFilePath),
      extractPdfText(newFilePath)
    ])

    if (!oldText || !newText) {
      console.log('Could not extract PDF text for change summary')
      return { success: false, error: 'PDF extraction failed' }
    }

    const changes = computeTextDiff(oldText, newText)
    const summary = await generateChangeSummary(changes, docName)

    const compareResult = {
      summary,
      changes,
      new_version: newVersion,
      old_version: oldVersion
    }

    await deleteChangeSummaryFromLlamaFarm(documentId)

    const summaryText = formatChangeSummary(docName, shortTitle, compareResult)
    const filename = `${documentId}_changes.txt`
    const uploadResult = await uploadTextToLlamaFarm(summaryText, filename)

    if (uploadResult.success) {
      console.log('✓ Change summary stored in RAG for document:', docName)
    }

    return uploadResult
  } catch (error) {
    console.error('Store change summary error:', error.message)
    return { success: false, error: error.message }
  }
}

// Extract text from PDF file (using pdf-parse v2.x API)
async function extractPdfText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath)
    const uint8Array = new Uint8Array(dataBuffer)
    const parser = new PDFParse(uint8Array)
    await parser.load()
    const result = await parser.getText()
    const texts = result.pages.map(page => page.text).filter(Boolean)
    return texts.join('\n\n')
  } catch (error) {
    console.error('PDF extraction error:', error.message)
    return null
  }
}

// Split text into sections (by page markers or paragraphs)
function splitIntoSections(text) {
  const pagePattern = /(?:--- Page \d+ ---|\n{3,})/g
  const sections = text.split(pagePattern).filter(s => s.trim().length > 50)

  if (sections.length < 3) {
    return text.split(/\n\n+/).filter(s => s.trim().length > 30).slice(0, 50)
  }

  return sections.slice(0, 50)
}

// Compute diff between two texts
function computeTextDiff(oldText, newText) {
  const normalizedOld = oldText.replace(/\s+/g, ' ').trim()
  const normalizedNew = newText.replace(/\s+/g, ' ').trim()

  const diff = fastDiff(normalizedOld, normalizedNew)

  const changes = []
  let changeIndex = 0

  for (const [type, text] of diff) {
    if (type === 0) continue

    const trimmedText = text.trim()
    if (trimmedText.length < 10) continue

    const sectionTitle = trimmedText.substring(0, 60) + (trimmedText.length > 60 ? '...' : '')
    const sentences = trimmedText.split(/[.!?]\s+/).filter(s => s.length > 5).length

    changes.push({
      section: `Section ${++changeIndex}: ${sectionTitle}`,
      type: type === 1 ? 'added' : 'removed',
      summary: type === 1
        ? `New content added (~${sentences} sentences)`
        : `Content removed (~${sentences} sentences)`,
      before: type === -1 ? trimmedText.substring(0, 500) : undefined,
      after: type === 1 ? trimmedText.substring(0, 500) : undefined
    })
  }

  return changes.slice(0, 15)
}

// Generate AI summary of changes using LlamaFarm
async function generateChangeSummary(changes, docName) {
  if (changes.length === 0) {
    return `No significant content changes detected between versions of "${docName}". The document may have formatting or metadata updates.`
  }

  try {
    const changesText = changes.map((c, i) =>
      `${i + 1}. ${c.type.toUpperCase()}: ${c.section} - ${c.summary}`
    ).join('\n')

    const response = await fetch(`${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Summarize these changes to the document "${docName}" in 1-2 sentences for a policy administrator:\n\n${changesText}`
        }],
        max_tokens: 150,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      return `${changes.length} change${changes.length === 1 ? '' : 's'} detected in the document.`
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || `${changes.length} change${changes.length === 1 ? '' : 's'} detected in the document.`
  } catch (error) {
    console.error('AI summary error:', error.message)
    return `${changes.length} change${changes.length === 1 ? '' : 's'} detected in the document.`
  }
}

// ============================================
// Match Detection Helpers
// ============================================

function extractDocNumber(text) {
  if (!text) return null
  const match = text.match(/(\d{1,3})-(\d{1,5})/)
  return match ? match[0] : null
}

function normalizeString(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitleFromText(text) {
  if (!text) return null
  const lines = text.split('\n').filter(l => l.trim().length > 10)
  for (const line of lines.slice(0, 20)) {
    const trimmed = line.trim()
    if (trimmed.length > 15 && trimmed.length < 200 &&
        !trimmed.match(/^(page|date|department|headquarters|air force)/i) &&
        !trimmed.match(/^\d+$/) &&
        !trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
      return trimmed
    }
  }
  return null
}

function calculateMatchScore(uploadedFilename, existingDoc, extractedText) {
  let score = 0
  const signals = []

  if (extractedText && existingDoc.short_title) {
    const supersedesPattern = /supersedes[:\s]+(?:DAFI|AFI|AFPD|AFH|AETCI|JBSAI|MDWI)?\s*(\d{1,3}-\d{1,5})/gi
    const matches = extractedText.match(supersedesPattern)
    if (matches) {
      for (const match of matches) {
        const docNum = extractDocNumber(match)
        const existingDocNum = extractDocNumber(existingDoc.short_title)
        if (docNum && existingDocNum && docNum === existingDocNum) {
          score += 60
          signals.push({ type: 'supersedes', weight: 60, detail: `Supersedes ${existingDoc.short_title}` })
          break
        }
      }
    }
  }

  const uploadedDocNum = extractDocNumber(uploadedFilename) || extractDocNumber(extractedText?.substring(0, 2000))
  const existingDocNum = extractDocNumber(existingDoc.short_title) || extractDocNumber(existingDoc.name)
  if (uploadedDocNum && existingDocNum && uploadedDocNum === existingDocNum) {
    score += 50
    signals.push({ type: 'document_number', weight: 50, detail: `Document number ${uploadedDocNum}` })
  }

  const existingFilename = existingDoc.versions?.[0]?.original_name || existingDoc.name
  const filenameSimilarity = stringSimilarity.compareTwoStrings(
    normalizeString(uploadedFilename),
    normalizeString(existingFilename)
  )
  const filenameScore = Math.round(filenameSimilarity * 40)
  if (filenameScore > 8) {
    score += filenameScore
    signals.push({ type: 'filename', weight: filenameScore, similarity: filenameSimilarity })
  }

  const titleFromPdf = extractTitleFromText(extractedText)
  const titleToCompare = titleFromPdf || uploadedFilename
  const titleSimilarity = stringSimilarity.compareTwoStrings(
    normalizeString(titleToCompare),
    normalizeString(existingDoc.name)
  )
  const titleScore = Math.round(titleSimilarity * 30)
  if (titleScore > 6) {
    score += titleScore
    signals.push({ type: 'title', weight: titleScore, similarity: titleSimilarity })
  }

  if (score > 0) {
    console.log(`Match score for "${existingDoc.name}": ${score}`, signals)
  }

  return { score, signals }
}

function getConfidenceLevel(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  if (score >= 20) return 'low'
  return null
}

// ============================================
// Demo Limit Helpers
// ============================================

function getSessionUsage(sessionId) {
  const metadata = loadMetadata(sessionId)
  const documentCount = metadata.documents.length

  let totalStorage = 0
  for (const doc of metadata.documents) {
    for (const version of doc.versions) {
      totalStorage += version.size || 0
    }
  }

  return {
    documents: { current: documentCount, max: DEMO_MAX_DOCUMENTS },
    storage: { current_bytes: totalStorage, max_bytes: DEMO_MAX_STORAGE_BYTES },
    can_upload: documentCount < DEMO_MAX_DOCUMENTS && totalStorage < DEMO_MAX_STORAGE_BYTES
  }
}

function checkUploadLimits(sessionId, isNewDocument = true) {
  const usage = getSessionUsage(sessionId)

  if (isNewDocument && usage.documents.current >= usage.documents.max) {
    return { allowed: false, error: `Document limit reached (${usage.documents.max}). Reset the demo or delete documents to continue.` }
  }

  if (usage.storage.current_bytes >= usage.storage.max_bytes) {
    return { allowed: false, error: `Storage limit reached (${Math.round(usage.storage.max_bytes / 1024 / 1024)}MB). Reset the demo or delete documents to continue.` }
  }

  return { allowed: true }
}

// ============================================
// API Routes
// ============================================

// Serve policy PDF files directly by filename
app.get('/v1/projects/:namespace/:project/policies/:filename', (req, res) => {
  const filePath = resolveFilePath(req.params.filename)

  if (!filePath) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`)
  res.sendFile(filePath)
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', sessions: sessions.size })
})

// List all documents
app.get('/v1/projects/:namespace/:project/documents/', (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  res.json({
    total: metadata.documents.length,
    documents: metadata.documents
  })
})

// Get single document
app.get('/v1/projects/:namespace/:project/documents/:documentId', (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  const doc = metadata.documents.find(d => d.id === req.params.documentId)
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' })
  }
  res.json({ document: doc })
})

// Create new document (upload)
app.post('/v1/projects/:namespace/:project/documents/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  // Check demo limits
  const limitCheck = checkUploadLimits(req.sessionId, true)
  if (!limitCheck.allowed) {
    // Clean up uploaded file
    try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)) } catch {}
    return res.status(400).json({ error: limitCheck.error })
  }

  const metadata = loadMetadata(req.sessionId)
  const now = new Date().toISOString()
  const versionId = uuidv4()
  const documentId = uuidv4()
  const docName = req.body.name || req.file.originalname.replace('.pdf', '')

  const document = {
    id: documentId,
    name: docName,
    short_title: req.body.short_title || null,
    current_version_id: versionId,
    created_at: now,
    updated_at: now,
    versions: [{
      id: versionId,
      filename: req.file.filename,
      original_name: req.file.originalname,
      uploaded_by: req.body.uploaded_by || 'Unknown',
      notes: req.body.notes || null,
      created_at: now,
      size: req.file.size
    }]
  }

  metadata.documents.push(document)
  saveMetadata(req.sessionId, metadata)

  // Track uploaded file for session cleanup
  getSession(req.sessionId).uploadedFiles.push(req.file.filename)

  // Skip LlamaFarm upload for demo sessions (RAG uses shared seed data only)
  res.status(201).json({
    document: {
      id: document.id,
      name: document.name,
      short_title: document.short_title,
      current_version_id: document.current_version_id,
      created_at: document.created_at,
      updated_at: document.updated_at
    },
    version: document.versions[0],
    rag_status: 'demo_mode'
  })
})

// Upload new version (as pending - requires approval)
app.post('/v1/projects/:namespace/:project/documents/:documentId/versions', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  // Check storage limits (not document count - adding version, not new doc)
  const limitCheck = checkUploadLimits(req.sessionId, false)
  if (!limitCheck.allowed) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)) } catch {}
    return res.status(400).json({ error: limitCheck.error })
  }

  const metadata = loadMetadata(req.sessionId)
  const docIndex = metadata.documents.findIndex(d => d.id === req.params.documentId)

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const now = new Date().toISOString()
  const versionId = uuidv4()
  const doc = metadata.documents[docIndex]

  const version = {
    id: versionId,
    filename: req.file.filename,
    original_name: req.file.originalname,
    uploaded_by: req.body.uploaded_by || 'Unknown',
    notes: req.body.notes || null,
    created_at: now,
    size: req.file.size,
    status: 'pending'
  }

  // Pre-compute diff and summary at upload time
  const previousVersion = doc.versions.find(v => v.id === doc.current_version_id)
  if (previousVersion) {
    try {
      const oldFilePath = resolveFilePath(previousVersion.filename)
      const newFilePath = path.join(UPLOADS_DIR, req.file.filename)

      if (oldFilePath && fs.existsSync(newFilePath)) {
        const [oldText, newText] = await Promise.all([
          extractPdfText(oldFilePath),
          extractPdfText(newFilePath)
        ])

        if (oldText && newText) {
          const changes = computeTextDiff(oldText, newText)
          const summary = await generateChangeSummary(changes, doc.name)

          const stats = {
            added: changes.filter(c => c.type === 'added').length,
            removed: changes.filter(c => c.type === 'removed').length
          }

          version.diff = { changes, stats }
          version.summary = summary
          console.log(`✓ Pre-computed diff and summary for version ${versionId}`)
        }
      }
    } catch (error) {
      console.error('Failed to pre-compute diff/summary:', error.message)
    }
  }

  metadata.documents[docIndex].versions.push(version)
  saveMetadata(req.sessionId, metadata)

  // Track uploaded file for session cleanup
  getSession(req.sessionId).uploadedFiles.push(req.file.filename)

  res.status(201).json({
    version,
    previous_version_id: doc.current_version_id,
    message: 'Version uploaded - pending review'
  })
})

// Approve a pending version
app.post('/v1/projects/:namespace/:project/documents/:documentId/versions/:versionId/approve', async (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  const docIndex = metadata.documents.findIndex(d => d.id === req.params.documentId)

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const doc = metadata.documents[docIndex]
  const versionIndex = doc.versions.findIndex(v => v.id === req.params.versionId)

  if (versionIndex === -1) {
    return res.status(404).json({ error: 'Version not found' })
  }

  const version = doc.versions[versionIndex]
  const now = new Date().toISOString()
  const previousVersionId = doc.current_version_id

  metadata.documents[docIndex].versions[versionIndex].status = 'published'
  metadata.documents[docIndex].current_version_id = req.params.versionId
  metadata.documents[docIndex].updated_at = now
  saveMetadata(req.sessionId, metadata)

  // Skip LlamaFarm operations for demo sessions
  res.json({
    message: 'Version approved and published',
    version: metadata.documents[docIndex].versions[versionIndex],
    rag_status: 'demo_mode'
  })
})

// Reject a pending version
app.delete('/v1/projects/:namespace/:project/documents/:documentId/versions/:versionId', (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  const docIndex = metadata.documents.findIndex(d => d.id === req.params.documentId)

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const doc = metadata.documents[docIndex]
  const versionIndex = doc.versions.findIndex(v => v.id === req.params.versionId)

  if (versionIndex === -1) {
    return res.status(404).json({ error: 'Version not found' })
  }

  const version = doc.versions[versionIndex]

  if (version.status !== 'pending') {
    return res.status(400).json({ error: 'Can only reject pending versions' })
  }

  // Delete the uploaded file (only if it's in uploads dir, not seed)
  const filePath = path.join(UPLOADS_DIR, version.filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  metadata.documents[docIndex].versions.splice(versionIndex, 1)
  saveMetadata(req.sessionId, metadata)

  res.json({ message: 'Pending version rejected and deleted' })
})

// List versions for a document
app.get('/v1/projects/:namespace/:project/documents/:documentId/versions', (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  const doc = metadata.documents.find(d => d.id === req.params.documentId)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' })
  }

  res.json({
    document_id: doc.id,
    total: doc.versions.length,
    versions: doc.versions
  })
})

// View/download document file
app.get('/v1/projects/:namespace/:project/documents/:documentId/file', (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  const doc = metadata.documents.find(d => d.id === req.params.documentId)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const versionId = req.query.version_id || doc.current_version_id
  const version = doc.versions.find(v => v.id === versionId)

  if (!version) {
    return res.status(404).json({ error: 'Version not found' })
  }

  const filePath = resolveFilePath(version.filename)
  if (!filePath) {
    return res.status(404).json({ error: 'File not found on disk' })
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${version.original_name}"`)
  res.sendFile(filePath)
})

// Delete document
app.delete('/v1/projects/:namespace/:project/documents/:documentId', async (req, res) => {
  const metadata = loadMetadata(req.sessionId)
  const docIndex = metadata.documents.findIndex(d => d.id === req.params.documentId)

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const doc = metadata.documents[docIndex]

  // Only delete uploaded files (not seed files)
  for (const version of doc.versions) {
    const uploadPath = path.join(UPLOADS_DIR, version.filename)
    if (fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath)
    }
  }

  metadata.documents.splice(docIndex, 1)
  saveMetadata(req.sessionId, metadata)

  res.json({ message: 'Document deleted' })
})

// Compare two versions of a document
app.get('/v1/projects/:namespace/:project/documents/:documentId/compare', async (req, res) => {
  const { oldVersionId, newVersionId } = req.query

  if (!oldVersionId || !newVersionId) {
    return res.status(400).json({ error: 'Both oldVersionId and newVersionId are required' })
  }

  const metadata = loadMetadata(req.sessionId)
  const doc = metadata.documents.find(d => d.id === req.params.documentId)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const oldVersion = doc.versions.find(v => v.id === oldVersionId)
  const newVersion = doc.versions.find(v => v.id === newVersionId)

  if (!oldVersion || !newVersion) {
    return res.status(404).json({ error: 'One or both versions not found' })
  }

  // Return pre-computed data if available
  if (newVersion.diff && newVersion.summary) {
    console.log(`Returning pre-computed diff for version ${newVersionId}`)
    return res.json({
      document_id: doc.id,
      document_name: doc.name,
      old_version_id: oldVersionId,
      new_version_id: newVersionId,
      old_version: oldVersion,
      new_version: newVersion,
      total_changes: newVersion.diff.changes.length,
      summary: newVersion.summary,
      changes: newVersion.diff.changes,
      compared_at: new Date().toISOString(),
      precomputed: true
    })
  }

  // Fallback: compute on-demand
  console.log(`Computing diff on-demand for version ${newVersionId}`)

  const oldFilePath = resolveFilePath(oldVersion.filename)
  const newFilePath = resolveFilePath(newVersion.filename)

  if (!oldFilePath || !newFilePath) {
    const fallbackSummary = newVersion.notes || 'No change details available — PDF files not found on disk.'
    return res.json({
      document_id: doc.id,
      document_name: doc.name,
      old_version_id: oldVersionId,
      new_version_id: newVersionId,
      old_version: oldVersion,
      new_version: newVersion,
      total_changes: 0,
      summary: fallbackSummary,
      changes: [],
      compared_at: new Date().toISOString(),
      precomputed: false
    })
  }

  const [oldText, newText] = await Promise.all([
    extractPdfText(oldFilePath),
    extractPdfText(newFilePath)
  ])

  if (!oldText || !newText) {
    return res.status(500).json({ error: 'Failed to extract text from PDFs' })
  }

  const changes = computeTextDiff(oldText, newText)
  const summary = await generateChangeSummary(changes, doc.name)

  res.json({
    document_id: doc.id,
    document_name: doc.name,
    old_version_id: oldVersionId,
    new_version_id: newVersionId,
    old_version: oldVersion,
    new_version: newVersion,
    total_changes: changes.length,
    summary,
    changes,
    compared_at: new Date().toISOString(),
    precomputed: false
  })
})

// Detect potential matches for an uploaded document
app.post('/v1/projects/:namespace/:project/documents/detect-matches', upload.single('file'), async (req, res) => {
  const startTime = Date.now()
  console.log('=== Match Detection Request ===')

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  console.log('Uploaded file:', req.file.originalname)

  try {
    const filePath = path.join(UPLOADS_DIR, req.file.filename)
    const extractedText = await extractPdfText(filePath)
    console.log('Extracted text length:', extractedText?.length || 0)

    const metadata = loadMetadata(req.sessionId)
    const existingDocs = metadata.documents
    console.log('Existing documents to check:', existingDocs.length)

    const matches = []
    for (const doc of existingDocs) {
      const { score, signals } = calculateMatchScore(
        req.file.originalname,
        doc,
        extractedText
      )

      const confidence = getConfidenceLevel(score)
      if (confidence) {
        matches.push({
          document: {
            id: doc.id,
            name: doc.name,
            short_title: doc.short_title,
            updated_at: doc.updated_at,
            current_version_id: doc.current_version_id
          },
          score,
          confidence,
          signals
        })
      }
    }

    matches.sort((a, b) => b.score - a.score)
    const topMatches = matches.slice(0, 3)

    const extractedDocNumber = extractDocNumber(req.file.originalname) || extractDocNumber(extractedText?.substring(0, 2000))
    const extractedTitle = extractTitleFromText(extractedText)

    // Clean up the uploaded file (it was just for analysis)
    fs.unlinkSync(filePath)

    res.json({
      matches: topMatches,
      extracted_title: extractedTitle,
      extracted_doc_number: extractedDocNumber,
      analysis_time_ms: Date.now() - startTime
    })
  } catch (error) {
    console.error('Match detection error:', error)
    try {
      const filePath = path.join(UPLOADS_DIR, req.file.filename)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {}
    res.status(500).json({ error: 'Failed to analyze document' })
  }
})

// ============================================
// Digest API - Weekly/Monthly Policy Summaries
// ============================================

app.get('/v1/projects/:namespace/:project/digest', (req, res) => {
  const { period, year, week, month } = req.query

  if (!period || !['week', 'month'].includes(period)) {
    return res.status(400).json({ error: 'period must be "week" or "month"' })
  }

  let parsedYear = parseInt(year, 10)
  let parsedPeriodNum

  if (period === 'week') {
    if (!year || !week) {
      const prev = getPreviousWeek()
      parsedYear = prev.year
      parsedPeriodNum = prev.week
    } else {
      parsedPeriodNum = parseInt(week, 10)
      if (isNaN(parsedPeriodNum) || parsedPeriodNum < 1 || parsedPeriodNum > 53) {
        return res.status(400).json({ error: 'week must be a number between 1 and 53' })
      }
    }
  } else {
    if (!year || !month) {
      const prev = getPreviousMonth()
      parsedYear = prev.year
      parsedPeriodNum = prev.month
    } else {
      parsedPeriodNum = parseInt(month, 10)
      if (isNaN(parsedPeriodNum) || parsedPeriodNum < 1 || parsedPeriodNum > 12) {
        return res.status(400).json({ error: 'month must be a number between 1 and 12' })
      }
    }
  }

  if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    return res.status(400).json({ error: 'year must be a valid 4-digit year' })
  }

  const validation = validateArchiveLimit(period, parsedYear, parsedPeriodNum)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason })
  }

  const bounds = period === 'week'
    ? getWeekBounds(parsedYear, parsedPeriodNum)
    : getMonthBounds(parsedYear, parsedPeriodNum)

  const metadata = loadMetadata(req.sessionId)
  const { documents, stats } = computeDigest(metadata.documents, bounds.start, bounds.end)

  const periodInfo = {
    type: period,
    year: parsedYear,
    ...(period === 'week' ? { week: parsedPeriodNum } : { month: parsedPeriodNum }),
    start_date: bounds.start.toISOString().split('T')[0],
    end_date: bounds.end.toISOString().split('T')[0],
    label: formatPeriodLabel(period, bounds.start, bounds.end, parsedYear, parsedPeriodNum)
  }

  res.json({
    period: periodInfo,
    stats,
    documents
  })
})

// ============================================
// Demo Features API
// ============================================

// Get demo limits and usage for current session
app.get('/v1/projects/:namespace/:project/limits', (req, res) => {
  res.json(getSessionUsage(req.sessionId))
})

// Reset session to seed state
app.post('/v1/projects/:namespace/:project/reset', (req, res) => {
  const session = getSession(req.sessionId)

  // Clean up uploaded files for this session
  let filesDeleted = 0
  for (const filename of session.uploadedFiles) {
    const filePath = path.join(UPLOADS_DIR, filename)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        filesDeleted++
      }
    } catch {}
  }

  // Reset session to fresh seed data
  session.metadata = JSON.parse(JSON.stringify(seedMetadata))
  session.uploadedFiles = []

  console.log(`Session ${req.sessionId} reset to seed (${filesDeleted} files cleaned up)`)

  res.json({
    message: 'Demo reset to original state',
    documents_restored: seedMetadata.documents.length,
    files_cleaned: filesDeleted
  })
})

// List available sample documents
app.get('/v1/projects/:namespace/:project/samples', (req, res) => {
  if (!fs.existsSync(SEED_SAMPLES_MANIFEST)) {
    return res.json({ samples: [] })
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(SEED_SAMPLES_MANIFEST, 'utf-8'))
    const metadata = loadMetadata(req.sessionId)

    const samples = manifest.samples.map(sample => {
      let alreadyAdded = false

      if (sample.type === 'new_document') {
        // Check if a document with matching name or short_title exists
        alreadyAdded = metadata.documents.some(doc =>
          doc.name === sample.title ||
          (sample.short_title && doc.short_title === sample.short_title)
        )
      } else if (sample.type === 'version_update') {
        // Check if the target document already has a version with this filename
        const targetDoc = metadata.documents.find(doc =>
          doc.name === sample.target_document_name
        )
        if (targetDoc) {
          alreadyAdded = targetDoc.versions.some(v =>
            v.original_name === sample.filename ||
            v.notes?.includes(sample.id)
          )
        }
      }

      return { ...sample, already_added: alreadyAdded }
    })

    res.json({ samples })
  } catch (error) {
    console.error('Failed to load samples manifest:', error.message)
    res.status(500).json({ error: 'Failed to load sample documents' })
  }
})

// Add a sample document to the session
app.post('/v1/projects/:namespace/:project/samples/:sampleId/add', async (req, res) => {
  if (!fs.existsSync(SEED_SAMPLES_MANIFEST)) {
    return res.status(404).json({ error: 'No samples available' })
  }

  const manifest = JSON.parse(fs.readFileSync(SEED_SAMPLES_MANIFEST, 'utf-8'))
  const sample = manifest.samples.find(s => s.id === req.params.sampleId)

  if (!sample) {
    return res.status(404).json({ error: 'Sample not found' })
  }

  const sampleFilePath = path.join(SEED_SAMPLES_DIR, sample.filename)
  if (!fs.existsSync(sampleFilePath)) {
    return res.status(404).json({ error: 'Sample PDF file not found' })
  }

  // Check limits
  const isNewDoc = sample.type === 'new_document'
  const limitCheck = checkUploadLimits(req.sessionId, isNewDoc)
  if (!limitCheck.allowed) {
    return res.status(400).json({ error: limitCheck.error })
  }

  const metadata = loadMetadata(req.sessionId)
  const now = new Date().toISOString()

  // Copy sample PDF to uploads directory with timestamp
  const destFilename = `${Date.now()}-${sample.filename}`
  const destPath = path.join(UPLOADS_DIR, destFilename)
  fs.copyFileSync(sampleFilePath, destPath)
  getSession(req.sessionId).uploadedFiles.push(destFilename)

  const fileSize = fs.statSync(destPath).size

  if (sample.type === 'new_document') {
    const documentId = uuidv4()
    const versionId = uuidv4()

    const document = {
      id: documentId,
      name: sample.title,
      short_title: sample.short_title || null,
      current_version_id: versionId,
      created_at: now,
      updated_at: now,
      scope: sample.scope || null,
      versions: [{
        id: versionId,
        filename: destFilename,
        original_name: sample.filename,
        uploaded_by: sample.uploaded_by || 'Demo User',
        notes: sample.description,
        created_at: now,
        size: fileSize,
        status: 'published'
      }]
    }

    metadata.documents.push(document)
    saveMetadata(req.sessionId, metadata)

    res.status(201).json({
      message: 'Sample document added',
      document: {
        id: document.id,
        name: document.name,
        short_title: document.short_title
      },
      type: 'new_document'
    })
  } else if (sample.type === 'version_update') {
    // Find the target document
    const targetDoc = metadata.documents.find(doc =>
      doc.name === sample.target_document_name
    )

    if (!targetDoc) {
      // Clean up copied file
      try { fs.unlinkSync(destPath) } catch {}
      return res.status(404).json({ error: `Target document "${sample.target_document_name}" not found` })
    }

    const versionId = uuidv4()

    // Pre-compute diff if possible
    let diff = null
    let summary = null
    const previousVersion = targetDoc.versions.find(v => v.id === targetDoc.current_version_id)
    if (previousVersion) {
      try {
        const oldFilePath = resolveFilePath(previousVersion.filename)
        if (oldFilePath) {
          const [oldText, newText] = await Promise.all([
            extractPdfText(oldFilePath),
            extractPdfText(destPath)
          ])
          if (oldText && newText) {
            const changes = computeTextDiff(oldText, newText)
            summary = await generateChangeSummary(changes, targetDoc.name)
            diff = {
              changes,
              stats: {
                added: changes.filter(c => c.type === 'added').length,
                removed: changes.filter(c => c.type === 'removed').length
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to compute diff for sample:', error.message)
      }
    }

    const version = {
      id: versionId,
      filename: destFilename,
      original_name: sample.filename,
      uploaded_by: sample.uploaded_by || 'Demo User',
      notes: sample.description,
      created_at: now,
      size: fileSize,
      status: 'pending',
      ...(diff && { diff }),
      ...(summary && { summary })
    }

    const docIndex = metadata.documents.findIndex(d => d.id === targetDoc.id)
    metadata.documents[docIndex].versions.push(version)
    saveMetadata(req.sessionId, metadata)

    res.status(201).json({
      message: 'Sample version added (pending approval)',
      version,
      document_id: targetDoc.id,
      type: 'version_update'
    })
  }
})

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`RegSync API server running on http://localhost:${PORT}`)
  console.log(`Seed data: ${seedMetadata.documents.length} documents from ${SEED_DIR}`)
  console.log(`User uploads: ${UPLOADS_DIR}`)
  console.log(`LlamaFarm RAG: ${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`)
  console.log(`Demo limits: ${DEMO_MAX_DOCUMENTS} docs, ${DEMO_MAX_STORAGE_BYTES / 1024 / 1024}MB storage`)
})
