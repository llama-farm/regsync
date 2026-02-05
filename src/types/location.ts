// Policy scope levels - from broadest to most specific
export type ScopeLevel = 'dod' | 'daf' | 'majcom' | 'installation' | 'wing' | 'group' | 'squadron'

// Policy scope definition
export interface PolicyScope {
  level: ScopeLevel
  value: string  // e.g., "AETC", "JBSA", "73 MDW"
}

// User location hierarchy
export interface UserLocation {
  installation: string      // "JBSA" | "Ramstein" | "Kadena" etc.
  majcom: string            // "AETC" | "AFMC" | "PACAF" etc.
  wing: string              // "502 ABW" | "73 MDW" etc.
  group?: string            // "502 MSG" etc. (optional)
  squadron?: string         // "502 FSS" etc. (optional)
}

// Display labels for scope levels
export const scopeLevelLabels: Record<ScopeLevel, string> = {
  dod: 'DoD-wide',
  daf: 'DAF-wide',
  majcom: 'MAJCOM',
  installation: 'Installation',
  wing: 'Wing',
  group: 'Group',
  squadron: 'Squadron'
}

// Policy type examples by scope
export const scopeExamples: Record<ScopeLevel, string> = {
  dod: 'DoDI',
  daf: 'DAFI, DAFGM, DAFMAN',
  majcom: 'AETCI, AFMCI, PACAFI',
  installation: 'JBSAI, RamsteinI',
  wing: '73 MDWI, 502 ABWI',
  group: 'Group OIs',
  squadron: 'Squadron SOPs'
}

// Common MAJCOMs
export const majcoms = [
  { value: 'AETC', label: 'Air Education and Training Command' },
  { value: 'ACC', label: 'Air Combat Command' },
  { value: 'AFMC', label: 'Air Force Materiel Command' },
  { value: 'AFGSC', label: 'Air Force Global Strike Command' },
  { value: 'AFSOC', label: 'Air Force Special Operations Command' },
  { value: 'AFSPC', label: 'Air Force Space Command' },
  { value: 'AMC', label: 'Air Mobility Command' },
  { value: 'PACAF', label: 'Pacific Air Forces' },
  { value: 'USAFE', label: 'United States Air Forces in Europe' },
] as const

// Common installations (sample - would be more comprehensive in production)
export const installations = [
  { value: 'JBSA', label: 'Joint Base San Antonio', majcom: 'AETC' },
  { value: 'Lackland', label: 'Lackland AFB', majcom: 'AETC' },
  { value: 'Randolph', label: 'Randolph AFB', majcom: 'AETC' },
  { value: 'Ramstein', label: 'Ramstein AB', majcom: 'USAFE' },
  { value: 'Kadena', label: 'Kadena AB', majcom: 'PACAF' },
  { value: 'Nellis', label: 'Nellis AFB', majcom: 'ACC' },
  { value: 'Wright-Patterson', label: 'Wright-Patterson AFB', majcom: 'AFMC' },
  { value: 'Travis', label: 'Travis AFB', majcom: 'AMC' },
] as const

// Sample wings (would be more comprehensive in production)
export const wings = [
  { value: '73 MDW', label: '73rd Medical Wing', installation: 'JBSA' },
  { value: '502 ABW', label: '502nd Air Base Wing', installation: 'JBSA' },
  { value: '37 TRW', label: '37th Training Wing', installation: 'Lackland' },
  { value: '12 FTW', label: '12th Flying Training Wing', installation: 'Randolph' },
  { value: '86 AW', label: '86th Airlift Wing', installation: 'Ramstein' },
  { value: '18 WG', label: '18th Wing', installation: 'Kadena' },
] as const

// Get the hierarchy of scopes a user can access based on their location
export function getAccessibleScopes(location: UserLocation): { level: ScopeLevel; value: string; label: string }[] {
  const scopes: { level: ScopeLevel; value: string; label: string }[] = [
    { level: 'dod', value: 'DoD', label: 'DoD-wide' },
    { level: 'daf', value: 'DAF', label: 'DAF-wide' },
    { level: 'majcom', value: location.majcom, label: `${location.majcom} (MAJCOM)` },
    { level: 'installation', value: location.installation, label: `${location.installation} (Installation)` },
    { level: 'wing', value: location.wing, label: `${location.wing} (Wing)` },
  ]

  if (location.group) {
    scopes.push({ level: 'group', value: location.group, label: `${location.group} (Group)` })
  }

  if (location.squadron) {
    scopes.push({ level: 'squadron', value: location.squadron, label: `${location.squadron} (Squadron)` })
  }

  return scopes
}

// Check if a user can see a policy based on their location and the policy's scope
export function canAccessPolicy(userLocation: UserLocation, policyScope: PolicyScope): boolean {
  switch (policyScope.level) {
    case 'dod':
    case 'daf':
      // Everyone sees DoD and DAF-wide policies
      return true

    case 'majcom':
      // Only see MAJCOM policies if user is in that MAJCOM
      return policyScope.value === userLocation.majcom

    case 'installation':
      // Only see installation policies if user is at that installation
      return policyScope.value === userLocation.installation

    case 'wing':
      // Only see wing policies if user is in that wing
      return policyScope.value === userLocation.wing

    case 'group':
      // Only see group policies if user is in that group
      return policyScope.value === userLocation.group

    case 'squadron':
      // Only see squadron policies if user is in that squadron
      return policyScope.value === userLocation.squadron

    default:
      return false
  }
}
