import { useState, useEffect, useCallback } from 'react'
import { Bell, Loader2, AlertCircle, Inbox } from 'lucide-react'
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

// Get previous week (default view)
function getPreviousWeek(): { year: number; week: number } {
  const now = new Date()
  const lastWeek = new Date(now)
  lastWeek.setDate(now.getDate() - 7)
  return {
    year: getISOWeekYear(lastWeek),
    week: getISOWeek(lastWeek),
  }
}

// Get previous month (default view)
function getPreviousMonth(): { year: number; month: number } {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed
  if (month === 0) {
    year--
    month = 12
  }
  return { year, month }
}

export function DigestPage() {
  const [periodType, setPeriodType] = useState<'week' | 'month'>('week')
  const [year, setYear] = useState<number>(() => getPreviousWeek().year)
  const [periodNum, setPeriodNum] = useState<number>(() => getPreviousWeek().week)

  const [digest, setDigest] = useState<DigestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculate 3-month limit
  const getMinDate = useCallback(() => {
    const now = new Date()
    now.setMonth(now.getMonth() - 3)
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
      return periodNum < currentWeek - 1 // -1 because we default to previous week
    } else {
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      if (year < currentYear) return true
      return periodNum < currentMonth - 1 // -1 because we default to previous month
    }
  }, [periodType, year, periodNum])

  // Check if can navigate backward (within 3-month limit)
  const canGoPrevious = useCallback(() => {
    const minDate = getMinDate()
    if (periodType === 'week') {
      const minWeek = getISOWeek(minDate)
      const minYear = getISOWeekYear(minDate)
      if (year > minYear) return true
      return periodNum > minWeek
    } else {
      const minMonth = minDate.getMonth() + 1
      const minYear = minDate.getFullYear()
      if (year > minYear) return true
      return periodNum > minMonth
    }
  }, [periodType, year, periodNum, getMinDate])

  // Navigate to previous period
  const goPrevious = useCallback(() => {
    if (!canGoPrevious()) return
    if (periodType === 'week') {
      if (periodNum === 1) {
        setYear(y => y - 1)
        setPeriodNum(52) // Approximate - could be 53 in some years
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
      const prev = getPreviousWeek()
      setYear(prev.year)
      setPeriodNum(prev.week)
    } else {
      const prev = getPreviousMonth()
      setYear(prev.year)
      setPeriodNum(prev.month)
    }
  }, [])

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
      if (e.key === 'ArrowLeft' && canGoPrevious()) {
        goPrevious()
      } else if (e.key === 'ArrowRight' && canGoNext()) {
        goNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoPrevious, canGoNext, goPrevious, goNext])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
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
    </div>
  )
}
