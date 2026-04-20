# Game Monetization Strategy Prompt

> Copy-paste this entire prompt into a Claude Code session to design and implement a monetization strategy that maximizes revenue while preserving the premium game feel.

---

You are the monetization architect for Dynasty Manager — a premium mobile football management sim with existing IAP infrastructure already partially implemented. Your mandate is player-first design: no pay-to-win, no dark patterns, no premium currency, no loot boxes, no energy gates. Every decision must pass the test: "Would I feel good about this as a player?"

## NON-NEGOTIABLE CONSTRAINTS (Read Before Anything Else)

- **No pay-to-win**: No purchased advantage that affects match outcomes, transfer success, or player development
- **No premium currency**: Don't add gems/coins/tokens — the in-game budget IS the currency
- **No energy/timer gates**: Players can play as much as they want, always
- **No loot boxes**: Every purchase shows exactly what the player gets
- **No stat boosts for money**: Player ratings, match engine, and AI behavior are never affected by spending
- **No dark patterns**: No fake countdown timers, manipulative FOMO, predatory targeting
- **Offline-first**: All purchased content must work without internet after initial purchase/restore
- **Existing code respect**: Extend working systems — monetization is an overlay, not a rewrite
- **No changes to `src/components/ui/*`** unless explicitly needed for the shop
- **All balance constants in `src/config/`** — never hardcode prices or rewards in components
- **Types in `src/types/game.ts`** — single source of truth
- **Test coverage**: New monetization logic must have tests in `src/test/`

---

## Current State Assessment

Before designing anything, read the existing monetization infrastructure.

### Read These First (in order)

If a file doesn't exist at the stated path, say so rather than proceeding as if you read it.

**Existing infrastructure to read and assess (do NOT recreate these):**
1. **`src/config/monetization.ts`** — Existing monetization constants and product definitions. Assess what's already defined.
2. **`src/store/slices/monetizationSlice.ts`** — Existing purchase state, unlocks, ad rewards, cosmetics. Assess what's already implemented.
3. **`src/utils/monetization.ts`** — Existing helper functions for checking entitlements. Assess what already exists.
4. **`src/pages/ShopPage.tsx`** — Existing shop UI. Assess its current state and gaps.
5. **`src/components/game/PurchaseModal.tsx`** — Existing purchase confirmation modal. Assess it.

**Economy files (map the full economy before designing):**
6. **`src/config/gameBalance.ts`** — All income/cost constants
7. **`src/utils/managerPerks.ts`** — XP system and perk tree
8. **`src/utils/prestige.ts`** — Prestige paths and XP multipliers
9. **`src/utils/achievements.ts`** — Achievement system with XP rewards
10. **`src/store/helpers/persistence.ts`** — Multi-slot save infrastructure (`readSaveSlot`, `writeSaveSlot`, `STORAGE_KEYS.saveSlot(n)` — multi-slot is already implemented; note the current free-tier slot count)

**Platform readiness:**
11. **`capacitor.config.ts`** — Current Capacitor setup
12. **`package.json`** — Current plugins (check for any payment plugins already added)

After reading, answer:
- What monetization infrastructure already exists and is functional?
- What is the single biggest gap between what exists and a shippable monetization system?
- Where are the natural "I wish I could..." moments that create spending desire?

---

## Part 1: Monetization Model Selection

Evaluate each model against Dynasty Manager's characteristics:

### Model A: Premium (One-Time Purchase)
- Price point analysis for football management sims on mobile (Football Manager Mobile, Retro Goal comparisons)
- What content justifies the price?
- Pros: Simple, no ongoing pressure, premium brand perception
- Cons: Revenue cap, harder discovery

### Model B: Freemium with Cosmetics
- What cosmetic layers can exist in a management sim? (Manager customization, club aesthetics, UI themes, celebration styles)
- Can the existing prestige system become the "show off" hook?
- Pros: Large audience, recurring revenue, no gameplay impact
- Cons: Management sims have fewer cosmetic surfaces than action games

### Model C: Freemium with Season Pass
- The game already has a weekly loop (`advanceWeek()`), XP system, and seasons — natural fit
- How does this interact with the existing perk/achievement XP system?
- **`SeasonPassPage.tsx` does not yet exist** — this is the primary implementation gap
- Pros: Predictable revenue, drives engagement
- Cons: Must deliver fresh content per pass cycle

### Model D: Hybrid (Free + Premium Upgrade)
- Free version with ads → one-time purchase removes ads + unlocks extras
- Pros: Wide funnel, clear value proposition
- Cons: Must balance so free feels complete

**Recommend ONE primary model** with clear reasoning.

---

## Part 2: Revenue Stream Design

Design each revenue stream in detail. For every feature, specify:
- What the player sees and feels
- How it integrates with existing code (specific files and functions)
- What new code is needed vs. what already exists
- Estimated implementation effort (S/M/L/XL)

### Stream 1: Cosmetic Layer

#### Manager Identity
- Avatar system (portrait styles, accessories, outfit pieces)
- Manager title/badge display (ties into prestige system at `src/utils/prestige.ts`)
- Where this appears: `src/pages/ManagerProfile.tsx`, match results

#### Club Aesthetics
- Stadium themes (atmosphere effects in `src/pages/FacilitiesPage.tsx`)
- Pitch visual styles (grass patterns, weather moods in `src/engine/match.ts`)
- Kit design editor or premium kit packs
- Custom formation board skins for `src/components/game/BoardPitch.tsx`

#### UI Themes
- Premium color accent options beyond the default gold (`43 96% 46%`)
- Trophy cabinet display styles in `src/pages/TrophyCabinet.tsx`

### Stream 2: Season Pass / Battle Pass

Design a season pass that works WITH the existing structure:

#### Structure
- **Duration:** Aligns with in-game season (46 weeks of fixtures)
- **Progression:** Leverages existing XP system in `src/utils/managerPerks.ts`
- **Free Track:** ~30 rewards (in-game currency bonuses, basic cosmetics, XP boosts)
- **Premium Track:** ~30 additional rewards (exclusive cosmetics, advanced analytics, unique celebrations)

#### Reward Types (no pay-to-win)
- Cosmetic: Manager outfits, pitch skins, UI themes
- Convenience: Extra scout reports, advanced match stats overlay, detailed youth projections
- Social: Badges, titles, profile frames for Hall of Managers
- Currency: Small in-game budget bonuses (must not break economy balance)

#### Integration Points
- XP events in `src/store/slices/orchestrationSlice.ts` (`advanceWeek()`)
- Achievement unlocks in `src/utils/achievements.ts`
- Season end in `orchestrationSlice.ts` (`endSeason()`)
- **New file needed**: `src/pages/SeasonPassPage.tsx` — this is the primary missing UI component

### Stream 3: Premium Unlocks (One-Time or Tiered)

- **Extra Save Slots** — Multi-slot save is already implemented via `STORAGE_KEYS.saveSlot(n)` in `src/store/helpers/persistence.ts`. The premium feature is unlocking additional slots beyond the free tier's allocation.
- **Advanced Analytics Dashboard** — Deeper stats, trend graphs, season comparisons (extends Recharts usage)
- **Custom Tactics Creator** — Beyond the 7 formations in `src/types/game.ts`
- **Expanded Press Conferences** — More choices/outcomes from `src/data/pressConferences.ts`
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

### Stream 5: Supporter Packs / Bundles (IAP)

- **Starter Pack** — Cosmetic bundle + small XP boost (available first 7 days only)
- **Manager's Toolkit** — Extra save slots + advanced analytics + custom formations
- **Dynasty Edition** — All premium features unlocked permanently
- **Seasonal Kits** — Rotating cosmetic bundles per real-world season

---

## Part 3: Economy Integration & Balance

> **Before answering the balance checks below**, think through the causal chain: if a paying player gets benefit X, trace the path — what in-game outcomes does it affect, and what is the delta versus a free player after 10 seasons? Only then answer each question. Flag any benefit where the causal chain is unclear as `[NEEDS VERIFICATION]`.

### Balance Checks (all must be YES/NO as specified)
- Can a free player reach the same gameplay outcomes as a paying player? (Must be **YES**)
- Does this make the existing progression feel worse to push people toward paying? (Must be **NO**)
- Would a player who spent £50 have a meaningful advantage in league standings? (Must be **NO**)
- Does the free experience feel complete and fun on its own? (Must be **YES**)

### Integration with `gameBalance.ts`
- Review constants in `src/config/gameBalance.ts`
- Ensure no monetization feature modifies: `MATCH_*` constants, `TRAINING_*` rates, `TRANSFER_*` values, or any core simulation parameter
- Monetization configs go in `src/config/monetization.ts` (already exists — extend it)
- Monetization state goes in `src/store/slices/monetizationSlice.ts` (already exists — extend it)

---

## Part 4: Technical Implementation Plan

### Payment Infrastructure
- Recommend a Capacitor-compatible payment plugin (RevenueCat preferred for cross-platform)
- Receipt validation strategy (client-side for offline game, restore purchases flow)
- Handling offline purchases

### New Files Needed
```
src/pages/SeasonPassPage.tsx    — Battle pass progression display (primary gap)
```

### Existing Infrastructure to Extend (do NOT recreate)
```
src/config/monetization.ts              — Extend with new product definitions
src/store/slices/monetizationSlice.ts   — Extend with season pass state
src/utils/monetization.ts               — Extend with new entitlement helpers
src/pages/ShopPage.tsx                  — Extend with new product listings
src/components/game/PurchaseModal.tsx   — Extend if new purchase flows needed
```

### Modified Files
```
src/types/game.ts                       — Add monetization types (cosmetic IDs, pass tiers)
src/store/storeTypes.ts                 — Add season pass state to GameState
src/store/gameStore.ts                  — Wire if new slice needed
src/store/slices/orchestrationSlice.ts  — Hook XP events into pass progression
src/components/game/BottomNav.tsx       — Add Shop nav item if missing
```

---

## Part 5: Pricing Strategy

### Market Research
- Compare: Football Manager Mobile, Top Eleven, Score! Match, Retro Bowl
- What price points work for management sim audiences?
- Regional pricing considerations

### Recommended Price Points
For each product/bundle, recommend:
- US price point
- One-time or recurring
- Expected conversion rate benchmark for the genre
- Perceived value justification

---

## Part 6: Prioritized Implementation Roadmap

### Phase 1: Foundation (Must-Have Before Launch)
- Payment infrastructure + restore purchases
- ONE core revenue stream fully implemented
- Shop UI assessment and gap-fill
- Analytics events for purchase funnel

### Phase 2: Growth (First 30 Days Post-Launch)
- Second revenue stream
- Starter pack (time-limited)
- A/B test hooks

### Phase 3: Scale (60-90 Days)
- Season pass system (`SeasonPassPage.tsx`)
- Expanded cosmetics

---

## Deliverables

1. **Model recommendation** — which model and why
2. **Feature specs** — each revenue stream with integration details and references to existing infrastructure
3. **Economy impact analysis** — proof that game balance is preserved
4. **Technical architecture** — what to extend vs. what's new
5. **Pricing sheet** — every product with recommended price
6. **Phase 1 implementation** — build the foundation using existing infrastructure
