# Cloud Save — Setup & Provisioning (Online Slice 1)

Manual cloud **Back up / Restore** of save slots, backed by Supabase
(Auth + Storage). Anonymous-first: every install silently gets an identity, so
players can back up without creating an account. A later **Sign in with Apple**
upgrade (phase 1b) keeps the same identity so backups carry over.

The feature is **dark until provisioned** — with the env vars unset,
`isCloudConfigured()` is false, the Settings "Cloud Backup" section doesn't
render, and `supabase-js` is never loaded. So this can ship merged and inert,
then light up the moment the backend exists and the secrets are set.

## What's in the repo

| Piece | Path |
|---|---|
| Env-gated lazy client | `src/utils/supabaseClient.ts` |
| Backup / restore / list logic | `src/utils/cloudSave.ts` |
| Settings UI (gated) | `src/components/game/CloudBackupSection.tsx` → rendered by `SettingsPage.tsx` |
| Storage bucket + RLS migration | `supabase/migrations/0001_cloud_saves.sql` |
| Tests (mocked client) | `src/test/cloudSave.test.ts` |
| Env var docs | `.env.example` |

## Provisioning status (2026-06-27)

| Step | State |
|---|---|
| Project created — `dynasty-manager`, ref **`ucfqhluvuvakfordrexr`**, region eu-north-1, free tier | ✅ done |
| Migration applied — private `saves` bucket + 4 owner-only RLS policies (verified via SQL: 1 bucket, 4 policies) | ✅ done |
| Security advisors | ✅ clean (no lints) |
| URL | `https://ucfqhluvuvakfordrexr.supabase.co` |
| **Enable anonymous sign-ins** | ⛔ **manual — do this** (no API/MCP toggle) |
| **Set `VITE_SUPABASE_*` secrets** (`.env.local` + CI) | ⛔ **manual — do this** |
| Live round-trip verification | ⏳ on-device only — the CI/sandbox network policy blocks `*.supabase.co`, so it can't be checked from there |

### Remaining manual steps

1. **Enable anonymous auth.** Dashboard → Authentication → Sign In / Providers →
   **Anonymous sign-ins = ON**. Without this, `signInAnonymously()` fails and the
   app reports "Could not reach the cloud". (Disabled by default; there is no
   Management-API/MCP toggle, so it must be done in the dashboard.)
2. **Set the secrets.** Put the project URL + **anon** (public) key into:
   - local: `.env.local` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - CI / release builds: the same two as build secrets.
   The anon key is a public client key (safe to ship); it is *not* the service-role key.
3. **Verify on-device.** App → Settings → **Cloud Backup** → "Back Up to Cloud",
   then on a second device/profile "Restore from Cloud". Confirm the save
   round-trips and that a second anonymous user cannot read the first user's
   objects (RLS). The repo's `src/test/cloudSave.test.ts` already covers the
   client logic against a mocked backend; this step confirms the live wiring.

> Note: storage objects default to a 50 MB per-file limit on the free tier —
> comfortably above a full save. Raise the bucket's `file_size_limit` if saves
> ever approach it.

## Storage layout

Private bucket `saves`, one folder per auth uid:

```
<uid>/slot_1        ← full raw save string
<uid>/slot_1.meta   ← { clubName, season, week, gameMode, schemaVersion, sizeBytes, updatedAt }
<uid>/slot_2 …
```

RLS allows a user to read/write/delete only objects whose first path segment
equals their `auth.uid()`. The `.meta` sidecar lets the Settings list show
"Arsenal · S3 W12" without downloading the (multi-MB) blob.

## Design decisions

- **Manual sync, not auto.** The match engine is non-deterministic and there are
  3 slots; a silent auto-merge would be a footgun. The player chooses when to
  push/pull.
- **Restore validates before overwriting.** A corrupt/truncated download is
  rejected and the local save is left untouched — cloud data can never destroy a
  good local save.
- **Lazy SDK.** `supabase-js` is dynamically imported so it never enters the
  eager bundle (`npm run size:check` stays green).

## Phase 1b — built, pending native config

**Code shipped (dark until configured):**
- **Sign in with Apple** — `src/utils/cloudAuth.ts` + `AccountSection` in Settings.
  Native plugin `@capacitor-community/apple-sign-in` → `signInWithIdToken`. Nonce
  flow verified against installed type defs (Apple gets the hashed nonce, Supabase
  the raw). On sign-in, local saves are re-uploaded under the durable Apple
  identity. Tests in `src/test/cloudAuth.test.ts`.
- **Account deletion** — `delete-account` Edge Function (deployed, verify_jwt on)
  removes the user's Storage folder + deletes the auth user; client `deleteAccount()`
  is wired into Settings → "Delete All My Data". `deleteAllDynastyData()` handles
  the local half.

**Native config you must do (can't be done from code / this sandbox):**
1. **Apple Developer** — enable the "Sign in with Apple" capability on the app id;
   create a Services ID + key for the web/Supabase callback.
2. **Supabase** — Authentication → Providers → **Apple**: add the Service ID +
   key, and list the iOS **bundle id** as an authorized client id.
3. **Xcode** — add the "Sign in with Apple" capability to the iOS target, then
   `npm run cap:sync`.
4. **Env** — set `VITE_APPLE_CLIENT_ID` (normally the bundle id) alongside the
   `VITE_SUPABASE_*` vars. Blank = Apple sign-in button hidden (guest-only).
5. **Verify on device** — Settings → Account → "Sign in with Apple" → confirm the
   session upgrades from guest to Apple and a backup round-trips; then test
   "Delete All My Data" removes the cloud account.

**Still open:** App Store Connect **privacy-nutrition labels** — declare the
account identifier + game-save data (linked to identity, NOT used for tracking) —
and a **privacy-policy** update describing cloud backup. (Outward-facing; draft
before publishing.)
