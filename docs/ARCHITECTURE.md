# noca — Current architecture (implementation reference)

Updated: 2026-10-14. Based on the code in `main` when the Codex handoff was prepared. This document describes **what exists now**, not the future architecture in `SPECIFICATION.md`.

## 1. Product / runtime boundaries

- iPhone-first Japanese PWA for a pair: TODO, monthly + daily calendar, notes.
- **Single-browser local preview:** there is no backend service, Firebase SDK initialization, login, workspace, invitation, member identity or real-time cross-device synchronization.
- UI is constrained to a 540px max-width app shell (`src/styles/globals.css`). Current browser preview: [noca-delta.vercel.app](https://noca-delta.vercel.app); deployed from GitHub/Vercel setup. Deploy success must be checked separately from CI.
- Phase 1 targets CSS/UX. Security rules, data ownership, cross-user identity and transport are future decisions.

## 2. Technology

| Responsibility | Implementation |
| --- | --- |
| Rendering | React 19, TypeScript 5, Vite 7, `@vitejs/plugin-react` |
| UI | Tailwind CSS 4 (`@tailwindcss/vite`), Radix Dialog/Slot, local shadcn-style components |
| Routing | `react-router-dom` v7, `BrowserRouter` |
| Dates | `date-fns` v4; Japanese locale |
| Animation | `motion/react` with `useReducedMotion` and `AnimatePresence` |
| Icons | `lucide-react` |
| PWA | `vite-plugin-pwa`, auto-update service worker, manifest in `vite.config.ts` |
| Persistence | `localStorage` through React Context providers, **not Firestore** |
| Tests | Playwright with Chromium (`tests/ui.spec.ts`) |
| CI | GitHub Actions `.github/workflows/ui-check.yml`, Node.js 22, `npm install`, build + browser tests |

`package-lock.json` is absent as of this handoff; CI uses `npm install` rather than `npm ci`.

## 3. Routes and composition

`src/main.tsx`:
- imports global style and Motion stylesheet; invokes `registerSW({ immediate: true })`;
- mounts `<BrowserRouter><App/></BrowserRouter>` under React StrictMode.

`src/App.tsx`:
```text
TodoProvider
  CalendarProvider
    Routes
      AppShell  (common layout)
        /todo       TodoPage
        /calendar   CalendarPage
        /memo       MemoPage
        /settings   SettingsPage
        *           Navigate("/todo")
```

`src/components/app-shell.tsx`:
- sticky header with noca logo, **local today** (updates across midnight and app focus), placeholder A/B avatars and settings link;
- `<main>` with page enter/exit animation;
- bottom floating dock: **3 tabs in a left white card + 16px gap + separate dark + CTA**; CTA opens current tab's editor, including a memo *non-saving preview*;
- TODO and calendar editor sheets, undo notices and theme state;
- `/settings` retains tabs but does not show + button.

`src/components/ui/sheet.tsx` implements reusable Radix-based mobile drawer, viewport/keyboard handling; do not replace blindly.

## 4. Data and persistence (critical)

### Domain types

Defined in `src/app/mock-data.ts`:

- `Task`: `{id, title, category, dueDate?, memo?, url?, address?, done, by:"A"|"B"}`
- `CalendarEvent`: `{id, title, date, time?, endTime?, address?, memo?, category, by:"A"|"B"|"both"}`
- `SharedNote`: `{id, title, body, updated, pinned?}` **mock/read-only**
- `TaskCategory`: `"暮らし" | "おでかけ" | "ふたり" | "その他"`

### Storage keys

| Key | Writer | Meaning |
| --- | --- | --- |
| `noca.todos.v1` | `TodoProvider` | JSON array of tasks; loaded on startup |
| `noca.calendar.events.v1` | `CalendarProvider` | JSON array of events; loaded on startup |
| `noca.calendar.samples.v2` | Calendar store | One-time migration marker for old bundled examples |
| `noca.calendar.samples.v3` | Calendar store | One-time migration marker for shared/overlap example events |
| `noca.theme` | `AppShell` | `light` or `dark` |

`loadTodos` and `readEvents` validate selected fields and use initial mock arrays only on absent/invalid data. **A legitimately stored empty array remains empty**. Browser storage deletion means losing local-only edits. Browser `storage` events update providers across tabs **of the same origin**, not a real shared account or reliable two-device sync.

The calendar initializer can append versioned `demo-*` sample events to existing *sample-containing* calendars once. **This is preview-data migration logic**; do not silently reseed user data, recreate previously deleted samples or treat marker flags as real DB migrations. Preserve local edit/delete/Undo and migration behavior when refactoring. Initial demo dates are relative to the runtime date.

`crypto.randomUUID()` creates TODO and calendar IDs. Both stores implement CRUD and delete/Undo notifications with a roughly 6.5-second window. New TODOs currently default to `by:"A"`; calendar editor allows A, B or `both`.

Time semantics:
- Date only: local `yyyy-MM-dd`.
- Optional event start/end times: `HH:mm`. All-day event = no `time`. When `endTime` is omitted, timeline visualizes ~60 minutes, **not** a saved default end time.
- End before/equal start is rejected by editor for same-day entry. Cross-midnight events and recurrence are not supported.

### Calendar → TODO connection

`src/pages/calendar-page.tsx` reads **both** stores:
- dates with open due-date TODOs receive a separate calendar dot;
- the selected date shows events in the timeline and open due-date TODOs in a distinct list;
- pressing a TODO opens its real TODO editor;
- **no duplicate event records are created for TODOs**.

## 5. Feature modules and current UI rules

### TODO
- Page: `src/pages/todo-page.tsx`
- Store: `src/features/todos/todo-store.tsx`
- Editor: `src/components/todo-editor-sheet.tsx`
- Two-line **category tiles** (すべて / おでかけ / 暮らし / ふたり / その他) display open counts. No redundant summary card/heading. Active/completed tasks, category filtering, creation/edit/complete/delete/Undo, due dates and optional details persist locally.

### Calendar
- Month UI: `src/pages/calendar-page.tsx`
- Two-person time grid: `src/components/calendar-day-timeline.tsx`
- Store/editor: `src/features/calendar/calendar-store.tsx`, `src/components/calendar-editor-sheet.tsx`

**Current approved preview layout:**
- Header and all-day personal lane: **A / B only**, with 42px time/label gutter. **No third “ふたりの予定” column.**
- All-day shared (`by:"both"`) appointments are **full-width A+B chips underneath the A/B all-day row**.
- Timed personal appointments appear in separate A/B lanes; shared appointments stretch across both lanes as a purple layer.
- The schedule surface is transparent, with only subtle ruler/column borders. Time scale: **54px / hour**.
- Nested overlapping appointments **do not split lane width**: long event stays behind shorter event, which is slightly inset; the long event's label is repositioned toward the longest available free interval. Compact short events have a **36px minimum rendered height** and prioritize the title over time text.
- Cards remain editable. Be careful with stacking, hit areas and z-index when adding complex overlaps.

This is a sophisticated **preview visualization**, not a general-purpose interval scheduler with exhaustively verified behavior for many nested/cross-day events. Extend it with focused tests if changing overlap math.

### Memo
- `src/pages/memo-page.tsx` uses `mockNotes` directly for **search, list and read-only sheet**.
- `src/components/preview-create-sheet.tsx` is the + CTA preview **without persistence**. No notes Context/store or localStorage key exists yet.
- **Phase 1D** is to add real memo creation/editing/deletion, validation and persistence.

### Settings
- `src/pages/settings-page.tsx` handles theme through `AppShell` outlet context; appearance is persisted.
- Sharing, invite, auth, notifications and cloud sync options are labeled **準備中** (no implementation).

## 6. Design and mobile considerations

- Core CSS tokens, theme values, safe areas: `src/styles/globals.css`; transition overrides: `src/styles/animations.css`.
- Sticky header sits within document flow; lower navigation uses safe-area-inset-bottom.
- Input sheet uses `visualViewport` to remain above the keyboard and should not autofocus on open. New memo forms should reuse it unless a full-screen editor is explicitly needed.
- Motion is subtle and disabled/reduced when `prefers-reduced-motion` is active.
- Primary testing widths: 320, 375, 390, 430 CSS px, including dark mode; compare interactive controls and overflow.
- Real iPhone Safari and Home Screen PWA verification is **NOT complete**.

## 7. Testing, releases, and historical docs

Local:
```bash
npm install
npm run dev
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts its own Vite server at `http://127.0.0.1:5173`; Chromium only. `npm run build` already runs TypeScript project references. CI uploads screenshots and diagnostics from `test-results/` and `playwright-report/` as `noca-ui-mobile-preview`.

Routes use a SPA fallback in `vercel.json`. Deployment at Vercel can occur on main updates, but **a green Actions run does not prove a successful live deployment**.

`docs/PHASE1A_REPORT.md`, `PHASE1B_REPORT.md`, `PHASE1C_REPORT.md` capture older phase checkpoints and test counts; **they are not current feature inventories**. Use `docs/CODEX_HANDOFF.md` + actual code for the latest baseline.

## 8. Known boundaries / engineering risks

- No auth, database, shared live updates, invitation, permission model or push notifications yet.
- No actual memo persistence; no offline data-sync contract, even though PWA static cache/service-worker support is configured.
- Calendar demo migration and multiple overlapping events require caution; protect user-generated items from any sample reset.
- Arbitrarily many nested events, very short events, personal/shared collisions and accessibility need dedicated edge tests and iPhone verification.
- CI has Chromium emulation, not real WebKit/iOS.
- No committed npm lockfile yet, and no separate lint/unit-test script in `package.json`.
