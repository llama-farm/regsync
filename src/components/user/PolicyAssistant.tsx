import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, FileText, Clock, ArrowRight, Search, ThumbsUp, ThumbsDown, MessageSquare, Printer, AlertCircle, HelpCircle, Plus } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import type { ChatMessage, CitedSource } from '@/types/chat'
import { SourcesDisplay } from './SourcesDisplay'
import { DocumentViewer } from './DocumentViewer'
import { chatApi } from '@/api/chatApi'
import { documentsApi } from '@/api/documentsApi'

// Storage key for chat history (per role)
const CHAT_STORAGE_KEY = 'regsync_chat_history'

interface RecentUpdate {
  id: string
  documentName: string
  shortTitle: string
  summary: string
  updatedAt: string
  updatedBy: string
}

// Related questions by topic keyword
const RELATED_QUESTIONS: Record<string, string[]> = {
  travel: [
    'How do I submit a travel voucher in DTS?',
    'What is the local travel reimbursement policy?',
    'Who approves travel vouchers over $5,000?',
  ],
  leave: [
    'How do I request leave in LeaveWeb?',
    'What is the emergency leave policy?',
    'How much advance notice is required for leave?',
  ],
  security: [
    'What are the password requirements?',
    'How do I report a security incident?',
    'What is the clean desk policy?',
  ],
  default: [
    'What policies were recently updated?',
    'Who do I contact for policy questions?',
    'How do I request a policy exception?',
  ],
}

// Get related questions based on query content
const getRelatedQuestions = (query: string): string[] => {
  const lowerQuery = query.toLowerCase()
  if (lowerQuery.includes('travel') || lowerQuery.includes('voucher') || lowerQuery.includes('tdy')) {
    return RELATED_QUESTIONS.travel
  }
  if (lowerQuery.includes('leave') || lowerQuery.includes('pto') || lowerQuery.includes('vacation')) {
    return RELATED_QUESTIONS.leave
  }
  if (lowerQuery.includes('security') || lowerQuery.includes('password') || lowerQuery.includes('cyber')) {
    return RELATED_QUESTIONS.security
  }
  return RELATED_QUESTIONS.default
}

export function PolicyAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | null>>({})
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([])
  const [selectedSource, setSelectedSource] = useState<CitedSource | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }, [])

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    } catch (err) {
      console.error('Failed to save chat history:', err)
    }
  }, [messages])

  // Fetch recent document updates from API
  useEffect(() => {
    const loadRecentUpdates = async () => {
      try {
        const response = await documentsApi.listDocuments()
        // Sort by updated_at and take the most recent
        const updates = response.documents
          .filter(doc => doc.updated_at)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 3)
          .map(doc => ({
            id: doc.id,
            documentName: doc.name,
            shortTitle: doc.short_title || 'Policy Document',
            summary: `Latest version updated`,
            updatedAt: doc.updated_at,
            updatedBy: 'Policy Administrator',
          }))
        setRecentUpdates(updates)
      } catch (err) {
        console.error('Failed to load recent updates:', err)
        // Keep empty array - no fallback to mock data
      }
    }
    loadRecentUpdates()
  }, [])

  // Calculate confidence score from sources (max score)
  const getConfidenceScore = (sources: ChatMessage['sources']): number | null => {
    if (!sources || sources.length === 0) return null
    const maxScore = Math.max(...sources.map((s) => s.score || 0))
    return Math.round(maxScore * 100)
  }

  // Check if message is a "no answer" response (no sources or low confidence)
  const isNoAnswer = (message: ChatMessage): boolean => {
    if (!message.sources || message.sources.length === 0) return true
    const confidence = getConfidenceScore(message.sources)
    return confidence !== null && confidence < 50
  }

  // Handle clicking on a document to ask about it
  const handleDocumentClick = (_documentId: string, documentName: string) => {
    handleSend(`Tell me about ${documentName}`)
  }

  // Handle feedback click
  const handleFeedback = (messageId: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({
      ...prev,
      [messageId]: prev[messageId] === type ? null : type,
    }))
    // In production, this would send to analytics
    console.log(`Feedback for message ${messageId}: ${type}`)
  }

  // Print summary for counseling sessions
  const handlePrint = (message: ChatMessage, query: string) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const sources = message.sources?.map((s, i) =>
      `[${i + 1}] ${s.section || 'Document Section'}${s.updated_by ? ` (${s.updated_by})` : ''}`
    ).join('\n') || 'No sources cited'

    const confidence = getConfidenceScore(message.sources)
    const now = new Date().toLocaleString()

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Policy Guidance Summary</title>
        <style>
          body { font-family: 'IBM Plex Sans', system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
          h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
          .question { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
          .question-label { font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
          .answer { line-height: 1.6; margin-bottom: 20px; }
          .sources { font-size: 13px; border-top: 1px solid #ddd; padding-top: 16px; }
          .sources h3 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
          .sources pre { white-space: pre-wrap; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
          .confidence { font-size: 12px; color: #16a34a; margin-bottom: 16px; }
          .footer { font-size: 11px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 12px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>73rd Medical Wing - Policy Guidance Summary</h1>
        <div class="meta">Generated: ${now}</div>

        <div class="question">
          <div class="question-label">Question</div>
          <div>${query}</div>
        </div>

        ${confidence ? `<div class="confidence">Confidence: ${confidence}%</div>` : ''}

        <div class="answer">
          <strong>Answer:</strong><br><br>
          ${message.content.replace(/\n/g, '<br>')}
        </div>

        <div class="sources">
          <h3>Sources</h3>
          <pre>${sources}</pre>
        </div>

        <div class="footer">
          This summary was generated from the 73MDW Policy Knowledge Base.<br>
          For official guidance, always refer to the source documents.
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

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

    try {
      // Build conversation history for context
      const conversationHistory = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      // Call LlamaFarm RAG-augmented chat API
      const response = await chatApi.chat(
        [
          ...conversationHistory,
          { role: 'user' as const, content: query },
        ],
        {
          ragEnabled: true,
          database: 'policies',
        }
      )

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat API error:', err)

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while searching the policy documents. Please make sure LlamaFarm is running and try again.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const handleClear = () => {
    setMessages([])
    setFeedback({})
    // Clear from localStorage
    localStorage.removeItem(CHAT_STORAGE_KEY)
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
      {/* Compact header - Policy Assistant title + New chat button */}
      {hasMessages && (
        <div className="border-b border-border bg-background px-4 py-0.5">
          <div className="max-w-3xl mx-auto flex items-center justify-between h-8">
            <span className="text-sm font-medium">Policy Assistant</span>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              New chat
            </button>
          </div>
        </div>
      )}

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
                {recentUpdates.map((update) => (
                  <button
                    key={update.id}
                    className="w-full bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors text-left group"
                    onClick={() => handleDocumentClick(update.id, update.documentName)}
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
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="space-y-6">
              {messages.map((message, msgIndex) => (
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
                        <>
                          {/* Confidence score badge or no-answer warning */}
                          {message.sources && message.sources.length > 0 ? (
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded font-medium",
                                (getConfidenceScore(message.sources) || 0) >= 50
                                  ? "bg-green-500/10 text-green-500"
                                  : "bg-amber-500/10 text-amber-500"
                              )}>
                                Confidence: {getConfidenceScore(message.sources)}%
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Limited information found
                              </span>
                            </div>
                          )}
                          <div className="prose prose-sm dark:prose-invert max-w-none font-body prose-p:my-5 prose-headings:mt-6 prose-headings:mb-2 prose-ul:my-3 prose-li:my-0.5 prose-strong:font-semibold [&>p:first-child]:mt-0">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>

                          {/* No-answer suggestions */}
                          {isNoAnswer(message) && (
                            <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-md">
                              <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                                <HelpCircle className="w-4 h-4" />
                                Suggested next steps
                              </div>
                              <ul className="text-sm text-muted-foreground space-y-1.5">
                                <li>• Contact your supervisor or First Sergeant for local guidance</li>
                                <li>• Check the Wing SharePoint for recent policy updates</li>
                                <li>• Submit a question to Wing Staff (73 MDW/CCE)</li>
                              </ul>
                              <button
                                className="mt-3 text-xs text-primary hover:underline"
                                onClick={() => alert('Feature coming soon: Submit a request to add this topic to the knowledge base.')}
                              >
                                Should this topic be in our knowledge base? Let us know →
                              </button>
                            </div>
                          )}

                          {/* Feedback and print buttons */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">Was this helpful?</span>
                              <button
                                onClick={() => handleFeedback(message.id, 'up')}
                                className={cn(
                                  'p-1.5 rounded transition-colors',
                                  feedback[message.id] === 'up'
                                    ? 'bg-green-500/20 text-green-500'
                                    : 'hover:bg-accent text-muted-foreground'
                                )}
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, 'down')}
                                className={cn(
                                  'p-1.5 rounded transition-colors',
                                  feedback[message.id] === 'down'
                                    ? 'bg-red-500/20 text-red-500'
                                    : 'hover:bg-accent text-muted-foreground'
                                )}
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Print button for counseling sessions */}
                            <button
                              onClick={() => handlePrint(message, messages[msgIndex - 1]?.content || '')}
                              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded transition-colors"
                              title="Print summary for counseling"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print Summary
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="font-body">{message.content}</p>
                      )}
                    </div>
                  </div>

                  {/* Sources - grouped by document with expandable chunks */}
                  {message.sources && message.sources.length > 0 && (
                    <SourcesDisplay
                      sources={message.sources}
                      onViewDocument={(source) => setSelectedSource(source)}
                    />
                  )}

                  {/* Related questions - show after last assistant message */}
                  {message.role === 'assistant' && msgIndex === messages.length - 1 && !isLoading && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Related Questions</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getRelatedQuestions(messages[msgIndex - 1]?.content || '').map((question, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(question)}
                            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-full transition-colors"
                          >
                            {question}
                          </button>
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

      {/* Document viewer modal */}
      {selectedSource && (
        <DocumentViewer
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </div>
  )
}
