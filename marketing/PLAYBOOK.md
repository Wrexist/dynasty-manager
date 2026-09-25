# Dynasty Manager — Growth Playbook (v1, 2026-09-25)

> The one document to run marketing from. Everything else in `marketing/` is a
> tool this playbook calls: scripts, posters, capture pipeline, ASO locales,
> Apple Ads plan, unit-economics model. Where a tool exists, this file points
> at it instead of re-describing it.
>
> **Status of every number here:** labelled **[MEASURED]**, **[MODELLED]**
> (from `ads/unit-economics.mjs`, assumptions not yet replaced by RevenueCat
> data) or **[EXTERNAL]** (a published benchmark, source at the bottom — vendor
> benchmarks are marketing too, treat them as direction, not truth).

---

## 0. The answer in six lines

1. **Organic short-form video is the channel. Paid is not — yet.** Modelled net
   revenue per install is **$0.42** [MODELLED]; Meta/TikTok CPIs in this genre
   run **$2–6** [EXTERNAL]. Every paid install today loses $1.50–5.50.
2. **The pack walkout is the hook; the management game is the retention.** Lead
   every piece of content with a pull, pay it off with a season story.
3. **Our one claim nobody else can make:** *real players in the packs, and your
   legends never retire — they come back as cards.* FC has Icons it licenses;
   FM has depth without packs; we have both, free, with no energy timers.
4. **Real faces sell — and are the single biggest legal exposure in this repo.**
   Show them as product footage; never put a real player's name or face in a
   headline, store field, thumbnail or paid ad until a lawyer has read §4.
5. **Fix the store page before pouring anything into it.** Page CVR is 17%
   [MEASURED]; the gate is 25%. App Preview video + a pack-led first screenshot
   are the two highest-leverage hours in this whole document.
6. **Raise revenue per install, because that is what unlocks paid.** Pack ARPI
   is modelled at $0.05. The walkout share card, a first-session pack and the
   weekly featured pack are growth features, not monetisation features.

---

## 1. Where we actually are

| Metric | Value | Gate for paid UA | Status |
|---|---|---|---|
| Installs / day | ~46 [MEASURED] | — | small enough that one creator post is visible in ASC next day |
| Impressions / day | ~3.66K [MEASURED] | — | search-driven; browse traffic near zero |
| Product-page CVR | 17% [MEASURED] | ≥ 25% | ❌ |
| App Preview video | none live | yes | ❌ |
| Ratings shown | verify in ASC | ≥ 50 | ❓ |
| D1 / D7 retention | read ASC → App Analytics → Retention | ≥ 40% / ≥ 20–25% | ❓ — **fill in before any spend** |
| Net revenue / install | $0.42 [MODELLED] | ≥ target CPI | ❌ (5×+ short of social CPI) |
| Max affordable CPT (Apple Ads, 55% CR) | $0.23 [MODELLED] | — | brand terms only |

**Verdict: fewer than 4 of 6 gates pass → $0 on Meta/TikTok this quarter.**
The only paid spend this plan authorises before the gates move is Apple Ads
brand defence (§9) and creator fees for organic content (§6), which buy owned
assets, not installs.

Reproduce the economics: `node marketing/ads/unit-economics.mjs`
(fixed in this change — it was still parsing the retired `.pro.annual` SKU and
crashed on start; it now reads `.pro.yearly`).

---

## 2. Category audit — what gets football games downloaded

What was checked: public store listings, official social accounts, TikTok
discovery pages, press coverage and case studies (sources at the bottom).
**What was not checked:** paid ad-intelligence tools (Sensor Tower, AppMagic,
data.ai) — creative-level spend data is behind their paywalls. The free
substitute is §2.3: do it once, it takes 45 minutes.

### 2.1 Competitor teardown

| App | What actually drives their installs | Steal | Can't / won't copy |
|---|---|---|---|
| **EA FC Mobile** | Creator pack-opening ecosystem (#FCMobilePackOpening, #PackLuck), creator codes, weekly promo events on the real football calendar (TOTY, TOTW-style drops). The official account is secondary; **creators are the channel.** | Pack-reaction format; weekly promo cadence as a *content calendar*; "pack luck" as a genre of video | Licence, Icons, EA's creator-code budget |
| **MADFUT** | A pack *simulator* that grew almost entirely on YouTube/TikTok pack-opening videos and trading between players — proof that the pack moment alone can carry installs in this audience. | "I opened X packs until…" series; trading/duplicate talk as comment-bait | Its audience is FUT-adjacent kids — Apple/Meta scrutiny of loot boxes to minors is rising (§5.5) |
| **Top Eleven** (Nordeus) | 15 years of brand, Facebook-era UA, huge localisation (31 languages). Official TikTok is small (~36K followers) — **the genre's official accounts are weak; reach lives with creators.** | Localisation breadth as long-term ASO | Real-time PvP, energy/rest economy (we sell *against* it) |
| **OSM** | 50M+ players, multiplayer leagues with friends, 30 languages. Social loop: *invite your mates to your league.* | The friends-league social frame, for content ("my mate vs me, same save") | Server-side multiplayer |
| **Soccer Manager 2026** (Invincibles) | 10M+ downloads, 4.4★ on 139K reviews; real clubs, broad league count; heavy paid UA with ads-in-game monetisation. | Ratings volume → ranking; "manage elite clubs" framing | Ad-funded model (our ads are off) |
| **Football Manager 26 Mobile** (Netflix) | Netflix distribution + **Premier League licence with real kits and player headshots.** Free to Netflix members, no IAP. | Nothing tactical — it is the reference for what *licensed* faces look like | The licence. This is why §4 exists: the licensed competitor shows faces legally; we do not have that paper. |
| **Retro Bowl** (New Star Games) | Reached **#1 overall US App Store with zero paid UA** — TikTok clips of last-second comebacks + school word-of-mouth + Apple features. | *Dynasty stories* as content; one simple repeatable clip format; getting featured | Arcade immediacy (ours is a sim — our clips must show outcomes, not controls) |
| **Football Life / Kickoff / UFL-style** | Trending on TikTok via "best football game on the App Store" list videos. | Get into those list videos (§6.4 creator seeding) | — |

### 2.2 The five patterns that repeat across every winner

1. **Creators, not brand accounts, carry reach.** No official account in this
   genre is big. The algorithm rewards people reacting, not logos talking.
2. **A single, repeatable, 10-second money moment.** FC: walkout. Retro Bowl:
   the comeback throw. Ours: walkout + "he retired in my save and came back".
3. **A calendar.** Every winner rides the real football calendar (transfer
   deadline, Ballon d'Or, derbies, TOTY season). Content made *for a date*
   outperforms evergreen.
4. **Stories over features.** "Took a fourth-tier club to the Champions Cup
   final" beats "45 leagues". Features belong in screenshots; stories go in video.
5. **Store page does the closing.** Traffic from video lands on a product page;
   a 17% page converts a viral spike into a fraction of what it should.

### 2.3 Do-it-yourself ad intelligence (free, 45 minutes, monthly)

- **Meta Ad Library** (facebook.com/ads/library) → search *Top Eleven*,
  *Soccer Manager*, *OSM*, *FC Mobile*. Sort by *longest running*: an ad alive
  60+ days is profitable. Screenshot hook + first frame + CTA into
  `marketing/research/ad-library-YYYY-MM.md`.
- **TikTok Creative Center → Top Ads** → filter *Games › Sports*, region GB/US/DE.
  Note hook type (reaction / POV / text-wall / gameplay) and length.
- **TikTok search:** "football manager game", "best football game app store",
  "pack opening". Note which *creators* appear three times — that is the
  seeding list for §6.4.

---

## 3. Positioning

**Line:** *Open real player packs. Build a dynasty. Your legends never retire.*

| For | Who are | Dynasty Manager is | Unlike |
|---|---|---|---|
| Football fans aged 18–34 on iPhone | bored of energy timers and pay-to-win PvP | a full manager career with real clubs, real-player packs and a free pack every day | FC Mobile (no management depth), FM Mobile (no packs, needs Netflix), Top Eleven (energy + PvP) |

Proof points, in the order a viewer should meet them:
1. Walkout of a card (the hook).
2. That card starting a match minutes later (it matters — not a collection).
3. A season outcome: promotion, trophy, Ballon d'Or (the payoff).
4. "Free. No energy. Three free packs a day." (the objection handler — Daily,
   Bronze and Silver are each free daily as of 1.6.0).

**Never claim:** "official", "licensed", real league/competition marks, or a
real player's name as a selling line. See §4.

---

## 4. Real names and professional portraits — the rights ladder

**What the game ships** (verified in this repo): 756 real clubs, real-player
names and ratings from the community pack, and **~840 real-player portrait
cutouts** in `public/player-portraits/` (registry `src/data/playerPortraits.ts`),
rendered on player cards. It is the most compelling thing on screen and the
strongest conversion lever the listing has.

**What the repo says about rights:**
- `docs/apple-review-response.md` §5/§7 tells App Review that *all clubs,
  leagues and players are fictional* and that *no real-world brands or
  trademarks* are used. **That is no longer true.** If a reviewer compares that
  statement with a screenshot of a real striker's face, the problem is not
  likeness — it is a misrepresentation to Apple, which is an account-level risk
  (Guidelines 2.3, 5.2, 5.2.1). **Correct that document before the next
  submission, whatever else you decide.**
- `docs/player-portrait-system-audit.md` already states the portrait system
  does not establish likeness rights.
- `marketing/scripts/tiktok-08-hall-of-legends.md` already set the rule: never
  write a real footballer's name into a hook, caption or headline.

**Precedent, briefly:** image rights are personality rights in several of our
key markets. Brazilian courts ordered EA — a *licensed* publisher — to pay
players individually (R$5,000 per player per edition, 450+ claimants) because
the collective licence was not personal consent. FM26 Mobile shows headshots
because it bought a Premier League licence. Neither fact says we will be sued;
both say faces are the part of the product rights holders notice.

### The ladder — each rung is more reach and more exposure

| Rung | Use | Reach | Exposure | Rule |
|---|---|---|---|---|
| **0** | Invented Hall of Legends heroes, regens, your own club stories | ● | none | **Default for every headline and thumbnail.** |
| **1** | Real faces appear *incidentally* in genuine gameplay footage (squad list, reveal grid) in organic posts | ●●● | low | OK. Never the thumbnail, never frozen as the hero frame. |
| **2** | A creator's own organic video reacting to pulling a named star | ●●●● | low–medium, and theirs | Allowed; do not script names into their brief; don't pay per-mention of a star. |
| **3** | Real face as the hero of a **paid** ad, a store screenshot, a CPP or an App Preview | ●●●● | **high** — paid + your account = clear commercial use | **Blocked until a 1-hour IP-lawyer opinion** (~few hundred USD; cheaper than one takedown). |
| **4** | Real player *name* in store metadata, ad copy, headlines, promo text | ●●●●● | **highest** — also 2.3.7 metadata rules | **No.** Not a risk trade worth taking at 46 installs/day. |

**How to "show that the game has professional portraits" without climbing to
rung 3:** show *the system*, not a person — a fast scroll of a full squad of
portrait cards (no single face held > 0.5s), the reveal grid, and captions like
"every player has a portrait" / "real squads, every league". The viewer reads
"this game has real players with real faces" without any one person being the
advertisement.

**Decision owed by you (log it in `ads/RELEASE-READINESS.md` §1.1):**
(a) stay at rung ≤ 2 — this playbook works fully at rung 2; or
(b) get the lawyer's opinion and, if favourable, unlock rung 3 for store assets
and paid. Do not drift into rung 3 by accident because a screenshot looked good.

---

## 5. Packs — the growth engine

Packs are simultaneously the **best hook**, the **best retention loop**
(daily free pack + streak) and the **only lever that can move ARPI** enough to
make paid UA possible. Treat them as all three.

### 5.1 Hooks that work (all true — no bait)

| # | Hook (on-screen text, 0–2s) | Body | Why |
|---|---|---|---|
| H1 | YOUR LEGENDS DON'T RETIRE | great retires in-save → returns as Hall of Legends card | Unique claim. Lead with it. (`tiktok-08`) |
| H2 | 3 FREE PACKS. EVERY DAY. NO ENERGY. | daily streak pack opening, floor rising to 75+ on day 7 | Objection-killer; true since 1.6.0 |
| H3 | PULLED A 94. FREE GAME. | Legends walkout | Genre-native disbelief format |
| H4 | RATE MY PULL 1–10 | 5-card reveal, stop before walkout | Comment-bait; comments drive distribution |
| H5 | I SIGNED MY PACK PULL. HE WON US THE LEAGUE. | pull → lineup → match goal → table | Only format that sells *both* halves of the game |
| H6 | PACK LUCK DAY 1 → DAY 7 | streak series, one video per day | Built-in series; returning viewers |
| H7 | THIS WEEK'S PACK HAS A NEW NAME | weekly promo skin reveal (The Dynasty / Golden Era / Royal Reserve) | Weekly news peg — free content calendar |

Capture all of these headlessly with `node marketing/postproduction/capture-ad.mjs` + `encode-ad.mjs`
(`postproduction/README-capture.md`) — 1080×1920, true 60fps, regenerable on
every visual change. Real-phone recordings for the reaction/UGC formats.

### 5.2 The weekly pack calendar *is* the content calendar

`FEATURED_PACK_ROTATION` + `WEEKLY_PACK_SKINS` already produce a new, dated,
real event every week. Use each one three times:
- **Monday:** skin reveal video (H7) + promo-text update in App Store Connect.
- **Mid-week:** best-pull compilation from the week.
- **In-App Event** in App Store Connect for the skins you can plan ahead
  (IAEs surface in search and on the product page; vendor data claims ~17% CVR
  lift on pages with an active event [EXTERNAL]).

### 5.3 Product changes that are really marketing (build these)

| # | Change | Why it's growth | Size |
|---|---|---|---|
| P1 | **Share button on walkout / best-pull summary** → 9:16 image card via existing `utils/shareCard.ts` + `utils/share.ts` (card art, OVR, "Pulled in Dynasty Manager", App Store link). No share exists in the pack overlay today. | Every rare pull becomes a free ad posted by the only person more credible than you: the player. | S–M |
| P2 | **Guaranteed pack inside the first session** (verify FTUE — no starter/welcome pack found in onboarding code). | An ad that shows a walkout must deliver one in the first 5 minutes, or it is a soft fail-ad and D1 pays for it. | S |
| P3 | **"Legends from your save" recap** at season end: the retirees who entered the Hall, as a shareable card. | Turns H1 into something players post for us. | M |
| P4 | Deep links from creator CPPs → open straight to the Market (post-install) | Continuity from ad promise to product | S |

P1 and P2 are the highest-ROI engineering in this plan. Neither touches a sim
parameter (monetisation invariant 4 holds).

### 5.4 Pricing/offer moves that raise ARPI (not new SKUs — Apple won't allow invented IDs)

- Weekly featured bonus (`WEEKLY_BONUS_CARDS`) is the promo — *say it in the
  first 2 seconds* of the Monday video: "this week only: extra card, same price."
- Starter Kit (7 days from first launch) — surface it at the first walkout,
  not in a menu.
- Show the **odds sheet** in content. Transparency is a trust hook in a genre
  known for hidden odds: "every pack shows its odds before you buy."

### 5.5 Pack compliance — the rules that keep packs sellable

- Odds before purchase: done (`PackOddsSheet`, Guideline 3.1.1). Never
  hand-author odds in marketing copy; quote the in-app sheet.
- **Minors:** do not target under-18s in any paid campaign; age-gate creator
  briefs to creators whose audience is majority adult. Several jurisdictions
  have restricted paid random items for minors (Belgium enforces a ban on paid
  loot boxes; Brazil enacted child-protection rules covering them). Before
  opening storefronts in those regions for paid packs, check current law —
  this file is not legal advice and these rules move.
- No "guaranteed Haaland"-style claims — the band picks eligibility, not a name.

---

## 6. Organic engine (the primary channel)

### 6.1 Accounts and cadence (solo-dev realistic: ~6 h/week)

| Platform | Handle | Cadence | Format |
|---|---|---|---|
| TikTok | @dynastymanager | 1/day for 30 days, then 4/week | H1–H7, save series |
| YouTube Shorts | same | cross-post same day | identical file |
| Instagram Reels | same | cross-post same day | identical file |
| Reddit | personal dev account | 1 genuine post / 2 weeks | dev-log + ask for feedback |
| Discord | server | always-on | pull-sharing channel, bug reports, beta list |

Cross-posting one file three ways is free reach; do it.
Batch-produce: one 2-hour session → 7 videos via the headless capture pipeline + phone captures.

### 6.2 Series (returning viewers beat one-off virality)

1. **"Road to Glory"** — take a 4th-tier English club to the top, one video per
   season beat (promotion, cup run, first continental night). Retro Bowl's
   dynasty-story loop, translated.
2. **"Pack Luck Week"** — the 7-day streak, daily (H6).
3. **"Hall of Legends"** — every time a star retires in-save, film the return.
4. **"Sunday League"** — the park-team mode is an under-used comedy vein
   (weekly availability crises, pound-scale finances). Banter format; different
   audience from pack-openers, same app.

### 6.3 Mechanics that make short video work

- Text hook on frame 1, no logo, no menu (`marketing/README.md` tone rules).
- Captions on every frame (80% watch muted).
- 9–15 s for hooks, 30–45 s for story series.
- End on a question ("keep him or quick-sell?") — comments drive distribution.
- Pin a comment with "free on iPhone — search Dynasty Manager".
- Post when the audience is idle: UK evenings 19–22 and weekend mornings;
  **never during a big live match**, post *right after* it with a reaction.
- Measure: 3-s view rate, average watch %, shares per 1K views. A format that
  gets < 15% 3-s hold three times is dead — rotate it out.

### 6.4 Creator seeding (the Retro Bowl / FC lever)

- **Who:** 10K–100K-follower football-gaming creators (FC pack-openers, FM
  save-series, football banter). Use §2.3's repeated-names list.
- **Offer, tier 1 (free):** Pro gifted via promo code + early access to the
  next weekly skin. Ask for nothing; ~1 in 5 posts.
- **Offer, tier 2 (paid):** $200–500 per video with paid-usage rights (so the
  post can later become a Spark Ad). Budget: **2 creators in month 2** —
  only after 30 days of your own posting has found a format that holds.
- **Attribution, free:** give **each creator their own Custom Product Page**
  (up to 70 allowed [EXTERNAL]); ASC reports installs per CPP. That is
  per-creator attribution without an MMP or an SDK.
- **Brief rules:** rung ≤ 2 of §4; no fake reactions; must play ≥ 1 season;
  #ad disclosure mandatory.

### 6.5 Community and PR

- **Reddit:** r/footballmanagergames and r/iosgaming allow dev posts within
  their rules — read each sidebar first. Frame as dev-log, respond to every
  comment for 24 h. Never astroturf.
- **Press:** pitch PocketGamer / TouchArcade-style outlets with *the angle*,
  not the app: "Solo dev's football manager where retired stars come back as
  cards." Attach a 30-s video and 5 screenshots.
- **App Store featuring:** submit via the App Store "Promote your app" form
  4–6 weeks before each In-App Event and major update. Retro Bowl's #1 was
  TikTok **plus** Apple featuring.

---

## 7. Store conversion (fix before scaling traffic)

Owned by the `store-conversion` and `aso-metadata` skills; details in
`aso/RESEARCH-2026.md` and `appstore-2026-09/`. Priority for this plan:

| # | Action | Target | Owner file |
|---|---|---|---|
| S1 | **App Preview video** (15–30 s): walkout → lineup → goal → trophy. Built from the same capture pipeline. | +CVR; industry reports +25–35% [EXTERNAL] | `scripts/app-store-trailer.md` |
| S2 | First screenshot = pack walkout + "3 free packs a day" | first-impression hook | `appstore/build-hero.mjs` |
| S3 | CPPs per intent: **packs**, **career**, **Sunday League**, one per creator; assign keywords (organic CPP keywords since July 2025 [EXTERNAL]) | ≥ 25% CVR on packs CPP | `aso/season-2026-refresh.md` §CPP |
| S4 | In-App Events: weekly skins, transfer deadline day, season kickoff, Ballon d'Or night | event always live | §8 calendar |
| S5 | Promo text rotated weekly with the featured pack (no review needed) | freshness | ASC |
| S6 | Ratings: review prompt already fires at peaks — add the first Legends walkout as a peak | ≥ 50 ratings shown, ≥ 4.5★ | `utils/appReview.ts` |

S2/S3 use store screenshots → they are rung-3 assets. Build them from
Hall-of-Legends/regen cards until the §4 decision is made.

**Success threshold for S1–S6:** product-page CVR ≥ 25% within 30 days of S1
shipping (ASC → App Analytics → Conversion Rate, 7-day average). If below 20%
after 30 days, the next screenshot iteration is the next task, not paid.

---

## 8. Calendar — Oct 2026 → Jan 2027

Real-world dates below are the known football calendar; confirm exact dates
each month (Ballon d'Or ceremony date moves year to year).

| When | Real-world peg | Content | Store | Product |
|---|---|---|---|---|
| Weeks 1–2 (late Sep–early Oct) | International break | "Road to Glory" episode 1; H2 daily | S1 App Preview, S2 screenshot | P2 first-session pack |
| Oct | Ballon d'Or season | In-game Ballon d'Or ceremony clips; "who wins in my save" | IAE: Ballon d'Or night | P1 share card |
| Every Monday | Weekly featured skin | H7 reveal | promo text swap | — |
| Nov | Derby weekends (match intensity is modelled) | "Derby day in my save" | CPP: career | P3 legends recap |
| Dec | Festive fixtures | "Boxing Day in my save" + pack-luck advent series | IAE: festive week | — |
| Jan | Winter transfer window; TOTY-season in FC | "Deadline day in Dynasty Manager" — own it; best-XI style skin (**never** "TOTY" — EA's mark) | IAE: deadline day | — |

---

## 9. Paid UA — gated

**Now (gates failed):** Apple Ads brand-defence only — exact-match on the app
name, CPT capped at the model's max ($0.23 at 55% CR). Full structure in
`ads/apple-ads-2026-27.md`. Budget: ≤ $5/day.

**Unlock condition** — all of: page CVR ≥ 25%, D7 ≥ 20%, ≥ 50 ratings, App
Preview live, **and** measured net revenue/install ≥ $1.00 from RevenueCat.

**First test once unlocked — one only:**

| Plan | Spend | Duration | Creatives | Win | Kill |
|---|---|---|---|---|---|
| **Spark Ads** on the best-performing organic post(s) | $300 | 7 days | 2–3 posts you or a creator already published (the hold rate is pre-proven) | CPI ≤ measured net rev/install and hold-rate > 10% | CPI > $4 after 5K impressions |
| Meta Advantage+ app campaign (only if Spark wins) | $500 | 10 days | 1 body × 4–6 hooks from §5.1 | same | same |

Why Spark first: it boosts content already proven organically, so the test
measures *price of reach*, not *quality of ad*.

**Attribution reality check:** the app ships no ad SDK and no SKAdNetwork
conversion-value updates (Capacitor, no plugin). Platforms will get install
postbacks only; creative decisions must use in-platform hook/hold rates, and
revenue quality must be read per-CPP in ASC + RevenueCat. Adding SKAN
conversion values (first match played / first pack opened / session > 5 min on
D0) is a native build item — do it before spend exceeds ~$1K/month, not before.

---

## 10. Metrics — weekly scorecard (15 minutes every Monday)

| Layer | Metric | Source | Good | Bad |
|---|---|---|---|---|
| Reach | Views across 3 platforms | platform analytics | trending ↑ 4 weeks | flat 4 weeks → change formats |
| Hook | 3-s hold / avg watch % | platform analytics | > 25% / > 40% | < 15% |
| Store | Impressions, page CVR | ASC App Analytics | CVR ≥ 25% | < 17% |
| Source | Installs per CPP (per creator) | ASC | creator CPI (fee ÷ installs) < $1 | > $3 |
| Retention | D1 / D7 | ASC | ≥ 40% / ≥ 20% | < 30% / < 15% |
| Money | Pack buyers %, trial starts, net rev/install | RevenueCat | rising | — |
| Viral | Shares from P1 share card (once shipped) | share-sheet completions | — | — |

Replace every **[MODELLED]** input in `ads/unit-economics.mjs` with
RevenueCat numbers after 30 days; re-run; the paid gate moves with it.

---

## 11. 90-day execution plan

| Weeks | Must ship | Kill / pivot criterion |
|---|---|---|
| 1–2 | Correct `docs/apple-review-response.md`; §4 decision logged; App Preview (S1); first screenshot (S2); accounts live; 14 videos posted | — |
| 3–4 | P2 first-session pack; P1 share card; CPPs for packs/career; daily posting continues | If no format beats 15% 3-s hold after 25 posts → rework hooks from §2.3 research before continuing |
| 5–8 | 2 paid creators (tier 2), each on their own CPP; IAEs every week; Road to Glory series | Creator CPI > $3 → stop paid creators, stay on gifted tier |
| 9–12 | Re-run economics with measured inputs; if all §9 gates pass → $300 Spark test | Gates fail → next 30 days go to CVR + retention, not spend |

**Target at day 90 (stretch, not a forecast):** 150+ installs/day, page CVR ≥
25%, ≥ 1 organic post > 100K views, measured net revenue/install known.

---

## 12. Never

- Fail-ads, fake gameplay, fake reactions, "guaranteed [star]" claims.
- Real player names in store fields, ad copy or thumbnails (§4 rung 4).
- Competitor or league marks in metadata ("FIFA", "FC", "TOTY", "Premier League",
  "Champions League") — Guideline 2.3.7. (Bidding on competitor terms in Apple
  Ads is a different rule and is allowed.)
- Incentivised or fake reviews, review-gating (Guideline 5.6).
- Targeting minors with pack content.
- Paid spend before §9 gates, however good a single video looks.

---

## Sources

Category and competitors:
- [Top Eleven — App Store](https://apps.apple.com/ai/app/top-eleven-be-football-manager/id459035295) · [Top Eleven TikTok](https://www.tiktok.com/@topeleven?lang=en)
- [OSM — App Store](https://apps.apple.com/us/app/online-soccer-manager-osm/id400201466) · [OSM — Google Play](https://play.google.com/store/apps/details?id=com.gamebasics.osm&hl=en_US)
- [Soccer Manager 2026 — Google Play](https://play.google.com/store/apps/details?id=com.invinciblesstudioltd.soccermanager2025&hl=en-GB)
- [FM26 Mobile — Netflix Tudum](https://www.netflix.com/tudum/articles/football-manager-26-mobile-game-news) · [FM26 Mobile — App Store](https://apps.apple.com/us/app/football-manager-26-mobile/id6446123740)
- [FC Mobile pack-opening on TikTok](https://www.tiktok.com/discover/how-to-open-pack-in-fc-mobile-best-players)
- [MADFUT — RAWG](https://rawg.io/games/mad-fut-21-draft-pack-opener) · [MADFUT — Apptopia](https://apptopia.com/ios/app/1533321887/about)
- [Retro Bowl #1 with no UA — PocketGamer.biz](https://www.pocketgamer.biz/uk-based-new-star-games-takes-us-by-storm-with-retro-bowl/) · [Making of Retro Bowl — PocketGamer.biz](https://www.pocketgamer.biz/new-star-games-simon-read-retro-bowl-making-of/)
- [Viral TikTok games 2026 — Filmora](https://filmora.wondershare.com/tiktok/tiktok-games.html)

Store conversion:
- [CPP guide 2026 — RespectASO](https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/) · [CPPs — Adapty](https://adapty.io/blog/custom-product-pages-app-store/) · [ASO benchmarks — AppTweak](https://www.apptweak.com/en/aso-resources/guides/aso-trends-benchmarks-a-comprehensive-data-study) · [ASO statistics 2026](https://www.digitalapplied.com/blog/app-store-optimization-aso-statistics-2026-data) · [Apple's 156% CPP figure, critiqued](https://appscreenshotstudio.com/blog/how-to-measure-custom-product-page-performance-2026)
- [Mobile game UA playbook 2026 — AppAgent](https://appagent.com/blog/mobile-game-user-acquisition-strategy/)

Image rights:
- [Image rights in video games — Fox Williams](https://www.foxwilliams.com/2021/03/09/its-in-the-game-unauthorised-use-of-image-rights-in-video-games/) · [EA and image rights in Brazil — LexSportiva](https://lexsportiva.blog/2020/07/22/easportsvimagerightsinbrazil/) · [NIL in games — Naavik](https://naavik.co/digest/fifa-messi-likeness-rights/) · [How FIFA obtains image rights — Fordham IPLJ](http://www.fordhamiplj.org/2021/11/11/fifa-how-does-the-most-successful-sports-video-game-obtain-player-i-rights/)
