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

// Upload new version
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
    size: req.file.size
  }

  metadata.documents[docIndex].versions.push(version)
  metadata.documents[docIndex].current_version_id = versionId
  metadata.documents[docIndex].updated_at = now
  saveMetadata(metadata)

  // Also upload to LlamaFarm for RAG processing
  const filePath = path.join(POLICIES_DIR, req.file.filename)
  const llamaResult = await uploadToLlamaFarm(filePath, req.file.originalname, {
    document_name: doc.name,
    short_title: doc.short_title,
    uploaded_by: req.body.uploaded_by,
    document_id: req.params.documentId
  })

  res.status(201).json({
    version,
    message: 'Version uploaded successfully',
    rag_status: llamaResult.success ? 'processed' : 'pending',
    rag_error: llamaResult.success ? null : llamaResult.error
  })
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

// Download document file
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

  res.download(filePath, version.original_name)
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

app.listen(PORT, () => {
  console.log(`RegSync API server running on http://localhost:${PORT}`)
  console.log(`Documents stored in: ${POLICIES_DIR}`)
  console.log(`LlamaFarm RAG: ${LLAMAFARM_URL}/v1/projects/${LLAMAFARM_NAMESPACE}/${LLAMAFARM_PROJECT}/datasets/${LLAMAFARM_DATASET}`)
})
