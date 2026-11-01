# Security policy

## What is public by design

This repository is **public**, and it previously tracked a `.env` file. That file was removed
from tracking in commit `8d66b33`, but it remains reachable in the history of earlier commits.

It contained exactly three values:

| Variable | Status |
|---|---|
| `VITE_SUPABASE_URL` | Public. Inlined into every `dist/` build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public. Inlined into every `dist/` build. |
| `VITE_SUPABASE_PROJECT_ID` | Public, and **unused** — `src/` never reads it. |

None of these are credentials in the sense of granting privileged access. The Supabase
publishable ("anon") key is an identifier: it tells Supabase *which project* is being called, and
it authorises exactly what row-level security authorises for the `anon` role — nothing more.

This is worth being blunt about: **that key is shipped to every visitor in the JavaScript bundle
of the deployed app.** It was never a secret, and treating its appearance in git history as a
breach would be a misreading of how Supabase's client keys work.

## What was never committed

No privileged key has ever been in this repository. I verified this rather than assuming it:

```bash
# working tree
grep -rIl -E "service_role|SERVICE_ROLE|sb_secret" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .

# full history, every commit and every branch
git log --all -p | grep -E "service_role"
```

Every hit in both is a **documentation placeholder**, not a value:

- `supabase/README.md:79` — `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here`
- `.env.example:6` — `# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`

A `service_role` key bypasses row-level security entirely. If one ever does reach this repository,
treat it as an incident rather than a chore — see *Reporting* below.

## Why rotating the anon key is not a fix

Rotating the publishable key does **not** hide it. The next `npm run build` bakes the new key into
the bundle that every visitor downloads. Rotation only invalidates the copy sitting in git history.

Do not read this document as saying the exposure has been remediated. It has not, and it cannot
be, because the key is public by construction. What actually protects the data is the next section.

## Row-level security is the real boundary

Every table is protected. Four tables, all with RLS enabled, and 25 policies between them:

| Table | RLS |
|---|---|
| `public.game_sessions` | enabled |
| `public.game_players` | enabled |
| `public.leaderboard` | enabled |
| `public.broadcast_messages` | enabled |

The policies encode the game's rules, for example: players can read sessions they belong to,
players can update only their own record, only the game master can update a session or send
broadcasts, and anyone may read the leaderboard.

**Rule for contributors: a new table must have `ENABLE ROW LEVEL SECURITY` and its policies in the
same migration.** A table without RLS is readable and writable by anyone holding the public key —
which is everyone. There is no second line of defence behind it.

## Rotating the key

If you still want to rotate it — for example because the project URL changed, or to invalidate the
historical copy — this is the whole procedure:

1. Supabase dashboard → **Project Settings** → **API**.
2. Rotate the publishable / anon key.
3. Update the value in your local `.env` **and** in your host's build environment variables
   (Vercel, Netlify, GitHub Actions, …). Both, or the next deploy will break.
4. Redeploy. `VITE_*` variables are inlined at build time, so a redeploy is required — restarting
   the existing deployment does nothing.
5. Confirm the new key is in the shipped bundle: `grep -o "sb_publishable_[A-Za-z0-9_-]*" dist/assets/*.js | head -1`

## Never commit

- Any `.env`, `.env.local`, `.env.*.local` — only `.env.example` belongs in git.
- The `service_role` key, or anything else the Supabase dashboard labels **secret**.
- Access tokens for Supabase management, Vercel, GitHub or any other service.

`.gitignore` already excludes `.env` and `.env.*` while keeping `.env.example`.

## Reporting a vulnerability

Please open a private report through **GitHub → Security → Advisories → Report a vulnerability**
rather than a public issue.

This is a university teaching project maintained on a best-effort basis: there is no SLA and no
bug bounty. Reports that identify a concrete impact on player data will be prioritised.
