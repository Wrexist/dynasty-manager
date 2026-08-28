# TikTok-08 — Hall of Legends (1 body × 4 hooks, in-house capture)

**Format:** In-feed / Shorts, captured from the real app — no creator needed
**Length:** 13s · **Spec:** 1080×1920, 60fps
**Effort:** `npm run capture:ads` (see `marketing/postproduction/README-capture.md`)

## Why this creative exists

Every other script in this kit needs a creator, a shoot or a phone recording.
This one does not: it is generated headlessly from the real `PackOpeningOverlay`
in Chromium, so it can be regenerated the day a pack visual changes and it can
never drift from what the app actually does.

It also leads with the one thing no competitor can copy. FC has Icons; we
cannot and will never have them (retired-player likeness rights are licensed
individually). What we have instead is **the player's own history** — a great
who retires inside your save enters the Hall of Legends and can be dealt back
as a card. "Your legends don't retire" is a claim EA structurally cannot make,
and a hook that is true is worth more than a hook that is loud.

## The body (identical across all four)

| Beat | Page time | What is on screen |
|---|---|---|
| Packet + charge | 0.0–2.2s | World Class packet, rumble, tap-to-rip |
| Reveal grid | 2.2–7.0s | Five cards, revealed low-to-high so the pack builds |
| Walkout | 7.0–11.5s | Hero card, ♛ HALL OF LEGENDS chip, the legend's era line |
| Summary | 11.5–13.6s | "BEST PULL · HALL OF LEGENDS", squad value |

Cards are ordered ascending deliberately: an unordered reveal peaks early and
the walkout then reads as an anticlimax.

## The four hooks

| # | Hook (0–3.2s) | Mid (7–10s) | Angle |
|---|---|---|---|
| 01 | YOUR LEGENDS DON'T RETIRE | THEY COME BACK AS CARDS | The differentiator. Lead here. |
| 02 | I PULLED A 94 IN A FREE GAME | THE HALL OF LEGENDS IS REAL | Value + disbelief; the genre's proven format. |
| 03 | NAME A BETTER PACK ANIMATION | I'LL WAIT. | Banter / comment-bait. Engagement play. |
| 04 | A GREAT RETIRED IN MY SAVE | NOW HE'S BACK IN MY SQUAD | Story. Longest to land, best for Shorts. |

CTA on 01–03: `DYNASTY MANAGER · FREE ON IOS`. On 04: `SEARCH DYNASTY MANAGER`.

## Caption placement is not cosmetic

Captions sit at 20% from top / 26% from bottom. Both edges are hostile: the
capture is 9:19.5 and is centre-cropped to 9:16, and TikTok's own chrome
(username, caption, action rail) covers roughly the bottom fifth and the right
edge. A hook clipped by either is a dead ad. The first cut of these had the
hook at 9% and it landed exactly on the crop line.

## Music

Add in-platform, not in the file. Use TikTok's Commercial Music Library so the
asset stays licensed for paid use, and sync the drop to the **walkout flash at
~7.2s** — that is the frame the whole 13 seconds is built around.

## Rights note — read before adding a real name to a hook

The reveal grid contains real footballers because the app's squads do; that is
product footage and it is what a viewer would see. Do NOT write a real
footballer's name into a hook, caption or ad headline. The app ships real
player data without a licence — a low-salience risk at this scale — and an ad
headlining a named star both raises the right-of-publicity question directly
and is the single most likely thing to draw a rights holder's attention to
everything else. The Hall of Legends heroes are invented and ours; headline
those.

## Test plan

| Setting | Value |
|---|---|
| Platform | TikTok in-feed (non-Spark — no creator rights needed) |
| Spend | $300 over 7 days, $43/day |
| Variants | All four hooks, one body |
| Read | Hook-rate (3s view %) first, CPI second |
| Kill | Any hook < 20% 3s-view-rate after 5K impressions |
| Winner | CPI < $4 AND hold-rate > 10% → port that hook to Meta as `/ad-meta` body |

Hook-rate is the read that matters here: the body is identical across all four,
so any difference in performance is attributable to the hook alone. That is the
whole reason to ship four.
