/**
 * Tests for digest computation logic
 * Run with: node --test server/digest.test.js
 */

import { test, describe } from 'node:test'
import assert from 'node:assert'
import {
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
} from './digest.js'

describe('getWeekBounds', () => {
  test('returns correct bounds for week 1 of 2024', () => {
    const { start, end } = getWeekBounds(2024, 1)
    assert.strictEqual(start.toISOString().split('T')[0], '2024-01-01')
    assert.strictEqual(end.toISOString().split('T')[0], '2024-01-07')
  })

  test('returns correct bounds for week 5 of 2024', () => {
    const { start, end } = getWeekBounds(2024, 5)
    assert.strictEqual(start.toISOString().split('T')[0], '2024-01-29')
    assert.strictEqual(end.toISOString().split('T')[0], '2024-02-04')
  })

  test('handles year boundary correctly', () => {
    const { start, end } = getWeekBounds(2024, 52)
    // Week 52 of 2024 should be Dec 23-29
    assert.ok(start.getUTCMonth() === 11) // December
    assert.ok(end.getUTCMonth() === 11)
  })
})

describe('getMonthBounds', () => {
  test('returns correct bounds for January 2024', () => {
    const { start, end } = getMonthBounds(2024, 1)
    assert.strictEqual(start.toISOString().split('T')[0], '2024-01-01')
    assert.strictEqual(end.toISOString().split('T')[0], '2024-01-31')
  })

  test('returns correct bounds for February 2024 (leap year)', () => {
    const { start, end } = getMonthBounds(2024, 2)
    assert.strictEqual(start.toISOString().split('T')[0], '2024-02-01')
    assert.strictEqual(end.toISOString().split('T')[0], '2024-02-29')
  })

  test('returns correct bounds for December 2024', () => {
    const { start, end } = getMonthBounds(2024, 12)
    assert.strictEqual(start.toISOString().split('T')[0], '2024-12-01')
    assert.strictEqual(end.toISOString().split('T')[0], '2024-12-31')
  })
})

describe('formatPeriodLabel', () => {
  test('formats month correctly', () => {
    const { start, end } = getMonthBounds(2024, 1)
    const label = formatPeriodLabel('month', start, end, 2024, 1)
    assert.strictEqual(label, 'January 2024')
  })

  test('formats week within same month', () => {
    const { start, end } = getWeekBounds(2024, 3)
    const label = formatPeriodLabel('week', start, end, 2024, 3)
    assert.ok(label.includes('Jan'))
    assert.ok(label.includes('2024'))
  })

  test('formats week spanning two months', () => {
    const { start, end } = getWeekBounds(2024, 5)
    const label = formatPeriodLabel('week', start, end, 2024, 5)
    assert.ok(label.includes('Jan'))
    assert.ok(label.includes('Feb'))
  })
})

describe('isInRange', () => {
  test('returns true for date within range', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-31')
    assert.strictEqual(isInRange('2024-01-15T12:00:00Z', start, end), true)
  })

  test('returns false for date before range', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-31')
    assert.strictEqual(isInRange('2023-12-31T12:00:00Z', start, end), false)
  })

  test('returns false for date after range', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-31')
    assert.strictEqual(isInRange('2024-02-01T12:00:00Z', start, end), false)
  })

  test('includes dates on boundary', () => {
    const start = new Date('2024-01-01T00:00:00Z')
    const end = new Date('2024-01-31T23:59:59Z')
    assert.strictEqual(isInRange('2024-01-01T00:00:00Z', start, end), true)
    assert.strictEqual(isInRange('2024-01-31T23:59:59Z', start, end), true)
  })
})

describe('computeDigest', () => {
  const mockDocuments = [
    {
      id: 'doc1',
      name: 'Policy A',
      short_title: '36-2903',
      created_at: '2024-01-15T10:00:00Z',
      versions: [
        {
          id: 'v1',
          uploaded_by: 'Admin',
          created_at: '2024-01-15T10:00:00Z',
          notes: 'Initial version'
        }
      ]
    },
    {
      id: 'doc2',
      name: 'Policy B',
      short_title: '44-102',
      created_at: '2023-12-01T10:00:00Z',
      versions: [
        {
          id: 'v1',
          uploaded_by: 'Admin',
          created_at: '2023-12-01T10:00:00Z',
          notes: 'Initial version'
        },
        {
          id: 'v2',
          uploaded_by: 'Editor',
          created_at: '2024-01-20T14:00:00Z',
          notes: 'Updated section 3'
        }
      ]
    },
    {
      id: 'doc3',
      name: 'Policy C',
      short_title: '31-101',
      created_at: '2023-06-01T10:00:00Z',
      versions: [
        {
          id: 'v1',
          uploaded_by: 'Admin',
          created_at: '2023-06-01T10:00:00Z',
          notes: 'Initial version'
        }
      ]
    }
  ]

  test('returns documents changed in period', () => {
    const start = new Date('2024-01-01T00:00:00Z')
    const end = new Date('2024-01-31T23:59:59Z')

    const { documents, stats } = computeDigest(mockDocuments, start, end)

    assert.strictEqual(documents.length, 2)
    assert.strictEqual(stats.total_changes, 2)
  })

  test('flags new documents correctly', () => {
    const start = new Date('2024-01-01T00:00:00Z')
    const end = new Date('2024-01-31T23:59:59Z')

    const { documents, stats } = computeDigest(mockDocuments, start, end)

    const newDoc = documents.find(d => d.id === 'doc1')
    const updatedDoc = documents.find(d => d.id === 'doc2')

    assert.strictEqual(newDoc?.is_new, true)
    assert.strictEqual(updatedDoc?.is_new, false)
    assert.strictEqual(stats.new_policies, 1)
    assert.strictEqual(stats.updated_policies, 1)
  })

  test('returns empty for period with no changes', () => {
    const start = new Date('2025-01-01T00:00:00Z')
    const end = new Date('2025-01-31T23:59:59Z')

    const { documents, stats } = computeDigest(mockDocuments, start, end)

    assert.strictEqual(documents.length, 0)
    assert.strictEqual(stats.total_changes, 0)
  })

  test('includes change metadata', () => {
    const start = new Date('2024-01-01T00:00:00Z')
    const end = new Date('2024-01-31T23:59:59Z')

    const { documents } = computeDigest(mockDocuments, start, end)
    const doc = documents.find(d => d.id === 'doc2')

    assert.ok(doc?.changes.length > 0)
    assert.strictEqual(doc?.changes[0].uploaded_by, 'Editor')
    assert.strictEqual(doc?.changes[0].notes, 'Updated section 3')
  })
})

describe('getPreviousWeek', () => {
  test('returns valid week number', () => {
    const { year, week } = getPreviousWeek()
    assert.ok(year >= 2024)
    assert.ok(week >= 1 && week <= 53)
  })
})

describe('getPreviousMonth', () => {
  test('returns valid month number', () => {
    const { year, month } = getPreviousMonth()
    assert.ok(year >= 2024)
    assert.ok(month >= 1 && month <= 12)
  })
})

describe('validateArchiveLimit', () => {
  test('rejects periods more than 12 months ago', () => {
    const result = validateArchiveLimit('month', 2020, 1)
    assert.strictEqual(result.valid, false)
    assert.ok(result.reason?.includes('archive limit'))
  })

  test('rejects future periods', () => {
    const result = validateArchiveLimit('month', 2030, 1)
    assert.strictEqual(result.valid, false)
    assert.ok(result.reason?.includes('future'))
  })

  test('accepts recent periods', () => {
    const now = new Date()
    const result = validateArchiveLimit('month', now.getFullYear(), now.getMonth() + 1)
    assert.strictEqual(result.valid, true)
  })

  test('accepts periods within 12 months', () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const result = validateArchiveLimit('month', sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1)
    assert.strictEqual(result.valid, true)
  })
})
