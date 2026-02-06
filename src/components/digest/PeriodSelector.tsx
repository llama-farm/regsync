import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PeriodSelectorProps {
  periodType: 'week' | 'month'
  label: string
  onPeriodTypeChange: (type: 'week' | 'month') => void
  onPrevious: () => void
  onNext: () => void
  canGoNext: boolean
  canGoPrevious: boolean
}

export function PeriodSelector({
  periodType,
  label,
  onPeriodTypeChange,
  onPrevious,
  onNext,
  canGoNext,
  canGoPrevious,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={cn(
            'p-2 rounded-lg transition-colors',
            canGoPrevious
              ? 'hover:bg-accent text-foreground'
              : 'text-muted-foreground/50 cursor-not-allowed'
          )}
          aria-label="Previous period"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-lg font-semibold font-display min-w-[200px] text-center">
          {label}
        </span>

        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={cn(
            'p-2 rounded-lg transition-colors',
            canGoNext
              ? 'hover:bg-accent text-foreground'
              : 'text-muted-foreground/50 cursor-not-allowed'
          )}
          aria-label="Next period"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Period Type Toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        <button
          onClick={() => onPeriodTypeChange('week')}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
            periodType === 'week'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Weekly
        </button>
        <button
          onClick={() => onPeriodTypeChange('month')}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
            periodType === 'month'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Monthly
        </button>
      </div>
    </div>
  )
}
