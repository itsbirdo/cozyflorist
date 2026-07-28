# Agent runbook — deploy Guild HQ to this VPS

You are an autonomous agent with shell access to a VPS that **already runs other
workloads** ("openclaw", and the bottleshops CRM with its Caddy reverse proxy).
Your job is to stand up Guild HQ *alongside* them, without disturbing anything.
Follow the steps in order. After each step there is a **Verify** block — do not
continue until it passes. When something is ambiguous or requires a
secret/decision, **ask the operator**; never guess.

---

## 0. What you are deploying

One tiny process behind the box's existing Caddy. Only Caddy is reachable from
the internet:

```
Internet ──443──▶ Caddy (shared, HTTPS) ──▶ 127.0.0.1:8321  node server.js (systemd)
                                                   └─ JSON file store at /var/lib/guildhq
```

- **server.js** — zero-dependency Node server (static frontend + JSON API).
  No npm install, no build step, no database. Idles at a few tens of MB.
- **Auth is built in**: two passwords set via environment — admin (full edit)
  and viewer (read-only). There is no Caddy basic-auth layer for this app.
- **Data** is one JSON file with automatic daily backups, kept in
  `/var/lib/guildhq` — deliberately *outside* the git checkout.

Repo (private): `git@github.com:itsbirdo/cozyflorist.git`. Install target: `/opt/guildhq`.
The app lives in the repo's `app/` subdirectory.

> A Dockerfile/compose file exists in `app/` but this runbook uses systemd —
> lighter on this shared box. Do not run both.

---

## HARD RULES (do not violate)

1. **Do not touch the other workloads.** Never stop, reconfigure, or delete
   openclaw or the bottleshops CRM, their services, containers, or data. You
   only *add* one service and one Caddy site block.
2. **Caddy is shared.** `/etc/caddy/Caddyfile` already serves other sites.
   **Append** the Guild HQ site block; never overwrite or truncate that file.
   Back it up first (§6).
3. **Guild HQ stays on localhost.** `HOST=127.0.0.1`, port `8321`. Caddy is the
   sole public listener.
4. **Secrets never enter git and are never printed in full.** The two passwords
   go in `/etc/guildhq.env` (root:root, 600). Do not echo them to logs; report
   them to the operator only over a secure channel — or better, let the
   operator supply them.
5. **The two passwords must differ** — the server refuses to start otherwise.
6. **Data is sacred.** `/var/lib/guildhq/guild.json` is the guild's single
   source of truth. Never delete or overwrite it once live; the server keeps
   14 daily backups next to it in `backups/`. Confirm with the operator before
   anything irreversible (`git reset --hard` is fine — data is outside the
   checkout — but anything under `/var/lib/guildhq` is not yours to remove).
7. **No firewall changes should be needed.** 80/443 are already open for the
   existing Caddy. If you believe a change is required, stop and ask — and
   never enable ufw without an SSH allow rule already in place.

---

## 1. Collect these inputs from the operator (blocking — get them first)

| # | Input | Notes |
|---|-------|-------|
| 1 | **Repo read access** | A GitHub *deploy key* for `cozyflorist`, or confirmation the box can already clone it (§3). The alccrm deploy key does NOT grant access to this repo. |
| 2 | **The two passwords** | `ADMIN_PASSWORD` (guild leadership, full edit) and `VIEWER_PASSWORD` (guildies, read-only). Must differ. Operator supplies them, or you generate (`openssl rand -base64 18` each) and return them securely. |
| 3 | **Public hostname** | A DuckDNS/domain name pointed at this VPS (shares port 443 with the other sites via SNI). Raw IP only works if no other site claims the bare IP. |
| 4 | **Initial data** | Fresh start, or a `guild-backup-*.json` exported from the app (Settings → Export). If provided, it's installed *before* first start (§5) — the server migrates old formats automatically. |

---

## 2. Preflight (run all; record outputs; stop and report if any red)

```bash
uname -a; head -2 /etc/os-release
node --version                                   # need ≥ 18 for the server (≥ 20 to run the repo's tests)
free -h; df -h /                                  # app is tiny; just confirm the box isn't already starved
sudo ss -tlnp | grep -E ':8321\b' || echo "port 8321 free"
systemctl is-active caddy                         # expected: active (installed for the CRM)
sudo ss -tlnp | grep -E ':(80|443)\b'             # expected: caddy on both
```

**Verify / decide:**
- If `node` is missing or < 18, install Node 22 LTS via NodeSource
  (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs`)
  — **confirm with the operator first**, since it affects the whole box.
- If port 8321 is taken, stop and ask (do not move the other workload).
- If Caddy is *not* running, this runbook's §6 still works but you must also
  install Caddy first — see the bottleshops runbook's Caddy section, and ask
  the operator why it's absent.

---

## 3. Get the code

Try cloning first; only set up a deploy key if it fails.

```bash
sudo mkdir -p /opt/guildhq
sudo chown "$USER": /opt/guildhq
git clone git@github.com:itsbirdo/cozyflorist.git /opt/guildhq
```

**If it fails with a permission error**, create a read-only deploy key and give
the public half to the operator to add on GitHub (repo → Settings → Deploy keys):

```bash
ssh-keygen -t ed25519 -C "vps-deploy-cozyflorist" -f ~/.ssh/cozyflorist_deploy -N ''
cat ~/.ssh/cozyflorist_deploy.pub     # ← send this line to the operator; wait for confirmation
cat >> ~/.ssh/config <<'EOF'
Host github-cozyflorist
  HostName github.com
  User git
  IdentityFile ~/.ssh/cozyflorist_deploy
  IdentitiesOnly yes
EOF
git clone git@github-cozyflorist:itsbirdo/cozyflorist.git /opt/guildhq
```

**Verify:** `test -f /opt/guildhq/app/server.js && echo OK`

---

## 4. Place the secrets (from the operator — never invent silently)

```bash
sudo cp /opt/guildhq/app/deploy/guildhq.env.example /etc/guildhq.env
sudo chmod 600 /etc/guildhq.env && sudo chown root:root /etc/guildhq.env
sudoedit /etc/guildhq.env    # fill ADMIN_PASSWORD and VIEWER_PASSWORD (must differ)
```

**Verify (without printing values):**
```bash
sudo grep -c '^ADMIN_PASSWORD=..*' /etc/guildhq.env    # -> 1
sudo grep -c '^VIEWER_PASSWORD=..*' /etc/guildhq.env   # -> 1
sudo grep -q 'REPLACE_WITH' /etc/guildhq.env && echo "STILL PLACEHOLDERS — fix" || echo OK
```

---

## 5. Service user, data dir, initial data

```bash
sudo useradd --system --home /opt/guildhq --shell /usr/sbin/nologin guildhq || true
sudo chown -R guildhq:guildhq /opt/guildhq
```

`/var/lib/guildhq` is created automatically by systemd (`StateDirectory`) on
first start. **If the operator supplied a data export (input #4)**, install it
*before* enabling the service:

```bash
sudo mkdir -p /var/lib/guildhq
sudo cp /path/to/guild-backup-YYYY-MM-DD.json /var/lib/guildhq/guild.json
sudo chown -R guildhq:guildhq /var/lib/guildhq
sudo chmod 600 /var/lib/guildhq/guild.json
```

**Verify:** `sudo -u guildhq python3 -c "import json;json.load(open('/var/lib/guildhq/guild.json'))" && echo "valid JSON"`
(skip if fresh start)

---

## 6. Run it: systemd + the shared Caddy

```bash
sudo cp /opt/guildhq/app/deploy/guildhq.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now guildhq
```

**Verify:**
```bash
systemctl is-active guildhq                          # -> active
curl -fsS localhost:8321/ | grep -qi 'guild hq' && echo OK
curl -s -o /dev/null -w '%{http_code}\n' localhost:8321/api/data   # -> 401 (auth working)
```
If it fails: `journalctl -u guildhq -n 50 --no-pager` (most common: placeholder
or identical passwords in `/etc/guildhq.env`).

Then the Caddy site block — **append, never replace** (hard rule 2):

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%s)
# Edit the hostname in the snippet first (input #3), then:
sudo tee -a /etc/caddy/Caddyfile < /opt/guildhq/app/deploy/Caddyfile.snippet
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Verify:**
```bash
sudo caddy validate --config /etc/caddy/Caddyfile     # no errors
journalctl -u caddy -n 30 --no-pager                  # cert obtained for the new host
curl -fsS https://<host>/ | grep -qi 'guild hq' && echo OK
```

---

## 7. Acceptance checklist (all must pass)

- [ ] `systemctl is-active guildhq` → active; **openclaw and bottleshops still running & untouched**.
- [ ] `https://<host>/` loads the Guild HQ login page with a valid certificate.
- [ ] Admin password logs in with an "Admin" badge and can edit (e.g. open Settings — Save button present).
- [ ] Viewer password logs in read-only (no edit buttons anywhere).
- [ ] A wrong password is rejected; repeated failures rate-limit (429 after ~20 tries — don't exhaust this on purpose during testing).
- [ ] From *outside* the box, `curl http://<public-ip>:8321` **fails/times out** (not exposed).
- [ ] After the first admin edit, `/var/lib/guildhq/backups/` gains a dated backup file.
- [ ] The other sites Caddy serves still respond (spot-check the CRM URL).
- [ ] Report the final URL to the operator; send the passwords over a secure channel, never in logs.

---

## 8. Redeploy & rollback (after code changes)

Code updates arrive as commits on `main` (CI runs the test suite on every push
— check it's green before deploying: `gh run list -R itsbirdo/cozyflorist -L 1`).

```bash
cd /opt/guildhq && git pull --ff-only && sudo systemctl restart guildhq
systemctl is-active guildhq && curl -fsS localhost:8321/ >/dev/null && echo OK
```

- Frontend-only changes are live on the next browser refresh; the restart is instant and harmless.
- `guildhq.service` changed → `sudo cp app/deploy/guildhq.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart guildhq`
- Caddy snippet changed → update Guild HQ's block inside `/etc/caddy/Caddyfile` (leave the other sites alone), `sudo caddy validate`, `sudo systemctl reload caddy`
- Roll back (data is untouched by this — it lives in `/var/lib/guildhq`):
  `cd /opt/guildhq && git reset --hard <old-sha> && sudo systemctl restart guildhq`

The operator may also run `VPS=user@host ./app/deploy/push.sh` from their laptop,
which does push → pull → restart in one step.

---

## 9. Troubleshooting quick map

| Symptom | Check | Likely fix |
|---|---|---|
| Service exits immediately | `journalctl -u guildhq -n 50` | Placeholder/missing/identical passwords in `/etc/guildhq.env` |
| Login accepted but doesn't stick | browser keeps returning to login | `COOKIE_SECURE=true` while testing over plain http — test via the https URL, or set false temporarily |
| 502 from Caddy | `systemctl is-active guildhq`; `curl localhost:8321` | Service down, or wrong port in the site block |
| Cert not issued for new host | `journalctl -u caddy -n 50` | DNS for the hostname doesn't point at this VPS yet |
| Writes fail / "Failed to persist" | `journalctl -u guildhq`; `ls -la /var/lib/guildhq` | Ownership — `sudo chown -R guildhq:guildhq /var/lib/guildhq` |
| Other sites broke after Caddy edit | `sudo caddy validate` | You replaced instead of appended — restore `/etc/caddy/Caddyfile.bak.*`, re-append |
