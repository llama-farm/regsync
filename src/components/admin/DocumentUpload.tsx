import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Upload, FileText, X, Loader2, CheckCircle, Calendar, Hash, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PolicyDocument } from '@/types/document'
import { documentsApi } from '@/api/documentsApi'
import { useAuth } from '@/contexts/AuthContext'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export function DocumentUpload() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  // Now receiving full document object instead of just ID
  const document = location.state?.document as PolicyDocument | undefined
  const isUpdate = !!document

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [shortTitle, setShortTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
    setErrorMessage(null)

    try {
      const uploadedBy = user?.name || 'Unknown'

      if (isUpdate && document) {
        // Upload new version of existing document
        setStatus('uploading')
        await documentsApi.uploadVersion(document.id, file, uploadedBy, notes || undefined)
        setStatus('processing')

        // Trigger change detection
        // Note: This happens automatically on the server after upload
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setStatus('success')
      } else {
        // Create new document
        setStatus('uploading')
        await documentsApi.createDocument(
          file,
          name,
          uploadedBy,
          shortTitle || undefined,
          notes || undefined
        )
        setStatus('processing')

        // Document processing happens on the server
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setStatus('success')
      }

      // Redirect after success
      setTimeout(() => {
        navigate('/admin')
      }, 1500)
    } catch (err) {
      console.error('Upload failed:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Make sure LlamaFarm server is running.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold font-display">
          {isUpdate ? 'Update Document' : 'Upload Document'}
        </h1>
        <p className="text-muted-foreground">
          {isUpdate
            ? 'Upload a new version of the existing document'
            : 'Add a new policy document to RegSync'}
        </p>
      </div>

      {/* Document info card when updating */}
      {isUpdate && document && (
        <div className="mb-6 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium font-display text-lg">{document.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {document.short_title && (
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    <span className="font-mono">{document.short_title}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Last updated {formatDate(document.updated_at)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Current version: <span className="font-mono">{document.current_version_id}</span>
              </p>
            </div>
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
              : 'bg-purple-600 text-white hover:bg-purple-700',
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

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  )
}
