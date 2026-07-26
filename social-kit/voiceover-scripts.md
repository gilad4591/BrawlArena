# Brawl Arena — Voiceover Scripts for External TTS Tools

This is a ready-to-paste script pack for generating narration with an
**external** voice tool instead of (or in addition to) the built-in
`scripts/social/narrate.mjs` pipeline (which already uses a free Microsoft
Edge neural voice — good, but not the most expressive option out there).

Every line below is timed to the **real, measured** screen-transition
timestamps captured live during recording (see `*.timeline.json` next to
each video in `social-kit/video/`) — not guessed. If you record these
lines externally and drop them in at the listed `AT` second, they will
land on the exact beat they describe.

---

## 1. Which tool to use

| Tool | Verdict | Why |
|---|---|---|
| **ElevenLabs** ([elevenlabs.io](https://elevenlabs.io)) | **Recommended** | The most natural-sounding option available today — genuinely hard to tell from a real voice actor. Has a "Style/Exaggeration" slider that's perfect for trailer-announcer energy, a free tier (~10 min/month) generous enough for this whole script pack, per-line regeneration, and a "Speech to Speech" mode if you ever want to record it yourself and have it re-voiced. No install — web UI, paste text, export MP3/WAV. |
| Play.ht | Very good alternative | "Play 3.0" model is close to ElevenLabs quality; slightly cheaper paid tiers if you need bulk usage later (e.g. per-character voice lines in-game). |
| Murf.ai | Good, more "corporate" | Built for business/marketing videos with a built-in timeline editor — handy if you want to do the whole edit (voice + captions + music) inside one tool instead of our ffmpeg pipeline. |
| WellSaid Labs | Broadcast-quality | Excellent voices, but pricier and account-gated (no real free tier) — overkill for a mobile game's social clips. |
| Microsoft Edge neural (current default) | Free, decent | What `narrate.mjs` already uses (`en-US-GuyNeural`). Genuinely fine, just a notch below ElevenLabs on emotional range/energy. |

**Recommendation: start with ElevenLabs' free tier.** Pick a male voice
preset like "Adam" or "Josh" (energetic, deep) for the gameplay trailers,
or a bright/announcer-style preset for the roster montage. Set the
**Stability** slider low-ish (more expressive/variable) and **Style
Exaggeration** up for a punchy trailer read.

## 2. How to use these scripts

1. Copy a line's **TEXT** into the tool, generate, export as MP3/WAV.
2. Either:
   - **Easiest — hand it to a video editor (CapCut/Premiere/DaVinci/CapCut mobile):** import the matching video from `social-kit/video/` (the plain, non-`-voiceover` file — it has music but no narration baked in) and drop each voice clip onto the timeline starting exactly at its `AT` second. The `WINDOW` column tells you how much time you have before the next beat — try to keep each line's spoken length inside that window so it doesn't run into the next screen.
   - **Or — feed it back into our pipeline:** save the files as `social-kit/video/tts_tmp/<tag>_line_<N>.mp3` (matching the order below, 0-indexed) and re-run `node scripts/social/narrate.mjs` with the `synthLine()` call in that script commented out (ask and I'll wire up a "bring your own audio" mode — takes 5 minutes).
3. Keep the punctuation as-is — it's tuned for natural TTS pausing (ellipses `...` = a beat of hesitation, em dashes `—` = a short connecting pause).

---

## 3. Script A — Gameplay Trailer: "Solaris in the Forest Arena"

Video: `social-kit/video/brawl-arena-promo.mp4` (36.6s, 16:9)
Voice direction: confident game-trailer announcer, medium-fast pace, a
notch of excitement building toward the K.O.

| # | AT (sec) | WINDOW | Line |
|---|---|---|---|
| 1 | 0.3 | ~4.5s | This is Brawl Arena. |
| 2 | 5.1 | ~2.2s | Fourteen heroes. Choose yours. |
| 3 | 7.6 | ~2.7s | Gear up with elemental auras — |
| 4 | 10.6 | ~1.6s | — and rare portrait frames. |
| 5 | 12.5 | ~2.0s | Solaris steps into the arena. |
| 6 | 14.8 | ~2.0s | The fight begins! |
| 7 | 17.1 | ~4.4s | Unleash devastating special attacks — |
| 8 | 21.8 | ~3.7s | — chain combos without mercy — |
| 9 | 25.8 | ~2.0s | — and finish strong. |
| 10 | 29.6 | ~6.5s | K.O.! Victory! Brawl Arena — download free today. |

## 4. Script B — Gameplay Trailer: "Volt in the Neon City Arena"

Video: `social-kit/video/duel-volt-neon.mp4` (37.4s, 16:9)
Voice direction: same energy as Script A, slightly edgier/electric tone
fits the cyberpunk visuals — pronounce "Volt" like the electrical unit.

| # | AT (sec) | WINDOW | Line |
|---|---|---|---|
| 1 | 0.3 | ~4.5s | Brawl Arena — pick your fighter. |
| 2 | 5.1 | ~2.3s | Meet Volt, master of storms. |
| 3 | 7.7 | ~2.7s | Equip a crackling storm aura — |
| 4 | 10.7 | ~1.5s | — and an electrified frame. |
| 5 | 12.5 | ~2.7s | Into the Neon City arena. |
| 6 | 15.5 | ~2.1s | Sparks fly fast. |
| 7 | 17.9 | ~4.4s | Special attacks light up the night — |
| 8 | 22.6 | ~3.7s | — combo after combo — |
| 9 | 26.6 | ~2.0s | — no escape. |
| 10 | 30.4 | ~6.5s | K.O.! Victory! Brawl Arena — free on iOS and Android. |

## 5. Script C — Roster Montage (character-card slideshow)

Videos: `social-kit/video/promo_square.mp4` (1080x1080) and
`promo_story.mp4` (1080x1920), ~27.4s each — same timing for both.
Voice direction: crisp roll-call energy, a beat of pride on each name,
like a fighting-game character-select announcer.

| # | AT (sec) | WINDOW | Line |
|---|---|---|---|
| 1 | 0.2 | ~2.4s | Meet the roster of Brawl Arena. |
| 2 | 2.6 | ~2.4s | Blaze. |
| 3 | 5.0 | ~2.4s | Frost. |
| 4 | 7.4 | ~2.4s | Volt. |
| 5 | 9.8 | ~2.4s | Sylva. |
| 6 | 12.2 | ~2.4s | Nox. |
| 7 | 14.6 | ~2.4s | Golem. |
| 8 | 17.0 | ~2.4s | Aurex. |
| 9 | 19.4 | ~2.4s | Sage. |
| 10 | 21.8 | ~2.5s | Solaris. |
| 11 | 24.3 | ~3.0s | Ten heroes. One arena. Download Brawl Arena free today. |

---

## 6. If you re-record footage later

Both gameplay recordings can be regenerated any time with fresh, real
timestamps — the recorder measures them live, it never guesses:

```
node scripts/social/record-gameplay.mjs 5175 <outName> <characterId> <arenaId>
```

`<outName>.timeline.json` will appear next to the video with the exact
second each beat happened; regenerate this script's tables from that file
if you change the fight choreography, character, or arena.
