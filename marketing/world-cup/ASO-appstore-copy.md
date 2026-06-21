# World Cup ASO — App Store Connect copy (paste-ready)

> Tuned for the live 2026 World Cup search window. App Store id 6760918006.
> Pair with the 6-panel screenshot set in `marketing/world-cup/appstore/`.

---

## ⚠️ READ FIRST — trademark decision (yours to make)

`APP_STORE_LISTING.md` (item #4) flags **"World Cup"** as a FIFA registered
mark and keeps it out of the official listing copy. But:

- Your **in-game mode is already named "World Cup"** and is publicly live, and
  the entire marketing kit leads with it.
- **"world cup"** is also a widely-used *descriptive* phrase in soccer-game ASO
  (many competitors rank on it). Using it lowercase as a generic competition
  descriptor — while **never** using FIFA's name, logos, official emblem, or
  implying official affiliation — is the common, defensible middle ground.

**Two variants below. Pick by your risk tolerance:**

- **Variant A (aggressive):** uses "World Cup / World Cup 2026" in
  subtitle + keywords. Maximum search capture during the window. Higher (not
  high) trademark exposure. Recommended **only** if you're comfortable that
  you already use the term in-app and accept a small takedown risk.
- **Variant B (trademark-safe):** "World Championship / international
  tournament" phrasing. Near-zero added IP exposure, slightly less search
  capture. **Recommended default** given your own listing doc's posture.

Whichever you choose: do **not** add FIFA marks, country FA logos, or "official"
claims. Keep the in-app mode name consistent with what you publish.

---

## VARIANT A — "World Cup" (aggressive)

### App Name / Title  (≤30 chars)
```
Dynasty Manager: Soccer
```
*(23) — keep the brand; push World Cup via subtitle + keywords. Optional
window-only test: `Dynasty Manager: World Cup` (26).*

### Subtitle  (≤30 chars)
```
Win the 2026 World Cup
```
*(22)*

### Keywords  (≤100 chars, comma-separated, no spaces, no words already in
title/subtitle)
```
world cup,national team,soccer game,football manager,tactics,penalty,career,league,club,formation,squad
```
*(~99 — trim the last term if App Store Connect reports over 100.)*

### Promotional Text  (≤170 chars — editable without a new build)
```
The 2026 World Cup is here. Take any nation from the group stage to the final — live matches, real tactics, penalty drama. Free to play, Dynasty Pro trial included.
```
*(~165)*

---

## VARIANT B — trademark-safe (recommended default)

### App Name / Title  (≤30 chars)
```
Dynasty Manager: Soccer
```
*(23)*

### Subtitle  (≤30 chars)
```
Win the World Championship
```
*(26)*

### Keywords  (≤100 chars)
```
world championship,national team,soccer game,football manager,tactics,penalty,career,league,club,formation
```
*(~101 — drop "formation" or "club" to fit.)*

### Promotional Text  (≤170 chars)
```
The summer of international football is here. Take any nation from the group stage to the final — live matches, real tactics, penalty drama. Free to play.
```
*(~157)*

---

## Description — World Cup lead block (prepend to existing description)

> Insert this above the current "Build the most powerful football dynasty…"
> opener. Use the same wording for both variants except swap the two bracketed
> terms: Variant A = "World Cup", Variant B = "World Championship".

```
⚽ NEW: WORLD CUP MODE — the summer of international football is here.

Pick any of 50+ nations and chase the [World Cup / World Championship]:
survive the group stage, win the knockouts, and lift the trophy. Manage
every minute of every match — team talks, substitutions, set pieces, and
nerve-shredding penalty shootouts. Crown a champion every time.

━━━ BUILD THE GREATEST FOOTBALL DYNASTY ━━━
```

*(Then continue with the existing description body unchanged.)*

---

## "What's New" (release notes for the build that ships WC polish)

```
⚽ WORLD CUP UPDATE
• Take any nation through a full World Cup — group stage to the final.
• Live national-team matches with team talks, subs, and penalty shootouts.
• Win it all: trophy lift, Golden Boot and Young Star awards on the result screen.
• Share your run — brag about your champions straight from the result screen.
Plus stability and polish improvements.
```

---

## Rollout checklist

1. **Screenshots:** upload `appstore-1-here` … `appstore-6-glory` (1290×2796)
   in order to the 6.7"/6.9" slot. App Store Connect down-scales for smaller
   devices automatically.
2. **Subtitle + Promotional Text + Keywords:** editable **without** a new
   binary submission — you can flip these the day the window opens and back
   afterward. Set them now.
3. **Description + "What's New":** require a version/metadata submission. Ship
   alongside the next build (the WC polish build).
4. **Localization:** the keyword field is per-locale — at minimum set the
   English (U.S.) and English (U.K.) locales; add Spanish/Portuguese/French to
   capture non-English "world cup" search volume if you have the bandwidth.
5. After the window: revert Subtitle/Promo Text to evergreen copy (the
   tournament-agnostic versions already in `APP_STORE_LISTING.md`).
```
```
