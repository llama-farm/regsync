import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { PolicyDocument } from '@/types/document'
import type { UserLocation } from '@/types/location'
import { canAccessPolicy } from '@/types/location'

// Default location for non-authenticated users
const DEFAULT_LOCATION: UserLocation = {
  majcom: 'AETC',
  installation: 'JBSA',
  wing: '73 MDW',
}

/**
 * Hook to filter policies based on the current user's location.
 * Returns a filter function that can be used with Array.filter().
 */
export function usePolicyFilter() {
  const { adminUser, isAdmin } = useAuth()

  const location = adminUser?.location ?? DEFAULT_LOCATION

  const filterPolicy = useMemo(() => {
    return (policy: PolicyDocument): boolean => {
      // Admins can see all policies when managing
      if (isAdmin) {
        return true
      }

      // If policy has no scope defined, assume DAF-wide (visible to all)
      if (!policy.scope) {
        return true
      }

      return canAccessPolicy(location, policy.scope)
    }
  }, [location, isAdmin])

  return { filterPolicy, location }
}

/**
 * Filter an array of policies based on user location.
 * Convenience function for use outside of React components.
 */
export function filterPolicies(
  policies: PolicyDocument[],
  location: UserLocation,
  isAdmin: boolean = false
): PolicyDocument[] {
  if (isAdmin) {
    return policies
  }

  return policies.filter((policy) => {
    if (!policy.scope) {
      return true
    }
    return canAccessPolicy(location, policy.scope)
  })
}
