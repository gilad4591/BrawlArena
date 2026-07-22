import { LEADERBOARD } from './leaderboardConfig.js';

/**
 * Thin wrapper over Google Play Games Services (capacitor-game-connect-8).
 *
 * Everything is guarded so the game never breaks:
 *   - Web builds: no-op (plugin only exists on native).
 *   - Native without a configured leaderboard id: dormant (button hidden).
 *   - Sign-in / submit / show failures are swallowed — the leaderboard is a
 *     nice-to-have, never a hard dependency.
 *
 * The submitted score is the player's cumulative XP; Play Games derives the
 * Daily / Weekly / All-time views from it automatically.
 */
export class LeaderboardService {
  constructor() {
    this.native = false;
    this.plugin = null;
    this.ready = false;
    this.player = null; // { player_id, player_name } once signed in
    this._signInInFlight = null;
  }

  /** A leaderboard id has been configured. */
  get configured() {
    return !!LEADERBOARD.id;
  }

  /** Whether we should show the leaderboard UI / menu button at all. */
  get available() {
    return this.ready && this.configured;
  }

  async init() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      this.native = Capacitor.isNativePlatform();
    } catch {
      this.native = false;
    }
    if (!this.native || !this.configured) return;
    try {
      const mod = await import('capacitor-game-connect-8');
      this.plugin = mod.CapacitorGameConnect;
      this.ready = true;
      // Kick off a silent sign-in so submits/opens are instant later.
      this._signIn();
    } catch (err) {
      console.warn('[leaderboard] plugin unavailable:', err);
    }
  }

  /** Sign in once; concurrent callers share the same promise. */
  _signIn() {
    if (!this.ready) return Promise.resolve(null);
    if (this.player) return Promise.resolve(this.player);
    if (this._signInInFlight) return this._signInInFlight;
    this._signInInFlight = this.plugin
      .signIn()
      .then((p) => {
        this.player = p || null;
        return this.player;
      })
      .catch((err) => {
        console.warn('[leaderboard] sign-in failed:', err);
        return null;
      })
      .finally(() => {
        this._signInInFlight = null;
      });
    return this._signInInFlight;
  }

  /** Submit the player's total XP as their leaderboard score. */
  async submitScore(totalXp) {
    if (!this.available || !Number.isFinite(totalXp)) return;
    try {
      await this._signIn();
      if (!this.player) return; // declined sign-in
      await this.plugin.submitScore({
        leaderboardID: LEADERBOARD.id,
        totalScoreAmount: Math.max(0, Math.floor(totalXp)),
      });
    } catch (err) {
      console.warn('[leaderboard] submit failed:', err);
    }
  }

  /** Submit the Survival high score to its own board (if configured). */
  async submitSurvival(score) {
    if (!this.ready || !LEADERBOARD.survivalId || !Number.isFinite(score)) return;
    try {
      await this._signIn();
      if (!this.player) return;
      await this.plugin.submitScore({
        leaderboardID: LEADERBOARD.survivalId,
        totalScoreAmount: Math.max(0, Math.floor(score)),
      });
    } catch (err) {
      console.warn('[leaderboard] survival submit failed:', err);
    }
  }

  /** Open the native Play Games leaderboard UI (has Daily/Weekly/All-time). */
  async show() {
    if (!this.available) return;
    try {
      await this._signIn();
      await this.plugin.showLeaderboard({ leaderboardID: LEADERBOARD.id });
    } catch (err) {
      console.warn('[leaderboard] show failed:', err);
    }
  }
}
