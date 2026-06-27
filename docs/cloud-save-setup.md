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

## Provisioning steps

1. **Create the project.** A free-tier Supabase project named `dynasty-manager`
   (org "Wrexist's Org"). *Note: the org currently sits at the 2-active-free-project
   limit — pause an unused project or upgrade before creating this one.*
2. **Apply the migration.** `supabase db push` against the project, or paste
   `supabase/migrations/0001_cloud_saves.sql` into the SQL editor. This creates
   the private `saves` bucket and the owner-only RLS policies.
3. **Enable anonymous auth.** Dashboard → Authentication → Providers →
   **Allow anonymous sign-ins = ON**. Without this, `signInAnonymously()` fails
   and the app reports "Could not reach the cloud".
4. **Set the secrets.** Copy the project URL and the **anon** (public) key into:
   - local: `.env.local` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - CI / release builds: the same two as build secrets.
   The anon key is a public client key (safe to ship); it is *not* the service-role key.
5. **Verify.** Run the app in-game → Settings → **Cloud Backup** → "Back Up to
   Cloud", then on a second device/profile "Restore from Cloud". Confirm the
   save round-trips and that a second anonymous user cannot read the first
   user's objects (RLS).

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

## Phase 1b (not yet built)

- **Sign in with Apple** upgrade (anonymous → Apple via identity linking).
  Needs native entitlements + the Apple provider configured in Supabase Auth.
- **Account deletion** (Apple 5.1.1(v)): delete the user's storage objects + auth
  user. `deleteAllDynastyData()` already wipes local data; add a server-side
  delete (Edge Function/RPC) for the cloud copy.
- **Privacy-label update** — declare the account identifier + game-save data.
