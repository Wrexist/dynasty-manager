# Game Monetization Strategy Prompt

> Copy-paste this entire prompt into a Claude Code session to design and implement a monetization strategy that maximizes revenue while preserving the premium game feel.

---

You are a mobile game monetization strategist specializing in premium sports management games. Your job is to design a monetization system that players WANT to spend money on — not because they're forced to, but because the value feels worth it. Read CLAUDE.md first, then read the full codebase.

## Current State Assessment

Before designing anything, audit the existing systems that monetization must integrate with:

### Existing In-Game Economy
Read these files and map the full economy:
- `src/config/gameBalance.ts` — All income/cost constants
- `src/config/merchandise.ts` — 5 product lines, pricing tiers, campaigns
- `src/config/sponsorship.ts` — 40 sponsors across 5 rep tiers, 7 sponsorship slots
- `src/store/slices/merchandiseSlice.ts` — Merch state management
- `src/store/slices/sponsorSlice.ts` — Sponsor lifecycle, satisfaction, offers
- `src/utils/managerPerks.ts` — XP system, 20-perk tree across 5 tiers
- `src/utils/prestige.ts` — 3 prestige paths, XP multipliers
- `src/utils/achievements.ts` — 20+ achievements with XP rewards

Answer:
- Where does in-game money come from and go? Map every income and expense source.
- What does the player progression curve look like across 10+ seasons?
- Where are the natural "I wish I could..." moments that create spending desire?
- What existing systems could be extended with premium tiers vs. built from scratch?

### Platform Readiness
- `capacitor.config.ts` — Current Capacitor setup
- `package.json` — Current plugins (haptics, splash, status bar, keyboard — NO payment plugins)
- What Capacitor payment plugins exist? (RevenueCat, `@capawesome/capacitor-purchases`, etc.)
- What are App Store / Play Store requirements for IAP in management/simulation games?

## Part 1: Monetization Model Selection

Evaluate each model against Dynasty Manager's specific characteristics:

### Model A: Premium (One-Time Purchase)
- Price point analysis for football management sims on mobile
- What content justifies the price? Compare to Football Manager Mobile, Retro Goal, etc.
- Pros: Simple, no ongoing pressure, premium brand perception
- Cons: Revenue cap, harder discovery, must justify price to skeptics

### Model B: Freemium with Cosmetics
- What cosmetic layers can exist in a management sim? (Not a shooter — think carefully)
- Manager customization, club aesthetics, UI themes, celebration styles, pitch visuals
- Can the existing prestige system become the "show off" hook?
- Pros: Large audience, recurring revenue, no gameplay impact
- Cons: Management sims have fewer cosmetic surfaces than action games

### Model C: Freemium with Battle Pass / Season Pass
- The game already has a weekly loop (`advanceWeek()`), XP system, and seasons — perfect fit
- Free track vs. premium track rewards
- How does this interact with the existing perk/achievement XP system?
- Pros: Predictable revenue, drives engagement, FOMO (if done ethically)
- Cons: Must deliver fresh content per pass cycle

### Model D: Hybrid (Free + Premium Upgrade)
- Free version with ads → one-time purchase removes ads + unlocks extras
- What's free vs. what's premium?
- Pros: Wide funnel, clear value proposition, respects player choice
- Cons: Must balance so free feels complete but premium feels worth it

**Recommend ONE primary model** with clear reasoning. If hybrid, specify which elements combine.

## Part 2: Revenue Stream Design

Design each revenue stream in detail. For every feature, specify:
- What the player sees and feels
- How it integrates with existing code (specific files and functions)
- What new code/components are needed
- Estimated implementation effort (S/M/L/XL)

### Stream 1: Cosmetic Layer

#### Manager Identity
- Avatar system (portrait styles, accessories, outfit pieces)
- Manager title/badge display (ties into prestige system at `src/utils/prestige.ts`)
- Custom manager celebration animations after wins
- Where this appears: `src/pages/ManagerProfile.tsx`, match results, leaderboards

#### Club Aesthetics
- Stadium themes (atmosphere effects in `src/pages/Facilities.tsx`)
- Pitch visual styles (grass patterns, weather moods in `src/engine/match.ts`)
- Kit design editor or premium kit packs
- Custom formation board skins for `src/components/game/PitchView.tsx`

#### UI Themes
- Premium color accent options beyond the default gold (`43 96% 46%`)
- Glass-morphism intensity variants
- Trophy cabinet display styles in `src/pages/TrophyCabinet.tsx`

### Stream 2: Season Pass / Battle Pass

Design a season pass that works WITH the existing game structure:

#### Structure
- **Duration:** Aligns with in-game season (46 weeks of fixtures)
- **Progression:** Leverages existing XP system in `src/utils/managerPerks.ts`
- **Free Track:** ~30 rewards (in-game currency bonuses, basic cosmetics, XP boosts)
- **Premium Track:** ~30 additional rewards (exclusive cosmetics, advanced analytics, unique celebrations)

#### Reward Types (no pay-to-win)
- Cosmetic: Manager outfits, pitch skins, UI themes
- Convenience: Extra scout reports, advanced match stats overlay, detailed youth projections
- Social: Badges, titles, profile frames for Hall of Managers (`src/pages/HallOfManagers.tsx`)
- Currency: Small in-game budget bonuses (must not break economy balance)

#### Integration Points
- XP events in `src/store/slices/orchestrationSlice.ts` (`advanceWeek()`)
- Achievement unlocks in `src/utils/achievements.ts`
- Match results in `src/engine/match.ts`
- Season end in `orchestrationSlice.ts` (`endSeason()`)

### Stream 3: Premium Unlocks (One-Time or Tiered)

Features that enhance the experience without affecting competitive balance:

- **Extra Save Slots** — Currently single save at `localStorage 'dynasty-save'` (`src/store/helpers/persistence.ts`). Premium adds 3+ slots.
- **Advanced Analytics Dashboard** — Deeper stats, trend graphs, season comparisons (extends `Recharts` usage)
- **Custom Tactics Creator** — Beyond the 7 formations in `src/types/game.ts`. Create and name custom formations.
- **Expanded Press Conferences** — More choices/outcomes from `src/data/pressConferences.ts`
- **Historical Record Book** — Detailed all-time records beyond what `src/utils/records.ts` tracks
- **Instant Sim Speed** — Skip match animation, see results instantly

### Stream 4: Rewarded Ads (Opt-In Only)

If the model includes ads, they MUST be:
- **Opt-in only** — Player chooses to watch for a reward
- **Never interrupting** — No forced pre-roll, no interstitials between screens
- **Clearly valuable** — Reward must feel worth 30 seconds

#### Ad Placement Opportunities
- Watch ad → reveal a scouted player's hidden potential (`src/utils/scouting.ts`)
- Watch ad → get a bonus transfer budget injection for the window
- Watch ad → unlock a free XP boost for the next 5 matches
- Watch ad → get an extra youth academy intake preview
- Watch ad → replay a match with different tactics (without advancing the week)

### Stream 5: Supporter Packs / Bundles (IAP)

One-time purchase bundles themed around the game:

- **Starter Pack** — Cosmetic bundle + small XP boost (available first 7 days only)
- **Manager's Toolkit** — Extra save slots + advanced analytics + custom formations
- **Dynasty Edition** — All premium features unlocked permanently
- **Seasonal Kits** — Rotating cosmetic bundles per real-world season

## Part 3: Economy Integration & Balance

This is the most critical section. Monetization must NOT break the game.

### Hard Rules
- **No pay-to-win**: No purchased advantage that affects match outcomes, transfer success, or player development
- **No premium currency**: Don't add gems/coins/tokens — the in-game budget IS the currency
- **No energy/timer gates**: Players can play as much as they want, always
- **No loot boxes**: Every purchase shows exactly what the player gets
- **No stat boosts for money**: Player ratings, match engine, and AI behavior are never affected by spending

### Balance Checks
For every monetization feature, answer:
- Can a free player reach the same gameplay outcomes as a paying player? (Must be YES)
- Does this make the existing progression feel worse to push people toward paying? (Must be NO)
- Would a player who spent £50 have a meaningful advantage in league standings? (Must be NO)
- Does the free experience feel complete and fun on its own? (Must be YES)

### Integration with `gameBalance.ts`
- Review all constants in `src/config/gameBalance.ts`
- Ensure no monetization feature modifies: `MATCH_*` constants, `TRAINING_*` rates, `TRANSFER_*` values, or any core simulation parameter
- Monetization configs go in a NEW config file: `src/config/monetization.ts`
- Monetization state goes in a NEW store slice: `src/store/slices/monetizationSlice.ts`
- Types go in `src/types/game.ts` (per project convention — single type source of truth)

## Part 4: Technical Implementation Plan

### Payment Infrastructure
- Recommend a Capacitor-compatible payment plugin (RevenueCat preferred for cross-platform)
- Receipt validation strategy (server-side vs. client-side for an offline game)
- Restore purchases flow (required by both app stores)
- Handling offline purchases and syncing

### New Files Needed
```
src/config/monetization.ts          — All monetization constants and product definitions
src/store/slices/monetizationSlice.ts — Purchase state, unlocks, pass progress
src/utils/monetization.ts           — Helper functions for checking entitlements
src/pages/ShopPage.tsx              — Premium shop UI (new page, new route)
src/pages/SeasonPassPage.tsx        — Battle pass progression display
src/components/game/PurchaseModal.tsx — Purchase confirmation with App Store flow
```

### Modified Files
```
src/types/game.ts                   — Add monetization types (cosmetic IDs, pass tiers, entitlements)
src/store/storeTypes.ts             — Add monetization state to GameState
src/store/gameStore.ts              — Add monetization slice
src/store/slices/orchestrationSlice.ts — Hook XP events into pass progression
src/store/helpers/persistence.ts    — Handle multi-save-slot if implemented
src/components/game/BottomNav.tsx   — Add Shop nav item
src/App.tsx or router               — Add new routes
capacitor.config.ts                 — Payment plugin config
package.json                        — New dependencies
```

### Data Architecture
- Purchases stored locally (offline-first) + synced when online
- Purchase receipts validated on restore
- Cosmetic unlocks persisted in save file alongside game state
- Pass progress tracked per real-world season (not in-game season)

## Part 5: Pricing Strategy

### Market Research
- Survey pricing of comparable games: Football Manager Mobile, Top Eleven, Score! Match, Retro Bowl
- What price points work for management sim audiences?
- Regional pricing considerations (App Store tiers)

### Recommended Price Points
For each product/bundle, recommend:
- US price point
- Whether it's one-time or recurring
- Expected conversion rate benchmark for the genre
- Perceived value justification

### A/B Testing Plan
- What can be tested without app updates? (Pricing, bundle composition, placement)
- What metrics define success? (ARPU, conversion rate, retention impact)

## Part 6: Prioritized Implementation Roadmap

Sort all proposed features into phases:

### Phase 1: Foundation (Must-Have Before Launch)
- Payment infrastructure + restore purchases
- ONE core revenue stream fully implemented
- Shop UI
- Analytics events for purchase funnel

### Phase 2: Growth (First 30 Days Post-Launch)
- Second revenue stream
- Starter pack (time-limited conversion driver)
- A/B test hooks

### Phase 3: Scale (60-90 Days)
- Season pass system
- Expanded cosmetics
- Bundle offers based on player behavior

For each phase, estimate the number of new files, modified files, and overall effort.

## Deliverables

1. **Model recommendation** — Which monetization model and why
2. **Feature specs** — Each revenue stream with integration details
3. **Economy impact analysis** — Proof that game balance is preserved
4. **Technical architecture** — New files, modified files, data flow
5. **Pricing sheet** — Every product with recommended price
6. **Phase 1 implementation** — Build the foundation: config, types, store slice, shop page, and payment integration

## Rules

- **Player-first**: Every monetization decision must pass the test "Would I feel good about this as a player?"
- **No dark patterns**: No fake countdown timers, manipulative FOMO, predatory targeting of whales, or pay-to-progress gates
- **Offline-first**: All purchased content must work without internet after initial purchase/restore
- **Premium feel**: The shop and purchase flows must match the game's dark glass-morphism aesthetic — no cheap mobile game store vibes
- **Platform compliance**: Follow Apple App Store and Google Play billing guidelines exactly
- **Existing code respect**: Don't restructure working systems — extend them. Monetization is an overlay, not a rewrite.
- **No changes to `src/components/ui/*`** unless explicitly needed for the shop
- **All balance constants in `src/config/`** — never hardcode prices or rewards in components
- **Types in `src/types/game.ts`** — single source of truth per project convention
- **Test coverage**: New monetization logic must have tests in `src/test/`
- Reference specific files and line numbers in your proposals
