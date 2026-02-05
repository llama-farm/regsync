import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getAccessibleScopes } from '@/types/location'

export function LocationContext() {
  const { adminUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Default location for non-authenticated users
  const location = adminUser?.location ?? {
    majcom: 'AETC',
    installation: 'JBSA',
    wing: '73 MDW',
  }

  const accessibleScopes = getAccessibleScopes(location)

  // Compact display: show wing name
  const displayName = location.wing

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 text-sm text-muted-foreground',
          'hover:text-foreground transition-colors',
          'rounded-md px-2 py-1 -mx-2 -my-1',
          'hover:bg-accent',
          isOpen && 'bg-accent text-foreground'
        )}
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>{displayName}</span>
        <ChevronDown className={cn(
          'w-3.5 h-3.5 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className={cn(
          'absolute top-full left-0 mt-2 z-50',
          'w-64 bg-popover border border-border rounded-lg shadow-lg',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2'
        )}>
          {/* Header */}
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-sm font-medium">Your Policy Access</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Policies visible based on your assignment
            </p>
          </div>

          {/* Scope list */}
          <div className="py-1">
            {accessibleScopes.map((scope, index) => (
              <div
                key={scope.level}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm',
                  index === accessibleScopes.length - 1 && 'font-medium text-primary'
                )}
              >
                <Check className={cn(
                  'w-4 h-4 flex-shrink-0',
                  index === accessibleScopes.length - 1 ? 'text-primary' : 'text-green-500'
                )} />
                <span className="flex-1">{scope.label}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-border bg-muted/30 rounded-b-lg">
            <p className="text-xs text-muted-foreground">
              Contact your administrator to update your assignment
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
