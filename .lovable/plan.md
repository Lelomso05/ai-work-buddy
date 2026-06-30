
# AI Workplace Productivity Assistant — Core Build

Building a clean, professional workplace productivity app with a blue/cyan corporate theme. Starting with the **core slice** (4 pages + shell); remaining features come in follow-up turns.

## Phase 1 scope (this build)

1. **Auth** — Email/password + Google sign-in via Lovable Cloud
   - `/auth` public route (sign in / sign up tabs)
   - Protected app behind `_authenticated/` layout
2. **App shell** — Responsive sidebar (collapsible, mobile hamburger), top header with user menu, dark/light mode toggle
3. **Dashboard** (`/`) — Welcome message, productivity score card, upcoming tasks preview, recent AI activity, quick action buttons
4. **Tasks** (`/tasks`) — Full CRUD, priority (high/med/low), due date, complete toggle, **AI "Prioritize my day" button**
5. **AI Chat** (`/chat`) — Streaming chat assistant using AI Elements components, message history persisted per user

## Phase 2 (deferred to follow-up turns)

Email Generator, Meeting Notes Summarizer, Document Summarizer, Analytics dashboard with charts, Productivity Tips, Profile page. Each is small enough to add cleanly once core is approved.

## Design direction

- **Palette**: Primary `#2563EB` (blue), accent `#06B6D4` (cyan), bg `#F8FAFC`, cards white, success green, warning orange. Full dark mode tokens.
- **Style**: Rounded cards (radius ~`0.75rem`), subtle glassmorphism on key surfaces (backdrop-blur + translucent white/dark), soft shadows, gradient header accents (blue→cyan), Lucide icons, smooth Tailwind transitions.
- **Typography**: Inter via `@fontsource/inter` (clean corporate default).
- All colors as semantic tokens in `src/styles.css` using `oklch`.

## Technical architecture

- **Stack**: TanStack Start + React + TS + Tailwind v4 + shadcn (already scaffolded)
- **Backend**: Lovable Cloud (Supabase) — enabled this turn
- **AI**: Lovable AI Gateway, default model `google/gemini-3-flash-preview`
  - Chat: streaming via `src/routes/api/chat.ts` + `useChat` + AI Elements
  - Task prioritization: `createServerFn` with structured output
- **Auth**: Managed `_authenticated/route.tsx` gate; Google via `lovable.auth.signInWithOAuth`; configure social auth provider in same turn

## Database (Lovable Cloud)

Tables with RLS + grants (auth.uid() scoped):

- `profiles` — id (FK auth.users), full_name, job_title, department, avatar_url
- `tasks` — id, user_id, title, description, priority (enum: high/medium/low), due_date, completed, ai_suggested_priority, created_at
- `chat_threads` — id, user_id, title, updated_at
- `chat_messages` — id, thread_id, role, parts (jsonb UIMessage[]), created_at
- Trigger: auto-create `profiles` row on signup

## Routes

```
src/routes/
  __root.tsx              (existing — add auth listener, theme provider)
  index.tsx               → redirect to /dashboard or /auth
  auth.tsx                → sign in / sign up
  api/chat.ts             → streaming chat endpoint
  _authenticated/
    route.tsx             (managed)
    dashboard.tsx
    tasks.tsx
    chat.tsx
    chat.$threadId.tsx    (threaded chat URLs)
```

## Chat shape

Per `chat-agent-ui-contract`: **threaded conversations + database persistence**. Thread list sidebar inside `/chat`, dedicated `/chat/$threadId` route, AI Elements (`conversation`, `message`, `prompt-input`, `shimmer`) installed.

## Out of scope this turn

Email Generator, Meeting Notes, Document Summarizer, Analytics, Tips, Profile page — added after you approve and try the core.
