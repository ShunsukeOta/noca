# noca — Current architecture (implementation reference)

Updated: 2026-10-15. Based on the current local implementation. This document describes **what exists now**, not the future architecture in `SPECIFICATION.md`.

## 1. Product / runtime boundaries

- iPhone-first Japanese PWA for a pair: TODO, monthly + daily calendar, notes.
- **Single-browser local preview:** the app starts with one local member named 「自分」. A small membership context controls whether solo or paired UI is shown, but it is not an account, invite, workspace permission or cross-device synchronization system. There is no backend service or Firebase SDK initialization.
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
- imports global styles, then starts service worker registration after the window `load` event so installation does not compete with first-screen resources;
- mounts `<LazyMotion><BrowserRouter><App/></BrowserRouter></LazyMotion>` under React StrictMode. The Motion layout/drag feature bundle loads asynchronously after the first render.

`src/App.tsx`:
```text
WorkspaceMembershipProvider  (local preview starts with member A only)
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

The `/calendar` page module is loaded with `React.lazy` when the route is opened. Global navigation preloads it on pointer intent or keyboard focus. TODO and the Settings page shell remain in the initial bundle. TODO/calendar editor sheets and Settings' category manager load when opened, with pointer/focus preloading. Settings' header and theme render while its category module loads. `motion/react`'s `m` components use an asynchronously loaded `domMax` feature bundle for the existing layout animations. The local providers still initialize on first load. Workbox precaches all built JavaScript, including deferred chunks, so these changes reduce initial parse/evaluation rather than total offline download size. The manifest icon is precached through the PWA manifest without a duplicate SVG glob entry.

`src/components/app-shell.tsx`:
- sticky header with noca logo, **local today** (updates across midnight and app focus), current-member avatar and settings link; solo preview shows only 「自分」, and a second avatar appears only when membership state contains B. On `/settings`, the settings icon becomes a close link that returns to the originating tab (or TODO for a direct URL);
- `<main>` with page enter/exit animation;
- bottom floating dock on the three main tabs: **3 tabs in a left white card + 16px gap + separate dark + CTA**; the CTA is hidden on the memo placeholder. The entire dock is hidden on `/settings`, which renders without a route transition animation;
- TODO and calendar editor sheets, shared Undo notices and theme state;
- `/settings` hides the entire dock.

`src/components/ui/sheet.tsx` implements reusable Radix-based mobile drawer, viewport/keyboard handling; do not replace blindly.

Shared UI foundation:
- `src/components/ui/`: Button, Input, Textarea, Label, Checkbox, Switch, mobile Sheet and ConfirmDialog. Form controls share typography, borders, focus rings and invalid states.
- `src/components/category-ui.tsx` and `src/components/owner-ui.tsx`: common category badges/selectors and A/B/both avatars/selectors. TODO editor uses the horizontally scrolling, palette-filled category tile selector; its 「詳細を入力」 section contains the due date, memo, URL and address fields. Creating a TODO keeps the sheet open, briefly overlays a green check at the title input's right edge, clears the draft fields, retains the selected category and returns focus to the title input; editing a TODO saves and closes the sheet.
- `src/features/workspace/workspace-membership.tsx`: local preview membership state defaults to one member. The calendar hides owner controls and B labels in solo mode, places saved A/B/both events in one unlabeled personal lane, and restores the comparison layout when two members are supplied. Settings shows the current member count; there is no user-facing way to join a second member until auth/invite work is implemented.
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
| `noca.workspace.members.v1` | `WorkspaceMembershipProvider` | Local preview members; defaults to A/「自分」 only and is not an identity or permission record |
| `noca.theme` | `AppShell` | `light` or `dark` |

`loadTodos` and `readEvents` validate selected fields and use initial mock arrays only on absent/invalid data. **A legitimately stored empty array remains empty**. Existing TODO records keep their category names in `noca.todos.v1`; the category configuration stores `{ id, name, tone }` items in display order. Existing configurations without `id` receive one during load. On first load, built-in categories are used and any category already referenced by a saved TODO but missing from the configuration is retained with the neutral tone. Renaming a category updates the associated TODO names; deleting one moves its TODOs to a selected remaining category before removing the category. Category tones use eight theme-defined palette choices; earlier `life`/`outing`/`couple` tone keys are normalized to their matching palette choices on load. Browser storage deletion means losing local-only edits. Browser `storage` events update providers across tabs **of the same origin**, not a real shared account or reliable two-device sync.

### Portable local backup

Settings can export and restore the in-memory TODOs, ordered TODO categories and calendar events as a JSON file. `src/features/data/local-backup.ts` defines the stable envelope: `format: "noca.local-backup"`, `version: 1`, an ISO `exportedAt`, the calendar sample-migration flags under `localState`, and the three arrays under `data`. The export includes optional TODO/event details such as memo, URL and address. It does not include theme. On browsers that support file sharing, Settings passes a JSON `File` to the native share sheet; otherwise it downloads the file with a local-date filename. Restore accepts files up to 20 MiB, validates all records and references before showing a count preview, and requires explicit confirmation before replacing current TODOs, categories and events. It writes to the existing storage keys; if a write fails, it attempts to roll back every touched key before reporting the error. Export does not write to or clear any existing storage key. Automatic cloud migration is not implemented.

There is currently no memo model, sample list, store or persistence path. The `/memo` route is a placeholder. If `noca.notes.v1` was written by an earlier local preview, this version intentionally leaves that key untouched and does not read or display it.

The calendar initializer can append versioned `demo-*` sample events to existing *sample-containing* calendars once. **This is preview-data migration logic**; do not silently reseed user data, recreate previously deleted samples or treat marker flags as real DB migrations. Preserve local edit/delete/Undo and migration behavior when refactoring. Initial demo dates are relative to the runtime date.

`crypto.randomUUID()` creates TODO and calendar IDs. Both stores implement CRUD and delete/Undo notifications with a roughly 6.5-second window. New TODOs currently default to `by:"A"`. In solo mode the calendar editor hides the owner selector and creates events for A; it also preserves existing B/`both` assignments when editing without exposing those labels. The local membership context starts with A/「自分」 and paired controls/layout activate only when a B member is provided. The invite flow that would provide that member is not implemented.

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
- Membership-aware time grid: `src/components/calendar-day-timeline.tsx`
- Store/editor: `src/features/calendar/calendar-store.tsx`, `src/components/calendar-editor-sheet.tsx`

**Current layout by membership state:**
- One member: header shows only 「自分」; TODO rows omit owner avatars; calendar has one unlabeled time lane and no owner selector. Existing A/B/`both` records remain visible in that lane without rewriting their stored owner values.
- Two members: the comparison layout below is used. The local preview currently has no invite/acceptance flow, so real users cannot reach this state through the app UI yet.
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
- `src/pages/settings-page.tsx` handles theme through `AppShell` outlet context; appearance is persisted. TODO category management is in `src/components/todo-category-settings.tsx` and backed by `TodoProvider`. The Data section exports and restores TODOs, TODO categories and calendar events using the versioned envelope in `src/features/data/local-backup.ts`.
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
npm run check:bundle
npx playwright install chromium
npm run test:e2e
npm run test:pwa
```

The normal Playwright suite starts a Vite development server at `http://127.0.0.1:5173`; the production PWA suite starts `vite preview` at port 4173 and verifies deferred loading and offline navigation/editing after precache. Both use Chromium. `npm run build` already runs TypeScript project references. `npm run check:bundle` enforces entry JS, largest-chunk and PWA precache budgets from the Vite manifest and generated service worker. CI uploads screenshots and diagnostics from `test-results/` and `playwright-report/` as `noca-ui-mobile-preview`.

Routes use a SPA fallback in `vercel.json`. Deployment at Vercel can occur on main updates, but **a green Actions run does not prove a successful live deployment**.

`docs/PHASE1A_REPORT.md`, `PHASE1B_REPORT.md`, `PHASE1C_REPORT.md` capture older phase checkpoints and test counts; **they are not current feature inventories**. Use `docs/CODEX_HANDOFF.md` + actual code for the latest baseline.

## 8. Known boundaries / engineering risks

- No auth, database, shared live updates, invitation, permission model or push notifications yet.
- Memo CRUD and persistence are currently deferred. A legacy `noca.notes.v1` key may remain in browser storage but this version does not access or delete it.
- Calendar demo migration and multiple overlapping events require caution; protect user-generated items from any sample reset.
- Arbitrarily many nested events, very short events, personal/shared collisions and accessibility need dedicated edge tests and iPhone verification.
- CI has Chromium emulation, not real WebKit/iOS.
- `package-lock.json` is committed. There is no separate lint/unit-test script in `package.json`.
