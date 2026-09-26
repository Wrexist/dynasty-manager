# 30-day TikTok playbook: Sun 27 Sep to Mon 26 Oct 2026

Account: **@deltaisac** (display name "Dynasty Manager"). New account, about 100
views on the first post. Executes `marketing/PLAYBOOK.md` §4 to §6 under the owner
decisions of 2026-09-27:

- **3 posts a day** at 13:00, 18:00 and 21:00 CEST (12:00, 17:00 and 20:00 UK).
  Sweden and the UK both change clocks on Sun 25 Oct, so the UK stays 1 hour
  behind for the whole month (CEST/BST, then CET/GMT).
- **Real player names are allowed** in organic hooks, captions and hashtags.
- **Every post is marked "Your brand"** (Content disclosure, Promotional content).
- A pinned-hero walkout is a **showcase**. Never caption it "my pull" or "rate my
  pull", and never frame it as luck (PLAYBOOK §4, limit 1).
- Existing posts are never deleted.

Week 1 is fully headless. The machine-readable list is
`marketing/content/week1-production.json`.

**Fixed slots (do not move):** Sat 26 Sep A01 (posted) · Sun 27 Sep 13:55 Mbappé,
18:xx Haaland, 21:xx Salah (owner-scheduled) · Wed 30 Sep 21:20 A02 · Sat 3 Oct
21:25 A04 · Mon 5 Oct 21:45 A05.

---

## 1. What the research says (Sep 2026)

Graded by source. **Official** means TikTok's own docs. **Study** means a large
published dataset. **Vendor** means a marketing blog: treat it as direction, not
fact. **Folklore** means widely repeated but unverified.

| # | Technique | Evidence | What we do |
|---|---|---|---|
| 1 | **Follower count is not a ranking factor.** A new account's video can reach as far as a big one. | **Official**: TikTok says neither follower count nor past hits are direct factors in For You ranking ([TikTok Newsroom](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you)) | Judge each post on its own numbers. 100 views on post 1 predicts nothing. |
| 2 | **Watch-through beats everything.** Completion rate, then shares, saves and comments, then likes. | **Vendor**, consistent across sources ([Hootsuite](https://blog.hootsuite.com/tiktok-algorithm/), [Darkroom](https://www.darkroomagency.com/observatory/tiktok-algorithm-guide-2026-everything-we-know-about-how-videos-are-ranked)). Exact weights such as "40 to 50%" or "70% completion" are **folklore** | Keep walkouts short. The icon-plan star renders are about 8.7 s. The hook is on frame 1 and the payoff (the OVR) lands before the viewer can leave. |
| 3 | **Repetitive or unoriginal content gets throttled.** TikTok "interrupts repetitive content patterns", and reused content without new creative edits is not eligible for the For You feed. | **Official** ([For You feed eligibility standards](https://www.tiktok.com/community-guidelines/en/fyf-standards/)) | This is the main risk of a star-walkout-heavy plan. Every walkout gets a different star, hook and caption. **At most 2 walkouts a day from week 2**, with a different format in the other slot. |
| 4 | **TikTok is a search engine.** It indexes captions, on-screen text (OCR), speech and sound names. Put the keyword in the first caption line and on screen. | **Vendor** ([Stackmatix](https://www.stackmatix.com/blog/tiktok-seo), [PostEverywhere](https://posteverywhere.ai/blog/tiktok-seo-2026)). Claims like "2 to 3x ranking" are **folklore** | Every caption opens with a search phrase: *"football manager game on iPhone"*, *"[Name] walkout"*, *"pack opening"*. The player's name is in the hook, so OCR sees it. |
| 5 | **3 to 5 hashtags.** The app caps posts at 5. | **Official app behaviour** since Aug 2025 ([Sked Social](https://skedsocial.com/blog/how-to-use-hashtags-on-tiktok-in-2026-maximize-your-tiktok-reach-and-engagement)) | 4 or 5 per post: one topic tag (player or format), one genre tag, and `#footballtiktok` or `#iphonegames`. No competitor or league marks. |
| 6 | **Posting more raises views per post.** Accounts posting 11+ times a week got +34% views per post versus once a week. The median post still gets about 500 views: volume buys lottery tickets, not a guarantee. | **Study**: Buffer, 11.4M posts ([Buffer](https://buffer.com/resources/how-often-should-you-post-on-tiktok/)) | 21 posts a week is inside the studied range. Space posts at least 4 hours apart (vendor advice against self-cannibalising). |
| 7 | **Sound-off viewing.** Captioned video holds longer, and a spoken hook is lost on muted viewers. | **Vendor** ([OpusClip](https://www.opus.pro/blog/tiktok-caption-subtitle-best-practices)) | All text is burned in (harness captions and POV walls). No format depends on audio. |
| 8 | **Business disclosure limits music.** A promotional post can only use the **Commercial Music Library**. The CML licence covers TikTok only, not YouTube or Instagram. | **Official** ([TikTok CML](https://ads.tiktok.com/help/article/commercial-music-library?lang=en)); TikTok-only scope per [Soundstripe](https://www.soundstripe.com/blogs/how-to-use-copyrighted-music-on-tiktok) | Trending non-CML sounds are off the table. On TikTok, use a CML track or the owned synth score (`postproduction/score-ad.py`). **Cross-posts to Shorts or Reels use only the owned score.** |
| 9 | **Reply to comments with video.** It turns comments into the next post, and the comment appears as a sticker. | **Official** feature ([TikTok Newsroom](https://newsroom.tiktok.com/en-us/product-tutorial-reply-to-comments-with-video)) | Build the XI and Transfer POV are designed to produce a comment worth answering. See §4. |
| 10 | **Best posting times disagree across studies.** Sprout: weekdays 14:00 to 18:00, UK Thursday 16:00 to 23:00, Saturday worst. Buffer: Sunday 09:00, Friday evening. | **Study**, two datasets that contradict each other ([Sprout](https://sproutsocial.com/insights/best-times-to-post-on-tiktok/), [Hello Partner, UK](https://hellopartner.com/2026/05/06/sprout-social-report-reveals-best-time-to-post-on-social-media-in-the-uk-in-2026/)) | Keep 12:00, 17:00 and 20:00 UK as the default. After 14 days, read TikTok Studio's follower-activity hours and move the weakest slot. |
| 11 | **Link in bio.** A Business account gets a clickable website link at any follower count. A personal or creator account needs 1,000 followers. | **Vendor**, consistent ([Linklay](https://linklay.io/blog/tiktok-link-in-bio-complete-guide-2026)) | See §3. |
| 12 | **Playlists** need 10K+ followers, so they are not available yet. | **Vendor** ([Kapwing](https://www.kapwing.com/resources/tiktok-playlists/)) | Use numbered series ("Transfer POV #3") and pinned videos until 10K. |
| 13 | **Folklore we ignore:** "disclosure kills reach", "delete and repost flops", "post at exactly X:00", "use 30 hashtags". | none found | Disclosure is mandatory for us anyway. |

**Football calendar, checked against official sources:**
- The international break runs Mon 21 Sep to Tue 6 Oct. The Premier League returns
  **Sat 10 Oct** ([Premier League](https://www.premierleague.com/en/news/4689113/when-are-the-international-breaks-for-202627)).
- October PL kick-offs are in the [PL amendments](https://www.premierleague.com/en/news/4688862/fixture-amendments-for-premier-league-matches-in-october-and-november).
  The dates that matter to us: Sat 10 Oct, Man Utd v Spurs at 17:30 UK. **Sun 11 Oct,
  Liverpool v Man City at 16:30 UK.** Sat 24 Oct, Chelsea v Spurs at 17:30 UK.
- Champions League MD2 is **Tue 13 / Wed 14 Oct** (Man City v PSG on Wed 14). MD3 is
  **Tue 20 / Wed 21 Oct** (PSG v Barcelona on Tue 20, Bayern v Arsenal on Wed 21).
  Most games kick off 21:00 CEST ([UEFA fixtures](https://www.uefa.com/uefachampionsleague/news/02a8-2174c9e9019d-f909a77bd77a-1000--2026-27-champions-league-all-the-league-phase-fixtures/)).
- **Ballon d'Or: Mon 26 Oct 2026, London Palladium, from 20:00 UK.** The 30 men's
  nominees include Bellingham, Dembélé, Luis Díaz, Gabriel, Haaland, Hakimi, Kane,
  Lautaro, Mbappé, Nuno Mendes, João Neves, Olise, Rice, Rodri, Saliba, Upamecano,
  Vinícius, Vitinha, Messi and Yamal ([Wikipedia](https://en.wikipedia.org/wiki/2026_Ballon_d'Or),
  [UEFA](https://www.uefa.com/ballondor/news/02a5-20bba5196317-e0e34001e13b-1000--2026-ballon-d-or-ceremony-date-and-host-city-announced/)).
  Messi and Yamal have **no portrait** in the game.

## 2. Rules for every post

1. **Content disclosure ON, "Your brand".** Sound: a CML track or the owned score only.
2. **Frame 1 carries the hook**, burned in. No logo and no menu in the first 2 seconds.
   The cover frame is the star's face (walkouts) or the POV text (POV posts).
3. **The first caption line is the search phrase.** End on a question. 3 to 5 hashtags.
4. **Pin a comment within 1 minute:** *"Free on iPhone. Search Dynasty Manager on the App Store 🏆"*
5. **Showcase language only** for pinned-hero walkouts: "walkout", "Legends card",
   "Legends version". Never "I pulled", "my pull", "packed", or "rate my pull".
   The **A02 exception** is covered in §8.
6. **Never post during a match the post is about.** On Champions League nights (13, 14,
   20 and 21 Oct) the 21:00 slot moves to **22:55 CEST (21:55 UK)**, after full time.
   On Sun 11 Oct the 18:00 slot moves to **19:45 CEST**, after Liverpool v City.
   Write reactive captions after the final whistle, and stay neutral if unsure.
7. Keep claims true and checkable against CLAUDE.md: 756 real clubs, 45 leagues,
   37 countries, 3 free packs a day (Daily, Bronze, Silver), the daily streak floor
   rising to 75+ on day 7, odds shown before purchase, no energy timers, Sunday
   League, Manager Career (jobs, contracts, sackings), and an in-game Ballon d'Or.
   Never "official" or "licensed", never "guaranteed [star]", never EA or FIFA or
   "TOTY", and no Premier League or Champions League marks in hashtags.

## 3. Profile (do once, 10 minutes)

1. **Switch to a Business account** if it is not one already. That unlocks the
   bio link with no follower minimum, and a promotional account only gets CML
   music anyway.
2. **Bio (80 characters or less):** `Football manager on iPhone ⚽ Real clubs · free packs daily · no energy timers`
3. **Link:** the App Store URL for id 6760918006, starting with `https://`. Once the
   packs Custom Product Page exists (PLAYBOOK §7 S3), link to that instead.
4. **Pin 3 videos** and review them weekly: the best star walkout, the best non-walkout
   format, and the best Hall of Legends post.
5. **Cross-post** the same file to YouTube Shorts and Instagram Reels, **with the owned
   score audio** (the CML licence does not cover those platforms).

## 4. Format mix, series and the comment loop

| Format | Share of slots | Purpose | Made by |
|---|---|---|---|
| **Star walkout** (pinned hero, Legends version, about 8.7 s) | about 45% (week 1: 12 of 21, then about 1 a day plus reactive) | Reach through name search and fandom | headless `icon` plan |
| **Transfer POV** text wall (`scene=transfer`) | about 10% | Comments ("accept or reject?"), management identity | headless `transfer` plan |
| **Build the XI** (pitch, part-filled pitch, squad grid) | about 12% | Comment-to-video loop, and "this is a management game" | headless `squad` / `grid` plan |
| **Hall of Legends** (invented legends, `legend=1`) | about 5% | The one claim nobody else can make. Rights-free (rung 0) | headless `pack` plan |
| **Feature showcases for new users**: Sunday League, Manager Career sackings, Road to Glory, daily free packs and streak, weekly pack skin and odds | about 20%, from week 3 | Retention story and objection handling | **OWNER RECORDS** (phone screen recording) |
| Re-cuts of the best performer | 2 slots | Double what works | edit |

**Series (numbered in the caption, and in the hook for new renders):**
- **Walkout of the Day**: 13:00 is the default star slot.
- **Transfer POV #N**: the same scene and a new meme line each time. A dilemma always ends on "accept or reject?"
- **Build the XI #N**: a part-filled XI asks "who goes in the last spot?". The next
  post is a **reply-with-video** to the best comment (for example Mon 5 Oct 18:00, answering Sat 3 Oct 13:00).
- **Hall of Legends #N**, **Road to Glory EP.N**, **Pack Luck Day N**, **Sunday League EP.N**.
- **Ballon d'Or Nominee Week** (21 to 26 Oct): nominee walkouts, then the winner's walkout within about an hour of the announcement.

**Comment loop (15 minutes a day, in the first hour after each post):**
1. Reply to every comment in the first 60 minutes, and ask a follow-up question.
2. Tag one comment a day as the next reply-with-video (Build the XI or Transfer POV),
   using TikTok's "Reply with video" so the comment sticker shows.
3. Star requests ("do Yamal next") go on the render list. If the player has no
   portrait (Messi, Yamal), say so honestly: "his card has no face in the game yet".
4. Never argue about odds. Answer with "every pack shows its odds before you buy".

## 5. Producing the headless posts

Dev server: `.claude/launch.json` config `dev` (port 8090). Every capture URL below
is a query string for `http://127.0.0.1:8090/capture.html?...`.

```bash
# Template used for the 16 existing star renders (scratchpad/stars/run.sh):
node marketing/postproduction/capture-ad.mjs <dir> "http://127.0.0.1:8090/capture.html?<query>" 6 <plan>
node <scratchpad>/enc.mjs <dir> <out>.mp4 0.3 <min(13.6, last frame time)>   # Windows h264_mf encode
# re-encode to the -tt.mp4 upload file exactly as run.sh does
```

- **icon** plan: one card, auto-walkout. `hero=` is a case-insensitive substring of
  "First Last", and the harness re-rolls up to 20,000 times. Use unambiguous
  substrings: `rodri rodri`, `alexis mac allister`, `moisés caicedo`,
  `alisson becker`, `keres` (Gyökeres), `degaard` (Ødegaard), `magalh` (Gabriel).
  All heroes chosen here have base OVR 85 or higher and a portrait, which was checked
  in `nationalPlayerPool.ts` and `playerPortraits.ts`.
- **transfer** plan: holds about 11 s. **The striker is not pinnable.** The scene picks
  a real ST rated 89 to 91 aged 28 or under (in practice Mbappé or Haaland), and the
  buyer is always "Real Madrid" at £150M. So the POV text says "your striker" and
  never names him.
- **squad** plan: pitch view. `fill=N` fills the XI in 4-3-3 slot order (GK, LB,
  CB, CB, RB, CM, CM, CM, LW, ST, RW), so `fill=10` leaves **RW** empty and `fill=9`
  leaves **ST and RW**. The XI is chosen from the top of the pool, not by name.
  Check the contact sheet before captioning any named player.
- **grid** plan: squad grid with pack frames, slow scroll (about 7 s).
- **pack** plan with `legend=1`: invented Hall of Legends hero. Encode 0.3 to 13.6 s.
- `still` and `tall` plans produce PNGs that `encode-ad.mjs` cannot animate. They
  are not used here.

Not headless-producible (these are **OWNER RECORDS**): the daily free pack and streak,
weekly pack skins, Sunday League, Manager Career, Road to Glory, the in-game Ballon
d'Or, and the odds sheet.

## 6. The 90 slots

Times are CEST, with UK in brackets. `already rendered` means the MP4 exists in
`scratchpad/stars/` or as A01 to A05. Keys ending `-bdo` are new takes of a star
already posted, with a Ballon d'Or hook, because a new hook and new caption are the
"creative edit" the For You eligibility rules ask for.

### Week 1: Sun 27 Sep to Sat 3 Oct (all headless, see week1-production.json)

| Date | CEST (UK) | Format · series | Key | On-screen hook | Caption + hashtags | Capture (query string · plan) |
|---|---|---|---|---|---|---|
| Sun 27 Sep | 13:55 (12:55) | Star walkout (owner-scheduled) · Walkout of the Day | `mbappe` | MBAPPÉ WALKOUT | Mbappé's Legends card walkout in a free football manager game on iPhone. Showcase, not a pull. Who should walk out next? #footballgame #packopening #mbappe #footballtiktok #iphonegames | already rendered |
| Sun 27 Sep | 18:00 (17:00) | Star walkout (owner-scheduled, 18:xx) · Walkout of the Day | `haaland` | HAALAND WALKOUT | Haaland's walkout in Dynasty Manager, a free football manager game with real players. Keep him or build around someone else? #footballgame #packopening #haaland #footballtiktok #iphonegames | already rendered |
| Sun 27 Sep | 21:00 (20:00) | Star walkout (owner-scheduled, 21:xx) · Walkout of the Day | `salah` | SALAH WALKOUT | Salah's Legends card walkout. Real players, real faces, free on iPhone. Rate the animation 1-10 #footballgame #packopening #salah #footballtiktok #iphonegames | already rendered |
| Mon 28 Sep | 13:00 (12:00) | Transfer POV · Transfer POV #1 | `tpov-150m` | POV: Real Madrid just bid £150M / for your striker / It's week 8 and you're 3rd | Football manager game, week 8, £150M on the table. Accept or reject? Be honest #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20Real%20Madrid%20just%20bid%20%C2%A3150M%7Cfor%20your%20striker%7CIt's%20week%208%20and%20you're%203rd&povPos=low&kenburns=1` · **transfer** |
| Mon 28 Sep | 18:00 (17:00) | Squad XI · Build the XI #1 | `xi-full-1` | Every card in this XI came out of a pack / Then you have to win the league with them | Pack cards are only half of it. You pick the XI, the tactics and play the season. Who's the weak link? #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=11&pov=Every%20card%20in%20this%20XI%20came%20out%20of%20a%20pack%7CThen%20you%20have%20to%20win%20the%20league%20with%20them&povPos=top` · **squad** |
| Mon 28 Sep | 21:00 (20:00) | Star walkout · Walkout of the Day | `bellingham` | BELLINGHAM WALKOUT | Bellingham walkout in a football manager game on iPhone. Where does he play in your XI? #footballgame #packopening #bellingham #footballtiktok #iphonegames | already rendered |
| Tue 29 Sep | 13:00 (12:00) | Star walkout · Walkout of the Day | `vinicius` | VINI JR WALKOUT | Vini Jr's walkout. 756 real clubs, 45 leagues, free on iPhone. Left wing or striker? #footballgame #packopening #vinijr #footballtiktok #iphonegames | already rendered |
| Tue 29 Sep | 18:00 (17:00) | Legends walkout · Real faces | `a03` | REAL PLAYERS. REAL FACES. | Every player in this football manager game has a real face. Which league do you manage in? #footballgame #packopening #emimartinez #footballtiktok #iphonegames | already rendered |
| Tue 29 Sep | 21:00 (20:00) | Star walkout · Walkout of the Day | `kane` | HARRY KANE WALKOUT | Harry Kane's walkout in Dynasty Manager. Is he still a top 3 striker? #footballgame #packopening #harrykane #footballtiktok #iphonegames | already rendered |
| Wed 30 Sep | 13:00 (12:00) | Star walkout · Walkout of the Day | `saka` | SAKA WALKOUT | Saka's walkout in a free football manager game on iPhone. Best winger in the league? #footballgame #packopening #saka #footballtiktok #iphonegames | already rendered |
| Wed 30 Sep | 18:00 (17:00) | Hall of Legends · Hall of Legends #1 | `legend-1` | WHAT HAPPENS WHEN A LEGEND RETIRES | In this football manager game your legends don't retire. They come back as cards in the Hall of Legends. Keep or sell? #footballgame #packopening #legends #iphonegames | `tier=rare&legend=1&hook=WHAT%20HAPPENS%20WHEN%20A%20LEGEND%20RETIRES&mid=HE%20COMES%20BACK%20AS%20A%20CARD&midPos=mid&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **pack** |
| Wed 30 Sep | 21:20 (20:20) | Pack reveal (scheduled) · — | `a02` | RATE MY PULL (as scheduled by owner) | (Owner-scheduled A02, keep as is.) #footballgame #packopening #packopening #footballtiktok #iphonegames | already rendered |
| Thu 1 Oct | 13:00 (12:00) | Transfer POV · Transfer POV #2 | `tpov-reject` | POV: you rejected £150M / because he's the only reason / your club isn't getting relegated | Would you reject £150M to stay up? Football manager game on iPhone #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20you%20rejected%20%C2%A3150M%7Cbecause%20he's%20the%20only%20reason%7Cyour%20club%20isn't%20getting%20relegated&povPos=low&kenburns=1` · **transfer** |
| Thu 1 Oct | 18:00 (17:00) | Star walkout · Walkout of the Day | `wirtz` | WIRTZ WALKOUT | Wirtz walkout in Dynasty Manager. Most underrated player in world football? #footballgame #packopening #wirtz #footballtiktok #iphonegames | already rendered |
| Thu 1 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `musiala` | MUSIALA WALKOUT | Musiala's walkout. Real players, free packs every day, no energy timers. Musiala or Wirtz? #footballgame #packopening #musiala #footballtiktok #iphonegames | already rendered |
| Fri 2 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `pedri` | PEDRI WALKOUT | Pedri walkout in a free football manager game on iPhone. Best midfielder right now? #footballgame #packopening #pedri #footballtiktok #iphonegames | already rendered |
| Fri 2 Oct | 18:00 (17:00) | Squad grid · Build the XI #2 | `grid-frames-1` | Every pack gives its cards their own frame / Which one is the cleanest? | Cards pulled from a pack keep that pack's frame forever. Which frame wins? #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=grid&pov=Every%20pack%20gives%20its%20cards%20their%20own%20frame%7CWhich%20one%20is%20the%20cleanest%3F&povPos=top` · **grid** |
| Fri 2 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `dembele` | DEMBÉLÉ WALKOUT | The 2025 Ballon d'Or winner walks out. Does he win it again this October? #footballgame #packopening #dembele #footballtiktok #iphonegames | already rendered |
| Sat 3 Oct | 13:00 (12:00) | Squad XI (part-filled) · Build the XI #3 | `xi-fill10-1` | 10 in. 1 spot left. / Who plays right wing? | One spot left in the XI. Comment a name and I'll reply with the full team #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=10&pov=10%20in.%201%20spot%20left.%7CWho%20plays%20right%20wing%3F&povPos=top` · **squad** |
| Sat 3 Oct | 18:00 (17:00) | Star walkout · Walkout of the Day | `gyokeres` | GYÖKERES WALKOUT | Gyökeres' Legends card walkout. Real players, real faces, free on iPhone. Too high or fair? #footballgame #packopening #gyokeres #footballtiktok #iphonegames | `tier=icon&hero=keres&hook=GY%C3%96KERES%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 3 Oct | 21:25 (20:25) | Pack reveal (scheduled) · — | `a04` | NO ENERGY. NO TIMERS. | Football manager game with no energy and no timers. Play as long as you want. What's the worst energy system you've played? #footballgame #managergame #iphonegames #footballtiktok | already rendered |

### Week 2: Sun 4 Oct to Sat 10 Oct (headless; international break ends Tue 6 Oct, PL back Sat 10 Oct)

| Date | CEST (UK) | Format · series | Key | On-screen hook | Caption + hashtags | Capture (query string · plan) |
|---|---|---|---|---|---|---|
| Sun 4 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `debruyne` | DE BRUYNE WALKOUT | De Bruyne walkout in a free football manager game. Best passer of his generation? #footballgame #packopening #debruyne #footballtiktok #iphonegames | already rendered |
| Sun 4 Oct | 18:00 (17:00) | Transfer POV · Transfer POV #3 | `tpov-board` | POV: the board says sell / the fans say keep / and Real Madrid wants an answer | Board or fans? Who do you listen to in your save? #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20the%20board%20says%20sell%7Cthe%20fans%20say%20keep%7Cand%20Real%20Madrid%20wants%20an%20answer&povPos=low&kenburns=1` · **transfer** |
| Sun 4 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `isak` | ISAK WALKOUT | Isak's Legends card walkout in Dynasty Manager. Top 5 striker in the world? #footballgame #packopening #isak #footballtiktok #iphonegames | `tier=icon&hero=alexander%20isak&hook=ISAK%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Mon 5 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `vandijk` | VAN DIJK WALKOUT | Van Dijk's walkout. Does a centre-back deserve a walkout this good? #footballgame #packopening #vandijk #footballtiktok #iphonegames | already rendered |
| Mon 5 Oct | 18:00 (17:00) | Reply-with-video · Build the XI #3 (answer) | `xi-full-reply` | You picked the right winger. / Here's the full XI | Replying to the top comment from Saturday. Full XI, now rate it 1-10 #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=11&pov=You%20picked%20the%20right%20winger.%7CHere's%20the%20full%20XI&povPos=top` · **squad** |
| Mon 5 Oct | 21:45 (20:45) | Pack reveal (scheduled) · — | `a05` | NAME A BETTER PACK ANIMATION | Name a better pack animation. I'll wait. Free on iPhone #footballgame #packopening #walkout #footballtiktok #iphonegames | already rendered |
| Tue 6 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `lewandowski` | LEWANDOWSKI WALKOUT | Lewandowski's walkout. Still elite at his age? #footballgame #packopening #lewandowski #footballtiktok #iphonegames | already rendered |
| Tue 6 Oct | 18:00 (17:00) | Hall of Legends · Hall of Legends #2 | `legend-2` | HE RETIRED IN MY SAVE | Retired players in this football manager game come back in the Hall of Legends. Who retires first in your save? #footballgame #packopening #legends #iphonegames | `tier=rare&legend=1&hook=HE%20RETIRED%20IN%20MY%20SAVE&mid=NOW%20HE'S%20BACK%20AS%20A%20CARD&midPos=mid&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **pack** |
| Tue 6 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `raphinha` | RAPHINHA WALKOUT | Raphinha's walkout in Dynasty Manager. Underrated or overrated? #footballgame #packopening #raphinha #footballtiktok #iphonegames | already rendered |
| Wed 7 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `palmer` | COLE PALMER WALKOUT | Cole Palmer's Legends card walkout. Cold enough? #footballgame #packopening #colepalmer #footballtiktok #iphonegames | `tier=icon&hero=cole%20palmer&hook=COLE%20PALMER%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Wed 7 Oct | 18:00 (17:00) | Transfer POV · Transfer POV #4 | `tpov-4thtier` | POV: you took a 4th-tier club / to the top flight / and now Real Madrid want your striker | From League Two to this. Every club in England's top 4 tiers is in the game. Sell? #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20you%20took%20a%204th-tier%20club%7Cto%20the%20top%20flight%7Cand%20now%20Real%20Madrid%20want%20your%20striker&povPos=low&kenburns=1` · **transfer** |
| Wed 7 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `rice` | DECLAN RICE WALKOUT | Declan Rice's walkout in a free football manager game. Best midfielder in the Premier League? #footballgame #packopening #declanrice #footballtiktok #iphonegames | `tier=icon&hero=declan%20rice&hook=DECLAN%20RICE%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Thu 8 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `saliba` | SALIBA WALKOUT | Saliba's walkout. Best centre-back in the world right now? #footballgame #packopening #saliba #footballtiktok #iphonegames | `tier=icon&hero=william%20saliba&hook=SALIBA%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Thu 8 Oct | 18:00 (17:00) | Squad grid · Build the XI #4 | `grid-frames-2` | Real players. Real faces. / Every card in this squad came from a pack | Scroll the squad. Who's the first name on your team sheet? #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=grid&pov=Real%20players.%20Real%20faces.%7CEvery%20card%20in%20this%20squad%20came%20from%20a%20pack&povPos=top` · **grid** |
| Thu 8 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `hakimi` | HAKIMI WALKOUT | Hakimi walkout in Dynasty Manager. Best right-back in the world? #footballgame #packopening #hakimi #footballtiktok #iphonegames | `tier=icon&hero=hakimi&hook=HAKIMI%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Fri 9 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `olise` | OLISE WALKOUT | Olise's Legends card walkout. The most underrated winger in Europe? #footballgame #packopening #olise #footballtiktok #iphonegames | `tier=icon&hero=olise&hook=OLISE%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Fri 9 Oct | 18:00 (17:00) | Transfer POV · Transfer POV #5 | `tpov-rival` | POV: your biggest rival / just bid £150M for the player / you built the whole save around | Would you sell to your rival? Football manager game on iPhone #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20your%20biggest%20rival%7Cjust%20bid%20%C2%A3150M%20for%20the%20player%7Cyou%20built%20the%20whole%20save%20around&povPos=low&kenburns=1` · **transfer** |
| Fri 9 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `vitinha` | VITINHA WALKOUT | Vitinha's walkout. Best midfielder in Europe last season? #footballgame #packopening #vitinha #footballtiktok #iphonegames | `tier=icon&hero=vitinha&hook=VITINHA%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 10 Oct | 13:00 (12:00) | Star walkout (matchday) · Walkout of the Day | `gabriel` | GABRIEL WALKOUT | Premier League is back today. Gabriel Magalhães walkout. Arsenal fans, rate it #footballgame #packopening #gabriel #footballtiktok #iphonegames | `tier=icon&hero=magalh&hook=GABRIEL%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 10 Oct | 18:00 (17:00) | Squad XI (part-filled) · Build the XI #5 | `xi-fill6` | Premier League is back. / Half an XI. Finish it | Six in. Five spots left. Comment who you'd sign #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=6&pov=Premier%20League%20is%20back.%7CHalf%20an%20XI.%20Finish%20it&povPos=top` · **squad** |
| Sat 10 Oct | 21:00 (20:00) | Star walkout (faceless) · Walkout of the Day | `messi` | MESSI WALKOUT | Messi's card is the only one here without a face in the game yet. Should he get one? #footballgame #packopening #messi #footballtiktok #iphonegames | already rendered |

### Week 3: Sun 11 Oct to Sat 17 Oct (owner-recorded formats start; UCL MD2 Tue 13 / Wed 14)

| Date | CEST (UK) | Format · series | Key | On-screen hook | Caption + hashtags | Capture (query string · plan) |
|---|---|---|---|---|---|---|
| Sun 11 Oct | 13:00 (12:00) | Star walkout (matchday) · Walkout of the Day | `rodri` | RODRI WALKOUT | Liverpool v City today. Rodri's walkout first. Who wins? #footballgame #packopening #rodri #footballtiktok #iphonegames | `tier=icon&hero=rodri%20rodri&hook=RODRI%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sun 11 Oct | 19:45 (18:45) | REACTIVE walkout (moved from 18:00: LIV v MCI 16:30 UK) · Matchday reactive | `foden` | FODEN WALKOUT | [Write after full time: result + one line.] Foden walkout. Free football manager game on iPhone #footballgame #packopening #foden #footballtiktok #iphonegames | `tier=icon&hero=foden&hook=FODEN%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sun 11 Oct | 21:00 (20:00) | OWNER RECORDS: daily free pack · Pack Luck Week D1 | `own-packluck-d1` | PACK LUCK · DAY 1 | Free pack every day in this football manager game and the floor rises with your streak. Guess the best OVR 👇 #footballgame #packopening #packluck #footballtiktok #iphonegames | **OWNER RECORDS** |
| Mon 12 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `kimmich` | KIMMICH WALKOUT | Kimmich's walkout. Right-back or midfield? #footballgame #packopening #kimmich #footballtiktok #iphonegames | `tier=icon&hero=kimmich&hook=KIMMICH%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Mon 12 Oct | 18:00 (17:00) | OWNER RECORDS: weekly pack skin · This week's pack | `own-skin-w1` | THIS WEEK'S PACK HAS A NEW NAME | New week, new featured pack, same price with a bonus card. Odds are shown before you buy #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Mon 12 Oct | 21:00 (20:00) | Hall of Legends · Hall of Legends #3 | `legend-3` | YOUR LEGENDS NEVER RETIRE | Legends in this football manager game never really retire. Who would you bring back? #footballgame #packopening #legends #iphonegames | `tier=rare&legend=1&hook=YOUR%20LEGENDS%20NEVER%20RETIRE&mid=THEY%20COME%20BACK%20AS%20CARDS&midPos=mid&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **pack** |
| Tue 13 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `courtois` | COURTOIS WALKOUT | Courtois' walkout. Best goalkeeper of the decade? #footballgame #packopening #courtois #footballtiktok #iphonegames | `tier=icon&hero=courtois&hook=COURTOIS%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Tue 13 Oct | 18:00 (17:00) | OWNER RECORDS: Road to Glory · Road to Glory EP1 | `own-rtg-1` | ROAD TO GLORY EP.1: 4TH TIER. NO MONEY. | Road to Glory, episode 1. A fourth-tier English club, no budget. Which club should it be? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Tue 13 Oct | 22:55 (21:55) | REACTIVE walkout (moved: UCL 21:00 CEST) · Matchday reactive | `odegaard` | ØDEGAARD WALKOUT | [Write after full time: Arsenal v Lille result.] Ødegaard walkout #footballgame #packopening #odegaard #footballtiktok #iphonegames | `tier=icon&hero=degaard&hook=%C3%98DEGAARD%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Wed 14 Oct | 13:00 (12:00) | Transfer POV · Transfer POV #6 | `tpov-deadline` | POV: in-game deadline day / £150M on the table / and no striker to replace him | Deadline day in your save. Sell and panic-buy, or keep him? #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20in-game%20deadline%20day%7C%C2%A3150M%20on%20the%20table%7Cand%20no%20striker%20to%20replace%20him&povPos=low&kenburns=1` · **transfer** |
| Wed 14 Oct | 18:00 (17:00) | Star walkout · Walkout of the Day | `valverde` | VALVERDE WALKOUT | Valverde's walkout. Most complete midfielder in the world? #footballgame #packopening #valverde #footballtiktok #iphonegames | `tier=icon&hero=valverde&hook=VALVERDE%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Wed 14 Oct | 22:55 (21:55) | REACTIVE walkout (moved: City v PSG) · Matchday reactive | `nunomendes` | NUNO MENDES WALKOUT | [Write after full time: City v PSG result.] Nuno Mendes walkout #footballgame #packopening #nunomendes #footballtiktok #iphonegames | `tier=icon&hero=nuno%20mendes&hook=NUNO%20MENDES%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Thu 15 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `lautaro` | LAUTARO WALKOUT | Lautaro Martínez walkout. Most underrated striker in Europe? #footballgame #packopening #lautaro #footballtiktok #iphonegames | `tier=icon&hero=lautaro&hook=LAUTARO%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Thu 15 Oct | 18:00 (17:00) | OWNER RECORDS: Manager Career · Sacked | `own-sacked-1` | I GOT SACKED AFTER 7 GAMES | Manager Career mode: interview for jobs, get a contract, get sacked. How long would you last? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Thu 15 Oct | 21:00 (20:00) | Squad grid · Build the XI #6 | `grid-frames-3` | 3 free packs a day. / No energy. No timers. / This is the squad. | Three free packs a day and no energy timers. Who's in your XI? #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=grid&pov=3%20free%20packs%20a%20day.%7CNo%20energy.%20No%20timers.%7CThis%20is%20the%20squad.&povPos=top` · **grid** |
| Fri 16 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `caicedo` | CAICEDO WALKOUT | Caicedo's walkout. Best defensive midfielder in the league? #footballgame #packopening #caicedo #footballtiktok #iphonegames | `tier=icon&hero=mois%C3%A9s%20caicedo&hook=CAICEDO%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Fri 16 Oct | 18:00 (17:00) | OWNER RECORDS: Road to Glory · Road to Glory EP2 | `own-rtg-2` | EP.2: FIRST TRANSFER WINDOW ON £0 | Road to Glory, episode 2. No money: loan or free agent? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Fri 16 Oct | 21:00 (20:00) | Star walkout · Walkout of the Day | `macallister` | MAC ALLISTER WALKOUT | Mac Allister's walkout. World champion and still underrated? #footballgame #packopening #macallister #footballtiktok #iphonegames | `tier=icon&hero=alexis%20mac%20allister&hook=MAC%20ALLISTER%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 17 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `alisson` | ALISSON WALKOUT | Alisson's walkout. Best keeper in the Premier League? #footballgame #packopening #alisson #footballtiktok #iphonegames | `tier=icon&hero=alisson%20becker&hook=ALISSON%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 17 Oct | 18:00 (17:00) | OWNER RECORDS: daily free pack · Pack Luck Week D7 | `own-packluck-d7` | DAY 7 · 75+ GUARANTEED | Seven days of free packs. Day 7 is 75+ guaranteed. Did the streak pay off? #footballgame #packopening #packluck #footballtiktok #iphonegames | **OWNER RECORDS** |
| Sat 17 Oct | 21:00 (20:00) | Squad XI · Build the XI #7 | `xi-full-2` | Rate this XI out of 10 / Be honest | Real players, your tactics, your season. Rate the XI 1-10 #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=11&pov=Rate%20this%20XI%20out%20of%2010%7CBe%20honest&povPos=top` · **squad** |

### Week 4 + Ballon d'Or: Sun 18 Oct to Mon 26 Oct (UCL MD3 Tue 20 / Wed 21; Ballon d'Or Mon 26)

| Date | CEST (UK) | Format · series | Key | On-screen hook | Caption + hashtags | Capture (query string · plan) |
|---|---|---|---|---|---|---|
| Sun 18 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `donnarumma` | DONNARUMMA WALKOUT | Donnarumma's walkout. Top 3 goalkeeper? #footballgame #packopening #donnarumma #footballtiktok #iphonegames | `tier=icon&hero=donnarumma&hook=DONNARUMMA%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sun 18 Oct | 18:00 (17:00) | OWNER RECORDS: Sunday League · Sunday League EP1 | `own-sunday-1` | SUNDAY LEAGUE: 9 PLAYERS TURNED UP | Sunday League mode: run a park team, nine players turned up, kit money is gone. Who's this in your team? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Sun 18 Oct | 21:00 (20:00) | Hall of Legends · Hall of Legends #4 | `legend-4` | A GREAT RETIRED IN MY SAVE | Retired, then back in the squad as a Hall of Legends card. Keep him or quick-sell? #footballgame #packopening #legends #iphonegames | `tier=rare&legend=1&hook=A%20GREAT%20RETIRED%20IN%20MY%20SAVE&mid=NOW%20HE'S%20BACK%20IN%20MY%20SQUAD&midPos=mid&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **pack** |
| Mon 19 Oct | 13:00 (12:00) | Best-performer re-cut · Re-cut | `recut-1` | [top post of weeks 1-3, new hook] | [Re-cut of the best-performing post: new hook, new caption, same keyword line.] #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Mon 19 Oct | 18:00 (17:00) | OWNER RECORDS: weekly pack skin · This week's pack | `own-skin-w2` | THIS WEEK'S PACK HAS A NEW NAME | New featured pack this week. Every pack shows its odds before you buy. Which skin is best? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Mon 19 Oct | 21:00 (20:00) | Reply-with-video (Transfer POV) · Transfer POV #7 | `tpov-reply` | [paste the best comment from a Transfer POV post] / Say less. | Replying to your comment. This is what the game made me do #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=%5Bpaste%20the%20best%20comment%20from%20a%20Transfer%20POV%20post%5D%7CSay%20less.&povPos=low&kenburns=1` · **transfer** |
| Tue 20 Oct | 13:00 (12:00) | Star walkout · Walkout of the Day | `doue` | DOUÉ WALKOUT | Désiré Doué's walkout. Best young player in France? #footballgame #packopening #doue #footballtiktok #iphonegames | `tier=icon&hero=d%C3%A9sir%C3%A9%20dou%C3%A9&hook=DOU%C3%89%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Tue 20 Oct | 18:00 (17:00) | OWNER RECORDS: Road to Glory · Road to Glory EP3 | `own-rtg-3` | EP.3: TOP OF THE TABLE? | Road to Glory, episode 3. Predict where we finish #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Tue 20 Oct | 22:55 (21:55) | REACTIVE walkout (moved: PSG v Barcelona) · Matchday reactive | `joaoneves` | JOÃO NEVES WALKOUT | [Write after full time: PSG v Barcelona result.] João Neves walkout #footballgame #packopening #joaoneves #footballtiktok #iphonegames | `tier=icon&hero=jo%C3%A3o%20neves&hook=JO%C3%83O%20NEVES%20WALKOUT&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Wed 21 Oct | 13:00 (12:00) | OWNER RECORDS: Sunday League · Sunday League EP2 | `own-sunday-2` | SUNDAY LEAGUE: THE KIT MONEY'S GONE | Sunday League mode, pound-scale finances. Funniest excuse for missing a game? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Wed 21 Oct | 18:00 (17:00) | Star walkout (Ballon d'Or nominee) · Nominee Week | `luisdiaz` | BALLON D'OR NOMINEE: LUIS DÍAZ | One of the 30 Ballon d'Or nominees. Luis Díaz walkout. Top 10 finish? #ballondor #luisdiaz #footballgame #packopening | `tier=icon&hero=luis%20d%C3%ADaz&hook=BALLON%20D'OR%20NOMINEE%3A%20LUIS%20D%C3%8DAZ&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Wed 21 Oct | 22:55 (21:55) | REACTIVE walkout (moved: Bayern v Arsenal) · Matchday reactive | `upamecano` | BALLON D'OR NOMINEE: UPAMECANO | [Write after full time: Bayern v Arsenal result.] Upamecano, Ballon d'Or nominee #ballondor #upamecano #footballgame #packopening | `tier=icon&hero=upamecano&hook=BALLON%20D'OR%20NOMINEE%3A%20UPAMECANO&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Thu 22 Oct | 13:00 (12:00) | Transfer POV · Transfer POV #8 | `tpov-bdo` | POV: Real Madrid bid £150M / the week of the Ballon d'Or / and your striker is nominated | Would you cash in before the ceremony? #transfernews #footballgame #managergame #footballtiktok | `scene=transfer&pov=POV%3A%20Real%20Madrid%20bid%20%C2%A3150M%7Cthe%20week%20of%20the%20Ballon%20d'Or%7Cand%20your%20striker%20is%20nominated&povPos=low&kenburns=1` · **transfer** |
| Thu 22 Oct | 18:00 (17:00) | OWNER RECORDS: Road to Glory · Road to Glory EP4 | `own-rtg-4` | EP.4: DERBY DAY | Road to Glory, episode 4. Derbies carry match intensity in this game. Worst derby loss you've had? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Thu 22 Oct | 21:00 (20:00) | Star walkout (Ballon d'Or) · Nominee Week | `dembele-bdo` | LAST YEAR'S BALLON D'OR WINNER | Ousmane Dembélé won it in 2025. Is he on the list again Monday? #ballondor #dembele #footballgame #packopening | `tier=icon&hero=demb%C3%A9l&hook=LAST%20YEAR'S%20BALLON%20D'OR%20WINNER&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Fri 23 Oct | 13:00 (12:00) | Squad XI (part-filled) · Build the XI #8 | `xi-fill9` | 9 in. 2 spots left. / Only Ballon d'Or nominees allowed | Two spots left, nominees only. Who gets in? #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=9&pov=9%20in.%202%20spots%20left.%7COnly%20Ballon%20d'Or%20nominees%20allowed&povPos=top` · **squad** |
| Fri 23 Oct | 18:00 (17:00) | OWNER RECORDS: in-game Ballon d'Or · Ballon d'Or | `own-bdo-save` | WHO WINS THE BALLON D'OR IN MY SAVE? | The game runs its own Ballon d'Or ceremony every season. Guess before the end #ballondor #managergame #footballgame #packopening | **OWNER RECORDS** |
| Fri 23 Oct | 21:00 (20:00) | Star walkout (Ballon d'Or nominee) · Nominee Week | `mbappe-bdo` | BALLON D'OR NOMINEE: MBAPPÉ | Mbappé is on the 30-man list. Does he win it Monday? #ballondor #mbappe #footballgame #packopening | `tier=icon&hero=mbapp&hook=BALLON%20D'OR%20NOMINEE%3A%20MBAPP%C3%89&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 24 Oct | 13:00 (12:00) | OWNER RECORDS: Sunday League · Sunday League EP3 | `own-sunday-3` | SUNDAY LEAGUE: PROMOTION DECIDER | Promotion decider in Sunday League mode. Would you play the injured striker? #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Sat 24 Oct | 18:00 (17:00) | Star walkout (Ballon d'Or nominee) · Nominee Week | `haaland-bdo` | BALLON D'OR NOMINEE: HAALAND | Haaland is nominated again. Is this his year? #ballondor #haaland #footballgame #packopening | `tier=icon&hero=haaland&hook=BALLON%20D'OR%20NOMINEE%3A%20HAALAND&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sat 24 Oct | 21:00 (20:00) | Star walkout (Ballon d'Or nominee) · Nominee Week | `rice-bdo` | BALLON D'OR NOMINEE: DECLAN RICE | Declan Rice made the 30. Top 10? #ballondor #declanrice #footballgame #packopening | `tier=icon&hero=declan%20rice&hook=BALLON%20D'OR%20NOMINEE%3A%20DECLAN%20RICE&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sun 25 Oct | 13:00 (12:00) | Best-performer re-cut · Re-cut | `recut-2` | [top post of week 4, new hook] | [Re-cut of the best-performing post of the last 7 days.] #footballgame #managergame #iphonegames #footballtiktok | **OWNER RECORDS** |
| Sun 25 Oct | 18:00 (17:00) | Star walkout (Ballon d'Or nominee) · Nominee Week | `bellingham-bdo` | BALLON D'OR NOMINEE: BELLINGHAM | Bellingham is on the list. Where does he finish tomorrow? #ballondor #bellingham #footballgame #packopening | `tier=icon&hero=bellingham&hook=BALLON%20D'OR%20NOMINEE%3A%20BELLINGHAM&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Sun 25 Oct | 21:00 (20:00) | Star walkout (Ballon d'Or nominee) · Nominee Week | `vinicius-bdo` | BALLON D'OR NOMINEE: VINI JR | Vini Jr is nominated. Robbed last time or fair? #ballondor #vinijr #footballgame #packopening | `tier=icon&hero=vin%C3%ADcius&hook=BALLON%20D'OR%20NOMINEE%3A%20VINI%20JR&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Mon 26 Oct | 13:00 (12:00) | Star walkout (Ballon d'Or day) · Nominee Week | `kane-bdo` | BALLON D'OR TONIGHT: WHO WINS? | Ballon d'Or is tonight in London. Kane, Mbappé, Haaland, Dembélé... drop your winner 👇 #ballondor #harrykane #footballgame #packopening | `tier=icon&hero=harry%20kane&hook=BALLON%20D'OR%20TONIGHT%3A%20WHO%20WINS%3F&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |
| Mon 26 Oct | 18:00 (17:00) | Squad XI · Ballon d'Or | `xi-bdo` | Ballon d'Or is tonight. / Who wins it? Wrong answers only | Drop your Ballon d'Or winner before 8pm UK. Real answers or wrong answers only #footballgame #managergame #dreamteam #footballtiktok | `scene=squad&view=pitch&fill=11&pov=Ballon%20d'Or%20is%20tonight.%7CWho%20wins%20it%3F%20Wrong%20answers%20only&povPos=top` · **squad** |
| Mon 26 Oct | 23:30 (22:30) | REACTIVE: Ballon d'Or winner (moved from 21:00; ceremony starts 20:00 UK) · Ballon d'Or | `bdo-winner` | THE 2026 BALLON D'OR WINNER | [Post only after the announcement.] The 2026 Ballon d'Or winner's walkout. Deserved? #ballondor #<winner> #footballgame #packopening | `tier=icon&hero=%3CWINNER%3E&hook=THE%202026%20BALLON%20D'OR%20WINNER&mid=FREE%20MANAGER%20GAME%20ON%20IPHONE&midPos=mid&hookUntil=1.8&midFrom=4.5&midUntil=6.5&ctaFrom=7&cta=DYNASTY%20MANAGER%20%C2%B7%20FREE%20ON%20IOS` · **icon** |

**Ballon d'Or night (Mon 26 Oct) runbook:**
1. On Sun 25, pre-render `bdo-winner` for every realistic winner (Mbappé, Haaland,
   Bellingham, Dembélé, Kane, Vinícius, Rice, Olise, Vitinha, Hakimi, Rodri,
   Saliba). Use the same URL with `hero=` swapped. The hook "THE 2026 BALLON D'OR
   WINNER" is generic, so it is only true once posted after the announcement.
2. Post within about 30 minutes of the announcement (about 22:00 to 22:30 UK; the
   slot is 23:30 CET at the latest).
3. If **Messi or Yamal** wins (no portrait), post the in-game ceremony clip instead
   (OWNER RECORDS, captured on Fri 23 for this purpose), with the caption
   "[Name] wins. In my save it was ___".

## 7. Weekly review: Monday, 15 minutes, before the 13:00 post

Record per post in a sheet: views, **average watch %** and **full-video watch %**,
**3-second hold** (TikTok Studio, "Retention"), shares, saves, comments, profile
views, follows, and App Store Connect installs that day plus the next day.

| Rule | Trigger | Action |
|---|---|---|
| **Kill** a format | 3 posts in a row under 15% 3-second hold, or under 25% average watch | Drop it for 2 weeks. Put its slots into the best format. |
| **Kill** a hook style | 5 posts under the account median views | Rewrite the hook pattern (for example "X WALKOUT" becomes a question or a claim) |
| **Double** a format | Share rate at least 2x the account median, or a post over 5x median views | Next week it gets one extra slot a day, and it becomes the re-cut on Mon 19 / Sun 25 |
| **Double** a star | A walkout at 3x or more the walkout median | Same star, different format, within 48 h (for example a Transfer POV or XI featuring him) |
| **Repetition check** | Two walkouts back to back both under 50% of the walkout median | Cap walkouts at 1 a day from then on (suspected repetition throttle, §1 #3) |
| **Time check** (day 14) | TikTok Studio follower-activity hours | Move the weakest slot toward the peak hour |
| **Install check** | ASC installs flat for 7 days despite growing views | The bio link or pinned comment is not converting. Test a new pinned-comment line and bio. |

After 30 days: the top two formats become the Spark Ad candidates (PLAYBOOK §9,
once its gates pass). Paid still stays at rung 3/4 rules. No named star goes in a paid ad.

## 8. Open risks (owner decides)

- **A02 "Rate my pull" (Wed 30 Sep 21:20) conflicts with PLAYBOOK §4 limit 1.** It
  is a re-rolled capture (`minHero=90`) presented as a pull. The owner keeps it, as
  decided. If the hook is burned in, at least make the **caption** say "showcase
  walkout, rate the animation", which reduces the odds-misrepresentation risk.
- **Walkout saturation.** Week 1 is 12 of 21 walkouts because the renders exist. If
  §7's repetition check fires, cut to 1 a day early.
- **Reactive slots** assume the pre-rendered star has a normal night. If he is sent
  off or injured, swap to a neutral post rather than mocking him.
- **Nothing here was rendered or test-captured.** Hero pins for the new names were
  checked against pool ratings and the portrait registry, not in a live capture.
  Check each contact sheet before posting.

## Creator outreach template (PLAYBOOK §6.4, gifted tier)

> Hey {name}, I'm the solo dev behind Dynasty Manager, a football manager on
> iPhone with real clubs and player packs, free, no energy timers. Your
> {specific video} is exactly the vibe. Can I send you a Pro code? No strings,
> no script. If you post, I'd love a look. Either way, thanks for the content.

Send to 10 creators a week from the §2.3 list. Log who replied, who posted,
and which Custom Product Page link they got.
