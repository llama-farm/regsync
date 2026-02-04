import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Clock, ArrowRight } from 'lucide-react'

interface RecentUpdate {
  id: string
  documentName: string
  shortTitle: string
  summary: string
  updatedAt: string
  updatedBy: string
}

const RECENT_UPDATES: RecentUpdate[] = [
  {
    id: '1',
    documentName: 'IT Security Policy',
    shortTitle: 'IT-SEC-001',
    summary: 'Updated password requirements and added 2FA guidelines',
    updatedAt: '2025-01-09T11:15:00Z',
    updatedBy: 'Maj. Robert Chen',
  },
  {
    id: '2',
    documentName: 'Employee Handbook',
    shortTitle: 'EMP-HB-2024',
    summary: 'Updated remote work policy and dress code',
    updatedAt: '2024-06-01T14:30:00Z',
    updatedBy: 'Capt. Sarah Mitchell',
  },
  {
    id: '3',
    documentName: 'Code of Conduct',
    shortTitle: 'HR-COC-001',
    summary: 'Added social media guidelines',
    updatedAt: '2024-12-15T16:00:00Z',
    updatedBy: 'Lt. Col. James Anderson',
  },
]

export function UserDashboard() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate('/chat', { state: { initialQuery: searchQuery } })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero section with search */}
      <div className="text-center mb-12 mt-8">
        <h1 className="text-3xl font-semibold mb-2">
          What do you need to know?
        </h1>
        <p className="text-muted-foreground mb-8">
          Search policy documents or ask questions about regulations
        </p>

        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., What are the requirements for remote work?"
              className="w-full pl-12 pr-4 py-4 text-lg bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick links */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => navigate('/chat')}
            className="text-sm text-primary hover:underline"
          >
            Open Chat
          </button>
          <span className="text-border">|</span>
          <button
            onClick={() => navigate('/documents')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Browse Documents
          </button>
        </div>
      </div>

      {/* Recent updates */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-medium">Recent Updates</h2>
        </div>

        <div className="space-y-3">
          {RECENT_UPDATES.map((update) => (
            <div
              key={update.id}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() =>
                navigate('/chat', {
                  state: { initialQuery: `What changed in ${update.shortTitle}?` },
                })
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{update.documentName}</span>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {update.shortTitle}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {update.summary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(update.updatedAt)} by {update.updatedBy}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
