# Codex handoff — noca

**As of:** 2026-10-16 (Japan time). **Repository:** [ShunsukeOta/noca](https://github.com/ShunsukeOta/noca), current task working tree (do not infer branch/push state from this note). **Preview:** [noca-delta.vercel.app](https://noca-delta.vercel.app).

> **First read:** [../AGENTS.md](../AGENTS.md), [../README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). This handoff is the *current development status*, not a request to implement everything in the roadmap.

## 1. Project goal and design intent

A minimalist, visually polished iPhone PWA for **two people** to manage TODOs, plans and memos. Without Firebase configuration, the app is a one-device local preview. With Firebase, signed-in members can explicitly activate shared TODO/category/calendar data; Memo remains a development placeholder. Japanese copy, low information clutter, consistent category tones, sticky header, safe-area-aware floating bottom dock, fast but restrained Motion animation.

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

The previous Phase 2 baseline passed `npm run build`, `npm run check:bundle`, **50/50 Playwright Chromium tests**, and **4/4 production PWA tests**. This working tree passes `npm run typecheck`, `npm run build`, `npm run check:bundle`, and `npm run build:functions`; current bundle measurements are listed below. Playwright suites, Firestore Rules emulator/deployment, Firebase/two-device acceptance and iPhone delivery have not been run for the current notification changes. E2E coverage in the old baseline was local-preview mode because `.env.local` had no Firebase values. Older per-phase reports contain stale counts.

| Area | Status on this baseline |
| --- | --- |
| Shared shell, dock, fixed header, local date, light/dark | Implemented |
| TODO CRUD, user-managed categories and live counts, complete/restore, undo, completed-row restore/permanent delete | Implemented with `localStorage`; category configuration is `noca.todo.categories.v1`. The completed list exposes a restore icon and a permanent-delete icon. On a synced workspace, permanent deletion removes the task document and retains only an ID/revision marker to prevent stale offline copies from restoring its content. New-task creation keeps the sheet open for consecutive entry, briefly shows a green check over the title input's right edge, clears task details after each save, preserves the selected category and focuses the title field; a valid draft is also added when the sheet closes. Editing saves on submit or on close, without a discard confirmation. |
| Calendar month grid, event CRUD, solo-first timeline, paired A/B/both editor, overlap summary chips and edit sheet | Device-local with `localStorage` until shared sync activation; then workspace Firestore CRUD/live updates |
| Initial TODO/calendar data | Starts empty. A load filter removes exact untouched legacy demo ID/title pairs from local data, backups and shared caches; edited titles and unrelated user records are preserved. Online shared workspaces also soft-delete matching imported demo records. |
| Date-constrained TODOs shown in calendar | Implemented as references, not separate event copies |
| Memo tab | Retained in global navigation; displays only **「メモ機能は開発中です」** |
| Memo list/editor/storage | Deferred and removed from the active app; the memo tab has no + action |
| PWA app shortcuts and invite sharing | Source implemented: manifest offers “TODOを追加” and “今日の予定” shortcuts on platforms that expose manifest shortcuts; Settings offers OS sharing for invite URLs when Web Share API is available and retains copy. iPhone Home Screen shortcut visibility and native share target behavior need manual device verification. |
| Push notifications | Client switches, Web Push service-worker handling, owner-only Firestore subscription Rules, indexes and Firebase Functions are implemented in source. Reminders are scheduled 30 minutes before timed events and at 09:00 local time on TODO due dates; new TODO/event documents notify the other member. VAPID setup, Blaze billing, Rules/indexes/functions deployment, Vercel public-key configuration and real iPhone/two-device delivery checks remain. |
| Membership display | Starts with 「自分」 in local preview. With Firebase configured, Google-authenticated Firestore members drive the actual A/B count; the header shows each available Google profile photo and falls back to the display-name initial. |
| Shared UI foundation (theme tokens, fields, buttons, checkbox/switch, owner/category controls, confirm/Undo) | Implemented; settings manage TODO categories |
| Local data backup | **Implemented:** Settings exports and restores TODOs, TODO categories, calendar events and sample-migration flags as versioned JSON. Restore validates the file, previews counts, requires explicit replacement confirmation and rolls back storage writes on failure. |
| Google login, workspace creation, invite link and acceptance | Source implemented. Firebase Web app, Google Auth, Firestore and Vercel client configuration were prepared per maintainer; Phase 2 live sign-in/invite/Rules checks remain. The previous Firestore Rules deployment predates the new data paths. |
| TODO/category/calendar sharing, local-to-cloud migration, offline queue, conflicts | Implemented in the current source; user explicitly activates it in Settings. Existing localStorage is not overwritten. New Rules deploy and real two-device acceptance remain. |
| iPhone Safari/standalone QA | Maintainer reports Phase 1E complete; device and case details are not in the repository. New Phase 2 screens have not been checked on iPhone. |

The earlier optimization commit `ffc8b7e` passed build, bundle, E2E (**49/49**) and production PWA (**4/4**) checks; GitHub Actions run [38695136243](https://github.com/ShunsukeOta/noca/actions/runs/38695136243) is recorded. The prior Phase 2 baseline also passed build, bundle, **50/50 E2E**, and **4/4 PWA**, but that result predates the current Phase 3 work. The maintainer reports Phase 1 iPhone Safari/standalone QA complete; Phase 2/3 screens remain unverified on-device.

The earlier performance pass deferred `/calendar`, both editor sheets, Settings' category manager, the Firebase membership bridge and Motion's layout feature bundle. Its initial JavaScript was **436.08 kB raw / 139.45 kB gzip**; the largest chunk was **458.21 kB**. Its PWA precache was **650.71 KiB** against a **652 KiB** budget. Before the current PWA changes, working-tree measurements were **447.53 kB / 143.04 kB gzip initial JavaScript**, **455.25 kB largest chunk**, and **674.02 KiB PWA precache / 676 KiB budget**. After invite sharing and shortcut handling they were **449.23 kB / 143.50 kB gzip**, **455.25 kB**, and **675.95 KiB / 676 KiB**. Current measurements after notification UI and service-worker support: **449.32 kB / 143.45 kB gzip initial JavaScript**, **483.56 kB largest chunk**, and **677.48 KiB PWA precache / 682 KiB budget**. The precache includes the small push handler; notification controls are lazy-loaded and runtime-cached after first use. Firebase SDK/service and invite chunks remain outside installation precache, while hashed Firebase JS is cache-first at runtime after online use.

**Files that should be opened first in a relevant task:** `src/styles/globals.css`, `src/components/ui/`, `src/components/category-ui.tsx`, `src/components/todo-category-settings.tsx`, `src/components/owner-ui.tsx`, `src/components/app-shell.tsx`, `src/pages/todo-page.tsx`, `src/pages/calendar-page.tsx`, `src/components/calendar-day-timeline.tsx`, `src/pages/memo-page.tsx`, `src/features/todos/todo-store.tsx`, `src/features/calendar/calendar-store.tsx`, `tests/ui.spec.ts`.

## 3. NEXT: complete Phase 3 implementation validation and Firebase acceptance

The source now has workspace-scoped Firestore CRUD for TODOs, TODO categories and calendar events, Settings activation choices, deterministic additive migration, live listeners, a durable offline outbox, revision conflicts and conflict resolution. Memo remains deferred. This is **not complete for real use** until the changed Rules are deployed and both Phase 2 and Phase 3 are accepted against Firebase.

Current order:
1. Run `npm run test:e2e` and `npm run test:pwa` against the current build. Add focused regression coverage for provider wiring, migration idempotency, localStorage preservation, offline retry and conflict resolution, then run it.
2. Validate `firestore.rules` with the Firebase emulator/rules tests and deploy the current rules to the intended Firebase project. The previously deployed Phase 2-only Rules do not authorize the new data collections.
3. Deploy a Preview with current source and configured Firebase values; add that exact hostname to Firebase Auth authorized domains if required.
4. Verify Phase 2 with two distinct accounts: sign-in, workspace create, invite, reissue/expiry, one-use, third-member rejection and non-member data access denial.
5. Verify Phase 3 on two devices/browsers: both activation modes, same-ID migration idempotency, distinct record handling, live CRUD and Undo, local data preservation/logout, offline edit/reload/reconnect, same-item conflict with both resolution choices, and backup restore.
6. Check Settings/invite/sync screens in Safari and installed PWA. The maintainer's Phase 1E check predates these flows.
7. Configure a VAPID pair, the public Vercel variable and the Firebase private secret; deploy current Firestore Rules, indexes and Functions on a billing-enabled Firebase project. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
8. Test notifications from two real devices: permission flow from the installed iPhone app, 30-minute timed-event reminder, TODO reminder at 09:00 local time, other-member new TODO/event notification, notification tap navigation and disabling/removing a device subscription. Imported records should not generate a burst of shared-update alerts.

Do not mark Phase 2/3 done until remote Rules and account/device acceptance are recorded. Notification source compiles, but it is not operational until VAPID keys, Rules/indexes and Firebase Functions are deployed and the iPhone/two-device checks pass. Typecheck/build do not prove live sync, server delivery or push behavior.

Memo CRUD remains deferred until its user workflow is specified.

## 4. Phase 1E — iPhone Safari/PWA QA (maintainer-confirmed)

The maintainer reports the original Phase 1E device QA complete. Device, OS version and per-case evidence were not added to the repository. The newer Phase 2 Settings and invite screens were not part of that earlier QA. Memo CRUD remains deferred. The global memo tab remains and shows only **「メモ機能は開発中です」**; memo list/editor/storage code is deferred.

If an earlier app version wrote `noca.notes.v1`, leave the key untouched. The current app neither reads nor removes that local data.

Do not silently mark Phase 2 or 3 done. Firebase environment configuration was prepared by the maintainer, but the new data Rules need deployment, and the current source needs Preview plus live account/invitation and shared-data verification.

## 5. Later phases

- **1E — actual iPhone Safari + Home Screen PWA QA:** maintainer reports completion; device/case details are not recorded. The Phase 2 screens still need a focused device check.
- **2 — actual identities and invitations:** Google login, one workspace per account, invite flow and server-validated membership. Source and Firebase/Vercel client configuration were prepared; Preview and live acceptance checks remain. Existing project Rules predate the current Phase 3 data paths.
- **3 — real shared persistence:** Firestore TODO/category/event CRUD with secure workspace filtering, additive migration/backup, offline queue, concurrency/conflict handling and sync status. Memo is deferred.
- **4–5 — PWA reliability, notifications only when requested, release QA.**

## 6. Current technical cautions

- **Source of truth depends on explicit activation:** before activation, TODO/categories/events use legacy local keys; after activation, active stores use workspace Firestore with per-workspace cache/outbox keys. Logout returns to original device-local data. Theme remains `noca.theme`; `noca.calendar.samples.v2/v3` remain only for old backup-format compatibility and no longer trigger sample insertion. The app does not use a memo storage key. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Local records are not users:** TODOs and events store A/B/both owner values. Accepted workspace members supply A/B for display, but these values are not mapped to authenticated user IDs and must not be used as authorization. After sync activation, item data is shared through workspace membership.
- **Paired calendar layout:** when membership contains A and B, show only A/B headers, conditionally show the all-day row, place shared all-day items in a full-width A+B bar, and use the 54px-per-hour transparent timeline with overlap summary chips. Firebase membership can supply B after invite acceptance; shared event data requires explicit sync activation.
- `package-lock.json` is committed. CI currently uses `npm install` on Node 22; confirm CI behavior before changing it to `npm ci`.
- TODO category configuration is stored separately from TODO records. Existing category names absent from that configuration are retained as neutral categories at load; rename updates matching task category strings, while delete moves them to the user-selected destination. Preserve this behavior when changing the task schema.
- **CI is Chromium**, not real iPhone. WebKit, manual QA, multi-user sync and production availability are unproven.
- Runtime demo records were removed. UI tests seed separate fixtures with IDs that cannot be mistaken for legacy production samples.
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
