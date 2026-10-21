# DOS AI Campus 2D

An internal prototype that shows the department's AI use-case submissions as a
seven-storey pixel-art office. Each department (use-case category) has its own floor.
Each fictional staff member stands for one submitted use case. Click someone to read
the original submission and see the use cases related to it.

Characters are fictional markers for use cases, not real people or performance indicators.
The pixel sprites are original and generated in code.

## Run

Needs Node.js 24+ (it uses the built-in `node:sqlite`). There are no npm dependencies.

```sh
npm start      # http://localhost:3000  (do not open public/index.html directly)
npm test       # API + static-file integration tests
```

Docker: `docker compose up --build -d` (binds to `127.0.0.1:3000`, DB in a named volume).

On this Windows machine Docker runs as the free Docker Engine inside WSL (distro `Ubuntu-24.04`,
no Docker Desktop). From PowerShell:

```powershell
wsl -d Ubuntu-24.04 -u root --cd /mnt/c/Users/Admin/Documents/dos-campus -- docker compose up --build -d
wsl -d Ubuntu-24.04 -u root --cd /mnt/c/Users/Admin/Documents/dos-campus -- docker compose down
```

The container is reachable from Windows at http://localhost:3000. Stop it before running
`npm start` locally, because both use port 3000.

## Data

- `data/seed.json` currently holds a **fictional 86-record sample**. Replace it with the real
  export (same field names) before use.
- The SQLite DB (`data/campus.sqlite`) is created from `seed.json` on first start only.
  To reload content: stop the server, back up and delete `data/campus.sqlite*`, then start again.

## What's on screen

- **Building view:** seven levels, a moving lift, and staff shown where they are right now.
  "Show network" draws links between levels.
- **Floor views:** each level has its own theme and desk layout:

  | Level | Theme | Desks | Amenities |
  |---|---|---|---|
  | L1 Planning & Classification | The Library | rows | bookshelves, whiteboard, reading rug |
  | L2 Collection & Acquisition | Field Ops | benches | phone booths, map wall, coffee |
  | L3 Processing & Compilation | Data Factory | rows | server racks, arcade, printer |
  | L4 Validation & Quality | QA Lab | pods | inspection stations, ping-pong, dashboards |
  | L5 Analysis & Interpretation | War Room | pods | meeting table, chart screens, bean bags |
  | L6 Communication & Dissemination | Studio | benches | stage, podcast booth, audience seating |
  | L7 Support & Enablement | The Hub | rows | help desk, nap pods, snacks, games |

- **Activities:** staff leave their desks for about 20 activities, such as coffee,
  ping-pong, reading, calls, presenting or napping. An icon shows what they are doing.
  Sometimes they take the lift to another floor.
- **Network:** two use cases are *related* when they score 3 or more points:
  - +2 for each shared AI-activity tag
  - +2 for the same subcategory
  - +2 when one's secondary category is the other's primary category
  - +1 for each shared tool

  Each person keeps their top 8 links. Related staff meet up and chat, shown with speech
  bubbles and hearts. The sidebar's **Conversations** feed lists live and recent chats.
  Selecting someone draws their links, and the dialog lists their related use cases.

Controls: drag to pan, scroll to zoom, click a level or a person. Keys: arrow keys pan,
`+`/`-` zoom, `0` fits the view, `N` toggles the network, `Esc` returns to the building view.
Deep links: `/#L3` opens level 3 and `/#L3,network` also shows the network.

## API (read-only; any other method returns 405)

| Method & path | Returns |
|---|---|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/use-cases` | All records; `?q=` text search, `?category=` exact category |
| `GET /api/use-cases/<Submission ID>` | One record, or 404 |
| `GET /api/departments` | `[{ category, count }]` |

## Security

There is no login. The real data holds internal submissions and submitter names, so keep it
on your own machine or behind an approved authenticated HTTPS reverse proxy. The
Content-Security-Policy allows only same-origin scripts and styles, with no inline scripts.

## Files

```
server.js            node:http server, SQLite, read-only API, static files
public/index.html    page shell
public/app.js        canvas engine: floors, pathfinding, sprites, network, chats, UI
public/style.css     UI styles
data/seed.json       content (sample until replaced)
test/api.test.js     integration tests
```

For automated checks, `window.campusDiagnostics()` returns the simulation state, and
`window.campusStep(seconds)` advances the simulation without animation frames.
