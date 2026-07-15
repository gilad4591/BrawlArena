/**
 * Brawl Arena — WebSocket relay
 * -----------------------------
 * A stateless message router: clients connect with `?room=CODE`, and every
 * message they send is forwarded verbatim to the other peers in the SAME room.
 * There is NO game logic here — the match is simulated host-authoritatively in
 * the client (the room host), and this server only shuttles JSON around.
 *
 * Run:   npm install && npm start
 * Env:   PORT (default 8787)
 *
 * Rooms are created on demand and dropped when the last peer leaves. Empty
 * rooms also expire after ROOM_TTL_MS so abandoned lobbies don't linger.
 */
import { WebSocketServer } from 'ws';
import http from 'node:http';
import { parse } from 'node:url';

const PORT = process.env.PORT || 8787;
const ROOM_TTL_MS = 10 * 60 * 1000; // safety cap on lobby lifetime
const MAX_PEERS_PER_ROOM = 8;

/** roomCode -> Set<WebSocket> */
const rooms = new Map();

function roomOf(code) {
  if (!rooms.has(code)) rooms.set(code, new Set());
  return rooms.get(code);
}

function dropFromRoom(code, ws) {
  const peers = rooms.get(code);
  if (!peers) return;
  peers.delete(ws);
  // Tell survivors that a peer dropped so the host can update the roster.
  broadcast(code, ws, { room: code, type: 'peer-left', id: ws._peerId });
  if (peers.size === 0) rooms.delete(code);
}

function broadcast(code, sender, obj) {
  const peers = rooms.get(code);
  if (!peers) return;
  const data = JSON.stringify(obj);
  for (const peer of peers) {
    if (peer === sender) continue;
    if (peer.readyState === peer.OPEN) {
      try {
        peer.send(data);
      } catch {
        /* ignore a bad socket; it'll be cleaned up on close */
      }
    }
  }
}

// A bare HTTP server so platforms with health checks (Render/Railway/Fly) get
// a 200 on GET / and the WS upgrade still works on the same port. The /health
// and /keep-alive routes are meant for an external uptime pinger (e.g.
// cron-job.org) that keeps a free-tier instance from spinning down.
const httpServer = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === '/health' || path === '/keep-alive') {
    let peers = 0;
    for (const set of rooms.values()) peers += set.size;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, peers, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Brawl Arena relay up');
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const { query } = parse(req.url, true);
  const code = String(query.room || '').trim();
  if (!/^\d{4,8}$/.test(code)) {
    socket.destroy();
    return;
  }
  const peers = roomOf(code);
  if (peers.size >= MAX_PEERS_PER_ROOM) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, code);
  });
});

wss.on('connection', (ws, req, code) => {
  ws._room = code;
  ws._peerId = null;
  ws._bornAt = Date.now();
  roomOf(code).add(ws);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed frames
    }
    // Remember the peer's app-level id (from join/create) so we can announce
    // a clean "peer-left" on disconnect.
    if (msg && msg.player && msg.player.id) ws._peerId = msg.player.id;
    if (msg && msg.from) ws._peerId = ws._peerId || msg.from;
    broadcast(code, ws, msg);
  });

  ws.on('close', () => dropFromRoom(code, ws));
  ws.on('error', () => dropFromRoom(code, ws));
});

// Reap stale rooms / sockets.
setInterval(() => {
  const now = Date.now();
  for (const [code, peers] of rooms) {
    for (const ws of peers) {
      if (now - ws._bornAt > ROOM_TTL_MS) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        peers.delete(ws);
      }
    }
    if (peers.size === 0) rooms.delete(code);
  }
}, 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`Brawl Arena relay listening on :${PORT}`);
});
