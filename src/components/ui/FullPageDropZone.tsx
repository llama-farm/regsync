import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FullPageDropZoneProps {
  children: ReactNode
  onFileDrop: (file: File) => void
  acceptedTypes?: string[]
  message?: string
  subMessage?: string
}

export function FullPageDropZone({
  children,
  onFileDrop,
  acceptedTypes = ['application/pdf'],
  message = 'Drop PDF to upload',
  subMessage = 'Release to add document',
}: FullPageDropZoneProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => prev + 1)

    // Check if dragging files
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      const newCount = prev - 1
      if (newCount === 0) {
        setIsDraggingOver(false)
      }
      return newCount
    })
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    setDragCounter(0)

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      const file = files[0]
      // Check if file type is accepted
      if (acceptedTypes.length === 0 || acceptedTypes.includes(file.type)) {
        onFileDrop(file)
      }
    }
  }, [onFileDrop, acceptedTypes])

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  return (
    <>
      {children}

      {/* Full page overlay - only visible when dragging */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center transition-all duration-200',
          'bg-background/90 backdrop-blur-sm',
          isDraggingOver
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="p-6 rounded-full bg-primary/10 border-2 border-dashed border-primary animate-pulse">
            <Upload className="w-12 h-12 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold font-display">{message}</p>
            <p className="text-muted-foreground mt-1">{subMessage}</p>
          </div>
        </div>
      </div>
    </>
  )
}
