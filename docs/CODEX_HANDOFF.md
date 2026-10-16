# Codex handoff — noca

**As of:** 2026-10-15 (Japan time). **Repository:** [ShunsukeOta/noca](https://github.com/ShunsukeOta/noca), branch `main`. **Preview:** [noca-delta.vercel.app](https://noca-delta.vercel.app).

> **First read:** [../AGENTS.md](../AGENTS.md), [../README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). This handoff is the *current development status*, not a request to implement everything in the roadmap.

## 1. Project goal and design intent

A minimalist, visually polished iPhone PWA for **two people** to manage TODOs, plans and memos. Without Firebase configuration, the app is a one-device local preview; configured builds now support real Google accounts and workspace membership, while TODO/calendar data remains local. Japanese copy, low information clutter, consistent category tones, sticky header, safe-area-aware floating bottom dock, fast but restrained Motion animation.

Design decisions established with the maintainer:
- **Do not** add a fourth global tab.
- Tabs TODO / カレンダー / メモ belong to their **own floating white rounded rectangle**. On TODO/calendar the + button sits **outside the white group**, separated by **16px**, in a dark raised square. Hide it on the memo development-placeholder route.
- TODO begins with color-matched **two-line category tiles + unfinished counts**, without a summary card or “これからすること” section heading.
- TODO categories are user-managed in Settings: add, rename (saved only on changed input blur), choose one of eight design-system tones from the color-dot modal, drag to reorder, and delete. When a category contains TODOs, choose a destination and move them before deletion; an empty category can be deleted directly. Calendar categories remain the built-in set.
- The sticky header’s settings icon changes to an X on `/settings`; it returns to the originating tab, or TODO when Settings is opened directly.
- `/settings` hides the entire bottom global menu and renders immediately without a route transition animation.
- Calendar shows a month grid and a timeline that follows the member count. With one member, show one unlabeled personal lane and no B owner UI. With two members, show the **A/B comparison timeline**; hide the all-day row when no owner has all-day events, and span shared events across both columns. The daily surface stays transparent, not an enclosing white card.
- For a same-owner timed overlap group, keep only the longest appointment as the main block at its true start time. Show the remaining count in an hour-aligned **他N件** chip; tapping it opens an exact-time event list with edit actions. Non-overlapping events remain individual cards, including readable five-minute items.
- Do not add decorative introductions or large headings to the three main screens. Maintain the current visual language, dark mode and accessibility.

## 2. Current verified state

The current Phase 2 source passes `npm run build`, `npm run check:bundle`, **50/50 Playwright Chromium tests**, and **4/4 production PWA tests**. E2E coverage is local-preview mode because `.env.local` has no Firebase values. Firebase-backed login and invitation behavior still needs a deployed Preview and two-account verification. Older per-phase reports contain stale counts.

| Area | Status on this baseline |
| --- | --- |
| Shared shell, dock, fixed header, local date, light/dark | Implemented |
| TODO CRUD, user-managed categories and live counts, complete/restore, undo | Implemented with `localStorage`; category configuration is `noca.todo.categories.v1`. New-task creation keeps the sheet open for consecutive entry, briefly shows a green check over the title input's right edge, clears task details after each save, preserves the selected category and focuses the title field; a valid draft is also added when the sheet closes. Editing saves on submit or on close, without a discard confirmation. |
| Calendar month grid, local event CRUD, solo-first timeline, paired A/B/both editor, overlap summary chips and edit sheet | Implemented with `localStorage`; Firebase membership can switch the UI to A/B, but event data is not shared |
| Date-constrained TODOs shown in calendar | Implemented as references, not separate event copies |
| Memo tab | Retained in global navigation; displays only **「メモ機能は開発中です」** |
| Memo list/editor/storage | Deferred and removed from the active app; the memo tab has no + action |
| Membership display | Starts with 「自分」 in local preview. With Firebase configured, Google-authenticated Firestore members drive the actual A/B count. |
| Shared UI foundation (theme tokens, fields, buttons, checkbox/switch, owner/category controls, confirm/Undo) | Implemented; settings manage TODO categories |
| Local data backup | **Implemented:** Settings exports and restores TODOs, TODO categories, calendar events and sample-migration flags as versioned JSON. Restore validates the file, previews counts, requires explicit replacement confirmation and rolls back storage writes on failure. |
| Google login, workspace creation, invite link and acceptance | Source implemented. The maintainer registered the Firebase Web app, enabled Google Auth, created Firestore, deployed the Rules, authorized `noca-delta.vercel.app`, and added the four client config values to Vercel Production and Preview. Live sign-in/invite checks remain. |
| TODO/calendar sharing and local-to-cloud migration | **NOT implemented.** Both stores remain local; existing localStorage keys/data are unchanged. |
| Push notifications | Not implemented |
| iPhone Safari/standalone QA | Maintainer reports Phase 1E complete; device and case details are not in the repository. New Phase 2 screens have not been checked on iPhone. |

The earlier optimization commit `ffc8b7e` passed build, bundle, E2E (**49/49**) and production PWA (**4/4**) checks; GitHub Actions run [38695136243](https://github.com/ShunsukeOta/noca/actions/runs/38695136243) is recorded. The current Phase 2 tree also passes build, bundle, **50/50 E2E**, and **4/4 PWA**. The maintainer reports Phase 1 iPhone Safari/standalone QA complete; new Phase 2 screens remain unverified on-device.

The performance pass defers `/calendar`, both editor sheets, Settings' category manager, the Firebase membership bridge and Motion's layout feature bundle. The current initial JavaScript is **436.08 kB raw / 139.45 kB gzip**; the largest chunk is **458.21 kB**. The PWA precache is **650.71 KiB** against a **652 KiB** budget. Network-only Firebase SDK/service and invitation-route chunks are excluded from offline precache; local TODO/calendar pages and editors remain offline-capable (PWA 4/4).

**Files that should be opened first in a relevant task:** `src/styles/globals.css`, `src/components/ui/`, `src/components/category-ui.tsx`, `src/components/todo-category-settings.tsx`, `src/components/owner-ui.tsx`, `src/components/app-shell.tsx`, `src/pages/todo-page.tsx`, `src/pages/calendar-page.tsx`, `src/components/calendar-day-timeline.tsx`, `src/pages/memo-page.tsx`, `src/features/todos/todo-store.tsx`, `src/features/calendar/calendar-store.tsx`, `tests/ui.spec.ts`.

## 3. NEXT: connect and verify Phase 2

The product specification selects Firebase Authentication + Firestore. Current Phase 2 source uses Firestore rules and atomic client transactions for membership and does not add a callable backend function.

Current order:
1. Deploy the current source to a Vercel Preview using the configured Firebase environment values; add that exact Preview hostname to Firebase Authentication's authorized domains if required.
2. Verify sign-in, workspace creation, invite acceptance, reissue/expiry, one-use behavior, third-member denial and non-member read denial with separate accounts. Record the results before marking Phase 2 complete.
3. Check the new Settings and invite screens in Safari/PWA; the maintainer's earlier Phase 1E check predates these screens.
4. Plan Phase 3 local-to-cloud migration and conflict/Undo behavior around the existing `noca.local-backup` v1 envelope before moving any data.

Memo CRUD remains deferred until its user workflow is specified.

## 4. Phase 1E — iPhone Safari/PWA QA (maintainer-confirmed)

The maintainer reports the original Phase 1E device QA complete. Device, OS version and per-case evidence were not added to the repository. The newer Phase 2 Settings and invite screens were not part of that earlier QA. Memo CRUD remains deferred. The global memo tab remains and shows only **「メモ機能は開発中です」**; memo list/editor/storage code is deferred.

If an earlier app version wrote `noca.notes.v1`, leave the key untouched. The current app neither reads nor removes that local data.

Do not silently mark Phase 2 or 3 done. Firebase Rules and environment configuration are prepared, but the current app source still needs a Preview deployment and live account/invitation verification. TODO/calendar sharing and migration remain Phase 3.

## 5. Later phases

- **1E — actual iPhone Safari + Home Screen PWA QA:** maintainer reports completion; device/case details are not recorded. The Phase 2 screens still need a focused device check.
- **2 — actual identities and invitations:** Google login, one workspace per account, invite flow and server-validated membership. Source, Firebase project setup, deployed Rules and Vercel config are ready; Preview and live acceptance checks remain.
- **3 — real shared persistence:** Firestore Todo/Event/Note CRUD with secure workspace filtering, data migration/backup, concurrency/conflict handling, sync and error feedback.
- **4–5 — PWA reliability, notifications only when requested, release QA.**

## 6. Current technical cautions

- **TODO/calendar source of truth is still local:** `noca.todos.v1`, `noca.calendar.events.v1`, `noca.theme`; samples use `noca.calendar.samples.v2/v3` markers. The current app does not use any memo storage key. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Local records are not users:** TODOs and events still store A/B/both owner values. With Firebase configured, accepted workspace members supply A/B for display, but existing records are not mapped to authenticated user IDs and are not shared. Do not use local owner values as authorization.
- **Paired calendar layout:** when membership contains A and B, show only A/B headers, conditionally show the all-day row, place shared all-day items in a full-width A+B bar, and use the 54px-per-hour transparent timeline with overlap summary chips. Firebase membership can now supply B after an invite is accepted; item data is still local.
- `package-lock.json` is committed. CI currently uses `npm install` on Node 22; confirm CI behavior before changing it to `npm ci`.
- TODO category configuration is stored separately from TODO records. Existing category names absent from that configuration are retained as neutral categories at load; rename updates matching task category strings, while delete moves them to the user-selected destination. Preserve this behavior when changing the task schema.
- **CI is Chromium**, not real iPhone. WebKit, manual QA, multi-user sync and production availability are unproven.
- Demo data in `src/app/mock-data.ts` uses today's local date at module load. Tests which need deterministic values must control date or seed localStorage before reload.
- `docs/PHASE1*_REPORT.md` are old snapshots; read current stores/components rather than copying their old feature inventory or counts.
- Preserve user local data when updating the store. Existing calendar sample migrations are subtle: version markers and `demo-*` IDs must not produce duplicate/reappearing deleted items.
- Existing drawers should remain usable when the iPhone keyboard is raised; preserve `visualViewport`/safe-area behavior and don't forcibly focus inputs when opening.
- Core user interactions should keep modern transitions but honor Reduced Motion.

## 7. How to prove completion

```bash
npm install
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Check `.github/workflows/ui-check.yml` on each push/PR: the job builds and tests; screenshots can be downloaded from artifact `noca-ui-mobile-preview`. Test failures or unverified iOS cases must be stated without overclaiming.

For handoff after a task, report: **files changed → behavior implemented → validation executed/results → remaining risks → next specific task**. Update this file instead of leaving misleading old status prose in README.
