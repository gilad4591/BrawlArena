/**
 * Daily quest templates. Each template can produce a concrete quest instance
 * (with a target rolled from a small range) via `make()`. Progress is tracked
 * from the `result` object the engine reports at the end of every match.
 *
 * A quest instance is a plain object persisted on the profile:
 *   { id, type, target, reward, progress, claimed, tmpl }
 *
 * `desc(target)` returns an English string (auto-translated by the i18n layer /
 * RULES); keep the wording matching entries in i18n.js.
 */

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export const QUEST_TEMPLATES = [
  {
    tmpl: 'win',
    reward: 60,
    make() {
      const target = rand(2, 4);
      return { type: 'win', target, reward: this.reward };
    },
    desc: (n) => `Win ${n} matches`,
  },
  {
    tmpl: 'play',
    reward: 40,
    make() {
      const target = rand(3, 5);
      return { type: 'play', target, reward: this.reward };
    },
    desc: (n) => `Play ${n} matches`,
  },
  {
    tmpl: 'ko',
    reward: 55,
    make() {
      const target = rand(6, 12);
      return { type: 'ko', target, reward: this.reward };
    },
    desc: (n) => `Knock out ${n} fighters`,
  },
  {
    tmpl: 'combo',
    reward: 70,
    make() {
      const target = rand(5, 8);
      return { type: 'combo', target, reward: this.reward };
    },
    desc: (n) => `Land a ${n}-hit combo`,
  },
  {
    tmpl: 'campaign',
    reward: 65,
    make() {
      const target = rand(1, 2);
      return { type: 'campaign', target, reward: this.reward };
    },
    desc: (n) => `Clear ${n} campaign stage(s)`,
  },
  {
    tmpl: 'survival',
    reward: 75,
    make() {
      const target = rand(3, 6);
      return { type: 'survival', target, reward: this.reward };
    },
    desc: (n) => `Reach wave ${n} in Survival`,
  },
];

const TMPL_MAP = Object.fromEntries(QUEST_TEMPLATES.map((t) => [t.tmpl, t]));

/** Roll `count` distinct daily quests. */
export function rollDailyQuests(count = 3) {
  const pool = [...QUEST_TEMPLATES];
  const picked = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    const t = pool.splice(idx, 1)[0];
    const q = t.make();
    picked.push({
      id: `${t.tmpl}_${Date.now()}_${i}`,
      tmpl: t.tmpl,
      type: q.type,
      target: q.target,
      reward: q.reward,
      progress: 0,
      claimed: false,
    });
  }
  return picked;
}

/** Human-readable description for a stored quest instance. */
export function questDesc(quest) {
  const t = TMPL_MAP[quest.tmpl];
  return t ? t.desc(quest.target) : '';
}

/** Advance a single quest's progress given a finished-match result. */
export function advanceQuest(quest, result) {
  if (quest.claimed) return quest;
  let progress = quest.progress || 0;
  switch (quest.type) {
    case 'win':
      if (result.win && !result.survival) progress += 1;
      break;
    case 'play':
      progress += 1;
      break;
    case 'ko':
      progress += result.koDealt || 0;
      break;
    case 'combo':
      progress = Math.max(progress, result.bestCombo || 0);
      break;
    case 'campaign':
      if (result.campaign) progress += result.stagesCleared || 0;
      break;
    case 'survival':
      if (result.survival) progress = Math.max(progress, result.wave || 0);
      break;
    default:
      break;
  }
  return { ...quest, progress: Math.min(quest.target, progress) };
}

export const isComplete = (q) => (q.progress || 0) >= q.target;
export const isClaimable = (q) => isComplete(q) && !q.claimed;
