# Firebase Phase 2 setup

Updated: 2026-10-15

## Scope

This phase adds Google sign-in, one workspace per account, a one-use invitation link, and server-enforced membership capped at two people. The app still stores TODOs, categories, calendar events and theme in the existing browser `localStorage` keys. Signing in or joining a workspace does **not** upload or share those records; cloud CRUD and migration are Phase 3.

The raw invite token is generated with browser cryptography and appears only in the URL fragment (`/join#…`), which is not sent as part of the HTTP request path. Firestore stores the SHA-256 token hash as the invitation document ID. The link expires in about 24 hours; issuing another link invalidates the prior one. The acceptance transaction updates the invitation, workspace, member record and account mapping together. Firestore Security Rules enforce the same constraints on the server, including the two-member limit.

This phase uses Firestore transactions and Security Rules instead of Cloud Functions. Firebase currently requires a Blaze billing account to deploy Cloud Functions; keeping this small membership flow in Rules avoids adding that runtime requirement. If the security cases below do not pass against the deployed Rules, do not weaken the Rules to make the UI work; revisit the trusted backend design first.

## Configure a Firebase project

1. Create a Firebase project and register a Web app.
2. In Authentication, enable **Google** as a sign-in provider.
3. Add the local development hostname and each deployed app hostname to Authentication's authorized domains. Google sign-in uses a redirect so it can return to the invite route on mobile.
4. Create a Cloud Firestore database. Choose its location deliberately in Firebase Console; this repository does not select or create a database region.
5. Copy `.env.example` to `.env.local` and fill in the Web app's `apiKey`, `authDomain`, `projectId`, `appId`, and optional sender/storage values. These Web app settings are public client configuration, not server credentials. Do not put Admin SDK credentials or service-account keys in `VITE_*` variables.
6. Sign in to Firebase CLI, then deploy the rules from the repository root:

   ```powershell
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
   ```

7. Start the app with `npm run dev`. With Firebase values absent, the app stays in local preview mode and keeps the existing one-person behavior.

## Current behavior

- Google login and logout use Firebase Authentication.
- A signed-in account can create one workspace or accept an invitation while it has no workspace.
- Only the workspace owner can create or reissue the invite. It can be accepted once; a second concurrent acceptance or a third member is rejected by the Firestore transaction/rules.
- An accepted member appears as B. The settings screen states that TODO/calendar sharing is still pending; existing local data is neither migrated nor rewritten.
- The previous `noca.workspace.members.v1` preview value is retained on disk, but configured Firebase builds do not read or overwrite it.
- Workspace deletion, changing a member, leaving a workspace, email-bound invites, and data migration are not included in this phase.

## Before calling Phase 2 complete

The maintainer reports completing Firebase Web app registration, Google Auth enablement, Firestore database creation and Rules deployment. The `noca-delta.vercel.app` host is authorized, and the four Firebase client values are configured in Vercel Production and Preview. The application source still needs a Preview deployment; add that exact deployment hostname to Firebase Authentication's authorized domains if Google sign-in requires it.

Then verify with two separate Google accounts that sign-in, workspace creation, invite acceptance, expired/reissued links, second use and a third-member attempt behave as described. A signed-in user without an active invitation must not read workspace or member data. During an active invitation, the invite route can read the minimal workspace document needed to accept; member records remain readable only by workspace members. Until these live checks are recorded, Phase 2 remains in progress.
