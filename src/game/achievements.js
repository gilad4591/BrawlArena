/**
 * Milestone achievements evaluated against lifetime `stats` + `profile`.
 * Each entry: { id, name, desc, reward (coins), test(stats, profile) }.
 * Unlocks are one-way and persisted in `profile.achievements` (id -> true).
 * Descriptions are English source strings (translated via i18n.js).
 */
export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Blood', desc: 'Win your first match', reward: 30, test: (s) => (s.wins || 0) >= 1 },
  { id: 'win_10', name: 'Contender', desc: 'Win 10 matches', reward: 50, test: (s) => (s.wins || 0) >= 10 },
  { id: 'win_50', name: 'Veteran', desc: 'Win 50 matches', reward: 120, test: (s) => (s.wins || 0) >= 50 },
  { id: 'win_100', name: 'Champion', desc: 'Win 100 matches', reward: 250, test: (s) => (s.wins || 0) >= 100 },
  { id: 'play_10', name: 'Warmed Up', desc: 'Play 10 matches', reward: 30, test: (s) => (s.matchesPlayed || 0) >= 10 },
  { id: 'play_50', name: 'Regular', desc: 'Play 50 matches', reward: 90, test: (s) => (s.matchesPlayed || 0) >= 50 },
  { id: 'play_200', name: 'Addicted', desc: 'Play 200 matches', reward: 300, test: (s) => (s.matchesPlayed || 0) >= 200 },
  { id: 'ko_50', name: 'Bruiser', desc: 'Knock out 50 fighters', reward: 60, test: (s) => (s.koDealt || 0) >= 50 },
  { id: 'ko_250', name: 'Demolisher', desc: 'Knock out 250 fighters', reward: 160, test: (s) => (s.koDealt || 0) >= 250 },
  { id: 'ko_1000', name: 'Unstoppable', desc: 'Knock out 1000 fighters', reward: 400, test: (s) => (s.koDealt || 0) >= 1000 },
  { id: 'combo_5', name: 'Combo Starter', desc: 'Land a 5-hit combo', reward: 40, test: (s) => (s.bestCombo || 0) >= 5 },
  { id: 'combo_10', name: 'Combo Master', desc: 'Land a 10-hit combo', reward: 90, test: (s) => (s.bestCombo || 0) >= 10 },
  { id: 'combo_20', name: 'Combo God', desc: 'Land a 20-hit combo', reward: 220, test: (s) => (s.bestCombo || 0) >= 20 },
  { id: 'streak_3', name: 'On a Roll', desc: 'Win 3 in a row', reward: 50, test: (s) => (s.bestStreak || 0) >= 3 },
  { id: 'streak_5', name: 'Dominating', desc: 'Win 5 in a row', reward: 100, test: (s) => (s.bestStreak || 0) >= 5 },
  { id: 'streak_10', name: 'Legendary', desc: 'Win 10 in a row', reward: 260, test: (s) => (s.bestStreak || 0) >= 10 },
  { id: 'campaign_1', name: 'Trailblazer', desc: 'Clear campaign stage 1', reward: 40, test: (s, p) => (p.campaignProgress || 0) >= 1 },
  { id: 'campaign_all', name: 'Overlord Slayer', desc: 'Clear the whole campaign', reward: 300, test: (s, p) => (p.campaignProgress || 0) >= 4 },
  { id: 'survive_5', name: 'Survivor', desc: 'Reach wave 5 in Survival', reward: 60, test: (s, p) => (p.survivalBest || 0) >= 5 },
  { id: 'survive_10', name: 'Last Stand', desc: 'Reach wave 10 in Survival', reward: 150, test: (s, p) => (p.survivalBest || 0) >= 10 },
  { id: 'survive_20', name: 'Endless', desc: 'Reach wave 20 in Survival', reward: 350, test: (s, p) => (p.survivalBest || 0) >= 20 },
  { id: 'rich_500', name: 'Coin Collector', desc: 'Hold 500 coins', reward: 50, test: (s, p) => (p.coins || 0) >= 500 },
  { id: 'rich_2000', name: 'Coin Baron', desc: 'Hold 2000 coins', reward: 150, test: (s, p) => (p.coins || 0) >= 2000 },
  { id: 'daily_7', name: 'Dedicated', desc: 'Reach a 7-day login streak', reward: 120, test: (s, p) => (p.dailyStreak || 0) >= 7 },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
