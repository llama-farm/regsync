import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Upload, FileText, X, Loader2, Calendar, Hash, AlertCircle, Check, ArrowLeft, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PolicyDocument } from '@/types/document'
import type { PolicyScope } from '@/types/location'
import type { MatchDetectionResult, DocumentMatch } from '@/types/match'
import { documentsApi } from '@/api/documentsApi'
import { useAuth } from '@/contexts/AuthContext'
import { UploadDiffPreview } from './UploadDiffPreview'
import { ScopeSelector } from './ScopeSelector'
import { MatchSuggestions } from './MatchSuggestions'
import { FullPageDropZone } from '@/components/ui/FullPageDropZone'

type UploadStatus = 'idle' | 'uploading' | 'detecting' | 'processing' | 'confirm' | 'publishing' | 'error'

interface UploadedDocInfo {
  id: string
  name: string
  shortTitle: string | null
  versionId: string
  filename: string
  size: number
  isUpdate: boolean
  previousVersionId?: string
}

export function DocumentUpload() {
  const navigate = useNavigate()
  const location = useLocation()
  const { adminUser } = useAuth()
  // Now receiving full document object instead of just ID
  const existingDocument = location.state?.document as PolicyDocument | undefined
  const droppedFile = location.state?.droppedFile as File | undefined
  const isUpdate = !!existingDocument

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [shortTitle, setShortTitle] = useState('')
  const [scope, setScope] = useState<PolicyScope | null>(existingDocument?.scope ?? null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocInfo | null>(null)
  const [matchResult, setMatchResult] = useState<MatchDetectionResult | null>(null)
  const previousVersionId = useRef<string | null>(existingDocument?.current_version_id || null)

  // Handle file dropped from another page (via navigation state)
  useEffect(() => {
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile)
      if (!name) {
        setName(droppedFile.name.replace('.pdf', ''))
      }
    }
  }, [droppedFile])

  // Handle full-page file drop
  const handleFullPageDrop = useCallback((droppedFile: File) => {
    if (droppedFile.type === 'application/pdf') {
      setFile(droppedFile)
      if (!name) {
        setName(droppedFile.name.replace('.pdf', ''))
      }
    }
  }, [name])

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
    setMatchResult(null)

    try {
      const uploadedBy = adminUser?.name || 'Unknown'

      if (isUpdate && existingDocument) {
        // Upload new version of existing document
        const response = await documentsApi.uploadVersion(existingDocument.id, file, uploadedBy)
        setStatus('processing')
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Store uploaded doc info and move to confirm step
        setUploadedDoc({
          id: existingDocument.id,
          name: existingDocument.name,
          shortTitle: existingDocument.short_title,
          versionId: response.version.id,
          filename: response.version.filename || response.version.file_name || file.name,
          size: response.version.size || response.version.file_size || file.size,
          isUpdate: true,
          previousVersionId: previousVersionId.current || undefined
        })
        setStatus('confirm')
      } else {
        // NEW: For new documents, first detect potential matches
        setStatus('detecting')

        try {
          const matches = await documentsApi.detectMatches(file)

          if (matches.matches.length > 0) {
            // Found potential matches - show selection UI
            setMatchResult(matches)
            // Stay in detecting state, render MatchSuggestions
            return
          }
        } catch (matchError) {
          // Match detection failed - show warning but proceed with normal upload
          console.warn('Match detection failed, proceeding with upload:', matchError)
          toast.warning('Unable to check for similar documents', {
            description: 'Proceeding with upload. The document may be a duplicate.',
          })
        }

        // No matches found or detection failed - proceed with normal upload
        await proceedWithNewDocument()
      }
    } catch (err) {
      console.error('Upload failed:', err)
      setStatus('error')
      const message = err instanceof Error ? err.message : 'Upload failed. Make sure the server is running.'
      setErrorMessage(message)
      toast.error('Upload failed', {
        description: message,
      })
    }
  }

  // Helper to proceed with creating a new document
  const proceedWithNewDocument = async () => {
    if (!file) return

    setStatus('processing')
    const uploadedBy = adminUser?.name || 'Unknown'

    const response = await documentsApi.createDocument(
      file,
      name,
      uploadedBy,
      shortTitle || undefined,
      undefined,
      scope
    )

    // Store uploaded doc info and move to confirm step
    setUploadedDoc({
      id: response.document.id,
      name: response.document.name,
      shortTitle: response.document.short_title,
      versionId: response.version.id,
      filename: response.version.filename || response.version.file_name || file.name,
      size: response.version.size || response.version.file_size || file.size,
      isUpdate: false
    })
    setStatus('confirm')
    toast.success('Document uploaded successfully', {
      description: 'Review the document before publishing.',
    })
  }

  // Handle selecting a matched document to update
  const handleSelectMatch = async (match: DocumentMatch) => {
    if (!file) return

    setStatus('uploading')
    const uploadedBy = adminUser?.name || 'Unknown'

    try {
      const response = await documentsApi.uploadVersion(match.document.id, file, uploadedBy)
      setStatus('processing')
      await new Promise((resolve) => setTimeout(resolve, 500))

      setUploadedDoc({
        id: match.document.id,
        name: match.document.name,
        shortTitle: match.document.short_title,
        versionId: response.version.id,
        filename: response.version.filename || response.version.file_name || file.name,
        size: response.version.size || response.version.file_size || file.size,
        isUpdate: true,
        previousVersionId: match.document.current_version_id
      })
      setMatchResult(null)
      setStatus('confirm')
      toast.success('Version uploaded', {
        description: `Added as new version of ${match.document.name}`,
      })
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : 'Upload failed'
      setErrorMessage(message)
      toast.error('Upload failed', { description: message })
    }
  }

  // Handle choosing to create new document from match selection
  const handleCreateNewFromMatch = async () => {
    setMatchResult(null)
    try {
      await proceedWithNewDocument()
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : 'Upload failed'
      setErrorMessage(message)
      toast.error('Upload failed', { description: message })
    }
  }

  const handleConfirm = () => {
    if (!uploadedDoc) return

    // Go directly to version history or admin dashboard
    // (document diff feature removed - can revisit later)
    toast.success(uploadedDoc.isUpdate ? 'Version uploaded!' : 'Document published!', {
      description: `${uploadedDoc.name} is now available to users.`,
    })

    if (uploadedDoc.isUpdate) {
      navigate(`/history/${uploadedDoc.id}`)
    } else {
      navigate('/admin')
    }
  }

  const handleCancel = () => {
    // Reset to upload form
    setStatus('idle')
    setUploadedDoc(null)
    setFile(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  // Match selection step - show when matches are found
  if (status === 'detecting' && matchResult && matchResult.matches.length > 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <MatchSuggestions
          result={matchResult}
          uploadedFileName={file?.name || ''}
          onSelectMatch={handleSelectMatch}
          onCreateNew={handleCreateNewFromMatch}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  // Confirmation step - show document preview or diff preview for updates
  if (status === 'confirm' && uploadedDoc) {
    const previewUrl = `/api/projects/default/regsync/documents/${uploadedDoc.id}/file`

    // Show diff preview for updates (when we have both version IDs)
    if (uploadedDoc.isUpdate && uploadedDoc.previousVersionId) {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Upload
            </button>
          </div>

          <UploadDiffPreview
            documentId={uploadedDoc.id}
            documentName={uploadedDoc.name}
            oldVersionId={uploadedDoc.previousVersionId}
            newVersionId={uploadedDoc.versionId}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        </div>
      )
    }

    // Standard preview for new documents
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Upload
          </button>
          <h1 className="text-2xl font-semibold font-display">
            Review & Confirm
          </h1>
          <p className="text-muted-foreground">
            Review the uploaded document before publishing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Document info */}
          <div className="space-y-4">
            {/* Document metadata card */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-lg font-display">{uploadedDoc.name}</h2>
                  {uploadedDoc.shortTitle && (
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="font-mono">{uploadedDoc.shortTitle}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">File size</span>
                  <span>{formatFileSize(uploadedDoc.size)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-amber-500 font-medium">Pending Review</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                <Check className="w-4 h-4" />
                Confirm & Publish
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-md hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>

          {/* Right side - PDF preview */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Document Preview</span>
            </div>
            <div className="h-[600px]">
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Upload form
  return (
    <FullPageDropZone onFileDrop={handleFullPageDrop}>
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
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
      {isUpdate && existingDocument && (
        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium font-display text-lg">{existingDocument.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {existingDocument.short_title && (
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    <span className="font-mono">{existingDocument.short_title}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Last updated {formatDate(existingDocument.updated_at)}
                </span>
              </div>
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
            file && 'border-primary/50 bg-primary/5'
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
              <FileText className="w-8 h-8 text-primary" />
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

        {/* Scope selection (only for new documents) */}
        {!isUpdate && (
          <ScopeSelector
            value={scope}
            onChange={setScope}
          />
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!file || status !== 'idle'}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            (!file || status !== 'idle') && 'opacity-50 cursor-not-allowed'
          )}
        >
          {status === 'idle' && (
            <>
              <Upload className="w-4 h-4" />
              {isUpdate ? 'Upload New Version' : 'Upload Document'}
            </>
          )}
          {status === 'uploading' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          )}
          {status === 'detecting' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing document...
            </>
          )}
          {status === 'processing' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
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
    </FullPageDropZone>
  )
}
