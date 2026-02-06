# Plan: Policy Digest Feature

## Overview

A new navigation tab ("Updates") that provides weekly and monthly policy change digests for all employees. The digest summarizes policy changes, new policies, and includes metadata (who published, when). Organized by policy/document with a 3-month rolling archive. Auto-updates upon changes.

## Agents to Use

- **ui-architect** - For React components (DigestPage, DigestCard, DateNavigation)
- **backend-architect** - For Express.js digest API endpoint
- **test-runner** - After each phase to run and verify tests
- **debugger** - If any tests fail, to fix issues
- **code-reviewer** - After significant implementations
- **demo-builder** - To create phase demos

## Feature Requirements

| Requirement | Implementation |
|-------------|----------------|
| Weekly/Monthly by calendar | Use ISO week numbers and calendar months |
| Summarize policy changes | Aggregate changes grouped by document |
| Include new policies | Flag documents with `created_at` in period |
| Auto-update upon changes | Dynamic computation from documents.json |
| Easy to consume | Card-based UI, skimmable summaries |
| Metadata (who, when) | Display uploaded_by, uploaded_at for each change |
| 3-month rolling archive | Filter date range in API |
| **Default to previous week** | Weekly view opens to last complete week, not current |

---

## Phase 1: Backend API - Digest Endpoint

### Phase 1 Tests (Define FIRST)
- [ ] Test: GET /v1/projects/:ns/:proj/digest returns 200 with valid structure
- [ ] Test: `period=week` returns documents changed in specified ISO week
- [ ] Test: `period=month` returns documents changed in specified calendar month
- [ ] Test: New documents (created_at in period) are flagged as `is_new: true`
- [ ] Test: Updated documents include change summary from most recent version
- [ ] Test: Empty periods return `{ documents: [], period: {...} }`
- [ ] Test: Invalid date parameters return 400 error
- [ ] Test file: `server/digest.test.js`

### Phase 1 Demo (Define FIRST)
- [ ] Demo script: `demos/demo-digest-api.sh`
- [ ] Demo shows: Curl requests to digest endpoint with week and month periods
- [ ] Expected output: JSON response with grouped document changes

### Phase 1 Implementation
- [ ] Create `server/digest.js` - digest computation logic
  - `getWeekBounds(year, week)` - returns start/end dates for ISO week
  - `getMonthBounds(year, month)` - returns start/end dates for month
  - `computeDigest(documents, startDate, endDate)` - filters and groups changes
- [ ] Add GET `/v1/projects/:ns/:proj/digest` endpoint in `server/index.js`
  - Query params: `period` (week|month), `year`, `week` or `month`
  - Response: `{ period: {...}, documents: [...], stats: {...} }`
- [ ] Document structure for digest response:
  ```typescript
  interface DigestDocument {
    id: string
    name: string
    short_title: string | null
    is_new: boolean  // Created in this period
    changes: {
      version_id: string
      uploaded_by: string
      uploaded_at: string
      notes: string | null
      summary: string | null  // From stored change summary
    }[]
  }
  ```

### Phase 1 Verification
- [ ] Run tests: `node --test server/digest.test.js`
- [ ] All tests pass
- [ ] Run demo: `bash demos/demo-digest-api.sh`
- [ ] Demo runs successfully

### Phase 1 Checkpoint
- [ ] Tests verified passing
- [ ] Demo verified working
- [ ] Ready for Phase 2

---

## Phase 2: Frontend - Digest Page Component

### Phase 2 Tests (Define FIRST)
- [ ] Test: DigestPage renders without crashing
- [ ] Test: Period toggle switches between week/month view
- [ ] Test: Date navigation updates displayed period
- [ ] Test: Loading state shows spinner
- [ ] Test: Empty state shows "No updates" message
- [ ] Test: Documents render as cards with correct info
- [ ] Test file: `src/components/digest/__tests__/DigestPage.test.tsx`

### Phase 2 Demo (Define FIRST)
- [ ] Demo script: `demos/demo-digest-ui.sh`
- [ ] Demo shows: Start dev server, navigate to /updates, toggle week/month
- [ ] Expected output: UI renders with period selector and document cards

### Phase 2 Implementation
- [ ] Create `src/api/digestApi.ts` - API client for digest endpoint
  ```typescript
  export const digestApi = {
    getDigest(period: 'week' | 'month', year: number, periodNum: number)
  }
  ```
- [ ] Create `src/types/digest.ts` - TypeScript types for digest data
- [ ] Create `src/components/digest/DigestPage.tsx` - Main page component
  - Period toggle (Week/Month)
  - Date navigation (prev/next arrows, current period label)
  - **Default to previous week** (last complete week, not current)
  - List of DigestCard components
  - Loading and empty states
- [ ] Create `src/components/digest/DigestCard.tsx` - Document change card
  - Document name and short title
  - "New Policy" badge if is_new
  - Change summary (expandable if multiple changes)
  - Metadata: uploaded_by, date
  - Link to current document
- [ ] Create `src/components/digest/PeriodSelector.tsx` - Week/Month toggle + navigation

### Phase 2 Verification
- [ ] Run tests: `npm test -- --grep DigestPage`
- [ ] All tests pass
- [ ] Run demo: `bash demos/demo-digest-ui.sh`
- [ ] Demo runs successfully

### Phase 2 Checkpoint
- [ ] Tests verified passing
- [ ] Demo verified working
- [ ] Ready for Phase 3

---

## Phase 3: Navigation Integration

### Phase 3 Tests (Define FIRST)
- [ ] Test: "Updates" nav item appears in Sidebar for all users
- [ ] Test: Clicking "Updates" navigates to /updates route
- [ ] Test: /updates route renders DigestPage component
- [ ] Test: Active state shows on nav item when on /updates
- [ ] Test file: `src/components/layout/__tests__/Sidebar.test.tsx`

### Phase 3 Demo (Define FIRST)
- [ ] Demo script: `demos/demo-digest-nav.sh`
- [ ] Demo shows: Full flow - click Updates in nav, view digest, navigate periods
- [ ] Expected output: Seamless navigation between Policy Assistant, Documents, Updates

### Phase 3 Implementation
- [ ] Add `/updates` route to `src/App.tsx`
- [ ] Add "Updates" nav item to `src/components/layout/Sidebar.tsx`
  - Icon: `Bell` or `Calendar` from lucide-react
  - Position: After "Documents" in nav order
  - Visible to all users (not admin-only)
- [ ] Style active state to match existing nav items

### Phase 3 Verification
- [ ] Run tests: `npm test -- --grep Sidebar`
- [ ] All tests pass
- [ ] Run demo: `bash demos/demo-digest-nav.sh`
- [ ] Demo runs successfully

### Phase 3 Checkpoint
- [ ] Tests verified passing
- [ ] Demo verified working
- [ ] Ready for Phase 4

---

## Phase 4: Polish & Edge Cases

### Phase 4 Tests (Define FIRST)
- [ ] Test: Archive limit enforced (only 3 months back)
- [ ] Test: Future periods show appropriate message
- [ ] Test: Print-friendly styles work
- [ ] Test: Mobile responsive layout
- [ ] Test: Keyboard navigation works
- [ ] Test file: `src/components/digest/__tests__/DigestPage.edge.test.tsx`

### Phase 4 Demo (Define FIRST)
- [ ] Demo script: `demos/demo-digest-full.sh`
- [ ] Demo shows: Complete feature walkthrough with edge cases
- [ ] Expected output: All features work, graceful handling of edge cases

### Phase 4 Implementation
- [ ] Add 3-month archive limit to API
- [ ] Add "View Full Document" link to each card
- [ ] Add print-friendly CSS styles
- [ ] Add responsive breakpoints for mobile
- [ ] Add keyboard navigation (arrow keys for period nav)
- [ ] Add "No updates this period" empty state with friendly message
- [ ] Add loading skeleton animation

### Phase 4 Verification
- [ ] Run all tests: `npm test`
- [ ] All tests pass
- [ ] Run demo: `bash demos/demo-digest-full.sh`
- [ ] Demo runs successfully

### Phase 4 Checkpoint
- [ ] Tests verified passing
- [ ] Demo verified working
- [ ] Feature complete

---

## Final Success Criteria

- [ ] All phase checkpoints complete
- [ ] Full integration test passes
- [ ] End-to-end demo runs successfully
- [ ] All users can access /updates nav tab
- [ ] Weekly digest shows calendar week changes
- [ ] Monthly digest shows calendar month changes
- [ ] New policies flagged with "New" badge
- [ ] Updated policies show change summary and metadata
- [ ] 3-month rolling archive accessible
- [ ] Print-friendly output available

---

## API Design

### GET /v1/projects/:namespace/:project/digest

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| period | 'week' \| 'month' | Yes | Time period type |
| year | number | Yes | 4-digit year (e.g., 2024) |
| week | number | If period=week | ISO week number (1-53) |
| month | number | If period=month | Month number (1-12) |

**Response:**
```json
{
  "period": {
    "type": "week",
    "year": 2024,
    "week": 5,
    "start_date": "2024-01-29",
    "end_date": "2024-02-04",
    "label": "Week of Jan 29 - Feb 4, 2024"
  },
  "stats": {
    "new_policies": 2,
    "updated_policies": 3,
    "total_changes": 7
  },
  "documents": [
    {
      "id": "uuid",
      "name": "Dress and Appearance",
      "short_title": "36-2903",
      "is_new": false,
      "changes": [
        {
          "version_id": "uuid",
          "uploaded_by": "Capt. Sarah Mitchell",
          "uploaded_at": "2024-01-31T14:30:00Z",
          "notes": "Updated hair standards for female airmen",
          "summary": "Section 3.2 modified to allow longer ponytails..."
        }
      ]
    }
  ]
}
```

---

## Component Structure

```
src/
├── api/
│   └── digestApi.ts           # API client
├── types/
│   └── digest.ts              # TypeScript types
└── components/
    └── digest/
        ├── DigestPage.tsx     # Main page (route component)
        ├── DigestCard.tsx     # Individual document card
        ├── PeriodSelector.tsx # Week/Month toggle + navigation
        └── __tests__/
            ├── DigestPage.test.tsx
            └── DigestPage.edge.test.tsx
```

---

## UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│  ◀  Week of Jan 29 - Feb 4, 2024  ▶    [Weekly] [Monthly]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 36-2903 - Dress and Appearance        UPDATED   │   │
│  │                                                     │   │
│  │  Updated hair standards for female airmen.          │   │
│  │  Section 3.2 modified to allow longer ponytails.    │   │
│  │                                                     │   │
│  │  📅 Jan 31, 2024 • 👤 Capt. Sarah Mitchell          │   │
│  │                                    [View Document]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 44-102 - Cybersecurity Standards       NEW ✨    │   │
│  │                                                     │   │
│  │  New policy establishing baseline security          │   │
│  │  requirements for all network-connected devices.    │   │
│  │                                                     │   │
│  │  📅 Jan 30, 2024 • 👤 Policy Administrator          │   │
│  │                                    [View Document]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
