# App Store Connect — listing copy & compliance answers (draft)

Copy-paste starting points for the App Store Connect submission form. Review
and tweak the tone/wording as you like — the facts (character/arena counts,
data practices) are pulled directly from the game code and `public/privacy.html`
so they should be accurate as of this writing.

---

## 1. Name, subtitle, promotional text

- **Name** (App Store Connect "Name" field, 30 chars max): `Brawl Arena: Fighting Game`
  — plain "Brawl Arena" is already taken by an unrelated app on the Store
  (name collisions are global, not per-developer-account). This only
  affects the App Store *listing* title — the home-screen icon label stays
  "Brawl Arena" (`CFBundleDisplayName` in `Info.plist`, unaffected).
- **Subtitle** (30 chars max): `2.5D Fighting Game & Brawler`
- **Promotional text** (170 chars, editable without a new review):
  `Battle with 14 unique fighters across 8 arenas. New seasonal cosmetics and
  arenas added regularly — free to play, no account required.`

## 2. Description

```
Brawl Arena is a fast, arcade-style 2.5D fighting game — pick a fighter,
master their signature special attack, and battle across 8 hand-painted
arenas.

FEATURES
• 14 original fighters, each with unique stats and a signature special
  attack — fireballs, ice shards, thunder dashes, ground AOEs, launchers,
  homing orbs, and more.
• 8 arenas, from a sunlit forest to a neon-lit rooftop.
• Game modes: 1v1 Duel, Free-for-All (up to 8 fighters), Team Battles, a
  5-stage Solo Campaign, and a Survival mode.
• Three difficulty tiers (Beginner / Pro / Expert) with genuinely different
  AI behavior — reaction time, aggression, blocking, and special usage all
  scale up.
• Local multiplayer lobbies with quick 6-digit invite codes — play with
  friends on other devices.
• Unlockable elemental auras and portrait frames to customize your fighter.
• No account or sign-up required — just pick a fighter and play. Your
  progress is saved on your device.

Brawl Arena is free to play. Optional in-app purchases unlock premium
fighters, arenas, ad removal, and coin packs — everything else is earnable
through normal play.
```

## 3. Keywords (100 chars max, comma-separated, no spaces after commas needed)

```
fighting,brawler,arcade,combat,versus,multiplayer,pvp,fighter,2.5d,beat em up
```

## 4. Support & marketing URLs

- **Support URL:** `https://brawl-arena.com/about.html` (has a contact email link)
- **Marketing URL** (optional): `https://brawl-arena.com`
- **Privacy Policy URL:** `https://brawl-arena.com/privacy.html`

## 5. Category

- **Primary:** Games → Action
- **Secondary (optional):** Games → Sports, or Games → Entertainment

---

## 6. Age Rating questionnaire — recommended answers

Based on the actual game content (cartoon/fantasy character combat with
special-effect attacks, no blood/gore assets, no real gambling, no
unrestricted web access, no user-generated text content):

| Question | Recommended answer | Why |
|---|---|---|
| Cartoon or Fantasy Violence | **Infrequent/Mild** or **Realistic Violence: None** — pick the fantasy-violence tier your rating tool offers | Stylized special-attack effects (fireballs, ice, lightning), no blood/gore, no realistic weapons |
| Realistic Violence | None | — |
| Sexual Content / Nudity | None | — |
| Profanity or Crude Humor | None | No text content authored by you contains this |
| Alcohol, Tobacco, or Drug Use | None | — |
| Mature/Suggestive Themes | None | — |
| Horror/Fear Themes | None | — |
| Gambling (Simulated) | None | Coin packs are a direct real-money → in-game-currency purchase with a fixed, disclosed amount — not a randomized/loot-box mechanic |
| Contests | None | — |
| Unrestricted Web Access | No | The in-app browser hand-off is limited to the bundled privacy/about pages and Google's own consent-management links |
| User-Generated Content shared with others | No | The only user-entered text is a 12-character local "Fighter Name" shown to opponents in a multiplayer lobby — not persisted, moderated, or broadcast beyond that session |

Expected resulting rating: **9+ or 12+** (fantasy violence is usually what
pushes it above 4+; Apple's exact bucket depends on the current
questionnaire wording, which changes occasionally).

---

## 7. App Privacy ("nutrition label") — recommended declarations

Straight from `public/privacy.html`, which is the source of truth here —
update both together if data practices ever change.

**Data NOT collected:** name, email, phone number, physical address,
precise/coarse location, health data, financial info, contacts, browsing
history, search history, photos/videos, audio data, user content, or any
account/authentication identifier. The game has **no account system**.

**Data collected:**

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Advertising Data (device/ad identifiers) | Yes — via Google AdMob | No (device-level, not name/email) | Yes (third-party ad networks — this is why the ATT prompt fires) | Third-Party Advertising, Analytics |
| Product Interaction / Other Usage Data | Yes — via Google AdMob's own SDK telemetry | No | Possibly (declare per AdMob's own current App Privacy Details, which Google publishes for you to copy) | Analytics |
| User Content — "Fighter Name" | Yes, but **optional and local-only**; only transmitted transiently to other players in the same multiplayer room via the relay server | No (not linked to any persistent identity, just the session) | No | App Functionality (multiplayer lobby display) |
| Game state (positions/inputs) during online multiplayer | Yes, transient only, not stored/logged (see `server/server.js` + `privacy.html` "Multiplayer" section) | No | No | App Functionality |

**Practical note:** Google publishes AdMob's own current "data types
collected" declaration for App Store Connect's App Privacy form — check
[Google's AdMob/Play Services SDK data disclosure](https://support.google.com/admob/answer/9760862)
at submission time and copy their current list exactly, since ad SDKs'
declared data types do change between SDK versions.

---

## 8. Review notes (App Store Connect → App Review Information)

```
No account or sign-in is required to use the app — all core gameplay is
immediately accessible from the main menu. To test online multiplayer,
open Multiplayer from the main menu on two devices (or two browser tabs
during review, if reviewing the web build) and use the 6-digit invite code
shown on the host's screen to join. In-app purchases (fighter unlocks, arena
pack, coin packs, remove ads) can all be tested by initiating a purchase
flow; no special test account/coupon is needed since pricing is fetched
live from App Store Connect's sandbox for review builds.
```
