# Tether

A private space for two. Couples companion PWA — shared modules, a private gift vault, optional Groq AI.

Built with Next.js 15, Supabase (Postgres + Auth + Storage + RLS), Tailwind, and Groq for AI.

## Stack & cost

| Layer | Service | Cost |
| --- | --- | --- |
| Hosting | Vercel free tier | $0 |
| DB + Auth + Storage | Supabase free tier | $0 |
| AI | Groq free tier | $0 |
| Maps | (Optional) MapLibre + free tiles | $0 |
| Push | Web Push (built-in) | $0 |

**Total: $0/month** for two users.

## Modules

**Shared (both partners read/write):** Memory Jar, Journal w/ AI prompts, Date Roulette w/ AI, Bucket List, Watchlist (TMDb-backed), Places, Our Songs, Travel pins + AI itineraries, Recipes, Quiz w/ AI, Voice Letters, Year-in-Review w/ AI.

**Personal (own-write, partner-read):** Mood check-in, Love Language tracker, Profile/Preferences (sizes, wishlist).

**Private vault (owner only, PIN-protected):** Gift Vault w/ AI suggestions sourced from partner's *readable* preferences only — vault rows never leave the owner's RLS scope.

## One-time setup

### 1. Supabase

1. Create a free project at https://supabase.com.
2. In the SQL editor, paste & run [`supabase/schema.sql`](supabase/schema.sql). It creates all tables, RLS policies, the auth trigger that creates a profile on signup, and the private `tether-media` storage bucket.
3. (Optional) Settings → Auth → URL Configuration → add your local + prod URLs.
4. Copy these from Settings → API:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` *(server-only; never expose)*

### 2. Groq (optional but recommended)

1. Free key at https://console.groq.com/keys.
2. `GROQ_API_KEY=...`
3. (Optional) `GROQ_MODEL=llama-3.3-70b-versatile` (the default).

AI-powered features degrade gracefully when no key is set — the buttons stay disabled.

### 3. TMDb (optional)

1. Free key at https://www.themoviedb.org/settings/api (request a v3 API key).
2. `TMDB_API_KEY=...`

Adds poster art, year, synopsis and runtime to the Watchlist via a search panel.
Without the key the panel is hidden and titles are added by hand exactly as
before — nothing else changes.

### 4. Env file

```bash
cp .env.example .env.local
# fill in the values
```

### 5. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Pairing flow (you + Maria)

1. **You sign up** at `/signup`.
2. You're redirected to `/pair`. Click **Create**. You'll get a 6-character invite code.
3. **Maria signs up** at `/signup` on her phone.
4. She lands on `/pair`, enters your code in **Join**, and the two of you are linked.
5. Both can now use the app.

## Lost password

There is no in-app password reset, and Supabase's built-in email service does
not reliably deliver to addresses outside the project's org members — so the
dashboard's "send recovery link" will appear to work and never arrive. Set the
password directly instead:

```bash
node scripts/set-password.mjs her@email.com
# prompts for the new password; needs SUPABASE_SERVICE_ROLE_KEY in .env.local
```

A real self-serve reset flow needs custom SMTP configured in Supabase
(Authentication → Emails → SMTP) plus a `/forgot` page and an `/auth/callback`
route to consume the recovery token. None of those exist yet.

## Gift Vault

- First visit: you set a 4–12 char PIN. The PIN is hashed (scrypt) and stored with the profile.
- Subsequent visits: enter PIN to unlock. The unlock lasts 30 minutes via an httpOnly cookie scoped to your user.
- Vault rows are scoped to `owner_id = auth.uid()` at the DB level (RLS). Your partner cannot read them even by hitting the API directly.
- AI gift suggestions are sent to Groq using only your partner's *readable* profile preferences (wishlist, sizes, etc.) — **never** vault contents.

## Deploy to Vercel (free)

```bash
# Push to a GitHub repo first, then:
# 1. Import repo at https://vercel.com/new
# 2. Add the env vars from .env.local in Vercel's project settings
# 3. Deploy
```

After deploy, update Supabase Auth → URL Configuration with your Vercel domain so email auth redirects work, and set `NEXT_PUBLIC_SITE_URL` to your production URL.

## Installing as an app

**iPhone (Safari only):** open the site → Share → Add to Home Screen.

**Android (Chrome):** open the site → menu (⋮) → Install app / Add to Home Screen.

Once installed it behaves like a native app — full screen, on the home screen, no browser chrome.

## File map

```
src/
  app/
    layout.tsx                 root layout + PWA metadata
    globals.css                Tailwind + component classes
    login/, signup/, pair/     auth + couple pairing
    auth/signout/route.ts      signout handler
    (app)/                     authenticated shell (bottom nav, header)
      layout.tsx               requires login + couple
      page.tsx                 home: tiles
      memories/                Memory Jar
      journal/                 Journal w/ AI prompts
      date-roulette/           Date Roulette w/ AI
      bucket-list/             Bucket List
      vault/                   Gift Vault (PIN-protected, owner-only RLS)
      quiz/                    "How well do you know me?"
      mood/                    Mood check-in (own-write, partner-read if shared)
      profile/                 My Preferences
      watchlist/               Movies & shows
      places/                  Restaurants & spots
      songs/                   Our Songs
      travel/                  Pins + AI itineraries
      recipes/                 Recipes + AI from pantry
      voice-letters/           Audio with optional unlock date
      love-language/           Daily log + bar chart
      year/                    Year-in-Review + AI narrative
  lib/
    couple.ts                  getMe / requireMe / requireCoupled
    crypto.ts                  PIN hash + invite codes
    env.ts                     env access
    groq.ts                    Groq client (chat, chatJson, aiEnabled)
    media.ts                   storage path + signed URLs
    vault.ts                   vault unlock cookie
    supabase/{server,client,admin}.ts
  middleware.ts                auth gate
supabase/schema.sql            full DB + RLS + storage bucket
public/
  manifest.webmanifest         PWA manifest
  sw.js                        service worker (offline shell)
  icon.svg                     app icon
```

## Security notes

- All tables have RLS enabled. Access is scoped via the `current_couple_id()` helper (for shared/personal tables) or `owner_id = auth.uid()` (vault).
- Storage uploads are restricted to a per-user prefix (`<user_id>/...`); reads use signed URLs.
- Service-role key is only used server-side to write the vault PIN hash (which RLS would otherwise allow — it's mostly belt-and-braces). It is never exposed to the client.
- The vault unlock cookie is httpOnly, sameSite=lax, secure in production, 30-min max age.

## What's deliberately out of scope (v1)

- Push notifications (table-stakes Web Push is wired up via the service worker; subscription persistence + a sender are a half-day each).
- Spotify OAuth (the songs module accepts URLs; a real linked playlist is a future step).
- True end-to-end encryption for the vault (current setup is server-trusted RLS; client-side encryption would require a custom key UI and a "lose the password, lose the data" UX).
- Real-time updates (Supabase Realtime would be a few lines per module — add when needed).
