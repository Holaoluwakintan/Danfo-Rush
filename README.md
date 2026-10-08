# Danfo Rush 🚌💨

Endless runner through Lagos traffic. Plain Canvas 2D + vanilla JS (no engine), all art drawn in code, SFX + music synthesised with WebAudio; conductor voice lines are 11 small mp3s in `public/voice` (ElevenLabs TTS, Nigerian male voice, lazy-loaded on the first run, mute via 🗣️ in the HUD / pause / settings). PWA, plays offline.

Live: https://danfo-rush-ng.vercel.app  (Vercel project `danfo-rush`, team team_8Jkc3ymdudr2aiHuFsdspZDE; `danfo-rush.vercel.app` belongs to someone else)

## Layout
- `src/` game: `game.js` (engine, spawner, collisions, autopilot), `art.js` (vector sprites), `audio.js` (synth SFX + afrobeat loop), `store.js` (save, missions, streak, skins, upgrades, CONFIG flags), `net.js` (Supabase RPC + offline queue), `share.js` (WhatsApp score card + challenge links), `main.js` (UI), `index.html`, `app.css`, `sw.js`
- `public/` icons, OG images (`og.jpg`, `og-challenge.jpg`), font (Lilita One, OFL), manifest
- `api/c.js` challenge-link preview (`/c/<score>/<nick>` → OG tags → `/?c=&n=`)
- `supabase/schema.sql` schema `danfo` (RLS on, no policies; only the RPCs below touch it)
- `tools/gen.mjs` regenerates icons + OG (then convert og PNGs to JPEG ≤ 300 KB for WhatsApp)
- `test/` `playtest.mjs` (51 checks), `soak.mjs` (20 simulated bot runs, also checks every run against the server's anti-cheat caps), `live-extra.mjs` (offline reload, reduced motion), `video.mjs` (10 s clip), `shot.mjs`

## Build / test / deploy
```
npm i                      # esbuild + playwright-core (dev only)
node build.mjs             # -> dist/ (~111 KB initial load)
python3 -m http.server 4780 --directory dist
node test/playtest.mjs http://127.0.0.1:4780/
python3 deploy.py          # reads VERCEL_TOKEN / VERCEL_TEAM / VERCEL_PROJECT / DANFO_DOMAIN from env
```

## Leaderboard (Supabase Blossom project rlbrhpjljjgpqpqjrpkc)
RPCs callable with the publishable key: `danfo_start_run(device)`, `danfo_submit(...)`, `danfo_leaderboard('weekly'|'all', device, limit)`.
Anti-cheat on submit: server-issued run id with server start time (claimed duration can't exceed real elapsed time + 5 s), distance ≤ 70 m/s × time, score ≤ f(distance, passengers, near misses, coins), passengers/near-miss/coin caps per metre, SHA-256 signature, 120 runs/hour and 30 offline runs/day per device. Failing runs are stored flagged and never ranked. Weekly board resets Monday 00:00 Lagos.

## Flags (src/store.js CONFIG)
`ADS_ENABLED=false` (rewarded "watch ad to continue" placeholder), `PAYSTACK_READY=false` (coin packs show "coming soon"), `PAYSTACK_PUBLIC_KEY=''`.

## Later: Android app
A TWA (Trusted Web Activity) via Bubblewrap/PWABuilder wraps this PWA as a Play Store APK/AAB; needs `/.well-known/assetlinks.json` with the signing key fingerprint.

## v1.1 (Oct 8 2026)
- Route rotates every 700 m: Ojuelegba → Oshodi (market, under the bridge) → Third Mainland Bridge → CMS / Marina → Lekki Toll Gate. Each zone has its own palette, landmarks and hazard mix (`ZONES` in game.js), a zone banner and a full-name overhead sign.
- LASTMA officers fine you 15% of the run's naira and slow you down (no longer a crash). Flood patches slow you for 1.5 s.
- Power-ups: NEPA Light (key `express`: speed and invincible), Agbero (clears cars ahead), Magnet, Double Fare (2× naira), plus Shield and Jerrycan. Timer ring and bar in the HUD, and a one-time tip the first time each one shows up.
- Daily Challenges extend the missions pool (`carry`, `zone`, `nearrow`; two lead each day). Every claimed reward gets +10% per streak day (max +100%).
- Anti-cheat unchanged: Double Fare is clamped client-side so naira never exceeds metres + 190 (server cap is metres + 200); Agbero clears don't count as smashes or near misses.
