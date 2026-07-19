/**
 * MultiplayerService
 * -------------------
 * Invitation-based lobby layer for Brawl Arena.
 *
 * A match is created by a HOST, which produces a random 6-digit invite code
 * with a short expiry (default 90s). Other players JOIN using that code.
 *
 * Networking is abstracted behind a `transport` so the same lobby/game code
 * works regardless of backend. The bundled default transport is
 * `BroadcastChannelTransport`, which signals between tabs/windows on the SAME
 * device (great for local testing of the full invite flow). To go truly
 * cross-device, drop in a `WebSocketTransport` (skeleton at the bottom of this
 * file) pointed at a small relay server — no changes to the game are required.
 */

const CODE_LENGTH = 6;
const DEFAULT_EXPIRY_MS = 90 * 1000; // fast-expiring invite
const JOIN_TIMEOUT_MS = 12000; // guest wait budget (covers free-tier cold starts)

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

function makePlayerId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

class Emitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.warn(`[mp] listener error for ${event}`, err);
      }
    });
  }
}

/**
 * BroadcastChannelTransport
 * Signals over a shared BroadcastChannel keyed by room code. Works between
 * tabs/windows on one device. Every message is tagged with the room code so
 * multiple lobbies can coexist.
 */
class BroadcastChannelTransport {
  constructor() {
    this.channel = null;
    this.onMessage = null;
    this.available = typeof BroadcastChannel !== 'undefined';
  }

  connect(code, onMessage, hooks = {}) {
    this.onMessage = onMessage;
    if (!this.available) return;
    this.channel = new BroadcastChannel(`brawl-room-${code}`);
    this.channel.onmessage = (e) => this.onMessage?.(e.data);
    // Same-device channel is ready immediately.
    Promise.resolve().then(() => hooks.onOpen?.());
  }

  warmup() { /* nothing to wake for a local channel */ }

  send(msg) {
    this.channel?.postMessage(msg);
  }

  disconnect() {
    try {
      this.channel?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
  }
}

/**
 * Pick a transport automatically: if a relay URL is configured (build-time
 * VITE_MP_RELAY_URL or a global window.__MP_RELAY_URL), use real cross-device
 * WebSockets; otherwise fall back to same-device BroadcastChannel so local
 * testing still works with zero setup.
 */
export function defaultTransport() {
  let url;
  try {
    url = import.meta.env?.VITE_MP_RELAY_URL;
  } catch {
    /* not a Vite context */
  }
  if (!url && typeof window !== 'undefined') url = window.__MP_RELAY_URL;
  if (url) return new WebSocketTransport(url);
  return new BroadcastChannelTransport();
}

export class MultiplayerService extends Emitter {
  constructor(transport) {
    super();
    this.transport = transport || defaultTransport();
    this.online = this.transport instanceof WebSocketTransport;
    this.playerId = makePlayerId();
    this.reset();
  }

  reset() {
    this.room = null; // { code, expiresAt }
    this.isHost = false;
    this.players = []; // [{ id, name, character, ready, team, isHost }]
    this.self = null;
    this._expiryTimer = null;
    this._detach = null;
    this._joinResolve = null; // set while a guest waits for the host's ack
  }

  get connected() {
    return !!this.room;
  }

  /** Wake a sleeping relay ahead of create/join (no-op for local transport). */
  warmup() {
    this.transport.warmup?.();
  }

  get expiresInMs() {
    if (!this.room) return 0;
    return Math.max(0, this.room.expiresAt - Date.now());
  }

  /** Host creates a room and returns the invite code. */
  createRoom({ name = 'Host', character = 'blaze', expiryMs = DEFAULT_EXPIRY_MS } = {}) {
    this.leave();
    const code = generateCode();
    this.isHost = true;
    this.room = { code, expiresAt: Date.now() + expiryMs };
    this.self = {
      id: this.playerId,
      name,
      character,
      ready: false,
      team: 0,
      isHost: true,
    };
    this.players = [this.self];
    this._attach(code);
    this._armExpiry();
    this.emit('players', this.players.slice());
    this.emit('room', { ...this.room });
    return code;
  }

  /**
   * Guest joins an existing room by code. Resolves only once the HOST answers
   * with a roster; if nobody answers within JOIN_TIMEOUT_MS the room is torn
   * down and the promise REJECTS. This is what makes a wrong/expired code fail
   * with an error instead of silently spinning up a phantom lobby.
   */
  joinRoom(code, { name = 'Guest', character = 'frost' } = {}) {
    const clean = String(code).trim();
    if (!/^\d{6}$/.test(clean)) {
      return Promise.reject(new Error('Invite code must be 6 digits'));
    }
    this.leave();
    this.isHost = false;
    this.room = { code: clean, expiresAt: Date.now() + DEFAULT_EXPIRY_MS };
    this.self = {
      id: this.playerId,
      name,
      character,
      ready: false,
      team: 1,
      isHost: false,
    };
    this.players = [];
    this._armExpiry();

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._joinResolve = null;
        fn();
      };
      const timer = setTimeout(() => {
        finish(() => {
          this.leave(); // discard the optimistic room — no host answered
          reject(new Error('Room not found — check the code or ask for a new one'));
        });
      }, JOIN_TIMEOUT_MS);
      // Resolved from _onMessage when the host's roster (our ack) arrives.
      this._joinResolve = () => finish(() => resolve(clean));
      // Connect with lifecycle hooks: announce ourselves once the socket is
      // open (covers a cold relay), and fail fast if the connection drops.
      this._attach(clean, {
        onOpen: () => this._broadcast({ type: 'join', player: this.self }),
        onError: () => {},
        onClose: () => finish(() => {
          this.leave();
          reject(new Error('Could not reach the server — check your connection and try again'));
        }),
      });
    });
  }

  toggleReady() {
    if (!this.self) return;
    this.self.ready = !this.self.ready;
    this._syncSelf();
  }

  setCharacter(character) {
    if (!this.self) return;
    this.self.character = character;
    this._syncSelf();
  }

  setTeam(team) {
    if (!this.self) return;
    this.self.team = team;
    this._syncSelf();
  }

  /** Host-only: start the match once everyone is ready. */
  startMatch(config) {
    if (!this.isHost) return;
    this._broadcast({ type: 'start', config });
    this.emit('start', config);
  }

  /** Relay arbitrary in-match state (input/snapshots) to peers. */
  sendState(state) {
    this._broadcast({ type: 'state', from: this.playerId, state });
  }

  leave() {
    if (this.room) {
      this._broadcast({ type: 'leave', id: this.playerId });
    }
    if (this._expiryTimer) clearInterval(this._expiryTimer);
    this._detach?.();
    this.transport.disconnect?.();
    this.reset();
  }

  // --- internals -----------------------------------------------------------

  _attach(code, hooks = {}) {
    this.transport.connect(code, (msg) => this._onMessage(msg), hooks);
    this._detach = () => {
      this.transport.onMessage = null;
    };
  }

  _broadcast(msg) {
    this.transport.send({ room: this.room?.code, ...msg });
  }

  _syncSelf() {
    this.players = this.players.map((p) => (p.id === this.self.id ? { ...this.self } : p));
    if (this.isHost) {
      this._broadcast({ type: 'roster', players: this.players });
    } else {
      this._broadcast({ type: 'update', player: this.self });
    }
    this.emit('players', this.players.slice());
  }

  _armExpiry() {
    if (this._expiryTimer) clearInterval(this._expiryTimer);
    this._expiryTimer = setInterval(() => {
      const left = this.expiresInMs;
      this.emit('tick', left);
      if (left <= 0) {
        clearInterval(this._expiryTimer);
        this._expiryTimer = null;
        this.emit('expired');
        this.leave();
      }
    }, 500);
  }

  _extendExpiry(ms = DEFAULT_EXPIRY_MS) {
    if (this.room) this.room.expiresAt = Date.now() + ms;
  }

  _onMessage(msg) {
    if (!this.room || msg.room !== this.room.code) return;

    switch (msg.type) {
      case 'join': {
        if (msg.player.id === this.playerId) break;
        if (this.isHost) {
          if (!this.players.some((p) => p.id === msg.player.id)) {
            this.players.push({ ...msg.player });
          }
          this._extendExpiry();
          this._broadcast({ type: 'roster', players: this.players });
          this.emit('players', this.players.slice());
        }
        break;
      }
      case 'roster': {
        // Authoritative roster from host — also the ack that confirms our join.
        this.players = msg.players.map((p) => ({ ...p }));
        const mine = this.players.find((p) => p.id === this.playerId);
        if (mine) this.self = mine;
        // Only count it as a valid join if the host actually enrolled us.
        if (mine) this._joinResolve?.();
        this.emit('players', this.players.slice());
        break;
      }
      case 'update': {
        if (this.isHost) {
          this.players = this.players.map((p) =>
            p.id === msg.player.id ? { ...msg.player } : p,
          );
          this._broadcast({ type: 'roster', players: this.players });
          this.emit('players', this.players.slice());
        }
        break;
      }
      case 'leave':
      case 'peer-left': {
        const goneId = msg.id;
        if (!goneId) break;
        this.players = this.players.filter((p) => p.id !== goneId);
        if (this.isHost) this._broadcast({ type: 'roster', players: this.players });
        this.emit('players', this.players.slice());
        this.emit('peerLeft', goneId);
        break;
      }
      case 'start': {
        if (!this.isHost) this.emit('start', msg.config);
        break;
      }
      case 'state': {
        if (msg.from !== this.playerId) this.emit('state', msg.state);
        break;
      }
      default:
        break;
    }
  }
}

/**
 * WebSocketTransport (skeleton)
 * -----------------------------
 * To enable true cross-device play, run a tiny relay server that echoes
 * messages to everyone in the same room, then use this transport:
 *
 *   const mp = new MultiplayerService(new WebSocketTransport('wss://your-host'));
 *
 * The relay only needs to forward JSON messages keyed by `room` — no game
 * logic lives on the server.
 */
export class WebSocketTransport {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.onMessage = null;
    this.queue = [];
  }

  connect(code, onMessage, hooks = {}) {
    this.onMessage = onMessage;
    this.ws = new WebSocket(`${this.url}?room=${code}`);
    this.ws.onopen = () => {
      this.queue.forEach((m) => this.ws.send(JSON.stringify(m)));
      this.queue = [];
      hooks.onOpen?.();
    };
    this.ws.onmessage = (e) => {
      try {
        this.onMessage?.(JSON.parse(e.data));
      } catch {
        /* ignore malformed */
      }
    };
    this.ws.onerror = () => hooks.onError?.();
    this.ws.onclose = () => hooks.onClose?.();
  }

  /** Derive the http(s) origin so we can wake a sleeping free-tier dyno. */
  _httpUrl() {
    try {
      return this.url.replace(/^ws/, 'http').split('?')[0];
    } catch {
      return null;
    }
  }

  /** Best-effort ping to spin up a sleeping relay before the user connects. */
  warmup() {
    const base = this._httpUrl();
    if (!base || typeof fetch === 'undefined') return;
    try {
      fetch(`${base.replace(/\/$/, '')}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  disconnect() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}
