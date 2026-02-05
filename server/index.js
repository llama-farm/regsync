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
import { diffLines } from 'diff'

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

// Delete old document chunks from LlamaFarm RAG dataset
async function deleteFromLlamaFarm(documentId) {
  try {
    // Delete by document_id metadata filter
    const url = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}/data`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { document_id: documentId }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`LlamaFarm delete failed (${response.status}):`, errorText)
      return { success: false, error: errorText }
    }

    console.log('✓ Old document chunks deleted from LlamaFarm RAG:', documentId)
    return { success: true }
  } catch (error) {
    console.error('LlamaFarm delete error:', error.message)
    return { success: false, error: error.message }
  }
}

// Upload file to LlamaFarm RAG dataset
async function uploadToLlamaFarm(filePath, originalName, metadata = {}) {
  try {
    const FormData = (await import('form-data')).default
    const form = new FormData()

    form.append('file', fs.createReadStream(filePath), {
      filename: originalName,
      contentType: 'application/pdf'
    })

    // Add metadata as form fields
    if (metadata.document_name) {
      form.append('metadata', JSON.stringify({
        document_name: metadata.document_name,
        short_title: metadata.short_title,
        uploaded_by: metadata.uploaded_by,
        document_id: metadata.document_id
      }))
    }

    const url = `${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}/data?auto_process=true`

    const response = await fetch(url, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
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

  res.json({
    message: 'Version approved and published',
    version: metadata.documents[docIndex].versions[versionIndex],
    rag_status: llamaResult.success ? 'processed' : 'pending',
    rag_cleanup: deleteResult.success ? 'completed' : 'failed'
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
app.delete('/v1/projects/:namespace/:project/documents/:documentId', (req, res) => {
  const metadata = loadMetadata()
  const docIndex = metadata.documents.findIndex(d => d.id === req.params.documentId)

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' })
  }

  // Delete all version files
  const doc = metadata.documents[docIndex]
  for (const version of doc.versions) {
    const filePath = path.join(POLICIES_DIR, version.filename)
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
  const oldSections = splitIntoSections(oldText)
  const newSections = splitIntoSections(newText)

  const changes = []

  // Simple comparison - find added, removed, modified sections
  const diff = diffLines(oldText.substring(0, 10000), newText.substring(0, 10000), {
    ignoreWhitespace: true
  })

  let changeIndex = 0
  for (const part of diff) {
    if (part.added || part.removed) {
      const lines = part.value.trim().split('\n').filter(l => l.trim())
      if (lines.length > 0) {
        const sectionTitle = lines[0].substring(0, 60) + (lines[0].length > 60 ? '...' : '')
        changes.push({
          section: `Section ${++changeIndex}: ${sectionTitle}`,
          type: part.added ? 'added' : 'removed',
          summary: part.added
            ? `New content added (${lines.length} lines)`
            : `Content removed (${lines.length} lines)`,
          before: part.removed ? part.value.substring(0, 500) : undefined,
          after: part.added ? part.value.substring(0, 500) : undefined
        })
      }
    }
  }

  return changes.slice(0, 10) // Limit to 10 changes for UI
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

  // Extract text from both PDFs
  const oldFilePath = path.join(POLICIES_DIR, oldVersion.filename)
  const newFilePath = path.join(POLICIES_DIR, newVersion.filename)

  if (!fs.existsSync(oldFilePath) || !fs.existsSync(newFilePath)) {
    return res.status(404).json({ error: 'PDF files not found on disk' })
  }

  console.log(`Comparing versions: ${oldVersion.filename} vs ${newVersion.filename}`)

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
    compared_at: new Date().toISOString()
  })
})

app.listen(PORT, () => {
  console.log(`RegSync API server running on http://localhost:${PORT}`)
  console.log(`Documents stored in: ${POLICIES_DIR}`)
  console.log(`LlamaFarm RAG: ${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`)
})
