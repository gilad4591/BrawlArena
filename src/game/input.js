/** Shared control surface read by both human input and the CPU AI. */
export class Controller {
  constructor() {
    this.state = { dirX: 0, dirZ: 0, defend: false };
    this._queued = { jump: false, attack: false, special: false, throw: false };
  }

  press(action) {
    if (action in this._queued) this._queued[action] = true;
  }

  consume(action) {
    const v = this._queued[action];
    this._queued[action] = false;
    return v;
  }

  reset() {
    this.state.dirX = 0;
    this.state.dirZ = 0;
    this.state.defend = false;
    this._queued.jump = false;
    this._queued.attack = false;
    this._queued.special = false;
    this._queued.throw = false;
  }
}

/**
 * Wires touch controls (virtual joystick + action buttons) and keyboard to a
 * Controller. Returns a cleanup function that removes every listener.
 */
export function bindHumanControls(controller, root, { haptics } = {}) {
  const cleanups = [];
  const add = (el, ev, fn, opts) => {
    if (!el) return;
    el.addEventListener(ev, fn, opts);
    cleanups.push(() => el.removeEventListener(ev, fn, opts));
  };

  // ---- Virtual joystick ----
  const joy = root.querySelector('#joystick');
  const knob = root.querySelector('#joystick-knob');
  let joyId = null;
  let joyCenter = { x: 0, y: 0 };
  const RADIUS = 52;
  const DEAD = 0.28;

  const setKnob = (dx, dy) => {
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const updateJoy = (clientX, clientY) => {
    let dx = clientX - joyCenter.x;
    let dy = clientY - joyCenter.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, RADIUS);
    dx = (dx / dist) * clamped;
    dy = (dy / dist) * clamped;
    setKnob(dx, dy);
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    controller.state.dirX = Math.abs(nx) > DEAD ? Math.sign(nx) : 0;
    controller.state.dirZ = Math.abs(ny) > DEAD ? Math.sign(ny) : 0; // up = -1 (back)
  };

  add(joy, 'pointerdown', (e) => {
    joyId = e.pointerId;
    const rect = joy.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joy.setPointerCapture?.(e.pointerId);
    updateJoy(e.clientX, e.clientY);
    e.preventDefault();
  });
  add(joy, 'pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    updateJoy(e.clientX, e.clientY);
    e.preventDefault();
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    controller.state.dirX = 0;
    controller.state.dirZ = 0;
    setKnob(0, 0);
  };
  add(joy, 'pointerup', endJoy);
  add(joy, 'pointercancel', endJoy);

  // ---- Action buttons ----
  root.querySelectorAll('[data-btn]').forEach((btn) => {
    const action = btn.dataset.btn;
    const down = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      if (action === 'defend') {
        controller.state.defend = true;
      } else {
        controller.press(action);
      }
      haptics?.tap();
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      if (action === 'defend') controller.state.defend = false;
    };
    add(btn, 'pointerdown', down);
    add(btn, 'pointerup', up);
    add(btn, 'pointercancel', up);
    add(btn, 'pointerleave', up);
  });

  // ---- Keyboard (desktop) ----
  // Layout: ARROWS move · W jump · A attack · S special · D defend (held).
  // A few extra aliases are kept for comfort (Space jump, J hit, K special, Shift block).
  const keys = {};
  const applyKeys = () => {
    let dx = 0;
    let dz = 0;
    if (keys.ArrowLeft) dx -= 1;
    if (keys.ArrowRight) dx += 1;
    if (keys.ArrowUp) dz -= 1;
    if (keys.ArrowDown) dz += 1;
    controller.state.dirX = dx;
    controller.state.dirZ = dz;
    controller.state.defend = !!(keys.KeyD || keys.ShiftLeft || keys.ShiftRight);
  };
  const gameKeys = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight',
    'KeyJ', 'Enter', 'Numpad0', 'Period',
    'KeyK', 'Slash', 'NumpadDecimal',
    'Space', 'KeyL', 'NumpadEnter',
    'KeyT', 'Comma',
  ]);
  const onKeyDown = (e) => {
    if (gameKeys.has(e.code)) e.preventDefault(); // stop page scroll on Space/arrows
    if (e.repeat) {
      applyKeys();
      return;
    }
    keys[e.code] = true;
    // Web layout: Arrows steer while W/A/S/D act (D is held for block).
    const attackKeys = ['KeyA', 'KeyJ', 'Enter', 'Numpad0', 'Period'];
    const specialKeys = ['KeyS', 'KeyK', 'Slash', 'NumpadDecimal'];
    const jumpKeys = ['KeyW', 'Space', 'KeyL', 'NumpadEnter'];
    const throwKeys = ['KeyT', 'Comma'];
    if (attackKeys.includes(e.code)) controller.press('attack');
    if (specialKeys.includes(e.code)) controller.press('special');
    if (throwKeys.includes(e.code)) controller.press('throw');
    if (jumpKeys.includes(e.code)) controller.press('jump');
    applyKeys();
  };
  const onKeyUp = (e) => {
    if (gameKeys.has(e.code)) e.preventDefault();
    keys[e.code] = false;
    applyKeys();
  };
  add(window, 'keydown', onKeyDown, { passive: false });
  add(window, 'keyup', onKeyUp, { passive: false });

  return () => cleanups.forEach((fn) => fn());
}
