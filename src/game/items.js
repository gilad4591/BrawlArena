/**
 * Ground props / weapons. Fighters walk over an item to pick it up (empty hands
 * only). Melee/throw weapons go to the hand and can be swung a limited number of
 * times or thrown; heal items are consumed instantly.
 */
import { GRAVITY, ARENA_DEPTH } from './constants.js';

/**
 * category:
 *   melee  - swing for bonus melee damage, or throw it
 *   throw  - mainly thrown; can also bonk in melee
 *   heal   - consumed on pickup (hp/mp)
 */
export const ITEM_DEFS = {
  bat: { id: 'bat', name: 'Bat', category: 'melee', glyph: '🏏', color: '#c98a4b', bonus: 8, uses: 5, throwDamage: 16 },
  sword: { id: 'sword', name: 'Sword', category: 'melee', glyph: '🗡️', color: '#cfd6e0', bonus: 14, uses: 5, throwDamage: 22 },
  pipe: { id: 'pipe', name: 'Pipe', category: 'melee', glyph: '🔧', color: '#9aa3c7', bonus: 6, uses: 6, throwDamage: 14 },
  rock: { id: 'rock', name: 'Rock', category: 'throw', glyph: '🪨', color: '#8a8a8a', bonus: 6, uses: 2, throwDamage: 18 },
  crate: { id: 'crate', name: 'Crate', category: 'throw', glyph: '📦', color: '#b0813f', bonus: 5, uses: 1, throwDamage: 16 },
  // Rare, high-power drops — deliberately hit harder than any SPECIAL move.
  battleaxe: { id: 'battleaxe', name: 'Battle Axe', category: 'melee', glyph: '🪓', color: '#e0c98a', bonus: 22, uses: 4, throwDamage: 32, strong: true },
  spear: { id: 'spear', name: 'Spear', category: 'throw', glyph: '🔱', color: '#cfe0ff', bonus: 14, uses: 3, throwDamage: 30, strong: true },
  potion: { id: 'potion', name: 'Potion', category: 'heal', glyph: '🧪', color: '#ff5d7a', healHp: 70 },
  meat: { id: 'meat', name: 'Meat', category: 'heal', glyph: '🍖', color: '#ff9f5a', healMp: 70, healHp: 45 },
  energy: { id: 'energy', name: 'Energy', category: 'heal', glyph: '⚡', color: '#67d6ff', healMp: 70 },
};

// Strong drops are reserved for the timed drop-wave, not the normal floor scatter.
export const STRONG_ITEM_IDS = Object.keys(ITEM_DEFS).filter((id) => ITEM_DEFS[id].strong);
export const ITEM_IDS = Object.keys(ITEM_DEFS).filter((id) => !ITEM_DEFS[id].strong);

/**
 * Timed player power-ups that periodically drop into a fight. They are consumed
 * on pickup and (unlike weapons/props) can only be grabbed by the human player
 * — CPU foes ignore them (`playerOnly`).
 */
export const POWERUP_DEFS = {
  hp: {
    id: 'hp', name: 'Health', category: 'buff', effect: 'hp',
    glyph: '❤️', color: '#ff4d6d', healHp: 90, playerOnly: true, label: '+HP',
  },
  power: {
    id: 'power', name: 'Power', category: 'buff', effect: 'power',
    glyph: '⚔️', color: '#ffab3d', duration: 10, mult: 1.4, playerOnly: true, label: 'POWER!',
  },
  shield: {
    id: 'shield', name: 'Shield', category: 'buff', effect: 'shield',
    glyph: '🛡️', color: '#5fe6ff', duration: 5, playerOnly: true, label: 'INVINCIBLE!',
  },
};

export const POWERUP_IDS = Object.keys(POWERUP_DEFS);

export class Item {
  constructor(def, x, z, y = 0) {
    this.def = def;
    this.x = x;
    this.z = z;
    this.y = y;
    this.vy = 0;
    this.dead = false;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    this.z = Math.max(0, Math.min(ARENA_DEPTH, this.z));
  }

  render(ctx, view) {
    const scale = view.scale(this.z);
    const sx = view.screenX(this.x);
    const groundY = view.floorLine(this.z);
    const bob = Math.sin(this.age * 3) * 3;
    const sy = groundY - this.y * scale - 10 * scale + bob;

    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, groundY, 12 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // soft highlight ring so items are noticeable on the floor
    const isBuff = this.def.category === 'buff';
    const pulse = isBuff ? 1 + Math.sin(this.age * 6) * 0.28 : 1;
    ctx.save();
    const gr = (isBuff ? 26 : 20) * scale * pulse;
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, gr);
    glow.addColorStop(0, this.def.color + 'ee');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, gr, 0, Math.PI * 2);
    ctx.fill();
    if (isBuff) {
      ctx.strokeStyle = this.def.color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, (16 * scale) * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.font = `${Math.round(26 * scale)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.def.glyph, sx, sy);
    ctx.restore();
  }
}
