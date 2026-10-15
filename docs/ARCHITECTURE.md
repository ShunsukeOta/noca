# noca — Current architecture (implementation reference)

Updated: 2026-10-15. Based on the current local implementation. This document describes **what exists now**, not the future architecture in `SPECIFICATION.md`.

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

`package-lock.json` is committed; CI currently uses `npm install` rather than `npm ci`.

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
- sticky header with noca logo, **local today** (updates across midnight and app focus), placeholder A/B avatars and settings link; on `/settings`, the settings icon becomes a close link that returns to the originating tab (or TODO for a direct URL);
- `<main>` with page enter/exit animation;
- bottom floating dock on the three main tabs: **3 tabs in a left white card + 16px gap + separate dark + CTA**; the CTA is hidden on the memo placeholder. The entire dock is hidden on `/settings`, which renders without a route transition animation;
- TODO and calendar editor sheets, shared Undo notices and theme state;
- `/settings` retains tabs but does not show + button.

`src/components/ui/sheet.tsx` implements reusable Radix-based mobile drawer, viewport/keyboard handling; do not replace blindly.

Shared UI foundation:
- `src/components/ui/`: Button, Input, Textarea, Label, Checkbox, Switch, mobile Sheet and ConfirmDialog. Form controls share typography, borders, focus rings and invalid states.
- `src/components/category-ui.tsx` and `src/components/owner-ui.tsx`: common category badges/selectors and A/B/both avatars/selectors. TODO editor uses the horizontally scrolling, palette-filled category tile selector; its 「詳細を入力」 section contains the due date, memo, URL and address fields. Creating a TODO keeps the sheet open, briefly overlays a green check at the title input's right edge, clears the draft fields, retains the selected category and returns focus to the title input; editing a TODO saves and closes the sheet.
- `src/components/undo-toast.tsx`: shared delete Undo notice; simultaneous TODO/calendar notices stack in one host.
- `src/styles/globals.css` is the source of truth for light/dark palette, owner/category meaning colors, weekend/calendar accents and radius steps. Avoid component-local hex values.
- Motion-driven controls use the shared `buttonVariants` styles where wrapping the Button component would interfere with layout animation.

## 4. Data and persistence (critical)

### Domain types

Defined in `src/app/mock-data.ts`:

- `Task`: `{id, title, category, dueDate?, memo?, url?, address?, done, by:"A"|"B"}`
- `CalendarEvent`: `{id, title, date, time?, endTime?, address?, memo?, category, by:"A"|"B"|"both"}`
- `TaskCategory`: `"暮らし" | "おでかけ" | "ふたり" | "その他"`

### Storage keys

| Key | Writer | Meaning |
| --- | --- | --- |
| `noca.todos.v1` | `TodoProvider` | JSON array of tasks; category names remain on each task |
| `noca.todo.categories.v1` | `TodoProvider` | Ordered TODO category names and palette tone keys |
| `noca.calendar.events.v1` | `CalendarProvider` | JSON array of events; loaded on startup |
| `noca.calendar.samples.v2` | Calendar store | One-time migration marker for old bundled examples |
| `noca.calendar.samples.v3` | Calendar store | One-time migration marker for shared/overlap example events |
| `noca.theme` | `AppShell` | `light` or `dark` |

`loadTodos` and `readEvents` validate selected fields and use initial mock arrays only on absent/invalid data. **A legitimately stored empty array remains empty**. Existing TODO records keep their category names in `noca.todos.v1`; the category configuration stores `{ id, name, tone }` items in display order. Existing configurations without `id` receive one during load. On first load, built-in categories are used and any category already referenced by a saved TODO but missing from the configuration is retained with the neutral tone. Renaming a category updates the associated TODO names; deleting one moves its TODOs to a selected remaining category before removing the category. Category tones use eight theme-defined palette choices; earlier `life`/`outing`/`couple` tone keys are normalized to their matching palette choices on load. Browser storage deletion means losing local-only edits. Browser `storage` events update providers across tabs **of the same origin**, not a real shared account or reliable two-device sync.

There is currently no memo model, sample list, store or persistence path. The `/memo` route is a placeholder. If `noca.notes.v1` was written by an earlier local preview, this version intentionally leaves that key untouched and does not read or display it.

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
- Two-line **category tiles** show the all filter and user-managed categories in configured order. Categories can be added, renamed (saved on input blur only when changed), assigned one of eight palette tones, reordered by a drag handle, and deleted with a required destination for associated TODOs. The built-in calendar category set remains unchanged. No redundant summary card/heading. Active/completed tasks, category filtering, creation/edit/complete/delete/Undo, due dates and optional details persist locally.

### Calendar
- Month UI: `src/pages/calendar-page.tsx`
- Two-person time grid: `src/components/calendar-day-timeline.tsx`
- Store/editor: `src/features/calendar/calendar-store.tsx`, `src/components/calendar-editor-sheet.tsx`

**Current approved preview layout:**
- Header and all-day personal lane: **A / B only**, with 42px time/label gutter. **No third “ふたりの予定” column.** Hide the all-day row when A, B and shared events have no all-day items.
- All-day shared (`by:"both"`) appointments are **full-width A+B chips underneath the A/B all-day row**.
- Timed personal appointments appear in separate A/B lanes; shared appointments stretch across both lanes as a purple layer.
- The schedule surface is transparent, with only subtle ruler/column borders. Time scale: **54px / hour**.
- Overlapping timed appointments **do not split lane width or stack multiple cards**. For each connected overlap group, the longest appointment remains as the primary card at its true start time; the other items are summarized by an hour-aligned **他N件** chip on its right side. Tapping the chip opens a sheet with every exact time and an edit action.
- Non-overlapping appointments remain individual cards. Compact short events have a **36px minimum rendered height** and prioritize the title over time text. The shared `both` lane applies the same grouping independently from A and B.
- Preserve chip hit areas, sheet-to-editor handoff and z-index when changing complex overlaps.

This is a sophisticated **preview visualization**, not a general-purpose interval scheduler with exhaustively verified behavior for many nested/cross-day events. Extend it with focused tests if changing overlap math.

### Memo
- `src/pages/memo-page.tsx` displays only **「メモ機能は開発中です」**. The global navigation tab remains, and the + action is hidden while this route is active.
- Memo list, editor, sample records, state and persistence code are deferred. There is no currently supported memo CRUD behavior.

### Settings
- `src/pages/settings-page.tsx` handles theme through `AppShell` outlet context; appearance is persisted. TODO category management is in `src/components/todo-category-settings.tsx` and backed by `TodoProvider`.
- Sharing, invite, auth, notifications and cloud sync options are labeled **準備中** (no implementation).

## 6. Design and mobile considerations

- Core CSS tokens, theme values, safe areas: `src/styles/globals.css`; transition overrides: `src/styles/animations.css`.
- Sticky header sits within document flow; lower navigation uses safe-area-inset-bottom.
- Input sheet uses `visualViewport` to remain above the keyboard and should not autofocus on open. Memo forms reuse this behavior.
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
- Memo CRUD and persistence are currently deferred. A legacy `noca.notes.v1` key may remain in browser storage but this version does not access or delete it.
- Calendar demo migration and multiple overlapping events require caution; protect user-generated items from any sample reset.
- Arbitrarily many nested events, very short events, personal/shared collisions and accessibility need dedicated edge tests and iPhone verification.
- CI has Chromium emulation, not real WebKit/iOS.
- No committed npm lockfile yet, and no separate lint/unit-test script in `package.json`.
