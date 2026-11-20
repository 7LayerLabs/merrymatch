# Merry Match

Secret Santa and family wishlists for one group, every Christmas.
Next.js 16 + InstantDB. No other services.

## Run it on this PC

```
npm install
npm run dev -- -p 3020
```

Open http://localhost:3020. `.env.local` holds the InstantDB keys (never commit it).

Local-only test sign-in (works only under `next dev` with `MM_DEV_LOGIN=1`, and only for @example.com accounts):
http://localhost:3020/dev?email=demo-olive@example.com
A sample family ("The Hollis Family": olive, amy, ben, cal, dee) is seeded in the test database.

## Tests

```
node --test tests/draw.test.ts                      # draw logic stress tests
node --no-warnings --import ./tests/ts-resolve.mjs --test tests/parseList.test.ts   # pasted-list reader (Apple Notes, share links)
node --env-file=.env.local tests/e2e.mjs            # full season against a running dev server (69 checks)
node --env-file=.env.local tests/seed-demo.mjs      # reseed the sample family (add --draw to draw names)
```

## How it works

- **Sign in:** InstantDB email codes. Invite links are one-time and tied to one person. If the organizer set an email, only that email can use the link.
- **Writes:** every change goes through `/api/[action]` (`src/server/actions.ts`) with the admin SDK. Browsers can only read.
- **Privacy:** `instant.perms.ts`. You see only your own match. The organizer sees all matches only after breaking the seal, and everyone is told. You never see coverage on your own gifts. Buyers are private.
- **Draw:** `src/lib/draw.ts`. Fair shuffle, with a fallback for tight rules. Supports no swapping pairs and avoiding last year's pairs. Dropouts and late joiners are patched in place.

## Going live (needs Derek)

1. Make a free InstantDB account, then run `npx instant-cli claim` to move the test app into it. Or create a new app and put its ID and admin token in `.env.local`.
2. `npx instant-cli push all --env .env.local` (schema + permissions).
3. Deploy to Vercel with `NEXT_PUBLIC_INSTANT_APP_ID` and `INSTANT_APP_ADMIN_TOKEN` set. Do NOT set `MM_DEV_LOGIN` there.
4. Optional: set `PUBLIC_SITE_URL` to the final domain so invite links use it.
