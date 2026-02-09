import { useState, useEffect, useCallback } from 'react'
import { Bell, Loader2, AlertCircle, Inbox, Mail, X, Check } from 'lucide-react'
import { digestApi } from '@/api/digestApi'
import { PeriodSelector } from './PeriodSelector'
import { DigestCard } from './DigestCard'
import type { DigestResponse } from '@/types/digest'

// Get ISO week number from date
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Get ISO week year
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

// Get current week
function getCurrentWeek(): { year: number; week: number } {
  const now = new Date()
  return {
    year: getISOWeekYear(now),
    week: getISOWeek(now),
  }
}

// Get current month
function getCurrentMonth(): { year: number; month: number } {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}

export function DigestPage() {
  // Default to current month to show recent updates
  const [periodType, setPeriodType] = useState<'week' | 'month'>('month')
  const [year, setYear] = useState<number>(() => getCurrentMonth().year)
  const [periodNum, setPeriodNum] = useState<number>(() => getCurrentMonth().month)

  const [digest, setDigest] = useState<DigestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)

  // Calculate 12-month limit
  const getMinDate = useCallback(() => {
    const now = new Date()
    now.setMonth(now.getMonth() - 12)
    return now
  }, [])

  // Check if can navigate forward (not beyond current period)
  const canGoNext = useCallback(() => {
    const now = new Date()
    if (periodType === 'week') {
      const currentWeek = getISOWeek(now)
      const currentYear = getISOWeekYear(now)
      // Can go next if not at current week
      if (year < currentYear) return true
      return periodNum < currentWeek
    } else {
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      if (year < currentYear) return true
      return periodNum < currentMonth
    }
  }, [periodType, year, periodNum])

  // Check if can navigate backward (within 12-month limit)
  const canGoPrevious = useCallback(() => {
    const minDate = getMinDate()
    if (periodType === 'week') {
      const minWeek = getISOWeek(minDate)
      const minYear = getISOWeekYear(minDate)
      if (year > minYear) return true
      if (year === minYear) return periodNum > minWeek
      return false
    } else {
      const minMonth = minDate.getMonth() + 1
      const minYear = minDate.getFullYear()
      if (year > minYear) return true
      if (year === minYear) return periodNum > minMonth
      return false
    }
  }, [periodType, year, periodNum, getMinDate])

  // Navigate to previous period
  const goPrevious = useCallback(() => {
    if (!canGoPrevious()) return
    if (periodType === 'week') {
      if (periodNum === 1) {
        setYear(y => y - 1)
        setPeriodNum(52)
      } else {
        setPeriodNum(p => p - 1)
      }
    } else {
      if (periodNum === 1) {
        setYear(y => y - 1)
        setPeriodNum(12)
      } else {
        setPeriodNum(p => p - 1)
      }
    }
  }, [periodType, periodNum, canGoPrevious])

  // Navigate to next period
  const goNext = useCallback(() => {
    if (!canGoNext()) return
    if (periodType === 'week') {
      if (periodNum >= 52) {
        setYear(y => y + 1)
        setPeriodNum(1)
      } else {
        setPeriodNum(p => p + 1)
      }
    } else {
      if (periodNum === 12) {
        setYear(y => y + 1)
        setPeriodNum(1)
      } else {
        setPeriodNum(p => p + 1)
      }
    }
  }, [periodType, periodNum, canGoNext])

  // Handle period type change
  const handlePeriodTypeChange = useCallback((type: 'week' | 'month') => {
    setPeriodType(type)
    if (type === 'week') {
      const current = getCurrentWeek()
      setYear(current.year)
      setPeriodNum(current.week)
    } else {
      const current = getCurrentMonth()
      setYear(current.year)
      setPeriodNum(current.month)
    }
  }, [])

  // Handle email save (fake implementation)
  const handleSaveEmail = () => {
    if (email && email.includes('@')) {
      setEmailSaved(true)
      setTimeout(() => {
        setShowEmailModal(false)
        setEmailSaved(false)
        setEmail('')
      }, 1500)
    }
  }

  // Fetch digest data
  useEffect(() => {
    const fetchDigest = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await digestApi.getDigest(periodType, year, periodNum)
        setDigest(data)
      } catch (err) {
        console.error('Failed to fetch digest:', err)
        setError('Failed to load policy updates. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchDigest()
  }, [periodType, year, periodNum])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showEmailModal) return // Don't navigate when modal is open
      if (e.key === 'ArrowLeft' && canGoPrevious()) {
        goPrevious()
      } else if (e.key === 'ArrowRight' && canGoNext()) {
        goNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoPrevious, canGoNext, goPrevious, goNext, showEmailModal])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold font-display">Policy Updates</h1>
              <p className="text-sm text-muted-foreground">
                Stay informed about policy changes
              </p>
            </div>
          </div>

          {/* Email Alerts Button */}
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            Set up email alerts
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        periodType={periodType}
        label={digest?.period.label || 'Loading...'}
        onPeriodTypeChange={handlePeriodTypeChange}
        onPrevious={goPrevious}
        onNext={goNext}
        canGoNext={canGoNext()}
        canGoPrevious={canGoPrevious()}
      />

      {/* Stats Summary */}
      {digest && !loading && digest.stats.total_changes > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {digest.stats.new_policies}
            </div>
            <div className="text-xs text-muted-foreground mt-1">New Policies</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {digest.stats.updated_policies}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Updated</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {digest.stats.total_changes}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Total Changes</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">Loading policy updates...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && digest && digest.documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No updates this period</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            There were no policy changes during {digest.period.label}.
            Use the arrows to check other time periods.
          </p>
        </div>
      )}

      {/* Document Cards */}
      {!loading && !error && digest && digest.documents.length > 0 && (
        <div className="space-y-4">
          {digest.documents.map((doc) => (
            <DigestCard key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* Footer hint */}
      {!loading && !error && (
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Use ← → arrow keys to navigate between periods
        </div>
      )}

      {/* Email Alert Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Email Alerts</h2>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              {emailSaved ? (
                <div className="flex flex-col items-center py-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                    <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium">Email alerts configured!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll receive weekly policy digests
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get weekly policy update summaries delivered straight to your inbox.
                  </p>
                  <label className="block text-sm font-medium mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Digests are sent every Monday morning
                  </p>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!emailSaved && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmail}
                  disabled={!email || !email.includes('@')}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save preferences
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
