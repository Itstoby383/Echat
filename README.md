# Echat

Anonymous one-to-one random text chat with real strangers. Omegle-style in a red theme.

**Next.js + Upstash Redis** — runs on Vercel's free tier.

## How it works

When you start chatting:
1. Your browser gets a unique ID (stored in `sessionStorage`, so it's per-tab)
2. `POST /api/match` puts you in a queue and looks for another waiting user
3. Once matched, you get a `roomId` and start polling `GET /api/poll` every 1.2 seconds
4. `POST /api/send` stores your message; the other person fetches it on their next poll
5. `POST /api/typing` broadcasts a 4-second "typing" flag
6. `POST /api/leave` ends the room and cleans up

**No WebSockets or real-time connections** — Vercel serverless functions can't hold open sockets, so we use Redis as the brain and short-interval polling. Each user polls ~once per second, so watch your Upstash command budget on real traffic.

## Deploy it

### 1. Push to GitHub

```bash
cd echat
git init
git add .
git commit -m "Echat"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/echat.git
git push -u origin main
```

### 2. Create the Redis database

**Option A (easiest):** In Vercel:
- Open your project → **Storage** → **Create Database** → **Upstash Redis**
- Vercel injects the credentials automatically as `KV_REST_API_URL` and `KV_REST_API_TOKEN`

**Option B:** Sign up free at https://console.upstash.com:
- Create a Redis database
- Copy its **REST URL** and **REST token**

### 3. Deploy to Vercel

1. Go to https://vercel.com/new and import your GitHub repo
2. Framework: **Next.js** (auto-detected)
3. **Environment variables** (only if you used Option B above):
   - `UPSTASH_REDIS_REST_URL` = your REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = your REST token
4. Deploy

Done. Your site is live. Share the URL with a friend, open it in two different browsers (or normal + private window), and you'll be matched with each other. Two tabs in the same browser also work.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill in your Redis URL and token
npm run dev
```

Visit http://localhost:3000. Open it in two windows to test real matching.

## Notes

**Moderation:** There is none. If you launch this publicly, add:
- Word filter in `app/api/send/route.js`
- Report button in the chat UI
- Backend ban list

**Cost:** Each online user makes ~1 API call/second. Upstash's free tier is 10k commands/day. With 10 concurrent users, that's gone in ~28 minutes. For production:
- Raise `POLL_MS` in `app/page.js` (e.g., 2000 = 2s between polls)
- Add a Vercel KV Pro plan or Upstash paid plan
- Consider WebSocket-based solutions like Socket.io if you want sub-second latency

**Privacy:** Messages live in Redis for 1 hour, then vanish. No logging, no accounts, no history. The partner's ID is just a random string — not linked to anything.

**Customization:**
- Change the red theme by editing `:root` in `app/globals.css`
- Add interests/tags: create separate queues (e.g., `echat:queue:gaming`, `echat:queue:memes`)
- Add video: extend the room object to carry WebRTC offer/answer/ICE payloads

---

Made with Next.js, Upstash Redis, and Vercel.
