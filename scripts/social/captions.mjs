// Generates ready-to-paste Instagram/TikTok captions for every card.
// Writes a web set (brawl-arena.com CTA) and an android set (Google Play CTA):
//   social-kit/captions/<id>.txt
//   social-kit/android/captions/<id>.txt
// Each file has the CAPTION and the FIRST COMMENT (hashtags) sections.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HANDLE = '@brawlarenagame';
const SITE = 'brawl-arena.com';

// id -> flavor line, lead emoji, engagement emoji, theme hashtags
const C = {
  blaze:  { name: 'BLAZE',  tag: 'The Flame Fighter', e: '🔥', q: '🔥', flavor: "Burns hot, hits harder. When BLAZE steps in, the whole arena catches fire.", th: ['fire', 'flames'] },
  frost:  { name: 'FROST',  tag: 'The Ice Warrior',   e: '❄️', q: '❄️', flavor: "Cold, calculated, unbreakable. FROST freezes the competition solid.", th: ['ice', 'frost'] },
  tide:   { name: 'TIDE',   tag: 'The Wave Bender',   e: '🌊', q: '🌊', flavor: "Flows like water, strikes like a tsunami. TIDE drowns every challenger.", th: ['water', 'ocean'] },
  volt:   { name: 'VOLT',   tag: 'The Storm Striker', e: '⚡', q: '⚡', flavor: "Fast as lightning, twice as shocking. Blink and VOLT already won.", th: ['lightning', 'electric'] },
  sylva:  { name: 'SYLVA',  tag: 'The Wild Hunter',   e: '🌿', q: '🏹', flavor: "Nature's deadliest predator. SYLVA hunts — everyone else runs.", th: ['nature', 'archer'] },
  shade:  { name: 'SHADE',  tag: 'The Venom Assassin',e: '🐍', q: '🟢', flavor: "One strike. One breath. That's all SHADE ever needs.", th: ['assassin', 'ninja'] },
  nox:    { name: 'NOX',    tag: 'The Void Bringer',  e: '🖤', q: '🖤', flavor: "Forged in shadow, armored in darkness. The arena goes quiet when NOX arrives.", th: ['darkfantasy', 'villain'] },
  golem:  { name: 'GOLEM',  tag: 'The Living Stone',  e: '🪨', q: '🪨', flavor: "Unmovable. Unstoppable. GOLEM doesn't fall — the arena does.", th: ['tank', 'stone'] },
  aurex:  { name: 'AUREX',  tag: 'The Golden Dragon', e: '🐉', q: '✨', flavor: "Bow before the Golden Dragon. AUREX rules the arena in gold and fire.", th: ['dragon', 'golden'] },
  sage:   { name: 'SAGE',   tag: 'The Arcane Master', e: '🔮', q: '🔮', flavor: "Ancient magic, modern beatdown. SAGE bends the whole battle to his will.", th: ['mage', 'magic'] },
  solaris:{ name: 'SOLARIS',tag: 'Sun Warden',        e: '☀️', q: '☀️', flavor: "Radiant power, blinding speed. SOLARIS burns brightest of all.", th: ['sun', 'light'] },
  tempest:{ name: 'TEMPEST',tag: 'Storm Lord',        e: '🌩️', q: '🌩️', flavor: "Commands the storm, crushes the arena. When TEMPEST reigns, you take cover.", th: ['storm', 'thunder'] },
  umbra:  { name: 'UMBRA',  tag: 'Night Reaper',      e: '🌑', q: '💀', flavor: "From the darkness, the reaper comes. UMBRA takes all — no exceptions.", th: ['reaper', 'shadow'] },
  titania:{ name: 'TITANIA',tag: 'Nature Queen',      e: '🌸', q: '👑', flavor: "Thorns and grace in equal measure. Kneel before the Nature Queen, TITANIA.", th: ['fairy', 'queen'] },
};

const ORDER = ['blaze', 'frost', 'tide', 'volt', 'sylva', 'shade', 'nox', 'golem', 'aurex', 'sage', 'solaris', 'tempest', 'umbra', 'titania'];

const BASE_TAGS = [
  'brawlarena', 'indiegame', 'fightinggame', 'beatemup', 'arcadegame', 'browsergame',
  'freegame', 'gaming', 'gamer', 'mobilegaming', 'indiedev', 'gamedev', '2dgame',
  'videogames', 'newgame', 'playnow', 'gamingcommunity', 'gamecharacter',
  'characterdesign', 'gamersofinstagram', 'indiegamedev', 'arcade', 'brawler',
  'onlinegame', 'gamedesign', 'instagaming',
];

const cta = (platform) =>
  platform === 'android'
    ? `🎮 BRAWL ARENA — now on Android!\n👉 Download it FREE on Google Play (link in bio)`
    : `🎮 BRAWL ARENA is OUT NOW — play FREE in your browser:\n👉 ${SITE} (link in bio)`;

const FEATURES = `• 14 fighters, each with unique specials\n• Solo Campaign + Arcade + Multiplayer\n• 8 arenas to conquer`;

function hashtags(theme = []) {
  const tags = [...theme, ...BASE_TAGS].slice(0, 30);
  return tags.map((t) => `#${t}`).join(' ');
}

function fighterCaption(id, platform) {
  const c = C[id];
  const caption = `${c.e} Meet ${c.name} — ${c.tag}.

${c.flavor}

${cta(platform)}

${FEATURES}

Would you main ${c.name}? Drop a ${c.q} if yes 👇

${HANDLE}`;
  return `=== CAPTION ===\n${caption}\n\n=== FIRST COMMENT (hashtags) ===\n${hashtags(c.th)}\n`;
}

function heroCaption(platform) {
  const caption = `🔥 BRAWL ARENA is HERE.

Pick your fighter. Master combos & specials. Own the arena. 👊

${cta(platform)}

• 14 unique fighters
• Solo Campaign, Arcade & Multiplayer
• 8 battle arenas

Who's your main going to be? 👇

${HANDLE}`;
  return `=== CAPTION ===\n${caption}\n\n=== FIRST COMMENT (hashtags) ===\n${hashtags(['newrelease', 'launch'])}\n`;
}

function rosterCaption(platform) {
  const caption = `👊 Meet the FULL BRAWL ARENA roster — 14 fighters, one arena to rule them all.

Flame, ice, storms, shadows, dragons… every fighter hits different. Who are you picking? 👇

${cta(platform)}

${HANDLE}`;
  return `=== CAPTION ===\n${caption}\n\n=== FIRST COMMENT (hashtags) ===\n${hashtags(['roster', 'characterselect'])}\n`;
}

for (const [platform, dir] of [['web', 'social-kit/captions'], ['android', 'social-kit/android/captions']]) {
  const out = path.join(ROOT, dir);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'hero.txt'), heroCaption(platform));
  fs.writeFileSync(path.join(out, 'roster.txt'), rosterCaption(platform));
  for (const id of ORDER) fs.writeFileSync(path.join(out, `${id}.txt`), fighterCaption(id, platform));
  console.log(`✓ ${platform}: ${ORDER.length + 2} caption files → ${dir}`);
}
