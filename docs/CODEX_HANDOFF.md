# Codex handoff — noca

**As of:** 2026-10-15 (Japan time). **Repository:** [ShunsukeOta/noca](https://github.com/ShunsukeOta/noca), branch `main`. **Preview:** [noca-delta.vercel.app](https://noca-delta.vercel.app).

> **First read:** [../AGENTS.md](../AGENTS.md), [../README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). This handoff is the *current development status*, not a request to implement everything in the roadmap.

## 1. Project goal and design intent

A minimalist, visually polished iPhone PWA for **two people** to manage TODOs, plans and memos. The long-term purpose is to share data between two users; **the current app is a one-device local preview**. Japanese copy, low information clutter, consistent category tones, sticky header, safe-area-aware floating bottom dock, fast but restrained Motion animation.

Design decisions established with the maintainer:
- **Do not** add a fourth global tab.
- Tabs TODO / カレンダー / メモ belong to their **own floating white rounded rectangle**. On TODO/calendar the + button sits **outside the white group**, separated by **16px**, in a dark raised square. Hide it on the memo development-placeholder route.
- TODO begins with color-matched **two-line category tiles + unfinished counts**, without a summary card or “これからすること” section heading.
- TODO categories are user-managed in Settings: add, rename (saved only on changed input blur), choose one of eight design-system tones from the color-dot modal, drag to reorder, and delete. When a category contains TODOs, choose a destination and move them before deletion; an empty category can be deleted directly. Calendar categories remain the built-in set.
- The sticky header’s settings icon changes to an X on `/settings`; it returns to the originating tab, or TODO when Settings is opened directly.
- `/settings` hides the entire bottom global menu and renders immediately without a route transition animation.
- Calendar shows a month grid and a **two-person comparison timeline**, not a conventional list. Personal header = **A and B only**. Hide the all-day row if A, B and shared events have no all-day items; shared all-day items extend across both columns when present. Shared timed items span both timeline lanes. The whole daily surface is **transparent**, not an enclosing white card.
- For a same-owner timed overlap group, keep only the longest appointment as the main block at its true start time. Show the remaining count in an hour-aligned **他N件** chip; tapping it opens an exact-time event list with edit actions. Non-overlapping events remain individual cards, including readable five-minute items.
- Do not add decorative introductions or large headings to the three main screens. Maintain the current visual language, dark mode and accessibility.

## 2. Verified baseline (not hypothetical)

**Latest recorded successful CI before the current UI changes:**
[GitHub Actions run 38532471385](https://github.com/ShunsukeOta/noca/actions/runs/38532471385) — **43/43 Playwright Chromium tests passed**, TypeScript/Vite build passed. The documentation-only commit may run CI again; check the new run. Prior per-phase reports list old counts.

| Area | Status on this baseline |
| --- | --- |
| Shared shell, dock, fixed header, local date, light/dark | Implemented |
| TODO CRUD, user-managed categories and live counts, complete/restore, undo | Implemented with `localStorage`; category configuration is `noca.todo.categories.v1`. New-task creation keeps the sheet open for consecutive entry, briefly shows a green check over the title input's right edge, clears task details after each save, preserves the selected category and focuses the title field; a valid draft is also added when the sheet closes. Editing saves on submit or on close, without a discard confirmation. |
| Calendar month grid, local event CRUD, A/B/both editor, per-person time comparison, overlap summary chips and edit sheet | Implemented with `localStorage` |
| Date-constrained TODOs shown in calendar | Implemented as references, not separate event copies |
| Memo tab | Retained in global navigation; displays only **「メモ機能は開発中です」** |
| Memo list/editor/storage | Deferred and removed from the active app; the memo tab has no + action |
| Shared UI foundation (theme tokens, fields, buttons, checkbox/switch, owner/category controls, confirm/Undo) | Implemented; settings manage TODO categories |
| Login, pairing, actual pair sharing, Firebase/Firestore | **NOT implemented** |
| Push notifications, real iOS Safari/standalone sign-off | **NOT implemented/verified** |

After the shared UI foundation, overlap-summary and category-management changes, `npm run typecheck` and `npm run build` pass. The build reports the existing >500 kB JavaScript chunk warning. Playwright has not been run for the latest category-management changes; the latest recorded CI baseline remains the run linked above. iPhone Safari remains unverified.

**Files that should be opened first in a relevant task:** `src/styles/globals.css`, `src/components/ui/`, `src/components/category-ui.tsx`, `src/components/todo-category-settings.tsx`, `src/components/owner-ui.tsx`, `src/components/app-shell.tsx`, `src/pages/todo-page.tsx`, `src/pages/calendar-page.tsx`, `src/components/calendar-day-timeline.tsx`, `src/pages/memo-page.tsx`, `src/features/todos/todo-store.tsx`, `src/features/calendar/calendar-store.tsx`, `tests/ui.spec.ts`.

## 3. NEXT: Phase 1E — iPhone Safari/PWA QA

Memo CRUD has been deferred. The global memo tab remains and shows only **「メモ機能は開発中です」**; the memo + action, list, editor, sample records, provider and persistence code are removed. Verify that the placeholder and three-tab navigation remain clear at 320/375/390/430px, in light/dark mode and in reduced-motion mode. The memo route is not an editor or storage test target.

If an earlier app version wrote `noca.notes.v1`, leave the key untouched. The current app neither reads nor removes that local data.

Do not silently mark Phase 2 or 3 done.

This is a proposal/acceptance checklist, not an unrequested task authorization.

## 4. Then: Phase 1E and later

- **1E — actual iPhone Safari + Home Screen PWA QA:** keyboard/sheets, native date/time pickers, safe-area/Dock, system theme, screen reader, offline/reload, 320–430px layouts. Use [UI_QA.md](UI_QA.md) as a checklist; record model, iOS version and mode. Chromium screenshots alone are not iPhone WebKit evidence.
- **2 — actual identities and invitations:** Google login, a two-member workspace, invite flow and server-validated membership; design Firestore rules and failure states before integrating.
- **3 — real shared persistence:** Firestore Todo/Event/Note CRUD with secure workspace filtering, data migration/backup, concurrency/conflict handling, sync and error feedback.
- **4–5 — PWA reliability, notifications only when requested, release QA.**

## 5. Current technical cautions

- **Source of truth is local:** `noca.todos.v1`, `noca.calendar.events.v1`, `noca.theme`; samples use `noca.calendar.samples.v2/v3` markers. The current app does not use any memo storage key. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Samples are not users:** TODO new items still default to A; calendar explicitly supports A/B/both. Actual shared identity requires a later design; do not pass demo IDs straight into security rules.
- **The latest calendar redesign is important:** old docs and older images may show three all-day columns. Current UI has **only A/B headers**, conditionally shows the all-day row when any owner has an all-day event, places shared all-day items in a full-width A+B bar, and uses a 54px-per-hour transparent timeline with overlap summary chips and readable standalone short-event cards.
- `package-lock.json` is committed. CI currently uses `npm install` on Node 22; confirm CI behavior before changing it to `npm ci`.
- TODO category configuration is stored separately from TODO records. Existing category names absent from that configuration are retained as neutral categories at load; rename updates matching task category strings, while delete moves them to the user-selected destination. Preserve this behavior when changing the task schema.
- **CI is Chromium**, not real iPhone. WebKit, manual QA, multi-user sync and production availability are unproven.
- Demo data in `src/app/mock-data.ts` uses today's local date at module load. Tests which need deterministic values must control date or seed localStorage before reload.
- `docs/PHASE1*_REPORT.md` are old snapshots; read current stores/components rather than copying their old feature inventory or counts.
- Preserve user local data when updating the store. Existing calendar sample migrations are subtle: version markers and `demo-*` IDs must not produce duplicate/reappearing deleted items.
- Existing drawers should remain usable when the iPhone keyboard is raised; preserve `visualViewport`/safe-area behavior and don't forcibly focus inputs when opening.
- Core user interactions should keep modern transitions but honor Reduced Motion.

## 6. How to prove completion

```bash
npm install
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Check `.github/workflows/ui-check.yml` on each push/PR: the job builds and tests; screenshots can be downloaded from artifact `noca-ui-mobile-preview`. Test failures or unverified iOS cases must be stated without overclaiming.

For handoff after a task, report: **files changed → behavior implemented → validation executed/results → remaining risks → next specific task**. Update this file instead of leaving misleading old status prose in README.
