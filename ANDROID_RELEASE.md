# Android Release Runbook — Dynasty Manager

> One ordered checklist to take the existing Capacitor Android project from
> "scaffolded" to "live on Google Play". The **code is ready**; everything left
> is accounts, keys, store config, and pushing the build button.
>
> Companion guides (deeper detail): `google-play-guide.txt` (store listing) and
> `IAP_SETUP_GUIDE.md` (RevenueCat / in-app purchases).

## What's already done (in this repo)

- ✅ Android platform scaffolded — `android/` (Capacitor 8.3.1, AGP 8.13, Gradle 8.14.3, compileSdk/targetSdk 36, minSdk 24).
- ✅ `npx cap sync android` runs clean — all 9 Capacitor plugins resolve for Android.
- ✅ `AndroidManifest.xml`: INTERNET permission, portrait lock, `launchMode="singleTop"` (required for IAP), adaptive launcher icons.
- ✅ Ads fully disabled (`NATIVE_ADS_READY=false`) with a guardrail test — no AdMob in the binary.
- ✅ `android/app/build.gradle` reads signing + version from env; skips `google-services.json` gracefully (push disabled).
- ✅ `capacitor.config.ts` has an `android` block (non-debuggable WebView, no mixed content, dark splash background).
- ✅ `src/utils/purchases.ts` picks the RevenueCat key per platform (`goog_` on Android, `appl_` on iOS).
- ✅ CI: `.github/workflows/android-build.yml` builds a signed release **AAB** on manual dispatch (`versionCode` defaults to the run number).

## What you still need to do

Estimated time: ~1–2 hours of work, spread over a few days (Google review + identity verification have their own clocks).

---

### Step 1 — Generate the signing keystore (once, ~5 min)

The keystore is **permanent**: every future update must be signed with the same
key, or Google Play rejects it. Generate it once on any machine with a JDK:

```bash
keytool -genkey -v \
  -keystore dynasty-manager.keystore \
  -alias dynasty-manager \
  -keyalg RSA -keysize 2048 -validity 9125 \
  -storetype JKS
```

You'll be prompted for a **store password**, a **key password** (use the same
for simplicity), and a name/org/country. Record all of them.

> ⚠️ **Back up `dynasty-manager.keystore` + both passwords immediately** to at
> least two places (password manager + offline drive). Losing them means you
> can never ship an update to this app ID again.

### Step 2 — Add the keystore to GitHub secrets (~5 min)

The CI workflow is already wired to these four secret names. Create them under
**repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `KEYSTORE_BASE64` | output of `base64 -w0 dynasty-manager.keystore` (macOS: `base64 -i dynasty-manager.keystore`) |
| `KEYSTORE_PASSWORD` | the store password from Step 1 |
| `KEY_ALIAS` | `dynasty-manager` |
| `KEY_PASSWORD` | the key password from Step 1 |

```bash
# Produce the base64 blob to paste into KEYSTORE_BASE64:
base64 -w0 dynasty-manager.keystore        # Linux
base64 -i  dynasty-manager.keystore        # macOS
```

After this, **Actions → Android Build → Run workflow** (leave inputs blank)
produces a signed AAB as a downloadable artifact — no local Android SDK needed.

### Step 3 — RevenueCat + Google Play Billing (~30 min)

Full walkthrough in `IAP_SETUP_GUIDE.md` §4–§8. The short version:

1. In **RevenueCat → your project → add a Google Play app**; set package
   `com.dynastymanager`.
2. In **Google Play Console**, create the in-app products / subscriptions whose
   IDs match `src/config/monetization.ts` (`PRODUCTS`).
3. Grant RevenueCat access to Play (service-account JSON) so it can validate
   purchases.
4. Copy the **Android (`goog_…`) public SDK key** from RevenueCat.
5. Provide it to the build as `VITE_REVENUECAT_ANDROID_API_KEY` (see Step 4).
   `purchases.ts` already selects this key on Android automatically.

### Step 4 — Provide the Android RevenueCat key to the build

The build reads the key from a Vite env var at build time. Set it in CI:

- Add a repo secret `VITE_REVENUECAT_ANDROID_API_KEY = goog_…`, then add this
  line to the `npm run build` step's `env:` in `android-build.yml`:
  ```yaml
  - run: npm run build
    env:
      VITE_REVENUECAT_ANDROID_API_KEY: ${{ secrets.VITE_REVENUECAT_ANDROID_API_KEY }}
  ```
- For local release builds, put it in untracked `.env.local` (see `.env.example`).

> Until this is set, Android falls back to the shared test key — the paywall
> won't transact against Google Play, but the app still runs.

### Step 5 — Google Play Console listing (~30 min, + review time)

Full walkthrough in `google-play-guide.txt` §5–§7. Required before you can ship:

- **Developer account** — https://play.google.com/console/signup ($25 one-time, identity verification can take 1–2 days).
- **Create app** — name "Dynasty Manager", type Game › Simulation.
- **Privacy policy URL** — host `privacy-policy.html` (GitHub Pages / Netlify / Google Sites).
- **Data safety** — app stores data **on-device only, no server**: declare "no data collected/shared" (note: if Sentry crash reporting is enabled in prod, declare crash logs accordingly).
- **Ads** — "No, my app does not contain ads" (ads are disabled in the binary).
- **Content rating** questionnaire, **Target audience** (13+), **App category** Game › Simulation.
- **Store listing assets**: 512×512 icon, 1024×500 feature graphic, ≥2 phone screenshots.

### Step 6 — Build, upload, and roll out

1. **Actions → Android Build → Run workflow.** Leave `version_code` blank
   (defaults to the run number, which always increases) and `version_name`
   blank (defaults to `package.json` version). Check the `::notice::` at the top
   of the run summary shows the version you intended.
2. Download the `dynasty-manager-release-<name>-<code>` artifact (the `.aab`).
3. In Play Console → **Testing → Internal testing → Create release** (start with
   internal testing, not production). Upload the `.aab`, add release notes, roll
   out, and add your tester email(s).
4. Install via the internal-testing opt-in link on a device and smoke-test:
   launch, start a save, advance a few weeks, open the paywall (sandbox), confirm
   no crash and that purchases restore.
5. When happy, promote the release **Internal → Closed/Open → Production**.

---

## Versioning rules (Android-specific)

- **`versionCode`** must be a positive integer that **strictly increases** every
  upload. The workflow defaults it to `github.run_number` (shared monotonic
  counter), so you rarely set it by hand. Only override to jump ahead.
- **`versionName`** is the human-facing string (e.g. `1.0.13`); it comes from
  `package.json` via `npm run version:sync`. Bump `package.json.version` for a
  user-visible version change.

## Local build (optional — needs Android Studio)

CI is the supported path. To build locally you need the Android SDK
(`ANDROID_HOME` set). Then:

```bash
npm run build && npx cap sync android
npm run cap:android          # opens Android Studio
# or headless, with signing env vars exported:
cd android && ./gradlew bundleRelease
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Workflow fails at "Build signed release AAB" with keystore error | One of the 4 `KEYSTORE_*` secrets is missing/wrong (Step 2). |
| Play Console rejects upload: "version code already used" | `versionCode` didn't increase — re-run (run number advances) or override higher. |
| Paywall shows but purchases fail on Android | `VITE_REVENUECAT_ANDROID_API_KEY` not set (Step 4), or Play products/IDs don't match `monetization.ts` (Step 3). |
| White flash on launch | Confirm `capacitor.config.ts` `android.backgroundColor` + SplashScreen config synced (`npx cap sync android`). |
| App ID mismatch | Everything keys off `com.dynastymanager` — keep it identical across `capacitor.config.ts`, `build.gradle`, RevenueCat, and Play Console. |
