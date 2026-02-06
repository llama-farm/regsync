export interface DigestChange {
  version_id: string
  uploaded_by: string
  uploaded_at: string
  notes: string | null
  summary: string | null
  status?: 'draft' | 'published' | 'pending'
}

export interface DigestDocument {
  id: string
  name: string
  short_title: string | null
  is_new: boolean
  changes: DigestChange[]
}

export interface DigestPeriod {
  type: 'week' | 'month'
  year: number
  week?: number
  month?: number
  start_date: string
  end_date: string
  label: string
}

export interface DigestStats {
  new_policies: number
  updated_policies: number
  total_changes: number
}

export interface DigestResponse {
  period: DigestPeriod
  stats: DigestStats
  documents: DigestDocument[]
}
