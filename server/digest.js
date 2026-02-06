/**
 * Digest computation logic for weekly/monthly policy summaries
 */

/**
 * Get ISO week number from a date
 * @param {Date} date
 * @returns {number} ISO week number (1-53)
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

/**
 * Get the ISO week year (may differ from calendar year at year boundaries)
 * @param {Date} date
 * @returns {number}
 */
function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

/**
 * Get start and end dates for an ISO week
 * @param {number} year - ISO week year
 * @param {number} week - Week number (1-53)
 * @returns {{ start: Date, end: Date }}
 */
function getWeekBounds(year, week) {
  // Find Jan 4 of the year (always in week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7

  // Find Monday of week 1
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1)

  // Add weeks to get to target week
  const start = new Date(week1Monday)
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)

  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  return { start, end }
}

/**
 * Get start and end dates for a calendar month
 * @param {number} year
 * @param {number} month - Month number (1-12)
 * @returns {{ start: Date, end: Date }}
 */
function getMonthBounds(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start, end }
}

/**
 * Format date range as human-readable label
 * @param {'week' | 'month'} periodType
 * @param {Date} start
 * @param {Date} end
 * @param {number} year
 * @param {number} periodNum
 * @returns {string}
 */
function formatPeriodLabel(periodType, start, end, year, periodNum) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  if (periodType === 'month') {
    return `${fullMonths[periodNum - 1]} ${year}`
  }

  // Week format: "Week of Jan 29 - Feb 4, 2024"
  const startMonth = months[start.getUTCMonth()]
  const endMonth = months[end.getUTCMonth()]
  const startDay = start.getUTCDate()
  const endDay = end.getUTCDate()
  const endYear = end.getUTCFullYear()

  if (startMonth === endMonth) {
    return `Week of ${startMonth} ${startDay} - ${endDay}, ${endYear}`
  }
  return `Week of ${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`
}

/**
 * Check if a date falls within a range
 * @param {string} dateStr - ISO date string
 * @param {Date} start
 * @param {Date} end
 * @returns {boolean}
 */
function isInRange(dateStr, start, end) {
  const date = new Date(dateStr)
  return date >= start && date <= end
}

/**
 * Compute digest for documents within a date range
 * @param {Array} documents - Array of document objects with versions
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {{ documents: Array, stats: { new_policies: number, updated_policies: number, total_changes: number } }}
 */
function computeDigest(documents, startDate, endDate) {
  const digestDocs = []
  let newPolicies = 0
  let updatedPolicies = 0
  let totalChanges = 0

  for (const doc of documents) {
    // Check if document was created in this period
    const isNew = isInRange(doc.created_at, startDate, endDate)

    // Find versions updated in this period (excluding the initial creation if it's new)
    const changesInPeriod = (doc.versions || [])
      .filter(v => {
        const versionDate = v.created_at || v.uploaded_at
        if (!versionDate) return false

        // Include if version is in range
        const inRange = isInRange(versionDate, startDate, endDate)

        // For new docs, include all versions in period
        // For existing docs, include all versions in period
        return inRange
      })
      .sort((a, b) => {
        // Sort by date descending (newest first)
        const dateA = new Date(a.created_at || a.uploaded_at)
        const dateB = new Date(b.created_at || b.uploaded_at)
        return dateB - dateA
      })
      .map(v => ({
        version_id: v.id,
        uploaded_by: v.uploaded_by || 'Unknown',
        uploaded_at: v.created_at || v.uploaded_at,
        notes: v.notes || null,
        summary: v.notes || null, // Use notes as summary for now
        status: v.status || 'published'
      }))

    // Only include if there are changes in this period
    if (changesInPeriod.length > 0) {
      digestDocs.push({
        id: doc.id,
        name: doc.name,
        short_title: doc.short_title || null,
        is_new: isNew,
        changes: changesInPeriod
      })

      if (isNew) {
        newPolicies++
      } else {
        updatedPolicies++
      }
      totalChanges += changesInPeriod.length
    }
  }

  // Sort by newest change first
  digestDocs.sort((a, b) => {
    const dateA = new Date(a.changes[0]?.uploaded_at || 0)
    const dateB = new Date(b.changes[0]?.uploaded_at || 0)
    return dateB - dateA
  })

  return {
    documents: digestDocs,
    stats: {
      new_policies: newPolicies,
      updated_policies: updatedPolicies,
      total_changes: totalChanges
    }
  }
}

/**
 * Get the previous complete week (not current week)
 * @returns {{ year: number, week: number }}
 */
function getPreviousWeek() {
  const now = new Date()
  // Go back 7 days to ensure we're in the previous week
  const lastWeek = new Date(now)
  lastWeek.setDate(now.getDate() - 7)

  return {
    year: getISOWeekYear(lastWeek),
    week: getISOWeek(lastWeek)
  }
}

/**
 * Get the previous complete month
 * @returns {{ year: number, month: number }}
 */
function getPreviousMonth() {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed

  if (month === 0) {
    year--
    month = 12
  }

  return { year, month }
}

/**
 * Validate that the requested period is within the 3-month archive limit
 * @param {'week' | 'month'} periodType
 * @param {number} year
 * @param {number} periodNum
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateArchiveLimit(periodType, year, periodNum) {
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(now.getMonth() - 3)

  let periodStart
  if (periodType === 'week') {
    const bounds = getWeekBounds(year, periodNum)
    periodStart = bounds.start
  } else {
    const bounds = getMonthBounds(year, periodNum)
    periodStart = bounds.start
  }

  if (periodStart < threeMonthsAgo) {
    return { valid: false, reason: 'Requested period is outside the 3-month archive limit' }
  }

  if (periodStart > now) {
    return { valid: false, reason: 'Cannot view future periods' }
  }

  return { valid: true }
}

export {
  getISOWeek,
  getISOWeekYear,
  getWeekBounds,
  getMonthBounds,
  formatPeriodLabel,
  isInRange,
  computeDigest,
  getPreviousWeek,
  getPreviousMonth,
  validateArchiveLimit
}
