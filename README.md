# KMHS Weather Dashboard

A personal weather station dashboard that aggregates data from your Ambient Weather WS-2000 and [CoCoRaHS](https://www.cocorahs.org/) manual rainfall observations.

## Features

- **Real-time weather data** — temperature, humidity, wind, pressure, UV index, and solar radiation from your Ambient Weather station
- **Accurate rainfall reporting** — CoCoRaHS manual observations take priority over the automated rain gauge
- **Local data persistence** — readings stored in a local SQLite database with automatic gap-filling on startup
- **CoCoRaHS sync** — scrape your own observation history directly from the CoCoRaHS website, or import a CSV export
- **Multiple data entry methods** — manual form entry, CSV bulk import, or automated web scraper

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Testing | Vitest |
| Browser automation | Playwright (CoCoRaHS scraper) |

## Getting Started

### Prerequisites

- Node.js (LTS)
- pnpm

### Installation

```bash
git clone <repo-url>
cd kmhs-weather
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `AMBIENT_WEATHER_API_KEY` | From [ambientweather.net/account](https://ambientweather.net/account) |
| `AMBIENT_WEATHER_APP_KEY` | Application key from the same page |
| `COCORAHS_USERNAME` | Your CoCoRaHS account email |
| `COCORAHS_PASSWORD` | Your CoCoRaHS password (used only by the scraper) |
| `COCORAHS_SCRAPER_TIMEOUT_MS` | Scraper timeout in ms (default: `30000`) |
| `DB_PATH` | SQLite file path (default: `data/weather.db`) |
| `PWS_WEATHER_STATION_ID` | PWS Weather station ID (optional) |
| `WUNDERGROUND_PWS_ID` | Weather Underground station ID (optional) |

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── dashboard/        # Ambient Weather live dashboard
│   ├── cocorahs/         # CoCoRaHS observations (entry, import, sync)
│   └── api/
│       ├── weather/ambient/  # Ambient Weather API proxy
│       └── cocorahs/         # CRUD, CSV import, web scraper sync
├── components/
│   └── weather/          # RainfallDisplay, CoCoRaHSSyncPanel
├── lib/
│   ├── api/              # Ambient Weather API client
│   ├── data/             # SQLite schema, storage modules, history fetcher
│   ├── scraper/          # Playwright-based CoCoRaHS scraper + date logic
│   └── utils/            # CSV parser
└── types/                # TypeScript interfaces for all data sources
```

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/weather/ambient?action=latest` | Latest reading for a device |
| `GET` | `/api/weather/ambient?action=devices` | List all stations |
| `GET` | `/api/cocorahs` | List observations (optional date filter) |
| `POST` | `/api/cocorahs` | Create observation |
| `PUT` | `/api/cocorahs?id={id}` | Update observation |
| `DELETE` | `/api/cocorahs?id={id}` | Delete observation |
| `POST` | `/api/cocorahs/sync` | Scrape observations from CoCoRaHS |
| `POST` | `/api/cocorahs/import` | Bulk import from CSV file |

### CoCoRaHS Sync Modes

The `/api/cocorahs/sync` endpoint accepts a `mode` field:

| Mode | Behavior |
|---|---|
| `missing` | Fill gaps — only fetches dates not already in the database |
| `recent` | Last 30 days (default if no mode specified) |
| `all` | Full history from the earliest observation |
| `range` | Custom date range via `startDate` / `endDate` |

## Rainfall Data Priority

CoCoRaHS manual observations are **always preferred** over the automated rain gauge:

1. Check for a CoCoRaHS observation for the date in question
2. If found, use that value and show a **CoCoRaHS** source indicator
3. If not found, fall back to the Ambient Weather station reading

## Development

```bash
pnpm dev           # Start dev server
pnpm build         # Production build
pnpm type-check    # TypeScript type checking
pnpm lint          # ESLint
pnpm lint:fix      # ESLint with auto-fix
pnpm format        # Prettier
pnpm test          # Run tests
pnpm test:watch    # Tests in watch mode
```

## Database

SQLite is stored at `data/weather.db` (configurable via `DB_PATH`). The schema is initialized automatically on startup.

**Tables:**

- `ambient_readings` — time-series weather station data, indexed by date
- `cocorahs_observations` — manual rainfall observations, unique per date

The database is excluded from version control. The `data/` directory is gitignored.
