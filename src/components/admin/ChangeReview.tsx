import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, X, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Change, ChangesSummary } from '@/types/document'

// Mock data - will be replaced with API call
const MOCK_CHANGES: ChangesSummary = {
  total_changes: 3,
  summary:
    'Updated remote work policy in Section 4.2, clarified dress code requirements in Section 3.1, and added new section on mental health resources.',
  changes: [
    {
      section: 'Section 4.2 - Remote Work Policy',
      type: 'modified',
      summary: 'Expanded eligibility criteria for remote work',
      before:
        'Employees must have completed 6 months of employment to be eligible for remote work arrangements.',
      after:
        'Employees must have completed 3 months of employment and demonstrated satisfactory performance to be eligible for remote work arrangements. Remote work requests require manager approval.',
    },
    {
      section: 'Section 3.1 - Dress Code',
      type: 'modified',
      summary: 'Clarified business casual requirements',
      before: 'Business casual attire is required in the office.',
      after:
        'Business casual attire is required in the office. This includes collared shirts, slacks or khakis, and closed-toe shoes. Jeans are permitted on Fridays.',
    },
    {
      section: 'Section 8.5 - Mental Health Resources',
      type: 'added',
      summary: 'New section on mental health support',
      after:
        'The company provides access to mental health resources through our Employee Assistance Program (EAP). This includes confidential counseling services, stress management workshops, and mental health days.',
    },
  ],
  old_version_id: 'v1',
  new_version_id: 'v2',
  compared_at: '2024-06-01T14:30:00Z',
}

interface ChangeItemProps {
  change: Change
  isExpanded: boolean
  onToggle: () => void
}

function ChangeItem({ change, isExpanded, onToggle }: ChangeItemProps) {
  const typeColors = {
    added: 'bg-green-500/10 text-green-500 border-green-500/20',
    modified: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    removed: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded border',
            typeColors[change.type]
          )}
        >
          {change.type.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{change.section}</p>
          <p className="text-sm text-muted-foreground truncate">
            {change.summary}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="grid grid-cols-2 gap-4">
            {change.before && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  BEFORE
                </p>
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded text-sm">
                  {change.before}
                </div>
              </div>
            )}
            {change.after && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  AFTER
                </p>
                <div className="p-3 bg-green-500/5 border border-green-500/20 rounded text-sm">
                  {change.after}
                </div>
              </div>
            )}
            {!change.before && change.after && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  NEW CONTENT
                </p>
                <div className="p-3 bg-green-500/5 border border-green-500/20 rounded text-sm">
                  {change.after}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ChangeReview() {
  const { documentId, versionId } = useParams()
  const navigate = useNavigate()
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(
    new Set([0])
  )
  const [changes] = useState<ChangesSummary>(MOCK_CHANGES)

  const toggleChange = (index: number) => {
    setExpandedChanges((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleApprove = () => {
    // TODO: Call API to approve changes
    console.log('Approved', { documentId, versionId })
    navigate('/admin')
  }

  const handleReject = () => {
    // TODO: Call API to reject changes
    console.log('Rejected', { documentId, versionId })
    navigate('/admin')
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              Employee Handbook v2024
            </span>
          </div>
          <h1 className="text-2xl font-semibold">Review Changes</h1>
          <p className="text-muted-foreground">
            Version {changes.old_version_id} → {changes.new_version_id} •{' '}
            {changes.total_changes} changes detected
          </p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium mb-1">AI Summary</p>
        <p className="text-sm text-muted-foreground">{changes.summary}</p>
      </div>

      {/* Changes list */}
      <div className="space-y-3 mb-6">
        {changes.changes.map((change, index) => (
          <ChangeItem
            key={index}
            change={change}
            isExpanded={expandedChanges.has(index)}
            onToggle={() => toggleChange(index)}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          <Check className="w-4 h-4" />
          Approve & Publish
        </button>
        <button
          onClick={handleReject}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-md hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  )
}
