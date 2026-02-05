# Copilot / Agent Quick Instructions for RegSync

## TL;DR ✅
- Frontend-only React app (TypeScript + Vite) that talks to a LlamaFarm backend (documents + RAG/chat). See `README.md` for high-level goals.
- Dev: `npm install` → `npm run dev` (Vite server proxies `/api` → backend). Build: `npm run build`.
- Many UI components use **mocked data** (see notes) — main tasks for an agent are wiring UI to `src/api/*` clients and ensuring integration tests/lint.

---

## Architecture & Key Files 🔧
- Entry: `src/main.tsx` — QueryClient + AuthProvider + Router are set up here.
- API layer: `src/api/client.ts` (central axios instance), `src/api/documentsApi.ts`, `src/api/chatApi.ts`.
  - Use `projectUrl(path)` to build project-scoped endpoints (defaults: namespace=`default`, project=`regsync`).
- Types: `src/types/*` (e.g., `document.ts`, `chat.ts`) define API shapes — prefer these types for request/response objects.
- UI: `src/components/` is split into `admin/`, `user/`, `auth/`, `layout/`, `shared/`.
  - Notable files with mock behavior: `src/components/user/PolicyAssistant.tsx` (chat UI uses a mock `generateMockResponse`) and `src/components/admin/ChangeReview.tsx` (mock `MOCK_CHANGES`).
- Dev server / proxy: `vite.config.ts` proxies `/api` → target `process.env.API_URL || http://localhost:8000` and rewrites `/api` → `/v1`.

---

## Environment & Run Notes ⚠️
- Node 18+ recommended (README says Node.js 18+).
- In development the frontend calls `/api/*` (via `API_BASE_URL = '/api'` in `src/api/client.ts`). Vite rewrites `/api` to the backend `/v1` path.
- Important env var nuance: README references `VITE_API_URL` in example `.env.local`, but `vite.config.ts` reads `process.env.API_URL`. To avoid surprises, set both `API_URL` (for proxy) and `VITE_API_URL` (if needed by README or runtime code).
- There is an instruction in `README.md` to `cp .env.local.example .env.local` but no `.env.local.example` file is present — agents may create one if needed.

---

## Integration patterns & where to wire backend calls 🔗
- Use `apiClient` + `projectUrl` to make calls so interceptors and error handling are applied.
- Chat/RAG: replace `generateMockResponse` in `src/components/user/PolicyAssistant.tsx` with an actual call such as:
  ```ts
  import { chatApi } from '@/api/chatApi'
  const { answer, sources } = await chatApi.chat([{ role: 'user', content: query }], { ragEnabled: true })
  ```
- Document changes & version flows: `src/api/documentsApi.ts` provides `listDocuments`, `getDocument`, `uploadVersion`, `detectChanges`, `compareVersions` — replace mock data in `ChangeReview.tsx` and `AdminDashboard.tsx` to use these.
- Download: use `documentsApi.downloadFile(documentId, versionId)` to fetch blobs when wire-up is needed.

---

## Conventions & Stylistic notes 🧭
- UI styling: Tailwind CSS + shadcn/ui (Radix primitives) — keep consistent classes and the `cn` helper from `src/lib/utils`.
- State & fetching: TanStack React Query is configured in `src/main.tsx`. Use `useQuery` / `useMutation` for server interactions and cache rules defined there (staleTime: 5m, retry: 1).
- Types: Prefer exported types in `src/types` for API responses — they are used pervasively by `src/api/*`.
- Auth: `src/contexts/AuthContext.tsx` contains a *mock* auth provider (two mock users, `admin` and `user`). There is no real auth flow yet — key for testing admin-only routes.

---

## Lint & Tests 🧪
- Linting is configured: `npm run lint` / `npm run lint:fix` (ESLint + TypeScript parser). There are no unit tests present in the repo (no test runner configured).

---

## Helpful examples to search for when coding 🔎
- Replace UI mocks:
  - `src/components/user/PolicyAssistant.tsx` (mock chat response)
  - `src/components/admin/ChangeReview.tsx` (mock changes)
- Use `src/api/chatApi.ts` and `src/api/documentsApi.ts` for the canonical request shapes.
- Auth gating: check `src/contexts/AuthContext.tsx` and usage in `src/components/layout/*`.

---

## Good First Tasks for an agent 🟢
1. Wire `PolicyAssistant` to `chatApi.chat` and display real RAG sources.
2. Replace `MOCK_CHANGES` in `ChangeReview` with `documentsApi.detectChanges` or `compareVersions` and add loading / error states via React Query.
3. Add `.env.local.example` that documents `API_URL` and `VITE_API_URL` to match README and `vite.config.ts`.
4. Add a small integration smoke test (or at least components tests) and a `README` snippet with clear env setup.

---

If anything above is unclear or you'd like me to expand any section (examples, code snippets, or add a quick PR with one of the "Good First Tasks"), tell me which part to improve and I’ll iterate. ✨
