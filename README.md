# DOS AI Campus 2D

An internal prototype that shows the department's AI use-case submissions as a
seven-storey pixel-art office. Each department (use-case category) has its own floor.
Each fictional staff member stands for one submitted use case. Click someone to read
the original submission and see the use cases related to it.

> Characters are fictional markers for use cases, not real people or performance indicators.
> The pixel sprites are original and generated in code.
> **This repository only contains fictional sample data** (`data/seed.sample.json`).

## Quick start

Needs Node.js 24+ (it uses the built-in `node:sqlite`). There are no npm dependencies.

```sh
git clone https://github.com/blurboy1985/dos-campus.git
cd dos-campus
npm start      # http://localhost:3000  (do not open public/index.html directly)
npm test       # API + static-file integration tests (always uses the sample data)
```

A fresh clone runs straight away on the 86 fictional sample records.

## Data: sample vs real

| File | In git? | Contents |
|---|---|---|
| `data/seed.sample.json` | yes | 86 **fictional** records with the real field names, for development and demos |
| `data/seed.json` | **no** (`.gitignore`) | the real export: internal submissions and submitter names |
| `data/campus.sqlite*` | no | database created from a seed file on first start |

On first start, with no database yet, the server loads the first seed file it finds:
1. `SEED_PATH` (environment variable), if set
2. `data/seed.json`, the real data, if present
3. `data/seed.sample.json`

The console prints which file it used. An existing database is never overwritten.

**To switch to the real data:**
1. Copy the real export to `data/seed.json`. It must use the same field names as the sample.
2. Stop the server, back up and delete `data/campus.sqlite*`, then run `npm start`.
3. Confirm the console says `Seeding database from data/seed.json`.

`git status` should never show `data/seed.json`. If it does, don't commit it.

### Record fields

`Submission ID` is the primary key and `Primary category` decides the floor. Both must match
the 7 category names exactly. Other fields shown in the app:

- `Suggested use case title`
- `Subcategory`
- `Secondary category tags` (`; `-separated)
- `AI activity tags` (`; `-separated)
- `Technologies and/or Tools Used`
- `Review note`
- `Name`
- the problem, solution, impact and implementation questions
- `Have something to show us?`
- `Response Timestamp`
- `Original Excel row`

## What's on screen

- **Building view:** seven levels, a moving lift, and staff shown where they are right now.
  **Show network** draws links between levels.
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
  Selecting someone draws their links, and the details dialog lists their related use cases.
- **Search and filter:** free-text search (titles, tools, submitters) and an AI-activity
  filter. Matching staff stay bright and the rest fade.

**Controls:** drag to pan, scroll to zoom, click a level or a person. Toolbar: Building view,
Fit floor, Zoom, Follow selected, Pause staff, Show network.
**Keys:** arrow keys pan, `+`/`-` zoom, `0` fits the view, `N` toggles the network,
`Esc` returns to the building view.
**Deep links:** `/#L3` opens level 3 and `/#L3,network` also shows the network.

## Docker

```sh
docker compose up --build -d   # http://localhost:3000 (bound to 127.0.0.1 only)
docker compose down            # stop (data stays in the named volume)
docker compose down -v         # stop and delete the database volume
```

The image copies whatever seed files are in `data/`. To use the real data in Docker, put
`data/seed.json` in place, then run `docker compose down -v` and `docker compose up --build -d`
so the database is rebuilt.

**On Windows without Docker Desktop:** this project was tested with the free Docker Engine
inside WSL (Ubuntu 24.04). From PowerShell:

```powershell
wsl -d Ubuntu-24.04 -u root --cd /mnt/c/Users/Admin/Documents/dos-campus -- docker compose up --build -d
wsl -d Ubuntu-24.04 -u root --cd /mnt/c/Users/Admin/Documents/dos-campus -- docker compose down
```

The container is reachable from Windows at http://localhost:3000. Stop it before running
`npm start` locally, because both use port 3000.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `HOST` | `127.0.0.1` (Docker image: `0.0.0.0`) | Bind address |
| `PORT` | `3000` | Port |
| `DB_PATH` | `data/campus.sqlite` (Docker: `/app/data/campus.sqlite`) | SQLite file |
| `SEED_PATH` | first found of `data/seed.json`, `data/seed.sample.json` | Seed file for a new database |

## API (read-only; any other method returns 405)

| Method & path | Returns |
|---|---|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/use-cases` | All records; `?q=` text search, `?category=` exact category |
| `GET /api/use-cases/<Submission ID>` | One record, or 404 |
| `GET /api/departments` | `[{ category, count }]` |

## Security

- There is **no login**. The real data holds internal submissions and submitter names, so
  keep it on your own machine or behind an approved authenticated HTTPS reverse proxy.
  Docker binds to `127.0.0.1` only.
- The real `data/seed.json` is git-ignored and must not be pushed, even to a private repository.
- Every response carries a strict Content-Security-Policy (same-origin scripts and styles,
  no inline scripts, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, and
  `Cache-Control: no-store`. Static file serving is path-checked against traversal.

## Project layout

```
server.js               node:http server, SQLite seeding, read-only API, static files
public/index.html       page shell
public/app.js           canvas engine: floors, pathfinding, sprites, network, chats, UI
public/style.css        UI styles
data/seed.sample.json   fictional sample data (committed)
test/api.test.js        integration tests (run against the sample)
Dockerfile, compose.yaml
PLAN.md                 build plan and verification log
```

## Development notes

- No build step and no external CDN. Edit the files in `public/` and reload.
- For automated checks, `window.campusDiagnostics()` returns the simulation state, and
  `window.campusStep(seconds)` advances the simulation without animation frames.
  This is useful in hidden or headless browser tabs.
- Floors are built on a 24-unit tile grid, and staff route between tiles with
  breadth-first search. When the page loads it checks that every desk and activity spot can
  be reached from the lift, and logs a console warning for any that can't.
- To add a floor theme or amenity, edit the `themes` and `ITEMS` tables at the top of `public/app.js`.

## Known limitations

- Visual rendering is checked by hand and with headless screenshots. The automated tests
  cover only the server.
- `/api/use-cases` filters all records in memory. That's fine for hundreds of records, but
  it isn't built for large datasets.
- Response timestamps in the source data use mixed formats (ISO 8601 and `dd/mm/yyyy hh:mm`).
- Attachments in submissions are filenames only. The files aren't part of the project.
