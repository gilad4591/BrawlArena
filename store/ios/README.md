# iOS app — setup, signing & App Store submission

Brawl Arena uses **Capacitor 8** with the same JS bundle as Android and Web.
Bundle ID: `com.gilad4591.brawlarena`. Current native version: **4.10.9
(build 53)**, matching Android.

**No Mac required for anything in this document.** Certificate/CSR
generation uses OpenSSL locally (§1 below); the actual signed build runs on
GitHub's hosted macOS CI runner (`.github/workflows/ios-build.yml`), which
already has Xcode preinstalled. If you ever do get occasional Mac access,
manual `npm run ios:open` + Xcode Archive also works — both paths produce
the same signed IPA.

---

## 0. Status (what's already done vs what needs your Apple account)

| Item | Status |
|---|---|
| Xcode project, bundle ID, app icon, splash, display name | ✅ Done (already in repo) |
| Privacy/About pages live + linked from native Settings | ✅ Done |
| Export compliance (`ITSAppUsesNonExemptEncryption`) | ✅ Done (set to `false` — no custom crypto anywhere in the codebase) |
| CI simulator build | ✅ Done, runs on every push to `main` |
| App Store screenshots (6.7"/6.9", 6.5", iPad) | ✅ Generated — see `social-kit/appstore/` |
| App Store listing copy + Age Rating / App Privacy draft answers | ✅ Drafted — see `store/ios/app-store-listing.md` |
| App record in App Store Connect | ⬜ **Requires your Apple Developer login** — §2 |
| In-app purchase products (11 of them) | ⬜ **Requires your Apple Developer login** — §2 |
| Real iOS AdMob app + ad unit IDs | ⬜ **Requires your Google/AdMob login** — §3 |
| Distribution certificate + provisioning profile | ⬜ **Requires your Apple Developer login**, but no Mac needed — §4 |
| GitHub CI secrets | ⬜ Needs the values from §4 — I can run `gh secret set` for you once you paste them |
| Upload first build, submit for review | ⬜ **Requires your Apple Developer login** — §5 |

---

## 1. Apple Developer Program (you already have this ✅)

Confirm your **Team ID** (10 characters, top-right of
[developer.apple.com/account](https://developer.apple.com/account)) — you'll
need it in §4.

---

## 2. App Store Connect — app record + IAP products

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**
   - Platform: **iOS**
   - Name: **Brawl Arena**
   - Primary language: English (add Hebrew as a secondary localization later if you want a translated listing)
   - Bundle ID: `com.gilad4591.brawlarena` (must already exist under [Identifiers](https://developer.apple.com/account/resources/identifiers/list) — Xcode's automatic signing usually registers it the first time you build with your team selected; if it's not listed yet, add it there manually first)
   - SKU: e.g. `brawlarena-ios`
2. Finish **Agreements, Tax, and Banking** (Business tab) — required before any paid feature (ads or IAP) can go live, even though the app itself is free.
3. **Features → In-App Purchases** → create these 11 products so the IDs match `src/services/purchasesConfig.js` **exactly**:

   | Product ID | Type | Reference name suggestion |
   |---|---|---|
   | `remove_ads` | Non-Consumable | Remove Ads |
   | `all_characters` | Non-Consumable | All Premium Fighters |
   | `arena_pack` | Non-Consumable | Premium Arenas |
   | `char_solaris` | Non-Consumable | Solaris (Fighter) |
   | `char_tempest` | Non-Consumable | Tempest (Fighter) |
   | `char_umbra` | Non-Consumable | Umbra (Fighter) |
   | `char_titania` | Non-Consumable | Titania (Fighter) |
   | `500_coins` | Consumable | 500 Coins |
   | `1200_coins` | Consumable | 1,200 Coins |
   | `3000_coins` | Consumable | 3,000 Coins |
   | `8000_coins` | Consumable | 8,000 Coins |

   Prices are intentionally not hardcoded in the app — it shows whatever
   localized price App Store Connect reports once these exist.

---

## 3. AdMob (production iOS app)

The app currently ships Google's **official test** AdMob app ID/ad units on
iOS (Android is already production). Before shipping real ads:

1. Create a real iOS app at [admob.google.com](https://admob.google.com).
2. Create ad units matching the three formats already wired up (banner,
   interstitial, rewarded) — see `src/services/AdService.js`.
3. Send me the new App ID + three ad unit IDs and I'll update
   `src/services/adsConfig.js` (`ios.appId`, `ios.banner`, `ios.interstitial`,
   `ios.rewarded`) and `ios/App/App/Info.plist`'s `GADApplicationIdentifier`
   myself — pure code change, no account access needed on my end.

---

## 4. Signing certificate & provisioning profile (no Mac needed)

### 4a. Generate a CSR + private key locally

```powershell
cd store/ios
.\generate-csr.ps1 -Email "you@example.com" -Name "Your Name"
```

Writes `ios_distribution.key` (keep private, never commit — already
gitignored) and `ios_distribution.csr`.

### 4b. Get the certificate from Apple

[Certificates → +](https://developer.apple.com/account/resources/certificates/add)
→ **Apple Distribution** → upload `ios_distribution.csr` → download the
resulting `.cer`.

### 4c. Convert to the `.p12` CI needs

```powershell
.\cert-to-p12.ps1 -CerPath .\distribution.cer -P12Password "choose-a-password"
```

Prints the base64 blob for `IOS_DIST_CERT_BASE64` and reminds you of the
password you chose for `IOS_DIST_CERT_PASSWORD`.

### 4d. Provisioning profile

[Profiles → +](https://developer.apple.com/account/resources/profiles/add)
→ **App Store** distribution → select the `com.gilad4591.brawlarena` App ID
+ the certificate from 4b → download the `.mobileprovision`, then base64-encode it:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\App_Store_Profile.mobileprovision"))
```

That's `IOS_PROVISION_PROFILE_BASE64`.

### 4e. Add the GitHub secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `IOS_DIST_CERT_BASE64` | output of `cert-to-p12.ps1` |
| `IOS_DIST_CERT_PASSWORD` | the password you chose in 4c |
| `IOS_PROVISION_PROFILE_BASE64` | base64 of the `.mobileprovision` (4d) |
| `IOS_TEAM_ID` | your 10-character Apple Team ID |

Then add a repo **variable** (not secret), same Settings page, **Variables**
tab: `IOS_SIGNING_READY` = `true`.

**Paste me the four values above (or just tell me they're set) and I can run
`gh secret set` for all of them from here** — I just can't generate the
values themselves since that requires your Apple Developer login.

---

## 5. First build → TestFlight/App Store

1. Push to `main` (or run the workflow manually from the **Actions** tab) —
   `signed-archive` runs automatically once `IOS_SIGNING_READY` is `true`.
2. Download the `brawl-arena-ios-ipa` artifact from the completed run.
3. Upload it with Apple's **Transporter** app (Mac App Store, or Windows via
   [Transporter for Windows](https://apps.microsoft.com/detail/9pl3j53gxx0p))
   or Xcode Organizer if you have Mac access.
4. App Store Connect → **TestFlight** → build appears after processing
   (~5–30 min) → add internal testers, or go straight to **App Store** tab →
   **+ Version** → select the build → fill in metadata (see
   `store/ios/app-store-listing.md`) → **Submit for Review**.

Review typically takes **1–3 days**.

### Updates after this

1. Bump `CURRENT_PROJECT_VERSION`/`MARKETING_VERSION` in Xcode (or directly
   in `project.pbxproj`) and `versionCode`/`versionName` in
   `android/app/build.gradle` together, same as today.
2. Push to `main` → CI builds + signs automatically.
3. Upload the new IPA, App Store Connect → new version → select build → Submit.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `security import` fails with "MAC verification failed" | Re-run `cert-to-p12.ps1` — it already forces the legacy PBE scheme `security import` expects; a stale `.p12` from a different tool is the usual cause |
| `signed-archive` job doesn't run at all | Check the `IOS_SIGNING_READY` repo **variable** (not secret) is exactly `true` |
| Archive succeeds but App Store Connect rejects the IPA | Check the bundle ID + Team ID in the provisioning profile match `com.gilad4591.brawlarena` and your team exactly |
| `openssl` not found (running `generate-csr.ps1`/`cert-to-p12.ps1`) | Run from **Git Bash**, or install OpenSSL for Windows |
