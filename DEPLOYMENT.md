# Server Deployment — Vercel

Step-by-step checklist for deploying the Express API to Vercel as a standalone project.

---

## 1. MongoDB Atlas

| Step | Detail |
|------|--------|
| Create a cluster | Free M0 tier is fine for a portfolio; choose a region close to your Vercel deployment region |
| Create a database user | Give it **readWrite** on the portfolio database; save the password |
| Network access | Add `0.0.0.0/0` (allow all) — Vercel functions do not have fixed egress IPs |
| Connection string | Use the **SRV** format: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority` |

---

## 2. Vercel Project Setup

1. **Import repository** — In the Vercel dashboard, import the GitHub repo.
2. **Root directory** — Set to `server` (not the monorepo root).
3. **Framework preset** — Select **Other**.
4. **Build command** — Leave blank (auto-detected from `vercel.json`; `@vercel/node` compiles TypeScript without a separate build step).
5. **Output directory** — Leave blank.
6. **Install command** — Leave as the default (`pnpm install`) or set to `pnpm install --frozen-lockfile`.
7. **Node.js version** — Set to **22.x** in Project Settings → General.

---

## 3. Environment Variables

Set all of the following in **Project Settings → Environment Variables**. Apply to **Production** (and Preview/Development as needed).

### Required

| Variable | Example / Notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/portfolio?retryWrites=true&w=majority` |
| `JWT_ACCESS_SECRET` | 32+ random bytes — generate with `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | 32+ random bytes — **different** from access secret |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `OTP_HMAC_SECRET` | 32+ random bytes |
| `CLIENT_URL` | `https://www.hammadsadi.com` — the frontend origin (no trailing slash) |
| `SERVER_URL` | `https://api.hammadsadi.com` — this Vercel project's public URL (no trailing slash) |
| `CRON_SECRET` | 32+ random bytes — Vercel uses this as `Authorization: Bearer {value}` on cron requests |
| `ADMIN_SEED_EMAIL` | `admin@hammadsadi.com` |
| `ADMIN_SEED_PASSWORD` | Strong password, 12+ chars |

### Optional (disable features when omitted)

| Variable | Notes |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Required for Google OAuth — see §5 |
| `GOOGLE_CLIENT_SECRET` | Required for Google OAuth |
| `GITHUB_CLIENT_ID` | Required for GitHub OAuth — see §5 |
| `GITHUB_CLIENT_SECRET` | Required for GitHub OAuth |
| `CLOUDINARY_CLOUD_NAME` | Required for image upload |
| `CLOUDINARY_API_KEY` | Required for image upload |
| `CLOUDINARY_API_SECRET` | Required for image upload |
| `SMTP_HOST` | e.g. `smtp.gmail.com` — required for transactional email |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your SMTP username / Gmail address |
| `SMTP_PASS` | App password (not your account password) |

> **Generating secrets**: `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 4. Custom Domain

1. In Vercel Project Settings → Domains, add `api.hammadsadi.com` (or your chosen subdomain).
2. Add a CNAME record at your DNS provider: `api` → `cname.vercel-dns.com`.
3. After DNS propagates, update `SERVER_URL` to `https://api.hammadsadi.com`.
4. If your frontend proxies `/api/*` to this service, also update `CLIENT_URL` and your proxy config.

---

## 5. OAuth Redirect URIs

The OAuth callback URL is derived from `SERVER_URL`:

```
Google:  {SERVER_URL}/api/v1/auth/google/callback
GitHub:  {SERVER_URL}/api/v1/auth/github/callback
```

### Proxy-compatible setup (recommended)

Since the client proxies all `/api/*` requests, OAuth also works through the proxy if you register the **CLIENT_URL** as the callback base:

```
Google:  {CLIENT_URL}/api/v1/auth/google/callback
GitHub:  {CLIENT_URL}/api/v1/auth/github/callback
```

Then set `SERVER_URL = CLIENT_URL` in the Vercel env, so the OAuth library generates a callback URL that the browser can reach via the proxy.

This keeps all cookies `sameSite: lax` (the default), which is more secure than `sameSite: none`.

### Direct API setup (alternative)

If the frontend doesn't proxy OAuth routes, register callbacks using `SERVER_URL`. The auth library generates the correct URL automatically; no code change is needed.

#### Google Cloud Console

1. Go to **APIs & Services → Credentials**.
2. Edit your OAuth 2.0 Client ID.
3. Under **Authorized redirect URIs**, add the callback URL.

#### GitHub Developer Settings

1. Go to **Settings → Developer settings → OAuth Apps**.
2. Edit your app.
3. Set **Authorization callback URL** to the callback URL.

---

## 6. Run the Seed Script

After the first successful deployment, seed the database with the admin user and default site settings:

```bash
# From the server/ directory, pointing at the production database
MONGODB_URI=<production-uri> \
ADMIN_SEED_EMAIL=admin@hammadsadi.com \
ADMIN_SEED_PASSWORD=<your-password> \
NODE_ENV=production \
pnpm seed
```

Or use a one-time Vercel CLI invocation:

```bash
cd server
vercel env pull .env.production.local   # pulls production env vars locally
pnpm --env-file=.env.production.local seed
```

---

## 7. Cron Job

`vercel.json` defines one Vercel Cron Job:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/v1/internal/cron/trending` | Hourly (`0 * * * *`) | Recomputes trending scores for published posts |

Vercel automatically passes `Authorization: Bearer {CRON_SECRET}` on every cron invocation. The `CRON_SECRET` env var **must** be set.

To manually publish scheduled posts:

```bash
curl -X POST https://api.hammadsadi.com/api/v1/internal/cron/publish-scheduled \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 8. Post-Deploy Smoke Tests

Run these in order after every production deployment.

### Health check
```bash
curl https://api.hammadsadi.com/api/v1/health
# → {"success":true,"message":"Hammad Sadi Portfolio API is running","env":"production"}
```

### Register + OTP verify
```bash
# Register a test account
curl -X POST https://api.hammadsadi.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke@example.com","password":"Password1!"}'
# → 201 "Registration successful..."

# (Check email for OTP, then verify)
curl -X POST https://api.hammadsadi.com/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@example.com","otp":"<OTP from email>"}'
# → 200 with Set-Cookie (accessToken, refreshToken)
```

### Login
```bash
curl -X POST https://api.hammadsadi.com/api/v1/auth/login \
  -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hammadsadi.com","password":"<ADMIN_SEED_PASSWORD>"}'
# → 200 with Set-Cookie
```

### Create post (admin)
```bash
curl -X POST https://api.hammadsadi.com/api/v1/posts/admin \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title":"Smoke test post","slug":"smoke-test-post","excerpt":"Testing.","content":"# Hello\nWorld","status":"published","publishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
# → 201
```

### Follow + feed
```bash
# Follow the admin user (replace <userId> with the admin's _id from the seed)
curl -X POST https://api.hammadsadi.com/api/v1/users/<userId>/follow \
  -b cookies.txt
# → 200 isFollowing: true

# Check the following feed
curl https://api.hammadsadi.com/api/v1/feed/following \
  -b cookies.txt
# → 200 with posts array
```

### Contact message
```bash
curl -X POST https://api.hammadsadi.com/api/v1/contacts \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke@example.com","subject":"Hello","message":"Testing the contact form from post-deploy smoke test."}'
# → 201
```

### Cron endpoint (verify CRON_SECRET protection)
```bash
# Without secret — must return 401
curl https://api.hammadsadi.com/api/v1/internal/cron/trending
# → 401

# With secret — must return 200
curl https://api.hammadsadi.com/api/v1/internal/cron/trending \
  -H "Authorization: Bearer $CRON_SECRET"
# → 200 {"data":{"count":<n>}}
```

---

## 9. Counter Reconciliation

If counters drift (followerCount, likeCount, commentCount, viewCount), run from your local machine pointing at the production database:

```bash
MONGODB_URI=<production-uri> NODE_ENV=production pnpm reconcile-counters
```
