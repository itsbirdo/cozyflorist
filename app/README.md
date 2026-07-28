# Guild HQ — The Cozy Florist guild tracker

A private, mobile-first web app for running a guild's weekly competition in
*The Cozy Florist* (RiftSky Games). Single source of truth for guild leadership:
dashboard, member roster, flower catalogue, weekly results, and competitor history.

**Zero dependencies.** One Node.js file serves the API and the frontend; data lives
in one JSON file with atomic writes and automatic daily backups. No npm install,
no database server, no build step.

## Requirements

- Node.js 18 or newer (`node --version`)

## Quick start (local)

```sh
cd app
cp config.example.json config.json   # then edit the two passwords
node server.js
# → http://localhost:8321
```

Log in with the **admin password** (full editing) or the **viewer password** (read-only).

Configuration comes from `config.json` and/or environment variables (env wins):

| Env var / config key | Default | Meaning |
|---|---|---|
| `PORT` / `port` | `8321` | Listen port |
| `ADMIN_PASSWORD` / `adminPassword` | — (required) | Full edit access |
| `VIEWER_PASSWORD` / `viewerPassword` | — (required) | Read-only access |
| `COOKIE_SECURE` / `cookieSecure` | `false` | Set `true` once behind HTTPS |
| `DATA_DIR` | `./data` | Where `guild.json` + backups live |

## Deploy on a VPS

### Option A — plain Node + systemd

```sh
# copy the app folder to the server, e.g.
rsync -a app/ user@vps:/opt/guildhq/
```

`/etc/systemd/system/guildhq.service`:

```ini
[Unit]
Description=Guild HQ (Cozy Florist tracker)
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/guildhq
Environment=ADMIN_PASSWORD=***
Environment=VIEWER_PASSWORD=***
Environment=COOKIE_SECURE=true
ExecStart=/usr/bin/node /opt/guildhq/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now guildhq
```

### Option B — Docker

```sh
cd /opt/guildhq
mkdir -p data && chown 1000:1000 data   # container runs as the "node" user (uid 1000)
printf 'ADMIN_PASSWORD=***\nVIEWER_PASSWORD=***\n' > .env
docker compose up -d --build
```

### HTTPS (recommended — do not skip)

Put a TLS reverse proxy in front and set `COOKIE_SECURE=true`. With
[Caddy](https://caddyserver.com) it's two lines and certificates are automatic:

```
guild.example.com {
    reverse_proxy localhost:8321
}
```

nginx works the same way (`proxy_pass http://127.0.0.1:8321;` plus certbot).
Until HTTPS is on, keep `COOKIE_SECURE=false` or logins won't stick.

## Data, backups, restore

- Everything lives in `data/guild.json` — human-readable, hand-editable
  (stop the server first if you edit it by hand).
- On the first write of each day the server snapshots the previous state to
  `data/backups/guild-YYYY-MM-DD.json` and keeps the last 14.
- Admins can also download a backup anytime from **Settings → Download backup**.
- **Restore**: stop the server, copy a backup over `data/guild.json`, start again.
- Migrating servers = copying the `data/` folder.

## Using the app

- **Home** — guild strength at a glance: members vs capacity, catalogue size,
  breakdown by rarity, and the *max points potential* estimate (badged "est.":
  per member, highest-point owned flower × max multiplier + that flower's bonus,
  × max quests).
- **Summary** — the member flower summary: every member with their top 5
  highest-point flowers, max potential, and the florist rank that potential
  earns; searchable and filterable by flower, with mobile-friendly cards.
- **Members** — sortable/filterable roster with colour-coded roles
  (Leader / Co-Leader / Elder / Elite / Member); tap a member for details, notes,
  week-by-week history, and their flowers — one per line, sortable by rarity,
  points, or bonus, with per-flower bonus points editable inline.
- **Flowers** — the catalogue with rarity (UR / SSR / SR / R / N, colour-coded)
  and points, sorted by points by default; tap a flower to see who owns it
  (and their bonuses).
- **Weeks** — one record per competition (Tue–Sun). Log the rival guilds and
  per-member results (score + quests; optionally itemised quests). Member
  scores tally into the week's our-score automatically, placements are
  auto-ranked from scores, and a colour bar graph compares all guilds.
  CSV export per week.
- **Rivals** — competitor history (top 10 by score, expandable) where each
  guild links to its own detail page: meetings, best/average score, per-week
  notes, and any saved title-count estimate. Plus per-guild estimate cards for
  a chosen week: enter total players and displayed florist titles, get
  min/average/max score estimates; the actual score shows the prediction error.
- **Settings** — guild name, capacity, quest scoring values (base scores,
  max multiplier, bonus range), the potential-estimate inputs, and the florist
  rank point floors behind the Rivals calculator. All editable in-app so a game
  rebalance never requires a code change.

### Passwords & roles

Two passwords, set on the server (never editable in-app, so nobody can lock you
out): **admin** can edit everything; **viewer** sees everything read-only.
Sessions last 30 days. Login attempts are rate-limited.

## Updating the app

Copy the new `server.js` / `public/` over the old ones and restart. The `data/`
folder is untouched; new settings keys are merged in automatically on boot.
