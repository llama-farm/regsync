import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Loader2, FileText } from 'lucide-react'
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

export function ChatInterface() {
  const location = useLocation()
  const initialQuery = location.state?.initialQuery as string | undefined

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState(initialQuery || '')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-send initial query if provided
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      handleSend(initialQuery)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Messages area */}
      <div className="flex-1 overflow-auto pb-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-medium mb-2">
                Ask about policy documents
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                I can help you find information in policy documents, explain
                regulations, and show you the sources for my answers.
              </p>
            </div>
          </div>
        ) : (
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
                      'max-w-[80%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-4 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-4 prose-li:my-2 prose-strong:font-semibold [&>p:first-child]:mt-0 leading-relaxed">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 ml-0">
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
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-border pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about policy documents..."
            className="flex-1 px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
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
  )
}
