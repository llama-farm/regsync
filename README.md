# RegSync

Document versioning and policy assistant for regulatory compliance. Built to help organizations manage policy documents and provide employees with an AI-powered assistant to answer questions about company policies.

## Features

### Admin Dashboard
- **Document Management** - Upload, view, and organize policy documents
- **Version Tracking** - Track changes across document versions
- **Change Detection** - LLM-powered analysis of what changed between versions
- **Version History** - View full history of document revisions

### User Interface
- **Policy Assistant** - AI-powered chat to answer questions about policies
- **Source Citations** - Every answer includes citations to source documents
- **Recent Updates** - See what policies have changed recently

### Policy Updates (Digest)
- **Weekly/Monthly Summaries** - Browse policy changes by calendar week or month
- **Change Highlights** - See what changed in each policy update
- **12-Month Archive** - Navigate back through a full year of changes
- **Email Alerts** - Subscribe to weekly policy digest emails (demo)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives)
- **State Management**: TanStack React Query
- **HTTP Client**: Axios
- **Backend**: [LlamaFarm](https://github.com/llama-farm/llamafarm) (RAG + chat) + Express.js (documents API)

## Getting Started

### Prerequisites

- Node.js 18+
- LlamaFarm server running (for backend API)

### Installation

```bash
# Clone the repo
git clone https://github.com/llama-farm/regsync.git
cd regsync

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your LlamaFarm server URL

# Start the local API server (documents + digest)
node server/index.js &

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173` (or 5174 if 5173 is in use)

### Environment Variables

Create a `.env.local` file:

```env
VITE_API_URL=http://localhost:8000
VITE_PROJECT_NAME=regsync
```

## Project Structure

```
server/                   # Local Express.js server
├── index.js              # API routes (documents, digest)
├── digest.js             # Digest computation logic
└── digest.test.js        # Unit tests (23 tests)

src/
├── api/                  # API client and endpoints
│   ├── client.ts         # Axios instance configuration
│   ├── documentsApi.ts   # Document CRUD operations
│   ├── datasetsApi.ts    # Dataset management
│   ├── chatApi.ts        # RAG chat endpoint
│   └── digestApi.ts      # Digest fetch client
├── components/
│   ├── admin/            # Admin-only components
│   │   ├── AdminDashboard.tsx
│   │   ├── DocumentUpload.tsx
│   │   ├── VersionHistory.tsx
│   │   └── ChangeReview.tsx
│   ├── auth/             # Authentication
│   │   └── SignInScreen.tsx
│   ├── digest/           # Policy updates feature
│   │   ├── DigestPage.tsx
│   │   ├── DigestCard.tsx
│   │   └── PeriodSelector.tsx
│   ├── layout/           # App shell, header, sidebar
│   ├── shared/           # Reusable components
│   └── user/             # User-facing components
│       ├── PolicyAssistant.tsx
│       ├── ChatInterface.tsx
│       └── SourceCard.tsx
├── contexts/
│   └── AuthContext.tsx   # Auth state & role management
├── types/                # TypeScript type definitions
└── lib/                  # Utilities
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run lint:fix # Fix linting issues
```

## Backend Integration

RegSync requires a LlamaFarm server with the documents API enabled. The frontend expects these endpoints:

- `GET /v1/projects/{org}/{project}/documents/` - List documents
- `POST /v1/projects/{org}/{project}/documents/` - Create document
- `GET /v1/projects/{org}/{project}/documents/{id}` - Get document
- `DELETE /v1/projects/{org}/{project}/documents/{id}` - Delete document
- `GET /v1/projects/{org}/{project}/documents/{id}/versions` - List versions
- `POST /v1/projects/{org}/{project}/documents/{id}/versions` - Upload new version
- `POST /v1/projects/{org}/{project}/documents/{id}/detect-changes` - Detect changes
- `POST /v1/projects/{org}/{project}/documents/{id}/compare` - Compare versions
- `GET /v1/projects/{org}/{project}/digest` - Get policy digest (week/month)

## License

MIT
