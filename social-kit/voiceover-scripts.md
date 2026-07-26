# Brawl Arena — Voiceover Scripts for External (Paid) TTS Tools

Ready-to-paste script pack for generating narration with a **paid, cloud**
voice tool, in **both English and Hebrew**, instead of the free options
already in this repo:

- `scripts/social/narrate.mjs` — free Microsoft Edge neural voice
  (`en-US-GuyNeural`), English only, needs network access.
- `local-dub/` — fully offline/local (Phonikud diacritizer + Matcha-TTS),
  free, but a single fixed voice per language and noticeably less
  expressive/natural than a top commercial voice.

Every line below is timed to the **real, measured** screen-transition
timestamps captured live during recording (see `*.timeline.json` next to
each video in `social-kit/video/`) — not guessed. Record these lines
externally and drop them in at the listed `AT` second and they will land on
the exact beat they describe.

---

## 1. Which tool to use

| Tool | Verdict | Hebrew support | Why |
|---|---|---|---|
| **ElevenLabs** ([elevenlabs.io](https://elevenlabs.io)) | **Recommended** | Yes — select the **`eleven_multilingual_v2`** (or newer `eleven_v3`) model; Hebrew is auto-detected from the pasted text, no separate "Hebrew voice" needed | The most natural-sounding option available today — genuinely hard to tell from a real voice actor. "Style/Exaggeration" and "Stability" sliders are perfect for trailer-announcer energy. Free tier (~10 min/month) is generous enough for this whole script pack (both languages). Per-line regeneration, "Speech to Speech" mode if you want to re-voice your own recorded take. No install — web UI, paste text, export MP3/WAV. |
| Play.ht | Very good alternative | Yes — "Play 3.0" model supports Hebrew | Close to ElevenLabs quality; slightly cheaper paid tiers for bulk usage later (e.g. per-character in-game voice lines). |
| Murf.ai | Good, more "corporate" | Check current voice list before committing — Hebrew coverage has been more limited/newer than English there | Built-in timeline editor — handy if you want to do the whole edit (voice + captions + music) inside one tool instead of our ffmpeg pipeline. |
| WellSaid Labs | Broadcast-quality | English only | Excellent voices, but pricier, account-gated, and no Hebrew — skip for this project. |
| Microsoft Edge neural (free, already in repo) | Free, decent | Yes (`he-IL-AvriNeural` / `he-IL-HilaNeural`) | What `narrate.mjs` already uses for English. Genuinely fine, just a notch below ElevenLabs on emotional range/energy. |
| `local-dub/` (free, offline, already in repo) | Usable fallback | Yes (Phonikud + Matcha-TTS) | Zero cost, zero network, but one fixed voice and flatter delivery than any of the above. |

**Recommendation: ElevenLabs, `eleven_multilingual_v2` model, free tier.**
For English pick a male voice preset like "Adam" or "Josh" (energetic,
deep). For Hebrew, browse the **Voice Library** and filter by language —
pick a voice tagged "Hebrew" or a strong multilingual voice (e.g. "Antoni"/
"Charlie"-style presets have read Hebrew well in practice; audition 2-3
before committing, quality varies more between voices in Hebrew than in
English). Set **Stability** low-ish (more expressive/variable) and **Style
Exaggeration** up for a punchy trailer read, in both languages.

## 2. How to use these scripts

1. Copy a line's **TEXT** into the tool, generate, export as MP3/WAV.
2. Either:
   - **Easiest — hand it to a video editor (CapCut/Premiere/DaVinci):**
     import the matching video from `social-kit/video/` (the plain,
     non-`-voiceover`/non-`-localdub` file — it has music but no narration
     baked in) and drop each voice clip onto the timeline starting exactly
     at its `AT` second. The `WINDOW` column tells you how much time you
     have before the next beat — try to keep each line's spoken length
     inside that window so it doesn't run into the next screen.
   - **Or — feed it back into `local-dub`'s pipeline (mixing/ducking/
     captions reused, just swap the voice):** ask and I'll wire up a
     "bring your own audio" mode that takes pre-rendered per-cue WAV/MP3
     files (named/ordered to match a `cues.json`) instead of calling
     `tts_engine.synth()` — a small change since `dub.py` already separates
     "synthesize each cue" from "mux onto video".
3. Keep the punctuation as-is — it's tuned for natural TTS pausing
   (periods = full stop, em dashes `—` = a short connecting pause).
4. **Hebrew-specific tip:** paste Hebrew lines *without* niqqud (vowel
   points) — ElevenLabs/Play.ht's own language models handle plain Hebrew
   text fine and adding niqqud yourself isn't necessary (unlike the fully
   offline `local-dub` engine, which adds niqqud itself via Phonikud
   specifically *because* the free/local model needs it spelled out).

---

## 3. Script A — Gameplay Trailer: "Solaris in the Forest Arena"

Video: `social-kit/video/brawl-arena-promo.mp4` (36.6s, 16:9)
Voice direction: confident game-trailer announcer, medium-fast pace, a
notch of excitement building toward the K.O.

### English

| # | AT (sec) | WINDOW | Line |
|---|---|---|---|
| 1 | 0.3 | ~4.8s | This is Brawl Arena. |
| 2 | 5.1 | ~2.5s | Fourteen heroes. Choose yours. |
| 3 | 7.6 | ~3.0s | Gear up with elemental auras — |
| 4 | 10.6 | ~1.8s | — and rare portrait frames. |
| 5 | 12.5 | ~2.3s | Solaris steps into the arena. |
| 6 | 14.8 | ~2.3s | The fight begins! |
| 7 | 17.1 | ~4.7s | Unleash devastating special attacks — |
| 8 | 21.8 | ~4.0s | — chain combos without mercy — |
| 9 | 25.8 | ~3.8s | — and finish strong. |
| 10 | 29.6 | ~7.0s | K.O.! Victory! Brawl Arena — download free today. |

### Hebrew (עברית)

| # | AT (שנ') | חלון | טקסט |
|---|---|---|---|
| 1 | 0.3 | ~4.8s | זו ברול ארנה. |
| 2 | 5.1 | ~2.5s | ארבע עשרה גיבורים. תבחרו את שלכם. |
| 3 | 7.6 | ~3.0s | התלבשו בהילות יסודות — |
| 4 | 10.6 | ~1.8s | — ומסגרות נדירות. |
| 5 | 12.5 | ~2.3s | סולריס נכנס לזירה. |
| 6 | 14.8 | ~2.3s | הקרב מתחיל! |
| 7 | 17.1 | ~4.7s | משחררים מכות מיוחדות קטלניות — |
| 8 | 21.8 | ~4.0s | — שוזרים קומבו בלי רחמים — |
| 9 | 25.8 | ~3.8s | — וסוגרים בגדול. |
| 10 | 29.6 | ~7.0s | נוקאאוט! ניצחון! ברול ארנה — הורידו בחינם עוד היום. |

## 4. Script B — Gameplay Trailer: "Volt in the Neon City Arena"

Video: `social-kit/video/duel-volt-neon.mp4` (37.4s, 16:9)
Voice direction: same energy as Script A, slightly edgier/electric tone
fits the cyberpunk visuals — pronounce "Volt" like the electrical unit.

### English

| # | AT (sec) | WINDOW | Line |
|---|---|---|---|
| 1 | 0.3 | ~4.8s | Brawl Arena — pick your fighter. |
| 2 | 5.1 | ~2.6s | Meet Volt, master of storms. |
| 3 | 7.7 | ~3.0s | Equip a crackling storm aura — |
| 4 | 10.7 | ~1.8s | — and an electrified frame. |
| 5 | 12.5 | ~3.0s | Into the Neon City arena. |
| 6 | 15.5 | ~2.4s | Sparks fly fast. |
| 7 | 17.9 | ~4.7s | Special attacks light up the night — |
| 8 | 22.6 | ~4.0s | — combo after combo — |
| 9 | 26.6 | ~3.8s | — no escape. |
| 10 | 30.4 | ~7.0s | K.O.! Victory! Brawl Arena — free on iOS and Android. |

### Hebrew (עברית)

| # | AT (שנ') | חלון | טקסט |
|---|---|---|---|
| 1 | 0.3 | ~4.8s | ברול ארנה — תבחרו לוחם. |
| 2 | 5.1 | ~2.6s | הכירו את וולט, אדון הסופות. |
| 3 | 7.7 | ~3.0s | התלבשו בהילת סופה מרשימה — |
| 4 | 10.7 | ~1.8s | — ומסגרת חשמלית. |
| 5 | 12.5 | ~3.0s | לתוך זירת העיר הניאון. |
| 6 | 15.5 | ~2.4s | הניצוצות עפים מהר. |
| 7 | 17.9 | ~4.7s | מכות מיוחדות מציפות את הלילה — |
| 8 | 22.6 | ~4.0s | — קומבו אחרי קומבו — |
| 9 | 26.6 | ~3.8s | — אין בריחה. |
| 10 | 30.4 | ~7.0s | נוקאאוט! ניצחון! ברול ארנה — חינם לאייפון ואנדרואיד. |

## 5. Script C — Roster Montage (character-card slideshow)

Videos: `social-kit/video/promo_square.mp4` (1080x1080) and
`promo_story.mp4` (1080x1920), ~27.4s each — same timing for both.
Voice direction: crisp roll-call energy, a beat of pride on each name,
like a fighting-game character-select announcer.

### English

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

### Hebrew (עברית)

| # | AT (שנ') | חלון | טקסט |
|---|---|---|---|
| 1 | 0.2 | ~2.4s | הכירו את השורה של ברול ארנה. |
| 2 | 2.6 | ~2.4s | בלייז. |
| 3 | 5.0 | ~2.4s | פרוסט. |
| 4 | 7.4 | ~2.4s | וולט. |
| 5 | 9.8 | ~2.4s | סילבה. |
| 6 | 12.2 | ~2.4s | נוקס. |
| 7 | 14.6 | ~2.4s | גולם. |
| 8 | 17.0 | ~2.4s | אורקס. |
| 9 | 19.4 | ~2.4s | סייג'. |
| 10 | 21.8 | ~2.5s | סולריס. |
| 11 | 24.3 | ~3.0s | עשרה גיבורים. זירה אחת. הורידו את ברול ארנה בחינם עוד היום. |

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
