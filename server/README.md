# Brawl Arena — Multiplayer Relay

A tiny stateless WebSocket relay. Clients connect with `?room=CODE` and every
message is forwarded to the other peers in the same room. No game logic lives
here — the match is simulated host-authoritatively in the room host's browser.

## Run locally

```bash
cd server
npm install
npm start           # listens on :8787 (override with PORT)
```

Then point the web client at it (in `brawl-arena/.env`):

```
VITE_MP_RELAY_URL=ws://localhost:8787
```

Rebuild / restart the Vite dev server so the env var is picked up. Open the game
in two browsers/devices, Create a room in one, Join with the code in the other.

## Deploy (pick one — all have free tiers)

The relay is a plain Node process that listens on `process.env.PORT`, so any
container/Node host works.

### Render.com
1. New → **Web Service**, connect the repo (or "Deploy from public Git URL").
2. Root directory: `brawl-arena/server`
3. Build command: `npm install`  ·  Start command: `npm start`
4. After it deploys you get `https://<name>.onrender.com`.
5. Client env: `VITE_MP_RELAY_URL=wss://<name>.onrender.com`  (note `wss`).

### Railway.app
1. New Project → Deploy from repo, set the service root to `brawl-arena/server`.
2. Railway auto-runs `npm install` + `npm start` and assigns a public domain.
3. Client env: `VITE_MP_RELAY_URL=wss://<name>.up.railway.app`.

### Fly.io
```bash
cd server
fly launch --no-deploy       # generates fly.toml; keep internal_port = 8787 via PORT
fly deploy
```
Client env: `VITE_MP_RELAY_URL=wss://<app>.fly.dev`.

## Keep it warm on a free tier (cron-job.org)

Free instances spin down after ~15 min idle (30–60s cold start on the next
connect). Avoid that by pinging the health route on a schedule — same trick as
the nutrition-tracker service:

1. Deploy, then note the URL, e.g. `https://brawl-relay.onrender.com`.
2. On https://console.cron-job.org add a job hitting
   `https://brawl-relay.onrender.com/health` every **10 minutes** (method GET).
3. `/health` and `/keep-alive` both return `200 {ok:true,...}` — either works.

With the pinger running the relay stays awake 24/7, so the 90s invite window is
never eaten by a cold start.

## Notes
- Always use **wss://** (TLS) when the game is served over https, or browsers
  block the connection as mixed content.
- The relay caps rooms at 8 peers and reaps idle rooms after 10 minutes.
- Scaling: for more concurrent rooms than one instance handles, run multiple
  instances behind a sticky-session load balancer (peers in a room must land on
  the same instance) or add Redis pub/sub between instances.
