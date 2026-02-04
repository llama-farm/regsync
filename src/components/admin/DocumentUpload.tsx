import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Upload, FileText, X, Loader2, CheckCircle, ArrowLeft, Calendar, User } from 'lucide-react'
import { cn } from '@/lib/utils'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

// Mock document data - will be replaced with API call
const MOCK_DOCUMENTS: Record<string, { name: string; shortTitle: string; currentVersion: number; lastUpdated: string; updatedBy: string }> = {
  '1': { name: 'Employee Handbook v2024', shortTitle: 'EMP-HB-2024', currentVersion: 2, lastUpdated: '2024-06-01', updatedBy: 'Capt. Sarah Mitchell' },
  '2': { name: 'IT Security Policy', shortTitle: 'IT-SEC-001', currentVersion: 3, lastUpdated: '2025-01-09', updatedBy: 'Maj. Robert Chen' },
  '3': { name: 'Travel & Expense Guidelines', shortTitle: 'FIN-TRV-001', currentVersion: 1, lastUpdated: '2024-03-10', updatedBy: 'Lt. Jennifer Walsh' },
  '4': { name: 'Code of Conduct', shortTitle: 'HR-COC-001', currentVersion: 2, lastUpdated: '2024-12-15', updatedBy: 'Lt. Col. James Anderson' },
}

export function DocumentUpload() {
  const navigate = useNavigate()
  const location = useLocation()
  const documentId = location.state?.documentId as string | undefined
  const isUpdate = !!documentId
  const existingDoc = documentId ? MOCK_DOCUMENTS[documentId] : null

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [shortTitle, setShortTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile)
        if (!name) {
          setName(droppedFile.name.replace('.pdf', ''))
        }
      }
    }
  }, [name])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      if (!name) {
        setName(selectedFile.name.replace('.pdf', ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setStatus('uploading')

    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setStatus('processing')

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setStatus('success')

    // Redirect after success
    setTimeout(() => {
      navigate('/admin')
    }, 1500)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold font-display">
          {isUpdate ? 'Update Document' : 'Upload New Document'}
        </h1>
        <p className="text-muted-foreground">
          {isUpdate
            ? 'Upload a new version of the existing document'
            : 'Add a new policy document to RegSync'}
        </p>
      </div>

      {/* Existing document info card (when updating) */}
      {isUpdate && existingDoc && (
        <div className="bg-admin-primary/5 border border-admin-primary/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-admin-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-admin-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{existingDoc.name}</h3>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {existingDoc.shortTitle}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Version {existingDoc.currentVersion} • Last updated {existingDoc.lastUpdated}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {existingDoc.updatedBy}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-admin-primary/20">
            <p className="text-sm text-admin-primary">
              Uploading will create Version {existingDoc.currentVersion + 1}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drag & drop zone */}
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            file && 'border-green-500/50 bg-green-500/5'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-green-500" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setFile(null)
                }}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a PDF file here, or click to select
              </p>
            </>
          )}
        </div>

        {/* Document name */}
        {!isUpdate && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Document Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Employee Handbook v2024"
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Short Title (optional)
              </label>
              <input
                type="text"
                value={shortTitle}
                onChange={(e) => setShortTitle(e.target.value)}
                placeholder="e.g., EMP-HB-2024"
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {isUpdate ? 'Version Notes' : 'Notes (optional)'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isUpdate
                ? 'Describe the changes in this version...'
                : 'Add any notes about this document...'
            }
            rows={3}
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!file || status !== 'idle'}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors',
            status === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            (!file || status !== 'idle') && status !== 'success' && 'opacity-50 cursor-not-allowed'
          )}
        >
          {status === 'idle' && (
            <>
              <Upload className="w-4 h-4" />
              {isUpdate ? 'Upload New Version' : 'Upload & Process'}
            </>
          )}
          {status === 'uploading' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          )}
          {status === 'processing' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing document...
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="w-4 h-4" />
              Upload complete!
            </>
          )}
          {status === 'error' && 'Error - Try again'}
        </button>
      </form>
    </div>
  )
}
