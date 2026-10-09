# Google Play — App content answers

Console → Policy → **App content**. Answers are derived from the code and
`docs/privacy.html` as of 2026-09-29. If a build turns on Sentry
(`vars.SENTRY_ENABLED`), ads, or any analytics transport, **Data safety must be
updated before that build ships** — a mismatch is a policy strike.

## Privacy policy
`https://wrexist.github.io/dynasty-manager/privacy.html`

## Ads
**No, my app does not contain ads.** (`utils/ads.ts` `NATIVE_ADS_READY = false`,
AdMob removed.)

## App access
**All functionality is available without any access restrictions.** No login.
Pro features are behind a purchase, which reviewers can make with a licence
tester account — nothing to declare.

## Content rating (IARC questionnaire)
- Category: **Game**
- Violence, fear, sexuality, language, controlled substances, crude humour: **No** to all
- Gambling: *Does the app feature simulated gambling?* **No** (packs are
  randomised items, not wagering). *Real-money gambling?* **No**
- Users interact / exchange content: **No** (single-player, no chat)
- Shares user location: **No**
- **Allows purchase of digital goods: Yes**
- **In-game purchases include randomised items (loot boxes): Yes** — the four
  paid player packs. The rating will carry "In-Game Purchases (Includes Random
  Items)". Answering No here is the single fastest way to get the app pulled.

## Target audience and content
- Target age groups: **18 and over** only.
- Why: paid randomised packs (PLAYBOOK §5.5 — never target minors with pack
  content). Selecting any group under 13 puts the app under the Families
  policy, which imposes SDK and ad requirements this app has not been audited
  for. 13–17 is possible later but is not worth the review exposure at launch.
- *Could the app unintentionally appeal to children?* **No** (football
  management sim, text-heavy, no cartoon characters). If Google asks for
  justification: the store listing and graphics are aimed at adult football
  fans.

## Data safety

**Does your app collect or share any of the required user data types?** **Yes**
(purchase records and anonymous gameplay totals go to RevenueCat as
subscriber attributes — `utils/playerAttributes.ts`, on by default since #640).

**Is all collected data encrypted in transit?** **Yes** (HTTPS only).

**Do you provide a way for users to request data deletion?** **Yes** — by
email to `privacy@dynastymanager.app` (named in the privacy policy). There is
no account, so no account-deletion URL is required; if the form insists, give
the privacy policy URL.

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Financial info → **Purchase history** | Yes | No (RevenueCat is a service provider processing on our behalf — not "sharing" under Play's definition) | Required to buy | App functionality (deliver and restore purchases) |
| App activity → **App interactions** | Yes — gameplay totals (sessions, active days, season/week/matches reached, paywall/store/pack/purchase-attempt counts) | No (same service-provider basis as above) | **Yes** — Settings → Data → *Share gameplay stats* turns it off and deletes the sent keys | Analytics |
| App info and performance → **Crash logs / Diagnostics** | **No** while `SENTRY_ENABLED` is not `true` | — | — | — |
| Device or other IDs | **Yes** — RevenueCat's randomly generated app user ID | No | Required to buy | App functionality, Analytics (the gameplay totals above are keyed to it) |
| Location, personal info, contacts, messages, photos, audio, files, calendar, health, web history | No | — | — | — |

Game saves never leave the device (IndexedDB/localStorage) — not collected.
Share cards go through the system share sheet chosen by the user — not
collected by us.

## Other declarations
- Government app: **No** · Financial features: **None** · Health: **No** ·
  News app: **No** · COVID-19: **No**
- Advertising ID (Android 13+ declaration): **No, the app does not use an
  advertising ID.** Check the merged manifest for
  `com.google.android.gms.permission.AD_ID` before answering — none of today's
  plugins add it, but a future SDK might.
- Foreground services / exact alarms / photo & video permissions: **none
  requested**, nothing to declare.
