const KEYS = {
  SETTINGS: 'brawl_arena_settings',
  STATS: 'brawl_arena_stats',
  PROFILE: 'brawl_arena_profile',
  PURCHASES: 'brawl_arena_purchases',
};

const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  haptics: true,
  reduceMotion: false,
  volume: 0.8,
};

const DEFAULT_STATS = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  koDealt: 0,
  bestCombo: 0,
  streak: 0,
  bestStreak: 0,
};

const DEFAULT_PROFILE = {
  name: 'Player',
  lastCharacter: 'blaze',
  lastMode: 'oneVsOne',
  lastDifficulty: 2,
  xp: 0,
  unlocked: ['blaze', 'frost', 'tide', 'volt', 'sylva', 'shade', 'nox', 'golem', 'aurex', 'sage'],
  campaignProgress: 0,
  // --- economy + engagement (spendable Coins; XP stays leaderboard-only) ---
  coins: 0,
  dailyStreak: 0,
  lastDailyClaim: null, // 'YYYY-MM-DD'
  quests: { day: null, items: [] },
  achievements: {}, // id -> true
  survivalBest: 0,
  ownedSkins: [], // ['blaze_gold', ...]
  equippedSkins: {}, // charId -> skinId
  adNudged: false, // one-time "remove ads?" prompt shown
};

export class StorageService {
  static async get(key, fallback) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      if (value == null) return fallback;
      return JSON.parse(value);
    } catch {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }
  }

  static async set(key, data) {
    const payload = JSON.stringify(data);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value: payload });
    } catch {
      try {
        localStorage.setItem(key, payload);
      } catch {
        /* ignore */
      }
    }
  }

  static async getSettings() {
    return { ...DEFAULT_SETTINGS, ...(await this.get(KEYS.SETTINGS, DEFAULT_SETTINGS)) };
  }

  static async saveSettings(settings) {
    await this.set(KEYS.SETTINGS, settings);
  }

  static async getStats() {
    return { ...DEFAULT_STATS, ...(await this.get(KEYS.STATS, DEFAULT_STATS)) };
  }

  static async updateStats(partial) {
    const stats = await this.getStats();
    const merged = { ...stats, ...partial };
    await this.set(KEYS.STATS, merged);
    return merged;
  }

  static async getProfile() {
    return { ...DEFAULT_PROFILE, ...(await this.get(KEYS.PROFILE, DEFAULT_PROFILE)) };
  }

  static async saveProfile(profile) {
    const current = await this.getProfile();
    const merged = { ...current, ...profile };
    await this.set(KEYS.PROFILE, merged);
    return merged;
  }

  /** Add (or subtract, with n<0) coins and persist. Returns the new balance. */
  static async addCoins(n) {
    const profile = await this.getProfile();
    const coins = Math.max(0, Math.round((profile.coins || 0) + n));
    await this.saveProfile({ coins });
    return coins;
  }

  /** Spend coins if affordable. Returns true on success, false if too poor. */
  static async spendCoins(n) {
    const profile = await this.getProfile();
    if ((profile.coins || 0) < n) return false;
    await this.saveProfile({ coins: (profile.coins || 0) - n });
    return true;
  }

  /** Owned product ids (entitlements). Kept separate so a progress reset never
   *  wipes real purchases. */
  static async getPurchases() {
    return await this.get(KEYS.PURCHASES, []);
  }

  static async savePurchases(ids) {
    await this.set(KEYS.PURCHASES, [...new Set(ids)]);
  }

  /** Wipe stats + progression (keeps audio/motion settings AND purchases). */
  static async resetProgress() {
    await this.set(KEYS.STATS, { ...DEFAULT_STATS });
    await this.set(KEYS.PROFILE, { ...DEFAULT_PROFILE });
    return { stats: { ...DEFAULT_STATS }, profile: { ...DEFAULT_PROFILE } };
  }
}
