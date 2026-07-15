/**
 * Lightweight i18n for Brawl Arena.
 *
 * The UI is built from innerHTML templates, so instead of wrapping every string
 * we keep an English->Hebrew map and auto-translate the DOM: a MutationObserver
 * translates any text node the app renders, and `t()` / `tpl()` handle strings
 * composed with values (and canvas text drawn outside the DOM).
 *
 * English is the source language, so keys ARE the English text (normalised to
 * single spaces). Switching back to English simply re-renders and skips
 * translation.
 */

let lang = 'en';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// English (normalised) -> Hebrew.
const HE = {
  // --- Menu ---
  'Pick a fighter. Own the arena.': 'בחר לוחם. שלוט בזירה.',
  'Solo Campaign': 'קמפיין יחיד',
  Arcade: 'ארקייד',
  Multiplayer: 'רב-משתתפים',
  'How to Play': 'איך משחקים',
  Settings: 'הגדרות',
  'Cross-platform · iOS · Android': 'חוצה פלטפורמות · iOS · Android',
  'Cross-platform · iOS · Android ·': 'חוצה פלטפורמות · iOS · Android ·',
  About: 'אודות',
  Privacy: 'פרטיות',

  // --- Setup ---
  'Choose Your Fighter': 'בחר את הלוחם שלך',
  Mode: 'מצב',
  Opponents: 'יריבים',
  Teams: 'קבוצות',
  'tap a colour per fighter': 'הקש צבע לכל לוחם',
  '🎲 Random': '🎲 אקראי',
  Difficulty: 'רמת קושי',
  Arena: 'זירה',
  'FIGHT!': 'קרב!',
  '1 vs 1': '1 נגד 1',
  'Free-for-all': 'כולם נגד כולם',
  Beginner: 'מתחיל',
  Pro: 'מקצוען',
  Expert: 'מומחה',
  You: 'אתה',
  Health: 'בריאות',
  Speed: 'מהירות',
  Power: 'עוצמה',
  '★ Special Moves': '★ מהלכים מיוחדים',
  'Jump + SP': 'קפיצה + SP',
  projectile: 'קליע',
  aoe: 'נפח',
  rush: 'הסתערות',
  uppercut: 'אגרוף עולה',
  multishot: 'מטח',
  // Arena names
  Forest: 'יער',
  Dojo: 'דוג׳ו',
  Volcano: 'הר געש',
  'Frozen Peak': 'פסגה קפואה',

  // --- In-game controls / banners ---
  DEF: 'הגנה',
  HIT: 'מכה',
  THROW: 'זריקה',
  Paused: 'מושהה',
  Resume: 'המשך',
  'Quit to Menu': 'יציאה לתפריט',
  Victory: 'ניצחון',
  'VICTORY!': 'ניצחון!',
  DEFEATED: 'הובסת',
  'CHAMPION!': 'אלוף!',
  Rematch: 'משחק חוזר',
  'Change Fighter': 'החלף לוחם',
  'Main Menu': 'תפריט ראשי',
  'UNLOCKED!': 'נפתח!',
  'K.O.!': 'נוקאאוט!',
  BLOCK: 'חסימה',
  SHIELD: 'מגן',
  BOSS: 'בוס',
  'ENRAGED!': 'זעם!',
  '{n} Hits!': '{n} מכות!',
  '+HP': '+חיים',
  '+MP': '+מאנה',

  // --- Result / XP (templated) ---
  'You placed #{place} of {count} · {time}s': 'דורגת #{place} מתוך {count} · {time}ש׳',
  'Your team placed #{place} of {count} · {time}s': 'הקבוצה שלך דורגה #{place} מתוך {count} · {time}ש׳',
  'KO in {time}s': 'הודחת אחרי {time}ש׳',
  '+{gained} XP · Total {xp}': '+{gained} XP · סה״כ {xp}',
  '{name} unlocked!': '{name} נפתח!',
  'unlocked!': 'נפתח!',
  Total: 'סה״כ',
  'Next:': 'הבא:',
  'You cleared all {n} stages! · {time}s': 'עברת את כל {n} השלבים! · {time}ש׳',
  'Fell at {stage} · {n} stages cleared': 'נפלת ב{stage} · {n} שלבים הושלמו',
  'Stage {s}/{total}': 'שלב {s}/{total}',
  'Wave {w}/{total}': 'גל {w}/{total}',

  // --- Campaign ---
  "Fight through 5 stages of Bruisers and Mages to the Gang Leader's throne.":
    'התקדם דרך 5 שלבים של בריונים וקוסמים עד לכס מנהיג הכנופיה.',
  Fighter: 'לוחם',
  Stages: 'שלבים',
  'The Outskirts': 'הפרברים',
  'The Fortress Gate': 'שער המבצר',
  'The Narrow Gorge': 'המעבר הצר',
  'The Burning Citadel': 'המצודה הבוערת',
  'The Throne Room': 'חדר הכס',
  'Learn the ropes against slow Bruisers.': 'למד את היסודות מול בריונים איטיים.',
  'Mages hang back and pelt you with bolts.': 'קוסמים נשארים מאחור ויורים בך קליעים.',
  'Foes close in from both sides. A Super Bruiser guards the exit.':
    'אויבים מתקרבים משני הצדדים. בריון-על שומר על היציאה.',
  'Upgraded packs and shielding Mages. Use the props!':
    'חבורות משודרגות וקוסמים ממגנים. השתמש בחפצים!',
  'The Gang Leader and his guard. Survive his enraged phase.':
    'מנהיג הכנופיה ומשמרו. שרוד את שלב הזעם שלו.',
  'Locked — clear the previous stage': 'נעול — עבור את השלב הקודם',

  // --- Settings ---
  'Fighter Name': 'שם הלוחם',
  'Master Volume': 'עוצמת שמע',
  'Sound Effects': 'אפקטי קול',
  Music: 'מוזיקה',
  Haptics: 'רטט',
  'Reduce Motion': 'הפחת תנועה',
  'Turns off screen shake': 'מכבה רעידת מסך',
  Back: 'חזרה',
  'Reset Progress': 'אפס התקדמות',
  Matches: 'משחקים',
  Wins: 'נצחונות',
  'Win Rate': 'אחוז ניצחון',
  KOs: 'נוקאאוטים',
  'Best Combo': 'קומבו שיא',
  'Best Streak': 'רצף שיא',
  Language: 'שפה',
  'Reset all progress? This clears your stats, XP and unlocks.':
    'לאפס את כל ההתקדמות? זה ימחק את הסטטיסטיקות, ה-XP והדמויות שנפתחו.',
  'Progress reset': 'ההתקדמות אופסה',

  // --- Multiplayer ---
  'Play with a friend via a private invite code. Codes are 6 digits and expire fast for safety.':
    'שחק עם חבר דרך קוד הזמנה פרטי. הקודים בני 6 ספרות ופגים במהירות לביטחון.',
  'Create Room': 'צור חדר',
  'Join Room': 'הצטרף לחדר',
  'Generate an invite code': 'הפק קוד הזמנה',
  "Enter a friend's code": 'הזן קוד של חבר',
  'Cross-device play is live via the relay server.': 'משחק חוצה-מכשירים פעיל דרך שרת הממסר.',
  'Same-device play works out of the box. Set a relay URL (VITE_MP_RELAY_URL) for cross-device.':
    'משחק באותו מכשיר עובד מיד. הגדר כתובת ממסר (VITE_MP_RELAY_URL) למשחק חוצה-מכשירים.',
  'Enter invite code': 'הזן קוד הזמנה',
  Join: 'הצטרף',
  'Invite Code': 'קוד הזמנה',
  Ready: 'מוכן',
  'Start Match': 'התחל משחק',
  'Waiting for host to start…': 'ממתין למארח שיתחיל…',
  Leave: 'עזוב',
  'Your fighter': 'הלוחם שלך',
  'tap to pick': 'הקש לבחירה',
  '🎲 Shuffle Teams': '🎲 ערבב קבוצות',
  'Choosing…': 'בוחר…',
  READY: 'מוכן',
  HOST: 'מארח',
  'Invite expired': 'ההזמנה פגה',
  'Code must be 6 digits': 'הקוד חייב להיות 6 ספרות',
  'Code copied': 'הקוד הועתק',
  'Pick a fighter first': 'בחר קודם לוחם',
  'Need at least 2 players to start': 'צריך לפחות 2 שחקנים כדי להתחיל',
  'Everyone must pick a fighter first': 'כולם חייבים לבחור לוחם קודם',
  'Teams mode needs at least two teams': 'מצב קבוצות דורש לפחות שתי קבוצות',
  'Multiplayer is coming soon': 'רב-משתתפים בקרוב',

  // --- How to Play ---
  Move: 'תנועה',
  'Left joystick — up/down also shifts depth on the floor.':
    'ג׳ויסטיק שמאלי — מעלה/מטה גם מזיז לעומק הרצפה.',
  'Light melee combo. Chain them and back off.': 'קומבו קרבי קל. שרשר אותם ותיסוג.',
  '▲ Jump': '▲ קפיצה',
  'Hop over projectiles and juggle airborne foes.': 'קפוץ מעל קליעים ולהטט אויבים באוויר.',
  "Guard to soak hits — you can't move while blocking.":
    'התגונן כדי לספוג מכות — אי אפשר לזוז בזמן חסימה.',
  'SP · Neutral': 'SP · רגיל',
  'Tap SP for your signature move (costs the blue energy bar).':
    'הקש SP למהלך החתימה שלך (עולה מפס האנרגיה הכחול).',
  'SP · Dash': 'SP · דאש',
  'Double-tap forward, then SP — a charging attack.': 'הקש פעמיים קדימה, ואז SP — התקפת הסתערות.',
  'SP · Air': 'SP · אוויר',
  'Press Jump, then SP in the air for a launcher.': 'לחץ קפיצה, ואז SP באוויר לשיגור.',
  Weapons: 'כלי נשק',
  'Stand over an item and press HIT to pick it up. THROW hurls it; each weapon has limited swings.':
    'עמוד מעל חפץ ולחץ מכה כדי להרים. זריקה משליכה אותו; לכל נשק מספר מוגבל של מכות.',
  Keyboard: 'מקלדת',
  'Arrows move · Enter or . hit · / special · Space jump · Right-Shift block · , throw. (Left hand: WASD + J/K/L/T also work.)':
    'חצים לתנועה · Enter או . מכה · / מיוחד · רווח קפיצה · Shift-ימני חסימה · , זריקה. (יד שמאל: WASD + J/K/L/T גם עובדים.)',
  'Got it': 'הבנתי',
};

// Patterns for strings composed with numbers.
const RULES = [
  [/^(\d+) CPU$/, '$1 מחשב'],
  [/^CPU (\d+)$/, 'מחשב $1'],
  [/^(\d+) Hits!$/, '$1 מכות!'],
  [/^Team (\d+)$/, 'קבוצה $1'],
  [/^expires in (\d+)s$/, 'פג בעוד $1ש׳'],
  [/^WAVE (\d+)$/, 'גל $1'],
  [/^STAGE (\d+)$/, 'שלב $1'],
  [/^at (\d+) XP$/, 'ב-$1 XP'],
];

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = l === 'he' ? 'he' : 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }
}

/** Translate a plain string (returns the English source when no translation). */
export function t(en) {
  if (lang !== 'he') return en;
  return HE[norm(en)] ?? en;
}

/** Translate a template like 'KO in {time}s' and substitute {vars}. */
export function tpl(en, vars = {}) {
  let s = lang === 'he' ? HE[norm(en)] ?? en : en;
  for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}

function translateText(raw) {
  const key = norm(raw);
  if (!key) return null;
  if (HE[key] != null) return HE[key];
  for (const [re, rep] of RULES) if (re.test(key)) return key.replace(re, rep);
  return null;
}

function translateNode(node) {
  if (node.nodeType === 3) {
    const tr = translateText(node.nodeValue);
    if (tr != null && tr !== node.nodeValue) node.nodeValue = tr;
    return;
  }
  if (node.nodeType === 1 && node.tagName !== 'CANVAS') {
    for (const child of node.childNodes) translateNode(child);
  }
}

/** Full pass over an existing subtree (used right after a language switch). */
export function retranslate(root) {
  if (lang !== 'he' || !root) return;
  translateNode(root);
}

/** Auto-translate anything the app renders into `root`. */
export function attachTranslator(root) {
  const obs = new MutationObserver((muts) => {
    if (lang !== 'he') return;
    for (const m of muts) for (const n of m.addedNodes) translateNode(n);
  });
  obs.observe(root, { childList: true, subtree: true });
  retranslate(root);
}
