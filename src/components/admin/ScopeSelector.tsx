import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PolicyScope, ScopeLevel } from '@/types/location'
import { scopeLevelLabels, majcoms, installations, wings } from '@/types/location'

interface ScopeSelectorProps {
  value: PolicyScope | null
  onChange: (scope: PolicyScope | null) => void
  className?: string
}

const scopeLevels: ScopeLevel[] = ['daf', 'majcom', 'installation', 'wing']

export function ScopeSelector({ value, onChange, className }: ScopeSelectorProps) {
  const [selectedLevel, setSelectedLevel] = useState<ScopeLevel | null>(value?.level ?? null)

  const handleLevelChange = (level: ScopeLevel) => {
    setSelectedLevel(level)

    // For DAF-wide, set immediately
    if (level === 'daf') {
      onChange({ level: 'daf', value: 'DAF' })
    } else {
      // Clear value when switching levels
      onChange(null)
    }
  }

  const handleValueChange = (scopeValue: string) => {
    if (selectedLevel) {
      onChange({ level: selectedLevel, value: scopeValue })
    }
  }

  const getValueOptions = () => {
    switch (selectedLevel) {
      case 'majcom':
        return majcoms.map(m => ({ value: m.value, label: `${m.value} - ${m.label}` }))
      case 'installation':
        return installations.map(i => ({ value: i.value, label: `${i.value} - ${i.label}` }))
      case 'wing':
        return wings.map(w => ({ value: w.value, label: `${w.value} - ${w.label}` }))
      default:
        return []
    }
  }

  const valueOptions = getValueOptions()

  return (
    <div className={cn('space-y-4', className)}>
      {/* Level selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Policy Scope
        </label>
        <p className="text-sm text-muted-foreground mb-3">
          Who should see this policy?
        </p>

        <div className="space-y-2">
          {scopeLevels.map((level) => (
            <label
              key={level}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                selectedLevel === level
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                name="scope-level"
                value={level}
                checked={selectedLevel === level}
                onChange={() => handleLevelChange(level)}
                className="sr-only"
              />
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                selectedLevel === level
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground'
              )}>
                {selectedLevel === level && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium">{scopeLevelLabels[level]}</div>
                <div className="text-sm text-muted-foreground">
                  {level === 'daf' && 'All DAF personnel'}
                  {level === 'majcom' && 'Personnel in selected MAJCOM'}
                  {level === 'installation' && 'Personnel at selected installation'}
                  {level === 'wing' && 'Personnel in selected wing/unit'}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Value selection (for non-DAF scopes) */}
      {selectedLevel && selectedLevel !== 'daf' && valueOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Select {scopeLevelLabels[selectedLevel]}
          </label>
          <select
            value={value?.value ?? ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className={cn(
              'w-full px-3 py-2 bg-background border border-input rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          >
            <option value="">Select...</option>
            {valueOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current selection summary */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="text-sm">
            <span className="font-medium">Scope: </span>
            <span>
              {value.level === 'daf'
                ? 'All DAF personnel will see this policy'
                : `Only ${value.value} personnel will see this policy`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
