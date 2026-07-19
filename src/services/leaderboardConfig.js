/**
 * Google Play Games Services leaderboard config.
 *
 * The score we submit is the player's TOTAL XP. Play Games hosts the board and
 * gives Daily / Weekly / All-time tabs for free — no backend/DB of our own.
 *
 * SETUP (Android only — the feature is auto-hidden on web):
 *   1. Play Console -> your app -> Grow -> Play Games Services -> Setup and
 *      management -> Configuration. Create/attach a game and note the numeric
 *      "Project ID" (a.k.a. App ID) -> paste it into
 *      android/app/src/main/res/values/strings.xml as game_services_project_id.
 *   2. Leaderboards -> Create leaderboard (name e.g. "Top Brawlers",
 *      Score format INTEGER, higher-is-better). Publish it, then copy its
 *      Leaderboard ID (looks like "CgkIxxxxxxxxxxEAAQAQ") into LEADERBOARD.id.
 *
 * Leave id empty to keep the whole feature dormant (button hidden, no calls).
 */
export const LEADERBOARD = {
  id: '', // e.g. 'CgkIxxxxxxxxxxEAAQAQ'
};
