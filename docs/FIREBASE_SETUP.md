# Firebase Auth and shared data setup

Updated: 2026-10-16

## Scope

Phase 2 adds Google sign-in, one workspace per account, a one-use invitation link, and server-enforced membership capped at two people. Phase 3 adds optional workspace-scoped Firestore storage for TODOs, TODO categories and calendar events. Theme remains per device; Memo remains deferred. Signing in or joining a workspace alone does **not** upload records: a user must explicitly choose a sync start mode in Settings.

The raw invite token is generated with browser cryptography and appears only in the URL fragment (`/join#…`), which is not sent as part of the HTTP request path. Firestore stores the SHA-256 token hash as the invitation document ID. The link expires in about 24 hours; issuing another link invalidates the prior one. The acceptance transaction updates the invitation, workspace, member record and account mapping together. Firestore Security Rules enforce the same constraints on the server, including the two-member limit.

Membership and record mutations use Firestore transactions and Security Rules instead of Cloud Functions. If the security cases below do not pass against the deployed Rules, do not weaken the Rules to make the UI work; revisit the trusted backend design first.

## Configure a Firebase project

1. Create a Firebase project and register a Web app.
2. In Authentication, enable **Google** as a sign-in provider.
3. Add the local development hostname and each deployed app hostname to Authentication's authorized domains. Google sign-in opens a popup and returns to the page where it started.
4. Create a Cloud Firestore database. Choose its location deliberately in Firebase Console; this repository does not select or create a database region.
5. Copy `.env.example` to `.env.local` and fill in the Web app's `apiKey`, `authDomain`, `projectId`, `appId`, and optional sender/storage values. These Web app settings are public client configuration, not server credentials. Do not put Admin SDK credentials or service-account keys in `VITE_*` variables.
6. Sign in to Firebase CLI, then deploy the rules from the repository root:

   ```powershell
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
   ```

7. Start the app with `npm run dev`. With Firebase values absent, the app stays in local preview mode and keeps the existing one-person behavior.

## Current behavior

- Google login and logout use Firebase Authentication. Login uses `signInWithPopup` because the app is hosted on Vercel while Firebase Auth uses a separate domain; browsers that block third-party storage can otherwise fail to restore redirect sign-in state. If the browser blocks popups, allow popups for the app and retry.
- A signed-in account can create one workspace or accept an invitation while it has no workspace.
- Only the workspace owner can create or reissue the invite. It can be accepted once; a second concurrent acceptance or a third member is rejected by the Firestore transaction/rules.
- An accepted member appears as B. Membership and item data are separate; shared data is not activated until the user chooses a start mode in Settings.
- The previous `noca.workspace.members.v1` preview value is retained on disk, but configured Firebase builds do not read or overwrite it.
- Workspace deletion, changing a member, leaving a workspace and email-bound invites are not included.

## Phase 3 shared data activation

After Google login and workspace creation/invite acceptance, open **設定 → データ**. Choose one of the following:

- **この端末のデータを追加して開始:** add this browser's existing TODOs, categories and calendar events to the shared workspace, then use the cloud copy on this browser. The old localStorage values are left intact and reappear after logout.
- **共有データだけで開始:** begin with the current workspace records and leave this browser's existing localStorage untouched. The Settings data panel can add this browser's local records later.

The importer retries partial work safely. Category IDs reconcile by normalized name. TODO/event documents use a stable ID derived from the original local record ID, so repeated imports (including the same IDs copied to another browser) do not overwrite or duplicate the same source records. Separately created records with matching text but different IDs remain separate and may appear as duplicates; review them after each device migration.

Once active, TODOs, categories and calendar events use these member-only paths:

```text
workspaces/{workspaceId}/todos/{recordId}
workspaces/{workspaceId}/todoCategories/{recordId}
workspaces/{workspaceId}/calendarEvents/{recordId}
workspaces/{workspaceId}/syncConflicts/{mutationId}
workspaces/{workspaceId}/syncDevices/{installId}
```

Live Firestore listeners refresh both members' views. The last verified workspace/member summary is cached in localStorage per authenticated UID so a previously opened workspace can be selected after an offline restart. Offline edits are stored in a workspace-scoped localStorage snapshot/outbox and retried after reconnect or from **再同期**. Hashed Firebase JavaScript chunks are cached at runtime after online use and are intentionally excluded from the install precache. Stale concurrent edits are kept as unresolved conflicts; Settings lets a member choose this device's version or the latest shared version. Delete uses a soft tombstone so the existing Undo action can restore it. Clearing browser storage removes that browser's unuploaded outbox; export a JSON backup before clearing it. Memo and notifications do not sync.

For offline use, first open the configured app online, sign in and activate shared sync on that browser/PWA so its Firebase code, workspace summary and records have been fetched and cached. Google sign-in, new invitations and sending queued edits still require a connection. Validate the target iPhone Safari/PWA separately.

## Push notifications

The Settings notification switches are per device. The app sends event reminders 30 minutes before a timed event (all-day events have no reminder time), TODO deadline reminders at 09:00 in the device's saved timezone on the due date, and a notification to the other workspace member when a new TODO or calendar event is added. Editing or deleting an existing item does not send a shared-update notification. Local-only records are not visible to the server and cannot generate reminders; activate Firestore sync first. Imported batches skip the shared-update notification to avoid sending one alert per migrated record.

Push uses the standard Web Push API and the app service worker. iPhone requires iOS 16.4 or later and the Home Screen installed app; the initial notification permission request happens from a Settings switch tap. The server uses Firebase Cloud Functions, Firestore triggers and one five-minute scheduled job. Deploying Cloud Functions requires Firebase's Blaze plan and a linked billing account; review the [Firebase pricing plan details](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Cloud Functions quotas and billing notes](https://firebase.google.com/docs/functions/quotas), and set budget alerts before deployment. The scheduled reminders use a single Cloud Scheduler job; Firebase documents the current job allowance and pricing in [scheduled functions](https://firebase.google.com/docs/functions/schedule-functions).

### Configure Web Push keys

1. From `functions/`, install the backend packages and generate one VAPID key pair:

   ```powershell
   cd functions
   npm install
   npx web-push generate-vapid-keys
   cd ..
   ```

   Keep the **private key** secret. Do not paste it into `.env.local`, Vercel, source files, or chat.

2. Copy `functions/.env.example` to `functions/.env.YOUR_FIREBASE_PROJECT_ID`. Put the **public key** in `PUSH_VAPID_PUBLIC_KEY`. Keep `PUSH_VAPID_SUBJECT` set to the app's HTTPS origin. This project-specific file is git-ignored.

3. Add the same public key to `.env.local` as `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, and add that variable to Vercel Production and Preview as a **Config** value. It is public client configuration. The private key belongs in Firebase Secret Manager:

   ```powershell
   npx firebase-tools functions:secrets:set PUSH_VAPID_PRIVATE_KEY --project YOUR_FIREBASE_PROJECT_ID
   ```

   Paste the private key at the CLI prompt. Firebase Functions reads it only through the bound Secret Manager parameter.

4. Build and deploy the Rules, collection-group indexes and functions:

   ```powershell
   npm run build:functions
   npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions --project YOUR_FIREBASE_PROJECT_ID
   ```

   The Functions source currently uses `asia-northeast1`, which suits a Japan-hosted project. If the Firestore database is in another region, update `FUNCTION_REGION` in `functions/src/index.ts` to match before deploying. Keep `functions/.env.YOUR_FIREBASE_PROJECT_ID`, the private key and any generated key output out of Git.

5. Redeploy the Vercel app with `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, open the installed Home Screen app, sign in, activate shared sync, then enable the desired switches under Settings → Notifications. Each device needs its own permission and registration. Check reminders and partner-added notifications on two separate devices; a local browser preview cannot receive server-scheduled reminders.

The latest Firestore Rules allow each signed-in member to read, create, update and remove only their own subscription document. Push endpoints and encryption keys are never readable by the other member from the client. Admin Functions read registrations to deliver notifications and remove expired endpoints. Delivery markers make retrying Firestore event triggers and scheduler runs idempotent.

The repository's current `firestore.rules` includes these data paths. Deploy the latest checked-in Rules before using shared sync:

```powershell
npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

## Before calling Phase 2 or Phase 3 complete

The maintainer reports completing Firebase Web app registration, Google Auth enablement, Firestore database creation and Rules deployment. The `noca-delta.vercel.app` host is authorized, and the four Firebase client values are configured in Vercel Production and Preview. The application source still needs a Preview deployment; add that exact deployment hostname to Firebase Authentication's authorized domains if Google sign-in requires it.

First deploy the current Rules and Preview source. Then verify with two separate Google accounts that sign-in, workspace creation, invite acceptance, expired/reissued links, second use and a third-member attempt behave as described. A signed-in user without an active invitation must not read workspace or member data. During an active invitation, the invite route can read the minimal workspace document needed to accept; member records remain readable only by workspace members.

For Phase 3, use two devices/browsers signed into the two workspace accounts. Verify both activation choices, local data preservation, same-ID import idempotency, live create/edit/delete/Undo, offline edit + reload + reconnect, concurrent same-item edits and both conflict choices, backup export/restore, and rejection of a non-member reading/writing shared record paths. Check the actual Firestore Rules in the target Firebase project. Until these checks are recorded, Phase 2/3 remain in progress; local typecheck/build alone does not prove remote configuration or security.
