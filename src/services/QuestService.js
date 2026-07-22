import { StorageService } from './StorageService.js';
import { rollDailyQuests, advanceQuest, isClaimable, isComplete } from '../game/quests.js';
import { todayStr } from './DailyReward.js';

/**
 * Owns the daily-quest lifecycle on top of the persisted profile
 * (`profile.quests = { day, items: [...] }`). Rolls a fresh set each local day,
 * records progress from match results, and pays out coins on claim.
 */
export class QuestService {
  constructor() {
    this.items = [];
    this.day = null;
  }

  /** Load today's quests, rolling a new set if the calendar day changed. */
  async ensureDaily() {
    const profile = await StorageService.getProfile();
    const today = todayStr();
    const q = profile.quests || { day: null, items: [] };
    if (q.day === today && Array.isArray(q.items) && q.items.length) {
      this.day = q.day;
      this.items = q.items;
      return this.items;
    }
    this.day = today;
    this.items = rollDailyQuests(3);
    await StorageService.saveProfile({ quests: { day: today, items: this.items } });
    return this.items;
  }

  /** Feed a finished-match result into every quest; persist and return newly completed. */
  async recordMatch(result) {
    if (!this.items.length) return [];
    const before = this.items.map((q) => isComplete(q));
    this.items = this.items.map((q) => advanceQuest(q, result));
    const newlyDone = this.items.filter((q, i) => !before[i] && isComplete(q));
    await StorageService.saveProfile({ quests: { day: this.day, items: this.items } });
    return newlyDone;
  }

  /** Claim a completed quest. Returns the coin reward (0 if not claimable). */
  async claim(questId) {
    const q = this.items.find((x) => x.id === questId);
    if (!q || !isClaimable(q)) return 0;
    q.claimed = true;
    await StorageService.saveProfile({ quests: { day: this.day, items: this.items } });
    await StorageService.addCoins(q.reward);
    return q.reward;
  }

  /** Number of quests ready to claim (for the menu badge). */
  claimableCount() {
    return this.items.filter((q) => isClaimable(q)).length;
  }
}
