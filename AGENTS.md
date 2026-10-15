# AGENTS.md — noca development instructions

This file is for Codex and other coding agents working inside this repository. **Read the actual code before implementing.** The app is a local-first **UI preview**, not a functioning multi-user service.

## Read in this order

1. [README.md](README.md) — product, environment, implemented features and limits
2. [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) — **latest handoff**, priorities and acceptance criteria
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current code, state, storage, routes and pitfalls
4. [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — established layout, colors and interaction rules
5. [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/UI_QA.md](docs/UI_QA.md) — future work and iPhone QA
6. The relevant `src/**` files and `tests/ui.spec.ts` **before changing behavior**

Earlier `docs/PHASE1*_REPORT.md` files are **historical snapshots**. If a historical report differs from the running code, **code wins**; update the latest handoff when you intentionally change behavior.

## Project invariants

- Product: minimalist **Japanese-language**, **two-person-oriented** TODO / Calendar / Memo iPhone PWA.
- Main navigation: `/todo`, `/calendar`, `/memo`; settings are `/settings`. Do not add extra global tabs or decorative page titles without direction.
- The **sticky top header** contains the noca brand, current local date, placeholder A/B avatars and settings.
- Bottom navigation: **a floating rounded box containing only three tabs**, a **16px gap**, and a **separate dark raised + button** on TODO/calendar. Hide the + on the memo development-placeholder route. Preserve iPhone safe-area spacing.
- TODO filtering uses **square-rounded, two-line colored category tiles** with **remaining open counts**; there is **no** “残りのタスク” overview box or “これからすること” heading.
- Calendar has a monthly grid plus a **transparent, two-column A/B daily timeline**. All-day `both` events stretch across the A+B width **below** the individual all-day row; there is **no third header/column**. Timed `both` events span both lanes. Nested overlaps keep the longer appointment's title visible; short appointments prioritize readable titles.
- A and B and `both` are **placeholder ownership labels**, **not** actual authenticated users or sharing permission checks.
- TODO and calendar editors are real local CRUD persisted in this browser's `localStorage`; memo is a development placeholder with no editor or persistence. Settings persist the theme and TODO category configuration.
- Do **not** claim that Firebase, authentication, invitations, 2-device sync, real notifications, native iOS verification or memo persistence are implemented.
- Do **not** modify the separate `ShunsukeOta/realtime-todos` repository, its database or deployment.

## Technical conventions

- React 19 + TypeScript + Vite 7, Tailwind CSS 4, Radix/shadcn-derived components, Lucide, Motion, React Router, date-fns.
- Use alias `@/` for `src/`; keep strict TypeScript passing. Follow existing component and store conventions rather than inventing a new global state manager.
- Current data contracts: `src/app/mock-data.ts`. Stores: `src/features/todos/todo-store.tsx` and `src/features/calendar/calendar-store.tsx`; storage keys and demo migration are explained in `docs/ARCHITECTURE.md`.
- Respect existing localStorage data. Do not clear, reseed, rename keys or mutate schema without an explicit compatibility/migration strategy. Preserve undo and old user edits. Never add secrets or actual user data to fixtures.
- Prefer semantic buttons, accessible names, 44px+ tap areas, visible focus, keyboard-friendly inputs and `useReducedMotion()` for animated behavior.
- **iPhone first:** inspect 320, 375, 390 and 430 CSS-pixel widths, light/dark, safe areas, keyboard + sheet behavior. iPhone Safari/standalone is a **separate manual test**, not proven by Playwright's Chromium emulation.
- Styling uses `src/styles/globals.css` and existing Tailwind tokens. Avoid unrelated redesigns and excess UI copy.
- Date-only values are local `yyyy-MM-dd`; optional times are `HH:mm`. No cross-midnight or recurrence contract exists yet.

## Standard workflow for a coding task

1. Read the related spec, implementation and tests; identify current behavior and user's requested change.
2. Make the smallest cohesive change; add or update regression tests.
3. Run `npm run typecheck` or `npm run build` and `npm run test:e2e`. If browser binaries are missing: `npx playwright install chromium` (Linux CI uses `--with-deps`).
4. Inspect screenshots where layout changed. GitHub Actions `.github/workflows/ui-check.yml` repeats build + Chromium tests and uploads `noca-ui-mobile-preview` artifacts.
5. Update README / architecture / handoff / design specification **when behavior changes**. Do not leave old feature counts or outdated instructions presented as current.
6. Report what changed, commit/PR or workflow link, exact verification outcome and unverified items. **Never call an unrun test “passed.”**

## Agent operating rules

- Reply to the maintainer in Japanese. Clarify only genuinely blocking ambiguities; otherwise use existing design decisions.
- Do not add Firebase, paid external services, unrelated dependencies or backend architecture without an explicit task.
- Prefer scoped commits/PRs and avoid force-pushing; honor the maintainer's requested branch/workflow.
- `package-lock.json` is currently **not committed**. Use `npm install` in this repository as CI does; consider adding a lockfile in a *separate, explicitly reviewed* dependency-hygiene change.
- Leave existing local preview data intact. Back up test/dev data before any destructive changes.

**Starting the next planned feature?** Read [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md). Memo CRUD is deferred; proceed with **Phase 1E (iPhone Safari/PWA QA)** unless the maintainer requests otherwise.
