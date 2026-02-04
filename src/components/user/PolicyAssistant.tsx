import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, FileText, Clock, ArrowRight, Search } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import type { ChatMessage, CitedSource } from '@/types/chat'
import { SourceCard } from './SourceCard'

// Mock response - will be replaced with API call
const generateMockResponse = (query: string): { answer: string; sources: CitedSource[] } => {
  return {
    answer: `Based on the current policy documents, here's what I found regarding your question about "${query}":

**Remote Work Eligibility**
Employees must have completed 3 months of employment and demonstrated satisfactory performance to be eligible for remote work arrangements. Remote work requests require manager approval.

**Key Requirements:**
- Minimum 3 months employment
- Satisfactory performance record
- Manager approval required
- Secure home office setup
- Reliable internet connection

The policy was updated on June 1, 2024 to reduce the eligibility period from 6 months to 3 months.`,
    sources: [
      {
        content: 'Employees must have completed 3 months of employment and demonstrated satisfactory performance to be eligible for remote work arrangements.',
        score: 0.92,
        metadata: { source: 'employee-handbook.pdf' },
        document_id: '1',
        version_id: 'v2',
        section: 'Section 4.2 - Remote Work Policy',
        updated_at: '2024-06-01T14:30:00Z',
        updated_by: 'Capt. Sarah Mitchell',
      },
      {
        content: 'Remote work requests must be submitted through the HR portal and require direct manager approval within 5 business days.',
        score: 0.85,
        metadata: { source: 'employee-handbook.pdf' },
        document_id: '1',
        version_id: 'v2',
        section: 'Section 4.2.3 - Request Process',
        updated_at: '2024-06-01T14:30:00Z',
        updated_by: 'Capt. Sarah Mitchell',
      },
    ],
  }
}

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
]

export function PolicyAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (queryOverride?: string) => {
    const query = queryOverride || input
    if (!query.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const response = generateMockResponse(query)

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.answer,
      sources: response.sources,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        {!hasMessages ? (
          /* Welcome state with search and recent updates */
          <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Hero section with search */}
            <div className="text-center mb-10">
              <h1 className="text-2xl font-semibold mb-2 font-display">
                Policy Assistant
              </h1>
              <p className="text-muted-foreground mb-6">
                Search policy documents or ask questions about regulations
              </p>

              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., What are the requirements for remote work?"
                    className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-body"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Ask
                  </button>
                </div>
              </form>
            </div>

            {/* Recent updates */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-medium font-display">Recent Policy Updates</h2>
              </div>

              <div className="space-y-3">
                {RECENT_UPDATES.map((update) => (
                  <button
                    key={update.id}
                    className="w-full bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors text-left group"
                    onClick={() => handleSend(`What changed in ${update.shortTitle}?`)}
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
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id}>
                  {/* Message */}
                  <div
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' && 'justify-end'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-lg px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border'
                      )}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none font-body">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="font-body">{message.content}</p>
                      )}
                    </div>
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Sources ({message.sources.length})
                      </p>
                      <div className="space-y-2">
                        {message.sources.map((source, index) => (
                          <SourceCard key={index} source={source} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="bg-card border border-border rounded-lg px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Input area - always visible when there are messages */}
      {hasMessages && (
        <div className="border-t border-border bg-background">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-body"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
