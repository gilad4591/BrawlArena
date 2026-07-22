/**
 * Daily login reward + streak.
 *
 * Pure helpers over the persisted profile fields `lastDailyClaim` (a 'YYYY-MM-DD'
 * string) and `dailyStreak` (1..7, rolling). No storage access here — the caller
 * (App) reads the profile, calls these, and persists the result. This keeps the
 * logic testable and side-effect free.
 */

// Coins granted for each streak day (index 0 = day 1). Day 7 loops back to 1.
export const DAILY_REWARDS = [20, 30, 45, 60, 80, 110, 150];

/** Local calendar day as 'YYYY-MM-DD' (streaks reset on the player's midnight). */
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(aStr, bStr) {
  const a = new Date(`${aStr}T00:00:00`);
  const b = new Date(`${bStr}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

/**
 * What the player would get if they claimed right now.
 * Returns { claimable, streak (the day being claimed, 1..7), reward, day }.
 */
export function dailyStatus(profile, today = todayStr()) {
  const last = profile?.lastDailyClaim || null;
  const prevStreak = profile?.dailyStreak || 0;
  if (last === today) {
    return { claimable: false, streak: prevStreak, reward: 0, day: today };
  }
  // Continue the streak only if the last claim was exactly yesterday.
  const continued = last && daysBetween(last, today) === 1;
  const streak = continued ? Math.min(7, prevStreak + 1) : 1;
  const reward = DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length];
  return { claimable: true, streak, reward, day: today };
}

/**
 * Compute the persisted fields after a successful claim. The caller adds
 * `reward` coins and saves { coins, dailyStreak, lastDailyClaim }.
 */
export function applyDailyClaim(profile, today = todayStr()) {
  const status = dailyStatus(profile, today);
  if (!status.claimable) return null;
  return {
    reward: status.reward,
    dailyStreak: status.streak,
    lastDailyClaim: status.day,
  };
}
