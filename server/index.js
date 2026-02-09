/**
 * RegSync Local API Server
 * Document management backend with LlamaFarm RAG integration
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
const POLICIES_DIR = path.join(DATA_DIR, 'policies')
const METADATA_FILE = path.join(DATA_DIR, 'documents.json')

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(POLICIES_DIR)) fs.mkdirSync(POLICIES_DIR, { recursive: true })

// Initialize metadata file
if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify({ documents: [] }, null, 2))
}

// Middleware
app.use(cors())
app.use(express.json())

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, POLICIES_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB limit

// Helper functions
function loadMetadata() {
  try {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'))
  } catch {
    return { documents: [] }
  }
}

function saveMetadata(data) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2))
}

// Delete file from LlamaFarm RAG dataset by filename
async function deleteFromLlamaFarm(filename) {
  try {
    // First, get the file hash from LlamaFarm by looking up the filename
    const listUrl = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`
    const listResponse = await fetch(listUrl)

    if (!listResponse.ok) {
      console.error('Failed to list LlamaFarm files')
      return { success: false, error: 'Failed to list files' }
    }

    const dataset = await listResponse.json()
    const files = dataset.details?.files_metadata || []

    // Find the file by matching the filename (it might have timestamp prefix)
    const file = files.find(f =>
      f.original_file_name === filename ||
      f.original_file_name.endsWith(filename) ||
      filename.endsWith(f.original_file_name.replace(/^\d+-/, ''))
    )

    if (!file) {
      console.log('File not found in LlamaFarm:', filename)
      return { success: true } // Not an error if file doesn't exist
    }

    // Delete by file hash
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
    // Use native FormData with Blob for better compatibility
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

    // Find change summary file for this document (pattern: {documentId}_changes.txt)
    const summaryFile = files.find(f =>
      f.original_file_name === `${documentId}_changes.txt` ||
      f.original_file_name?.includes(`${documentId}_changes`)
    )

    if (!summaryFile) {
      console.log('No existing change summary found for document:', documentId)
      return { success: true } // Not an error
    }

    // Delete by file hash
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
async function storeChangeSummary(documentId, docName, shortTitle, oldVersionId, newVersionId) {
  try {
    // Skip if this is the first version (nothing to compare)
    if (!oldVersionId) {
      console.log('Skipping change summary - first version, nothing to compare')
      return { success: true, skipped: true }
    }

    // Get comparison data by calling the compare logic directly
    const metadata = loadMetadata()
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

    // Extract text from both PDFs
    const oldFilePath = path.join(POLICIES_DIR, oldVersion.filename)
    const newFilePath = path.join(POLICIES_DIR, newVersion.filename)

    if (!fs.existsSync(oldFilePath) || !fs.existsSync(newFilePath)) {
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

    // Compute diff and generate summary
    const changes = computeTextDiff(oldText, newText)
    const summary = await generateChangeSummary(changes, docName)

    const compareResult = {
      summary,
      changes,
      new_version: newVersion,
      old_version: oldVersion
    }

    // Delete any existing change summary for this document
    await deleteChangeSummaryFromLlamaFarm(documentId)

    // Format and upload new summary
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

// Serve policy PDF files directly by filename
// This allows the DocumentViewer to access PDFs using just the filename from RAG results
app.get('/v1/projects/:namespace/:project/policies/:filename', (req, res) => {
  const filePath = path.join(POLICIES_DIR, req.params.filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  // Set headers to display inline (in browser) rather than download
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`)
  res.sendFile(filePath)
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' })
})

// List all documents
app.get('/v1/projects/:namespace/:project/documents/', (req, res) => {
  const metadata = loadMetadata()
  res.json({
    total: metadata.documents.length,
    documents: metadata.documents
  })
})

// Get single document
app.get('/v1/projects/:namespace/:project/documents/:documentId', (req, res) => {
  const metadata = loadMetadata()
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

  const metadata = loadMetadata()
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
  saveMetadata(metadata)

  // Also upload to LlamaFarm for RAG processing
  const filePath = path.join(POLICIES_DIR, req.file.filename)
  const llamaResult = await uploadToLlamaFarm(filePath, req.file.originalname, {
    document_name: docName,
    short_title: req.body.short_title,
    uploaded_by: req.body.uploaded_by,
    document_id: documentId
  })

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
    rag_status: llamaResult.success ? 'processed' : 'pending',
    rag_error: llamaResult.success ? null : llamaResult.error
  })
})

// Upload new version (as pending - requires approval)
app.post('/v1/projects/:namespace/:project/documents/:documentId/versions', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const metadata = loadMetadata()
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
    status: 'pending' // New versions start as pending
  }

  // Pre-compute diff and summary at upload time (since content is immutable)
  const previousVersion = doc.versions.find(v => v.id === doc.current_version_id)
  if (previousVersion) {
    try {
      const oldFilePath = path.join(POLICIES_DIR, previousVersion.filename)
      const newFilePath = path.join(POLICIES_DIR, req.file.filename)

      if (fs.existsSync(oldFilePath) && fs.existsSync(newFilePath)) {
        const [oldText, newText] = await Promise.all([
          extractPdfText(oldFilePath),
          extractPdfText(newFilePath)
        ])

        if (oldText && newText) {
          const changes = computeTextDiff(oldText, newText)
          const summary = await generateChangeSummary(changes, doc.name)

          // Count added/removed from changes
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
      // Continue without pre-computed data - compare endpoint will compute on-demand
    }
  }

  metadata.documents[docIndex].versions.push(version)
  // Don't update current_version_id yet - wait for approval
  saveMetadata(metadata)

  res.status(201).json({
    version,
    previous_version_id: doc.current_version_id,
    message: 'Version uploaded - pending review'
  })
})

// Approve a pending version
app.post('/v1/projects/:namespace/:project/documents/:documentId/versions/:versionId/approve', async (req, res) => {
  const metadata = loadMetadata()
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

  // Capture previous version ID before updating (for change summary)
  const previousVersionId = doc.current_version_id

  // Update version status
  metadata.documents[docIndex].versions[versionIndex].status = 'published'
  metadata.documents[docIndex].current_version_id = req.params.versionId
  metadata.documents[docIndex].updated_at = now
  saveMetadata(metadata)

  // First, delete old document chunks from LlamaFarm RAG
  // This ensures users don't get answers from outdated document versions
  const deleteResult = await deleteFromLlamaFarm(req.params.documentId)
  if (deleteResult.success) {
    console.log('✓ Old RAG chunks cleaned up for document:', req.params.documentId)
  }

  // Now upload new version to LlamaFarm for RAG processing
  const filePath = path.join(POLICIES_DIR, version.filename)
  const llamaResult = await uploadToLlamaFarm(filePath, version.original_name, {
    document_name: doc.name,
    short_title: doc.short_title,
    uploaded_by: version.uploaded_by,
    document_id: req.params.documentId
  })

  // Store change summary in RAG (replaces any existing summary for this document)
  // This enables chat to answer "what changed" questions
  let changeSummaryResult = { success: false, skipped: true }
  if (llamaResult.success && previousVersionId) {
    changeSummaryResult = await storeChangeSummary(
      req.params.documentId,
      doc.name,
      doc.short_title,
      previousVersionId,
      req.params.versionId
    )
  }

  res.json({
    message: 'Version approved and published',
    version: metadata.documents[docIndex].versions[versionIndex],
    rag_status: llamaResult.success ? 'processed' : 'pending',
    rag_cleanup: deleteResult.success ? 'completed' : 'failed',
    change_summary: changeSummaryResult.success ? 'stored' : (changeSummaryResult.skipped ? 'skipped' : 'failed')
  })
})

// Reject a pending version
app.delete('/v1/projects/:namespace/:project/documents/:documentId/versions/:versionId', (req, res) => {
  const metadata = loadMetadata()
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

  // Only allow deleting pending versions
  if (version.status !== 'pending') {
    return res.status(400).json({ error: 'Can only reject pending versions' })
  }

  // Delete the file
  const filePath = path.join(POLICIES_DIR, version.filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  // Remove from versions array
  metadata.documents[docIndex].versions.splice(versionIndex, 1)
  saveMetadata(metadata)

  res.json({ message: 'Pending version rejected and deleted' })
})

// List versions for a document
app.get('/v1/projects/:namespace/:project/documents/:documentId/versions', (req, res) => {
  const metadata = loadMetadata()
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
  const metadata = loadMetadata()
  const doc = metadata.documents.find(d => d.id === req.params.documentId)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const versionId = req.query.version_id || doc.current_version_id
  const version = doc.versions.find(v => v.id === versionId)

  if (!version) {
    return res.status(404).json({ error: 'Version not found' })
  }

  const filePath = path.join(POLICIES_DIR, version.filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' })
  }

  // Set headers to display inline (in browser) rather than download
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${version.original_name}"`)
  res.sendFile(filePath)
})

// Delete document
app.delete('/v1/projects/:namespace/:project/documents/:documentId', async (req, res) => {
  const metadata = loadMetadata()
  const docIndex = metadata.documents.findIndex(d => d.id === req.params.documentId)

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' })
  }

  // Delete all version files from local storage and LlamaFarm
  const doc = metadata.documents[docIndex]
  for (const version of doc.versions) {
    const filePath = path.join(POLICIES_DIR, version.filename)
    // Try to delete from LlamaFarm RAG (by filename)
    await deleteFromLlamaFarm(version.filename)
    // Delete local file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  metadata.documents.splice(docIndex, 1)
  saveMetadata(metadata)

  res.json({ message: 'Document deleted' })
})

// Extract text from PDF file (using pdf-parse v2.x API)
async function extractPdfText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath)
    const uint8Array = new Uint8Array(dataBuffer)
    const parser = new PDFParse(uint8Array)
    await parser.load()
    const result = await parser.getText()
    // getText() returns { pages: [{ text: string }, ...] }
    const texts = result.pages.map(page => page.text).filter(Boolean)
    return texts.join('\n\n')
  } catch (error) {
    console.error('PDF extraction error:', error.message)
    return null
  }
}

// Split text into sections (by page markers or paragraphs)
function splitIntoSections(text) {
  // Split by page markers (common in PDFs)
  const pagePattern = /(?:--- Page \d+ ---|\n{3,})/g
  const sections = text.split(pagePattern).filter(s => s.trim().length > 50)

  // If no good splits, fall back to paragraph splitting
  if (sections.length < 3) {
    return text.split(/\n\n+/).filter(s => s.trim().length > 30).slice(0, 50)
  }

  return sections.slice(0, 50) // Limit to 50 sections
}

// Compute diff between two texts
function computeTextDiff(oldText, newText) {
  // Normalize whitespace for comparison (no 10KB truncation - process full documents)
  const normalizedOld = oldText.replace(/\s+/g, ' ').trim()
  const normalizedNew = newText.replace(/\s+/g, ' ').trim()

  // fast-diff returns: [[0, 'equal'], [-1, 'removed'], [1, 'added'], ...]
  // Types: -1 = DELETE, 0 = EQUAL, 1 = INSERT
  const diff = fastDiff(normalizedOld, normalizedNew)

  const changes = []
  let changeIndex = 0

  for (const [type, text] of diff) {
    if (type === 0) continue // Skip unchanged

    const trimmedText = text.trim()
    if (trimmedText.length < 10) continue // Skip tiny changes

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

  return changes.slice(0, 15) // Limit to 15 changes for UI
}

// Generate AI summary of changes using LlamaFarm
async function generateChangeSummary(changes, docName) {
  // Handle no changes case
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

// Compare two versions of a document
app.get('/v1/projects/:namespace/:project/documents/:documentId/compare', async (req, res) => {
  const { oldVersionId, newVersionId } = req.query

  if (!oldVersionId || !newVersionId) {
    return res.status(400).json({ error: 'Both oldVersionId and newVersionId are required' })
  }

  const metadata = loadMetadata()
  const doc = metadata.documents.find(d => d.id === req.params.documentId)

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' })
  }

  const oldVersion = doc.versions.find(v => v.id === oldVersionId)
  const newVersion = doc.versions.find(v => v.id === newVersionId)

  if (!oldVersion || !newVersion) {
    return res.status(404).json({ error: 'One or both versions not found' })
  }

  // Return pre-computed data if available (computed at upload time)
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

  // Fallback: compute on-demand for legacy versions without pre-computed data
  console.log(`Computing diff on-demand for version ${newVersionId} (no pre-computed data)`)

  // Extract text from both PDFs
  const oldFilePath = path.join(POLICIES_DIR, oldVersion.filename)
  const newFilePath = path.join(POLICIES_DIR, newVersion.filename)

  if (!fs.existsSync(oldFilePath) || !fs.existsSync(newFilePath)) {
    // For mock documents without actual PDFs, use version notes as summary
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

  // Compute diff
  const changes = computeTextDiff(oldText, newText)

  // Generate AI summary
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

// ============================================
// Smart Version Detection - Match Detection
// ============================================

// Extract document number like "36-2903" from text
function extractDocNumber(text) {
  if (!text) return null
  // Match patterns like 36-2903, 44-102, 31-101
  const match = text.match(/(\d{1,3})-(\d{1,5})/)
  return match ? match[0] : null
}

// Normalize string for comparison
function normalizeString(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Try to extract title from PDF text (first significant line)
function extractTitleFromText(text) {
  if (!text) return null
  const lines = text.split('\n').filter(l => l.trim().length > 10)
  // Look for title-like lines in first 20 lines
  for (const line of lines.slice(0, 20)) {
    const trimmed = line.trim()
    // Skip short lines, page numbers, dates, headers
    if (trimmed.length > 15 && trimmed.length < 200 &&
        !trimmed.match(/^(page|date|department|headquarters|air force)/i) &&
        !trimmed.match(/^\d+$/) &&
        !trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
      return trimmed
    }
  }
  return null
}

// Calculate match score between uploaded file and existing document
function calculateMatchScore(uploadedFilename, existingDoc, extractedText) {
  let score = 0
  const signals = []

  // Signal 1: "Supersedes" reference (60 points) - strongest signal
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

  // Signal 2: Document number match (50 points)
  const uploadedDocNum = extractDocNumber(uploadedFilename) || extractDocNumber(extractedText?.substring(0, 2000))
  const existingDocNum = extractDocNumber(existingDoc.short_title) || extractDocNumber(existingDoc.name)
  if (uploadedDocNum && existingDocNum && uploadedDocNum === existingDocNum) {
    score += 50
    signals.push({ type: 'document_number', weight: 50, detail: `Document number ${uploadedDocNum}` })
  }

  // Signal 3: Filename similarity (40 points max)
  const existingFilename = existingDoc.versions?.[0]?.original_name || existingDoc.name
  const filenameSimilarity = stringSimilarity.compareTwoStrings(
    normalizeString(uploadedFilename),
    normalizeString(existingFilename)
  )
  const filenameScore = Math.round(filenameSimilarity * 40)
  if (filenameScore > 8) {  // Lowered threshold from 15 to 8 (20% similarity)
    score += filenameScore
    signals.push({ type: 'filename', weight: filenameScore, similarity: filenameSimilarity })
  }

  // Signal 4: Title similarity (30 points max)
  const titleFromPdf = extractTitleFromText(extractedText)
  const titleToCompare = titleFromPdf || uploadedFilename
  const titleSimilarity = stringSimilarity.compareTwoStrings(
    normalizeString(titleToCompare),
    normalizeString(existingDoc.name)
  )
  const titleScore = Math.round(titleSimilarity * 30)
  if (titleScore > 6) {  // Lowered threshold from 10 to 6 (20% similarity)
    score += titleScore
    signals.push({ type: 'title', weight: titleScore, similarity: titleSimilarity })
  }

  // Debug logging
  if (score > 0) {
    console.log(`Match score for "${existingDoc.name}": ${score}`, signals)
  }

  return { score, signals }
}

// Get confidence level from score
function getConfidenceLevel(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  if (score >= 20) return 'low'  // Lowered from 25 to catch more potential matches
  return null
}

// Detect potential matches for an uploaded document
app.post('/v1/projects/:namespace/:project/documents/detect-matches', upload.single('file'), async (req, res) => {
  const startTime = Date.now()
  console.log('=== Match Detection Request ===')

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  console.log('Uploaded file:', req.file.originalname)

  try {
    // Extract text from uploaded PDF
    const filePath = path.join(POLICIES_DIR, req.file.filename)
    const extractedText = await extractPdfText(filePath)
    console.log('Extracted text length:', extractedText?.length || 0)

    // Load all existing documents
    const metadata = loadMetadata()
    const existingDocs = metadata.documents
    console.log('Existing documents to check:', existingDocs.length)

    // Score each document
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

    // Sort by score descending, take top 3
    matches.sort((a, b) => b.score - a.score)
    const topMatches = matches.slice(0, 3)

    // Extract metadata from uploaded file for display
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
    // Clean up file on error
    try {
      const filePath = path.join(POLICIES_DIR, req.file.filename)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {}
    res.status(500).json({ error: 'Failed to analyze document' })
  }
})

// ============================================
// Digest API - Weekly/Monthly Policy Summaries
// ============================================

// Get policy digest for a time period
app.get('/v1/projects/:namespace/:project/digest', (req, res) => {
  const { period, year, week, month } = req.query

  // Validate required params
  if (!period || !['week', 'month'].includes(period)) {
    return res.status(400).json({ error: 'period must be "week" or "month"' })
  }

  // Parse year or use default
  let parsedYear = parseInt(year, 10)
  let parsedPeriodNum

  if (period === 'week') {
    // Default to previous week if not specified
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
    // Default to previous month if not specified
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

  // Validate archive limit (3 months)
  const validation = validateArchiveLimit(period, parsedYear, parsedPeriodNum)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason })
  }

  // Get date bounds for the period
  const bounds = period === 'week'
    ? getWeekBounds(parsedYear, parsedPeriodNum)
    : getMonthBounds(parsedYear, parsedPeriodNum)

  // Load documents and compute digest
  const metadata = loadMetadata()
  const { documents, stats } = computeDigest(metadata.documents, bounds.start, bounds.end)

  // Format response
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

app.listen(PORT, () => {
  console.log(`RegSync API server running on http://localhost:${PORT}`)
  console.log(`Documents stored in: ${POLICIES_DIR}`)
  console.log(`LlamaFarm RAG: ${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`)
})
