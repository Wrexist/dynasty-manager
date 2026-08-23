# App Store ASO research dossier — August 2026

> Compiled 2026-07-28 for **Dynasty Manager: Football** (App Store id 6760918006).
> This is the *why* behind `season-2026-refresh.md` and the per-locale files in
> `locales/`. Re-verify the "what changed" section before any major metadata
> push — Apple moved three ranking-relevant things in the last 14 months.

---

## 0. The headline finding: our metadata is post-window

Every locale file in `locales/` and the whole of `wc-2026-refresh.md` is built
around **World Cup 2026**. That tournament's final was **19 July 2026**. As of
this dossier the store is carrying:

- Subtitles like `World Cup 2026 · No Timers` — 30 characters, the second most
  heavily weighted indexed field we own, spent on a decaying token.
- Promotional text opening `World Cup 2026 mode is live` — the first line a
  browsing user reads, anchored to an event that finished.
- Keyword fields carrying `national team` / `world cup` variants that were
  bought with characters taken from evergreen management terms
  (`penalty shootout` was explicitly dropped to fund them — see the en-GB
  rationale).

Seasonal ASO is correct *inside* its window and actively costly outside it.
The window we are now in the first days of is the **2026-27 club season**:
European leagues kick off through August, and the summer transfer window
closes **1 September**. That is the annual moment when "manage my club" intent
is highest and when every football title refreshes its store presence.

**Honest caveat:** I have no measured download-seasonality data for this
category — the search results available to me carry no volume series, and the
network policy in this environment blocks `itunes.apple.com`, so I could not
pull our own or competitors' live listings. The season-window argument is
reasoned from the football calendar and from competitor behaviour visible in
their store titles, not from a volume chart. Validate the specific keyword
picks against Apple Ads' *Search Popularity* scores before spending money on
them (same caveat the existing `locales/README.md` already makes — it still
stands).

---

## 0.5 Measured demand (Semrush, 2026-08-23) — the volume caveat, partially closed

The caveat above ("no measured download-seasonality data") is now partially
closed: six Semrush queries (US + UK web databases, Aug 2026) put real volume
numbers behind the keyword picks. **Method caveat that stays:** this is Google
web search volume, not App Store search volume — use it as a *relative* demand
signal between candidate terms, and still validate against Apple Ads Search
Popularity before spending money. In-store-only behaviours (e.g. "offline
games" browsing) are invisible here.

### What the data confirmed

| Term | US vol/mo | UK vol/mo | Read |
|---|---|---|---|
| football manager | 8,100 | (brand-dominated) | Head term; covered via `manager` (Name) + `football` (keywords) union |
| soccer manager | 1,300 | — | Covered by Name |
| football manager game | 720 | 720 | Covered by union |
| soccer sim / football sim | 720 | 880 | `sim` earns its slot |
| football career game | — | 210 | `career` in the Name validated |

### What the data overturned

| Term | US vol/mo | UK vol/mo | Old call → new call |
|---|---|---|---|
| **lineup builder** | **4,400** | **9,900** | Not indexed anywhere → `lineup` added to every English keyword field. Biggest single miss; we ship a lineup editor + Smart Optimize. |
| **penalty game / penalty shootout game** | 1,600 / 1,000 | 1,900 | Dropped as "narrow query" → wrong; `penalty` restored to keywords |
| **wonderkid** | 1,300 | 480 | Was captions-only → added to keywords |
| **soccer gm / general manager games** | 590 / 720 | — | Never considered → `gm` added (en-US/en-CA; 2 chars, US vocabulary) |
| **sunday league football** | — | **1,900** | Never considered → `sunday` added to en-GB (combines with `league`; the Sunday League game mode makes it genuinely relevant) |
| soccer pack opener | 320 | — | `pack` added to en-US (we sell packs; high purchase-intent fit) |
| formation creator / soccer formation app | 140 / 30 | — | `formation` cut from keywords (9 chars for ~no demand); stays indexed via the panel-03 caption "SQUAD & FORMATION" |
| soccer season game / soccer champion game | ~0 / 20 | — | `season`, `champion` cut — dead weight |
| soccer youth academy | 30 | — | `academy` cut from en-US/en-AU (kept en-CA); candidate for a caption if a re-render happens anyway |

Also measured, for the record: `soccer manager 2026` = 320/mo US (year tokens
carry real volume — a `2026` token is a legitimate seasonal play but was not
worth displacing an evergreen term; revisit for Apple Ads instead), and
`online soccer manager` = 5,400/mo US (competitor brand — Ads conquest
territory only, never metadata).

## 1. What actually ranks (Apple, 2026)

### Indexed text fields — where keywords can come from

| Field | Indexed for search | Weight | Editable without a build |
|---|---|---|---|
| App Name (30) | Yes | **Highest** — a term in the title is widely measured at ~5× the same term in the subtitle | No |
| Subtitle (30) | Yes | High | **Yes** |
| Keyword field (100) | Yes | Medium | **Yes** |
| Screenshot captions | **Yes — new since June 2025** (OCR-extracted, first ~3 shots weighted) | Medium | Via Asset Library, no build |
| Custom product page keywords | Yes — organic keyword assignment since July 2025 | Medium | **Yes** |
| In-app event metadata | Yes | Low–medium | **Yes** |
| Developer name | Yes | Low | No |
| IAP display names | Yes | Low | Yes |
| Description (4000) | **No** (Apple ≠ Google Play here) | — conversion + feeds AI tags | No |
| Promotional text (170) | No | — conversion only | **Yes** |

Two consequences we are not currently exploiting:

1. **Screenshot captions are keyword inventory.** Since June 2025 Apple
   OCR-extracts the text baked into screenshots and treats it as metadata,
   able to introduce keywords that appear *nowhere else* in the listing. Our
   new hero screenshots (`marketing/appstore/hero/`) carry a kicker line, a
   two-line headline and a subline on every panel — roughly 12 indexable words
   per panel, currently written purely for tone. Rewriting the first three
   panels' kickers/sublines to carry terms we *cannot* fit in the 100-char
   keyword field is free ranking surface.
2. **Custom product pages doubled to 70** (from 35) in early 2026, and since
   July 2025 each can be assigned its own organic keywords. This converts CPPs
   from an ad-only feature into an organic long-tail tool: one page per
   intent cluster, each with a screenshot set that matches the query.

### Non-text ranking factors

- **Retention is now weighted over raw installs.** Both stores shifted weight
  toward D1/D7 retention and stability in 2026; an app with weaker install
  volume but stronger D7 can outrank a bigger one. This makes onboarding and
  crash-freedom ASO work, not just product work — our `OnboardingChecklist`
  and the Sentry crash rate are ranking inputs now, and the AdMob-crash saga
  cost us on this axis, not just in reviews.
- **Conversion rate** (impression → install) feeds ranking, which is why the
  screenshot/CPP work compounds with the keyword work rather than being
  separate.
- **Ratings volume and average**, refreshed — `utils/appReview.ts` prompt
  timing is an ASO lever.

### App Store tags (iOS 26)

Apple generates AI tags per app from metadata, description and screenshots;
tags are human-verified and **manageable in App Store Connect**, and surface
as browsable collections in search. They were still not informing the public
search algorithm at last report, but they are fed by the description — which
is otherwise unindexed. Practical rule: **keep the description explicitly
feature-named** ("youth academy", "penalty shootouts", "promotion and
relegation") so the tagger classifies us into the collections we want, and
check the tag list in App Store Connect after each release.

---

## 2. Field construction rules (Apple, enforced by our validator)

- Keyword field: 100 chars, comma-separated, **no space after commas** (a
  space costs a character). Singular only — Apple matches plurals. Skip stop
  words (`app`, `the`, `for`, `and`). Never repeat a word already in the App
  Name or Subtitle; Apple indexes the union, so a repeat is a wasted
  character. Never include the category name — it is associated automatically.
- Apple builds search phrases by **combining** tokens across Name + Subtitle +
  keyword field. So `soccer` in the title + `club` in keywords covers
  "soccer club" without spending characters on the phrase.
- **Guideline 2.3.7**: no trademarked terms, competitor app names, price
  information, or irrelevant padding in any metadata. This rules out every
  rival's brand, and also real league/club/player names in metadata (we ship
  real club data in-game, but the store fields stay generic — the existing
  locale files already enforce this and it should not be relaxed).
- Unverifiable superlatives ("best", "#1") are a rejection risk in
  name/subtitle.
- "Free" claims: we say **"Free to download"**, never "completely free", since
  Pro and consumable packs are IAP. Keep that phrasing.

## 3. Cross-locale keyword indexing

Several storefronts index **two** locales' keyword fields. The ones that
matter for us:

| Storefront | Indexes | Play |
|---|---|---|
| United States | en-US **+ es-MX** | es-MX is a second 100-char field *for the US*. It must complement, never duplicate, en-US. |
| Canada | en-CA + fr-CA | |
| UK / IE | en-GB (falls back to en-US, not en-AU) | |
| Australia | en-AU (+ en-GB fallback) | |

This is why the locale files are written to complement each other and why
"fixing" an apparent gap by copying terms across a pair is a regression, not
an improvement.

## 4. Competitive landscape (category read)

The football-management shelf on iOS splits into four postures. None of their
brand names may appear in our metadata; the point of this table is which
*generic* territory is already crowded and which is open.

| Posture | Typical store framing | Territory they own | Our counter |
|---|---|---|---|
| Licensed premium sim (Netflix-published) | "condensed, decisive, quick progress" | Licence + brand recall | Depth without a subscription; no login wall |
| Real-time 3D PvP manager | "3D live match engine, real-time PVP" | Live/PvP, esports framing | No energy timers, no rest packs, play at your own pace |
| Breadth collectors | "90+ leagues, 54 countries" | Raw league count | 45 leagues / 756 clubs **plus** career, packs, national team in one app |
| Casual squad-builders / live-score hybrids | "casual manager strategy, squad building" | Low-commitment play | Real match-minute simulation and tactics |

**The defensible wedge stays what the existing kit identified:** no energy
timers / no rest packs / no waiting, and full depth without a subscription.
That is a conversion message (promo text, first screenshot, description
opener), not a search message — nobody searches "no energy timers". Search
real estate should go to category head terms; the wedge should go where it
changes the install decision.

## 5. Apple Ads (paid, for when there's budget)

- Placements: search results, Search tab, Today tab, and other apps' product
  pages. From **3 March 2026** Apple runs **two advertisers per search query**
  on iOS/iPadOS 26.2+, and existing search campaigns are auto-eligible — no
  new campaign needed, but expect CPT movement as inventory and competition
  both change.
- Today tab ads render **app name + icon + subtitle** and land on a custom
  product page — another reason the subtitle must read as a benefit, not only
  as a keyword bag.
- Minimum sane structure: one brand-defence campaign (own brand terms),
  one category campaign (head terms), one competitor-conquest campaign
  (bidding on rival brand terms is allowed in *Apple Ads* even though those
  words may not appear in *metadata* — do not confuse the two rules), each
  pointing at a matching CPP.

---

## 6. The plan this dossier produces

| Priority | Action | Needs a build? | Where |
|---|---|---|---|
| P0 | Kill the World Cup window copy across all locales | No (subtitle/promo/keywords) | `locales/*`, `season-2026-refresh.md` |
| P0 | Season-window subtitle + promo + keyword fields, Tier-1 locales | No | same |
| P1 | Keyword-bearing screenshot captions, re-rendered | No (Asset Library) | `marketing/appstore/build-hero.mjs` |
| P1 | Title change to add a high-weight term | **Yes** | `season-2026-refresh.md` |
| P2 | CPP set, one per intent cluster, with assigned keywords | No | `season-2026-refresh.md` §CPP |
| P2 | In-app events: season kickoff, transfer deadline day | No | `season-2026-refresh.md` §Events |
| P3 | Re-check App Store Connect tag list after next release | No | this file, §1 |

---

## Sources

- [App Store Optimization in 2026: ASO Strategy, Trends, and Best Practices — ASOMobile](https://asomobile.net/en/blog/aso-in-2026-the-complete-guide-to-app-optimization/)
- [App Store Algorithm Changes in 2026 — FoxData](https://foxdata.com/en/blogs/app-store-algorithm-changes-in-2026-what-you-need-to-know/)
- [App Store Ranking Factors in 2026 — TheAppLaunchpad](https://theapplaunchpad.com/blog/app-store-ranking-factors/)
- [What is App Store Optimization (ASO)? — App Radar](https://appradar.com/academy/what-is-app-store-optimization-aso)
- [The Biggest App Store Algorithm Change is Here — Appfigures](https://appfigures.com/resources/guides/app-store-algorithm-update-2025)
- [Is Apple Now Indexing Screenshot Titles? — ConsultMyApp](https://www.consultmyapp.com/blog/-is-apple-now-indexing-screenshot-titles-on-the-app-store)
- [Custom Product Pages in 2026: 70 Pages, Keywords, Limits — RespectASO](https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/)
- [WWDC 2026 recap: what's changing for ASO teams — AppTweak](https://www.apptweak.com/en/aso-blog/apple-wwdc-2026-recap)
- [Apple expands App Store capabilities to help developers grow — Apple Newsroom](https://www.apple.com/newsroom/2026/06/apple-expands-app-store-capabilities-to-help-developers-grow-and-reach-new-users/)
- [App Store Connect Launches Tag Management — Swipe Insight](https://web.swipeinsight.app/posts/app-store-connect-launches-tag-management-to-boost-app-discoverability-18128)
- [At WWDC, Apple says it will use AI to tag apps — TechCrunch](https://techcrunch.com/2025/06/11/at-wwdc-apple-says-it-will-use-ai-to-tag-apps-to-improve-discoverability-on-the-app-store)
- [8 Tips to Optimize Your Keywords List in App Store Connect — Appfigures](https://appfigures.com/resources/guides/keyword-optimization-app-store-connect)
- [iOS Keyword Field: Rules, Character Limits & Optimization — Appalize](https://www.appalize.com/cs/blog/keyword-research/ios-keyword-field-rules-character-limits-optimization)
- [App Store Keyword Field Guide 2026 — AppLaunchFlow](https://www.applaunchflow.com/blog/app-store-keyword-field-guide-2026)
- [New Apple Ads placement explained — AppTweak](https://www.apptweak.com/en/aso-blog/apple-ads-search-results-are-expanding)
- [Apple Expands App Store Search Ads With New Placements in 2026 — TechTimes](https://www.techtimes.com/articles/313465/20251218/apple-expands-app-store-search-ads-new-placements-2026.htm)
- [App Review Guidelines — Apple Developer](https://developer.apple.com/app-store/review/guidelines/)
- [Targeting competitor iOS app brands with keyword optimization — Gummicube](https://www.gummicube.com/blog/targeting-competitor-ios-app-brands-with-keyword-optimization/)
