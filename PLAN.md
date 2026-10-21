# DOS AI Campus 2D — rebuild plan

Source of truth: Notion page "DOS AI-Campus" (context pack, 21 Oct 2026).

## Goal
Working 2D multi-level building version: one department per floor (7 levels),
1 fictional character = 1 use case, click a character to read the submission.

## Assumptions
- `public/index.html` is the 2D page from the Notion pack, unchanged (DOM contract fixed).
- `app.js` / `style.css` are rebuilt from scratch; originals can replace them if found.
- `data/seed.json` is a **fictional 86-record sample** — replace with the real file.
- No Three.js in 2D: drop the dependency and `/vendor` route; CSP drops `'unsafe-inline'`.
- Stack unchanged: Node 24+ (`node:sqlite`), plain `node:http`, no build step, no CDN.

## Steps
1. [x] Check toolchain (Node 25.7, node:sqlite OK, Docker not installed).
2. [x] Scaffold `server.js`, `package.json`, `Dockerfile`, `compose.yaml`, ignores, `test/api.test.js`.
3. [x] Generate fictional `data/seed.json` (86 records, 7 categories, real field names).
4. [x] Build `public/app.js` (canvas 2D: building + themed floors, sprites, network, chats) and `public/style.css`.
5. [x] Verify: `npm test` 4/4; in-page simulation via `campusStep` (activities, lift rides, chats
       completing, dialog + related list, search); headless-Edge screenshots of all 7 floors.
6. [x] README updated.
7. [x] Docker: installed Ubuntu 24.04 in WSL + Docker Engine 29.9.2 / Compose v5.6.1 (free, no
       Desktop). `docker compose up --build -d` OK (image 331 MB); 15/15 container smoke checks
       (API, 404/405, traversal, CSP, non-root user, volume persistence across restart); reachable
       from Windows at localhost:3000.

## Scope additions (user requests, 22 Oct)
- Pixel-art characters in the style of the user's reference screenshots — **original sprites**,
  generated procedurally (no copied artwork/logos); one tonal palette per department.
- Network: use cases are "related" by shared AI-activity tags (+2 each), same subcategory (+2),
  secondary-category link to the other's primary (+2), shared tool (+1); related if score ≥ 3
  (top 8 per person). Related staff meet (same floor, or via the lift) and chat with bubbles
  and hearts. Selected person's links drawn; dialog lists related use cases; "Show network" toggle;
  sidebar "Conversations" feed. (index.html gains `#network` and `#chats`.)
- Different layout per level (rows / pods / benches, themed floors and amenities) and ~20
  activities. Requires tile-grid pathfinding (BFS) instead of fixed aisle routes.
- Docker: Desktop needs licence decision + admin install → user to choose.

## Done means
- `npm test` passes (86 records, 7 departments, 404/405, static files served).
- In a browser: building view renders 7 floors; clicking a level enters it; characters
  move; clicking one opens the dialog; search/tag filter, Fit/Zoom/Follow/Pause work.

## Not verifiable here
- Docker build (Docker not installed).
- Real data rendering (no real seed.json).
