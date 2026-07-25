# The Cozy Florist (RiftSky Games) — Research Dossier

> Compiled 2026-07-21 from store listings, the developer's official site and legal docs, the official Facebook guild-competition guide (image OCR), player-made TikTok guides, code/guide sites, app-intelligence trackers, and store reviews. Reddit was searched exhaustively and has essentially **zero** coverage of this game — see [§13](#13-community-landscape-where-the-knowledge-actually-lives).
>
> ⚠️ **Don't confuse** with "Cozy Florist" on Steam (app 3868690, a grandmother's-flower-shop indie game) or "Flowers and Favours" (indie Steam florist sim discussed on r/CozyGamers) — different games entirely.

---

## 1. Quick facts

| Field | Value |
|---|---|
| Title | The Cozy Florist ("Play and win real bouquets") |
| Developer | RiftSky Games Co., Limited (Hong Kong entity, mainland-China team) |
| Genre | Casual farm-sim + shop-management sim (order fulfillment). **Not** match-3, **not** merge |
| Platforms | iOS (id 6754878717), Android (`com.riftsky.mhg.gb.gp`), Windows via Google Play Games on PC |
| Release | **Nov 28, 2025** (Google Play, per embedded page JSON) / **Dec 4, 2025** (iOS) — Android soft-launched ~1 week earlier |
| Version (Jul 2026) | Android 1.0.56 (Jul 17–18, 2026, 851 MB); iOS 1.0.48 (~Jul 18, 2026, 1.1 GB). Weekly update cadence |
| Downloads | Play badge "1M+"; raw Play install counter **2,499,067**; trackers report 2.1M total, ~390K/month |
| Ratings | Google Play **4.7** (~127K ratings; heavily 5★-skewed); App Store **4.8** (18K US / 43.6K worldwide), #35–39 in Simulation. Play *PC*-store page only **3.7** (15 reviews) |
| Monetization | Ads + IAP $0.49–$99.99 (Play) / $0.99–$29.99 visible on iOS, generically named "1 USD Pack"…"30 USD Pack"; **loot boxes** disclosed in Apple age rating; VIP subscription; ad-free ticket; paid event passes |
| Age rating | Apple 9+ (Contests, Loot Boxes, Advertising, Messaging); Play "Everyone / Users Interact"; Uptodown 3+ — inconsistent |
| Online | Online-only (needs connection to load garden / visit friends) |
| Support | support@riftskygames.com |

Sources: [Google Play](https://play.google.com/store/apps/details?id=com.riftsky.mhg.gb.gp&hl=en_US) · [App Store](https://apps.apple.com/us/app/the-cozy-florist/id6754878717) · [Play PC store](https://play.google.com/pc-store/games/details?id=com.riftsky.mhg.gb.gp) · [APKPure version history](https://apkpure.net/the-cozy-florist/com.riftsky.mhg.gb.gp/versions) · [mwm.ai tracker](https://mwm.ai/apps/the-cozy-florist/6754878717) · [skich.app](https://skich.app/games/the-cozy-florist)

---

## 2. Source reliability map (read before trusting anything below)

**Solid / first-hand:**
- Store listings + on-page player reviews (Google Play, App Store incl. full iOS version history)
- Official Facebook page's **guild-competition infographic guide** (4 images by community member "@sweetz", reposted by the official account) — the single richest source of hard numbers ([post](https://www.facebook.com/thecozyfloristofficial/posts/want-to-dominate-the-guild-competition-check-out-this-ultimate-guide-to-help-you/122118821649130402/))
- Player-made TikTok guides, esp. **@tcfbluehour** "Astrals 101" series and @rebelliouschick8
- [Pocket Gamer codes page](https://www.pocketgamer.com/the-cozy-florist/codes/) — the only mainstream games-press coverage that exists
- Official site / [ToS](https://riftskygames.com/terms.html) / [Privacy Policy](https://riftskygames.com/privacy.html); HK company registry

**Thin / SEO / AI-generated (used only for corroboration, flagged inline):**
- [game-solver.com](https://game-solver.com/the-cozy-florist/) — despite the promising name, it's an SEO aggregator: App Store metadata + scraped reviews, **no actual guide or level pages**
- GameHaunt "review" — AI-written, wrong release date ("late 2024"), fabricated "we tested it" framing; its "no timers, no paywalls" claims contradict player reviews
- Enduins article — a rewritten publisher press release (Feb 28, 2026) with canned "player quotes"
- Code-aggregator SEO sites (ucngame, minutetactics, newgamecode, clashiverse, gamepretty, levelgeeks) — reward tables appear genuine, editorial text is filler
- MOD-APK mirror sites (apktodo, modcombo, softonic, uptodown) — generic AI text, but their gameplay sections contain some of the most detailed loop descriptions found (mined for description only)

**Dead ends:** No Fandom wiki. No LevelWinner/Gamezebo/Touch Tap Play/MrGuider guides. No GameFAQs. ChapterCheats has 3 real player questions, **all unanswered**. QooApp listing is dead (1 rating, 0 reviews). Reddit: nothing (see §13).

---

## 3. Core gameplay loop

Assembled from store descriptions, reviews, TikTok guides, and mod-site gameplay sections — all sources agree on the shape:

1. **Plant** seeds in garden plots ("soil")
2. **Water** them (Droplets resource; a water-collection function refills on a timer, on **server time**, not local — a known player complaint)
3. **Wait** out real-time growth timers (see §4)
4. **Harvest** blooms
5. **Sell** loose flowers or **craft floral arrangements in vases** at your shop
6. **Fulfill orders** — Resident Orders (townsfolk NPCs) and shop customers — for Gold + XP
7. **Level up** → unlock new flowers (via Cultivation), customers, features; spend Gold on seeds/decor/story
8. Repeat, plus daily social loop: visit friends' gardens, **steal blooming flowers** (§6), guild tasks (§8), Astral dispatches (§7)

Other structural notes:
- **Mission/story line** gates early content: 76+ numbered missions in the early game (KruMobile's walkthrough parts are labeled Missions 29–52, 52–58, 69–76)
- **Story**: chat-style narrative about a woman getting divorced, set in an era when women needed a husband's permission to own a business. Story chapters cost coins (starting at **20 coins**, increasing). As of June 2026 reviews, the story **ends unfinished** with no continuation
- **Order structure** (mod-site example, illustrative): an order might require "2 tulips, 1 lily, 3 daisies" — multi-flower recipe fulfillment; timing management is the strategy layer
- **No energy gate / no move limits / no fail states** — pacing comes from growth timers, not an energy bar. (Caveat: "Random Energy Bottle" items exist in code rewards, likely for a sub-system such as Astral dispatch — unresolved, see §16)
- Shop side: arrange vases, set prices, decorate the boutique; decoration allegedly affects foot traffic/tips (thin source — GameHaunt)
- Later feature additions: **Workshop** gameplay (v1.0.19), **Pets** (v1.0.31), **Flower Exhibition** (v1.0.34), **Alchemy** (announced on Instagram, ~Jul 2026) — no mechanical details public for any of these

---

## 4. Garden & flower mechanics (concrete numbers)

- **Flower tiers**: common starters (daisies, lilies of the valley) → rarer unlocks (tulips, roses, peonies, pink lilies, orchids). Zodiac-themed event flowers exist (e.g., "**Capricorn-Veil**")
- **Flowers are upgradeable (have levels)**; growth time scales with flower level: **Level 1 grows in seconds → Level 5 takes ~25 minutes** of real time, occupying a soil plot the whole while (App Store review, corroborated on game-solver's scrape)
- **Cultivation** = crafting/unlocking new flower species from accumulated **Cultivation Materials**:
  - Materials are purchasable with coins at **1 material per purchase** at "a crazy amount" of coins, or bought with Diamonds
  - Some cultivations take **10+ hours**; skippable with tickets/Diamonds/Speed-Up Cards
  - F2P players report queues of 10–15 flowers waiting on materials; "takes a few days to get all materials" — this is the main F2P bottleneck
  - Tutorial includes "cultivating a rose" (a player got stuck there; unanswered on ChapterCheats)
- **Flower Market**: buy specific flowers (incl. rares) with **Flower Market Tickets**; one rare flower costs **5,880 tickets** (App Store review: "5.88k… to get ONE RARE FLOWER")
- **"Flower Spirits" have a lottery/gacha** (named in the Jan 29, 2026 patch notes)
- Known progression gates: one flower "normally unlocks at level 22" (mod-site); free/ad-supported progress reportedly stalls around **level 21**
- Jan 29, 2026 patch notes (from game-solver's scrape of official notes): universal light effects on mature ordinary flowers; item-pack display optimization; Flower Spirits lottery visual optimization; "Clear Cache" button hidden from launch screen; guild-competition tie rankings sorted by completion time

---

## 5. Shop, arrangements & orders

- **Arranging is crafting, not puzzling**: choose a vase type + required flowers → produce an arrangement. Vase types are named (e.g., "**Elegant Vase**" — a guild task reads "Create 60 floral arrangement(s) (Elegant Vase)")
- **Resident Orders** (NPC townsfolk orders) have a **daily count cap**; loose-flower orders need no vase. Maxing the daily Resident Order count is the fastest way to level through roughly **levels 1–20** (@tcfbluehour, TikTok)
- Some **vase collections cannot be completed without paid (real-money) flowers** (repeated App Store complaint, Apr 2026)
- Time-gated dailies ("royal orders", extra water) reset on **server time**, not local timezone (player complaint)
- **No published formula exists anywhere** for order pricing, arrangement scoring, star ratings, or XP per order — the only scoring numbers in the wild are guild-task point values (§8). This is a genuine public-knowledge gap, not a research miss

---

## 6. Flower stealing (the signature social mechanic)

- Official pitch: *"Spotted vibrant roses blooming in a friend's garden? Sneak a few blooms, but watch out—don't get caught! Snagging rare flower seeds brings immense a sense of achievement!"* — note stealing can yield **rare flower seeds**, not just blooms
- Mechanics as described across sources: visit a friend's (or other player's) garden while flowers are in bloom → steal a few → the victim **gets a notification and can steal back later**. Timing matters (you steal what's currently bloomed; players report setting alarms for friends' peony blooms)
- Economically meaningful, not just cosmetic: *"My advice is to just play FTP because whatever you need, **you can steal and get ahead**"* (Play review)
- A "guard dog" defense mechanic was mentioned in one search snippet — **unverified, no primary source**
- No public numbers on steal limits, cooldowns, or catch probability
- **Lineage** (analysis): this is a direct descendant of the Chinese 偷菜 (crop-stealing) loop from QQ Farm / Happy Farm (2008–09) — timed blooms, offline stealing, notification + retaliation — which fits the dev team's Chinese social-casual pedigree (§14). It's Coin-Master-adjacent as an async-raiding retention driver but gentler: no destruction, no documented shields. It also rides the 2025–26 "steal from gardens" trend (Roblox's Grow a Garden). It is **not** a Lily's Garden/Gossip Harbor-style puzzle+renovation game — there is no match/merge layer at all

---

## 7. Astral / Star Spirit system (unlocks ~level 30+)

The mid/late-game system, poorly tutorialized in-game (a level-34 player publicly asking "how to do Astral" went unanswered). Best available reconstruction, from @tcfbluehour's "Astrals 101" TikTok series and @rebelliouschick8:

1. Pull **Star Spirit Flowers** from the **Star Spirit Draw** — a **gacha banner organized by zodiac sign** (e.g., "Gemini: Twin Star Shadows")
2. Plant the Star Spirit Flower **together with specific zodiac-themed "Fill Flowers"** (partner plants: Pisces, Aquarius, Taurus…), growing them **simultaneously** (guides recommend Speed-Up Cards to sync the timing)
3. Successful pairing **summons an Astral** (fairy) to your garden — fairies appear when flowers regrow/refresh, not simply on watering
4. Harvest Astrals, then **dispatch** them on timed missions to earn **Spirit Coins**; dispatches are diamond-rushable
5. Watch for **weekly bonus / Double Bonus windows** — some Fairies return more Spirit Coins during the right window
6. Spend Spirit Coins in the **Astral Shop**
- "**Pearls**" are a gatherable resource at the florist shop connected to the astral economy (players open pearls for astral-related rewards); players can be **hired via Hiring Contracts to gather pearls for other players** — a player-labor mechanic
- Community consensus: much of the Astral system "leans toward paid or limited resources"

---

## 8. Guild competition (the hardest numbers available — closest thing to published formulas)

Source: official Facebook page's 4-image guide (Jan 29, 2026, authored by @sweetz), corroborated by review complaints.

**Structure**
- Guild feature unlocks after **115 quests completed**; a guild needs **≥5 members** to enter competition
- **Weekly**, against guilds of the same rank: **Tuesday 9:00 AM UTC → Saturday 9:00 PM UTC** (5 days 12 hours); Sun–Mon rest
- Leagues **D → C → B → A**

**Task math**

| League | Base tasks per member | Task board size |
|---|---|---|
| D | 9 | 24 |
| C | 12 | 36 |
| B | 15 | 48 |
| A | 18 | 66 |

- Each member can buy up to **6 extra tasks** with Diamonds
- Task types: **Normal** (upgradeable with Diamonds — at A-Rank an upgrade **doubles** the task's points, but also raises requirements and time limit) vs **Advanced** ("golden", pre-upgraded, not upgradeable)
- Every task has a point value and a **time limit — an expired task scores 0**
- Refreshes: **8 free refreshes per member per day**; paid tiers: **2 💎** random task, **8 💎** task worth >14 pts, **16 💎** task worth >21 pts
- Leaders/Co-Leaders can delete tasks; a deleted slot refills after **1h 30m**
- Reference point value: "base flower quests only offer **9 points**" (review); highest-point quests require real-money flowers

**Rewards & ranking**
- **Team Chests every 700 guild points** (random cultivation materials)
- **Individual reward redeemable per 100 personal competition points**, unlimited redemptions (1,300 pts = 13 redemptions; redeeming doesn't reduce team score) — contains Guild Coins, Diamonds, Gold, Speed-Ups, Flower Market Tickets
- Promotion/demotion within a **10-guild bracket: 1st–3rd promoted, 4th–7th stay, 8th–10th demoted**
- Ties in final ranking broken by completion time (Jan 29 patch)

**Balance reality (player reports):** paying guilds score ~**30k** points vs ~**4k** for F2P guilds; some competitive events "cost upward of $50+" per member; a player-organized **boycott of a paid event over costs** occurred around May–Jun 2026 (Facebook group post "Florists boycott game event due to costs")

---

## 9. Currencies & items (all names confirmed via code rewards / guides)

| Currency | Role |
|---|---|
| **Gold (coins)** | Soft currency — orders income; buys story chapters, cultivation materials, seeds |
| **Diamonds (gems)** | Premium — speed-ups, cultivation materials, guild task buys/upgrades/refreshes, astral rushes, draws |
| **Droplets** | Watering/growth resource |
| **Flower Market Tickets** | Buy specific/rare flowers at the Flower Market (rare = 5,880 tickets) |
| **Spirit Coins** | Earned from Astral dispatches; spent in Astral Shop |
| **Guild Coins** | From guild-competition individual rewards |
| **Pearls** | Gatherable at the shop; astral-related; other players can be hired to gather them |

Items: **Speed-Up Cards** (a.k.a. speed grow cards), **Random Cultivation Materials**, **Potions**, **Fertilizers**, **Soil**, **Energy Bottles**, **Hiring Contracts**, **Talismans**.

---

## 10. Monetization & economy pressure

- IAP: generic consumable cash packs "1 USD Pack" ($0.99) → "30 USD Pack" ($29.99) on iOS; Play lists a **$0.49–$99.99** range (Apple list truncated). **Loot boxes** disclosed in Apple's rating; "Contests (infrequent/mild)" also disclosed
- **VIP membership** (subscription with daily login benefits, added v1.0.17), **Ad-Free Ticket** / paid "month of no ads", stacking event passes and gift packs; some **draws are fully pay-locked**
- **Rewarded-ad allowance is capped: ~50 ads per 9-day period** (player report); mid-2026 players report ads being "batched, 3 at a time where it used to be one"
- Event cadence: **3–5 events/month**, players claim "each event costs at least $30" to fully complete; events allegedly rebalanced over time to require spending
- Progression wall around **level 21** for free/ad-only players
- Review-arc pattern: Dec 2025–Feb 2026 reviews glowing ("generous", "no energy waits") → May–Jul 2026 reviews report paywall tightening, tripled ads, unfinished story, daily crashes. Early-game generous, mid/late-game monetized — a classic Chinese social-casual live-ops curve
- Known bugs from reviews: disappearing harvested flowers (90 pink roses → 2), freezes during cultivation, multiple daily crashes (Jun–Jul 2026), timezone desync on dailies

---

## 11. "Win real flowers" (the marketing hook)

- The centerpiece of all marketing: *"Lucky players can redeem real flowers—you could be the next lucky one!"*; iOS subtitle "Play and win real bouquets"
- **It appears genuinely real**: Facebook group posts "Received my real flowers!" / "Received my beautiful flowers today!!"; App Store reviewers confirming won bouquets; TikTok guide author @tcfbluehour: *"Do players really win real flowers, or is it a gimmick? Answer: Yes, I received a real bouquet!"*; a Korean TikTok hub for 꽃배달 (flower delivery) exists. The **privacy policy** is the only legal doc acknowledging it (winners "provide us your mailing address for us to send you the prize")
- **Mechanism**: luck-based selection among active players completing special event tasks, roughly monthly (specifics from thin sources — treat as unconfirmed). Apple's "Contests" advisory corroborates a sweepstakes-style mechanic
- **Compliance red flag**: no published sweepstakes terms, odds, eligibility, regional restrictions, or no-purchase-necessary language exists anywhere — not in the ToS, not on the site — despite being the primary acquisition hook in US/EU markets
- Sobering counterpoint from a review: *"only one person received a real bouquet after spending over $8,000"* (reviewer's circle/guild)

---

## 12. Feature/version timeline (iOS version history)

| Version | Date | Added |
|---|---|---|
| 1.0.15 | ~Jan 2026 | (game-solver snapshot: 443 MB, iOS 13+) |
| — | Jan 29, 2026 | Patch: flower light effects, Flower Spirits lottery polish, guild tie-breaks |
| 1.0.17 | Feb 6, 2026 | VIP/ad-free daily login rewards; guild final rankings; Resident Orders display |
| 1.0.18 | Feb 13, 2026 | Growth Path UI; Friend Notes; "March Queen" fashion; Daily Schedule Settings |
| 1.0.19 | Mar 6, 2026 | **Workshop gameplay**; Valentine's event; ID/MS/FIL languages |
| 1.0.20–21 | Mar 9–10, 2026 | Guild rule adjustments; Women's Day event; zh-TW/VI |
| 1.0.28 | Apr 2, 2026 | Thai; server-time display |
| 1.0.31 | Apr 13, 2026 | **Pet gameplay**; giftable flower/costume packs |
| 1.0.34 | May 6, 2026 | **Flower Exhibition gameplay** |
| 1.0.45–1.0.56 | May 15 – Jul 18, 2026 | ~Weekly maintenance releases (Android APK grew 643→851 MB); guild competitions, workshop functionality; **Alchemy** teased on Instagram |

Named events seen: Valentine's, International Women's Day, **Floral Inlay Event**, **Summer Carnival** (limited arrangement + "Starry Purple Ballad" outfit + free 7-Day Bonus track). Fashion/outfit skins and home/shop decoration systems confirmed.

---

## 13. Community landscape (where the knowledge actually lives)

- **Reddit: essentially zero.** No threads found via Google/Bing site-search or the Pullpush archive API; no dedicated subreddit; r/CozyGamers "florist" threads are all about other games. (Caveat: archive coverage of 2026 posts is spotty, but indexed search also shows nothing.)
- **Facebook is the hub**: [official page](https://www.facebook.com/thecozyflorist/) (~128K likes) + ["The Cozy Florist Official Group"](https://www.facebook.com/groups/cozyflorist/) — login-walled, but guide posts visible by title: "Star Spirits ultimate guide and faqs", "Astral guide for planting and collecting", "Basic gameplay guides for flower arrangements?", "Guild competition guide and rules", "Tips for ranking up quickly", "How to win real flowers?", "What to do when hired to gather pearls", "90-day review", "Florists boycott game event due to costs"
- **Discord**: ["The Cozy Florist"](https://discord.com/servers/the-cozy-florist-1457571990062891163) — ~47,000 members, created Jan 5, 2026; weekly gift codes
- **TikTok**: official accounts @thecozyfloristofficial / @thecozyfloristonline with named livestream hosts; **codes dropped every 30 minutes during official TikTok livestreams** (player report); player guide creators @tcfbluehour, @rebelliouschick8
- **Instagram**: [@thecozyflorist](https://www.instagram.com/thecozyflorist/) (~40K followers), "Garden Review Rewards" posts
- **YouTube**: small — KruMobile's mission-by-mission [walkthrough series](https://www.youtube.com/playlist?list=PL5_X6itPA1QYqBHEqGp3_DDRe6j1Mv5PX) (Part 1: 11.5K views) plus a sponsored AlphaGalaxyy video (referral bundle: 100 Diamonds + 50 Speed-Up Cards + 20,000 Gold). No big-creator organic coverage
- German-language players present in the FB group; a separate Korean-market Play listing exists (`com.riftsky.mhg.kr.gp`, "더 코지 플로리스트")

---

## 14. Developer: RiftSky Games Co., Limited

- **Hong Kong private company**, incorporated **Jul 19, 2024** (BRN 76828010), Rm 5003, 5/F Yau Lee Centre, 45 Hoi Yuen Rd, Kwun Tong; status Live ([registry via ltddir](https://www.ltddir.com/companies/riftsky-games-co-limited/))
- [Official site](https://riftskygames.com/): team founded 2024 by members of "domestic Top 10 international publishing corporations" — core members ex-**Tap4fun, FunPlus, Elex, Storm8, Pocket Gems, NetEase, Tencent**; claims 100+ ad-network partnerships. Contact number is a **mainland-China mobile (+86)** → HK shell entity, mainland operating team (a standard Chinese-publisher structure; "domestic" = domestic China)
- **Portfolio**: The Cozy Florist, Gambit Heroes (`com.riftsky.ttl.*`, Jun 2025, luck-based hero battler), Caveman Survivor, Capy Pop Drop, "Haven for Cats". Package pattern `com.riftsky.{codename}.{region}.gp` with region-segmented builds (kr, ru). The real-flowers hook is unique to Cozy Florist within their portfolio, though the unrelated app "My Garden Tale" (Modo Global) uses the identical "Play and win real bouquets" tagline — suggesting the gimmick is spreading as a UA template
- **Legal**: ToS under **Singapore law**, mandatory SIAC arbitration, no class actions; virtual goods "licensed, not sold", non-refundable. ToS contains **no sweepstakes/prize provisions at all**. Privacy policy (eff. Jan 20, 2025): collects credentials, chat records, IP, device IDs, payment data, anti-cheat monitoring; Play data-safety admits **sharing** personal info & messages with third parties; iOS: tracks identifiers + usage across apps
- **No relation to MWM** — mwm.ai is just an app-intelligence site
- Full-width punctuation in store copy ("！～「」") is a consistent Chinese-source-text tell

---

## 15. Review sentiment summary

**Praised:** cozy art/music and flower-shop theme; genuinely playable F2P early game with no energy gate; friendly community and global chat; involved story ("wasn't expecting" it); stealing keeps F2P viable ("whatever you need, you can steal"); frequent codes (TikTok live drops); real flowers actually ship for some winners.

**Criticized (dominant, worsening over 2026):**
- "Cute but expensive… you can go so far on ads, not beyond level 21… a cute game becomes a bad money trap so quickly"
- "Some events cost upward of $50+, required should your guild wish to compete… higher point tasks are usually paid packages"
- "started batching the ads and showing 3 at a time where it used to be only one… feels greedy"
- "Massive cash grab… they monetize everything… customer service abysmal / disrespectful"
- Guild competitions "completely unbalanced" (paid ~30k vs F2P ~4k points)
- Story ends unfinished; events getting pricier; crashes "multiple times a day"; "reward system overly complicated with excessive pop-ups"; ads don't match actual gameplay/art ("knock off feel"); botanical/world-building inaccuracies
- Rating-vs-review gap: 4.7–4.8 stars overall but written reviews skew harsh → heavy unwritten-5★ skew, plausibly incentivized in-game

---

## 16. Contradictions & open questions

**Contradictions found:**
| Topic | Conflict |
|---|---|
| Release date | Nov 28, 2025 (Play JSON, ChapterCheats, Skich) vs Dec 4, 2025 (iOS, game-solver) — likely staggered launch |
| Downloads | Play raw counter 2.50M vs trackers' 2.1M vs Play badge 1M+ |
| Energy | "No energy system" (reviews + promo) vs "Random Energy Bottle" items in code rewards — bottles likely feed a sub-system (Astral dispatch?), unconfirmed |
| Age rating | Apple 9+ (loot boxes!) vs Play "Everyone" vs Uptodown 3+ |
| GameHaunt claims | "late 2024 release", "no timers", "no paywalls" — all wrong; source is AI-generated |

**Nobody has published (genuine public-knowledge gaps):**
- Exact XP/level thresholds, or a level→unlock table (a player's request for this sits unanswered on ChapterCheats)
- Order payout / arrangement pricing / scoring formulas (the only hard scoring numbers anywhere are guild-task points, §8)
- Plot counts and garden/shop expansion costs
- Steal mechanic numbers (limits, cooldowns, catch chance, guard-dog defense?)
- Star Spirit Draw gacha rates; Flower Spirits lottery rates (loot boxes disclosed but odds unpublished)
- Pet / Workshop / Flower Exhibition / Alchemy mechanics detail
- Real-flower winner-selection criteria, odds, and eligibility (no sweepstakes terms exist)

**Where the missing knowledge likely is:** the login-walled Facebook group's guide posts (§13 titles), the Discord, and in-game itself. If deeper detail is needed, the practical next steps are: join the FB group/Discord, or play the game and document first-hand.

---

## 17. Redeem codes (as of Jul 2026 — codes rotate weekly; ~43 already expired)

Redemption: Profile/avatar (top-left) → Settings → Redeem/Exchange/Gift Code → enter (case-sensitive, one use per account) → rewards arrive in Mailbox. New codes ~weekly on Discord/socials + 30-minute drops during TikTok lives.

| Code | Rewards | Status (Jul 2026) |
|---|---|---|
| `TCF2026` | 12.88K Gold, 10 Droplets, 8 Speed-Up Cards, 2 Random Cultivation Materials | Active |
| `uef1ecb8` | (unspecified) | Until 23 Jul 2026 |
| `COZY999` | 15 Diamonds, 15 Speed-Up Cards, 8,888 Gold | — |
| `COZY888` | 15 Diamonds, 15 Flower Market Tickets, 8,888 Gold | — |
| `COZY666` | 20 Diamonds, 10 Speed-Up Cards, 10 Flower Market Tickets | — |
| `DCFLOR` | 20 Diamonds, 1 Cultivation Material, 1 Energy Bottle, 20 Speed-Up Cards | — |
| `FlowersVIP` | 15 Diamonds, 1× Potion/Fertilizer/Soil/Energy Bottle, 10 Speed-Up Cards | — |
| `FLORIST` | 8,888 Gold, 8 Speed-Up Cards, 8 Droplets | — |
| `QUEEN` | 100 Diamonds, 100 Droplets, 100 Flower Market Tickets | Expired May 2026 |
| `COZYLATIN` | 80 Diamonds, 5 Cultivation Materials, 30 Speed-Up Cards | Expired Mar 2026 |

Weekly rotating hash-style codes (`p9da9f5e`, `E0929d37`, `x087b9f5`, …) each last ~1 week.

---

## 18. Full source list

**Official / store**
- Google Play: https://play.google.com/store/apps/details?id=com.riftsky.mhg.gb.gp&hl=en_US · PC store: https://play.google.com/pc-store/games/details?id=com.riftsky.mhg.gb.gp · Korean edition: https://play.google.com/store/apps/details?id=com.riftsky.mhg.kr.gp
- App Store: https://apps.apple.com/us/app/the-cozy-florist/id6754878717 · Apple dev page: https://apps.apple.com/us/developer/riftsky-games/id1805546623 · Play dev page: https://play.google.com/store/apps/developer?id=Riftsky+Games
- RiftSky: https://riftskygames.com/ · ToS: https://riftskygames.com/terms.html · Privacy: https://riftskygames.com/privacy.html
- HK registry: https://www.ltddir.com/companies/riftsky-games-co-limited/

**Community / guides**
- Facebook group: https://www.facebook.com/groups/cozyflorist/ · Official page (guild guide images): https://www.facebook.com/thecozyflorist/
- Discord: https://discord.com/servers/the-cozy-florist-1457571990062891163
- Instagram: https://www.instagram.com/thecozyflorist/
- TikTok discover hubs: tiktok.com/discover/{tips-and-tricks-cozy-florist-game, how-to-get-real-flowers-from-the-cozy-florist-game, the-cozy-florist-star-spirit, how-to-do-star-spirit-draw-in-the-cozy-florist, cozy-florist-game-real-flowers}
- ChapterCheats Q&A: https://www.chaptercheats.com/qna/android/752483/the-cozy-florist-answers/
- YouTube: KruMobile walkthroughs https://www.youtube.com/playlist?list=PL5_X6itPA1QYqBHEqGp3_DDRe6j1Mv5PX · first-week gameplay https://www.youtube.com/watch?v=s0mA8zRj9ro · sponsored review https://www.youtube.com/watch?v=kxwJMyGL_2U

**Codes / trackers / aggregators**
- Pocket Gamer codes: https://www.pocketgamer.com/the-cozy-florist/codes/ · MinuteTactics: https://www.minutetactics.com/codes/the-cozy-florist-promo-codes · UCNGame: https://ucngame.com/codes/the-cozy-florist-codes/ · NewGameCode: https://newgamecode.com/the-cozy-florist-codes/
- APKPure versions: https://apkpure.net/the-cozy-florist/com.riftsky.mhg.gb.gp/versions · Uptodown: https://the-cozy-florist.en.uptodown.com/android · mwm.ai: https://mwm.ai/apps/the-cozy-florist/6754878717 · skich: https://skich.app/games/the-cozy-florist · QooApp: https://m-apps.qoo-app.com/en_us/app/148085 · Sharebie: https://www.sharebie.com/apps/the-cozy-florist · Softonic: https://the-cozy-florist.en.softonic.com/android

**Low-reliability (flagged)**
- game-solver: https://game-solver.com/the-cozy-florist/ · GameHaunt: https://gamehaunt.com/the-cozy-florist-a-healing-garden-awaits-you-to-start-your-floral-journey/ · Enduins (PR): https://www.enduins.com/news/the-cozy-florist-a-healing-garden-at-your-fingertips-begin-your-florist-story · AppsPirate: http://appspirate.com/the-cozy-florist-review/ · mod-site descriptions (mined for text only): the-cozy-florist.apktodo.io, the-cozy-florist.modcombo.com
