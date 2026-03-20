# Weather History Graphs — Design Spec

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Add historical weather data visualization to the KMHS Weather Dashboard. Users can view line/bar charts of all weather metrics with a date range picker. Data is stored in SQLite for durability and portability, replacing the existing JSON-based CoCoRaHS storage.

---

## Goals

- Display historical Ambient Weather station data as interactive charts
- Prioritize temperature and rainfall; support all available metrics via toggles
- Date picker with presets (Today, 7 Days, 30 Days) and custom range
- Single-day view: continuous line of all 5-minute data points
- Multi-day view: daily high/low range + daily totals per metric
- SQLite storage for all weather data — queryable and exportable outside the app
- One-time backfill of Ambient Weather data from January 18, 2026 to present

---

## Data Layer

### Database

- **Engine:** SQLite via Prisma ORM
- **File location:** `data/weather.db`
- **Gitignore:** add `data/*.db` to `.gitignore`

### Schema

```prisma
model WeatherReading {
  id              Int      @id @default(autoincrement())
  timestamp       DateTime @unique
  macAddress      String

  // Temperature (°F)
  tempf           Float?
  tempinf         Float?
  feelsLike       Float?
  dewPoint        Float?

  // Humidity (%)
  humidity        Float?
  humidityin      Float?

  // Wind
  windspeedmph    Float?
  winddir         Int?
  windgustmph     Float?
  maxdailygust    Float?

  // Pressure (inHg)
  baromrelin      Float?
  baromabsin      Float?

  // Rainfall (inches) — secondary to CoCoRaHS
  hourlyrainin    Float?
  dailyrainin     Float?

  // Solar & UV
  solarradiation  Float?
  uv              Float?

  @@index([timestamp])
  @@index([macAddress, timestamp])
}

model CocorahsObservation {
  id                    String   @id
  date                  String   @unique  // YYYY-MM-DD
  rainfall              Float
  snowfall              Float?
  notes                 String?
  obsTime               String?
  stationNumber         String?
  stationName           String?
  state                 String?
  county                String?
  // Extended snowpack fields (preserved from existing CoCoRaHSObservation interface)
  snowfallNewDepth      Float?
  snowfallWaterContent  Float?
  snowfallSLR           Float?
  snowpackTotalDepth    Float?
  snowpackWaterContent  Float?
  snowpackDensity       Float?
  source                String   // 'manual' | 'import'
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Migration from JSON

- On first startup (detected by absence of `data/weather.db`), a migration script reads `data/cocorahs.json` and inserts all records into `CocorahsObservation`
- All fields from the existing TypeScript `CoCoRaHSObservation` interface are preserved, including all snowpack fields
- Migration is idempotent: skips records whose `date` already exists in the DB
- The JSON file is kept as-is after migration (read-only backup); the app stops writing to it

### Backfill

**Route:** `POST /api/admin/backfill`

**Authentication:** Protected by a required secret header. Requests must include `x-admin-secret: <value>` matching the `ADMIN_SECRET` environment variable. Missing or wrong header returns 401. Add `ADMIN_SECRET=` to `.env.example`.

**Behavior:**

- Pages backwards through the Ambient Weather API using the `endDate` parameter
- 288 records per call (~24 hours at 5-min intervals), 1-second delay between calls (API rate limit)
- Upserts on `timestamp` (inserts new records, skips existing)
- Stops when all pages back to 2026-01-18 are processed

**Progress streaming:** Uses **Server-Sent Events (SSE)**. The route sets `Content-Type: text/event-stream` and streams one event per completed page:

```text
data: {"processed":288,"total":17280,"done":false}

data: {"processed":576,"total":17280,"done":false}

...

data: {"processed":17280,"total":17280,"done":true}
```

The dashboard trigger button connects via `EventSource`, updates a progress bar, and closes the connection when `done: true`. The backfill button is shown in the History tab only when `ADMIN_SECRET` is set in the environment.

---

## API Layer

### `GET /api/history/weather`

**Query params:** `start=YYYY-MM-DD`, `end=YYYY-MM-DD` (both required)

**Validation — return 400 for:**

- Missing `start` or `end` params → `{ error: "start and end are required" }`
- Invalid date format → `{ error: "Invalid date format. Use YYYY-MM-DD" }`
- `start > end` → `{ error: "start must be before or equal to end" }`
- Range > 365 days → `{ error: "Date range cannot exceed 365 days" }`

**Single day** (`start === end`): Returns all raw readings for that calendar date, ordered by `timestamp` ascending. Empty `[]` if no readings exist.

```json
[
  {
    "timestamp": "2026-03-19T07:00:00.000Z",
    "tempf": 44.2,
    "tempinf": 68.1,
    "feelsLike": 41.0,
    "dewPoint": 38.5,
    "humidity": 82,
    "humidityin": 45,
    "windspeedmph": 3.1,
    "windgustmph": 5.2,
    "winddir": 220,
    "baromrelin": 30.02,
    "solarradiation": 0,
    "uv": 0,
    "hourlyrainin": 0,
    "dailyrainin": 0
  }
]
```

**Multi-day** (`start !== end`): Returns one aggregated row per calendar day, ordered by date ascending. Empty `[]` if no readings exist for the range.

Rainfall join: the route makes two separate queries — one fetching `CocorahsObservation` records for the date range, one aggregating `WeatherReading.dailyrainin` per calendar day — then merges in application code (no Prisma relation join, as there is no foreign key; the link is a date string vs. a date derived from a DateTime). CoCoRaHS takes priority when both exist.

```json
[
  {
    "date": "2026-03-12",
    "tempfMin": 39.1,
    "tempfMax": 56.8,
    "tempfAvg": 47.2,
    "tempinfMin": 65.0,
    "tempinfMax": 72.3,
    "feelsLikeMin": 36.0,
    "feelsLikeMax": 54.1,
    "dewPointMin": 33.2,
    "dewPointMax": 41.8,
    "humidityMin": 61,
    "humidityMax": 94,
    "humidityinMin": 38,
    "humidityinMax": 52,
    "windspeedmphMax": 12.4,
    "windgustmphMax": 18.7,
    "baromrelinMin": 29.82,
    "baromrelinMax": 30.14,
    "solarradiationMax": 312,
    "uvMax": 3,
    "rainfallTotal": 0.24,
    "rainfallSource": "cocorahs"
  }
]
```

### `GET /api/history/cocorahs`

**Query params:** `start=YYYY-MM-DD`, `end=YYYY-MM-DD` (both required)

Same validation rules as above. Returns CoCoRaHS observations in range, sorted by date ascending. Returns `[]` if no observations exist.

```json
[
  {
    "date": "2026-03-12",
    "rainfall": 0.24,
    "snowfall": null,
    "notes": null,
    "source": "cocorahs",
    "stationNumber": "OR-CC-140"
  }
]
```

---

## UI

### Dashboard Tab Layout

The existing `/dashboard` page gains a two-tab layout:

- **Current Conditions** — existing content, unchanged
- **History & Graphs** — new graph tab

Tab state is synced to the URL query param (`?tab=current` / `?tab=history`) so browser back/forward and direct links work correctly. Default on first visit with no param: `current`.

### History Tab Structure

```text
[ Date Range Controls ]
[ Metric Toggle Pills  ]
[ Chart Area           ]
```

**Date Range Controls:**

Preset buttons: `Today` | `7 Days` | `30 Days` | `Custom...`

- Presets set start/end relative to today
- `Custom...` reveals two `<input type="date">` fields
- Selecting custom dates that match a preset re-highlights that preset automatically
- Active preset is visually highlighted

**Metric Toggle Pills:**

Each metric is a pill button. Active = colored background + white text. Inactive = muted outline. Multiple metrics can be active simultaneously. Default on load: **Temp (outdoor)** + **Rainfall** active.

| Metric key | Label | Color | Chart type |
| --- | --- | --- | --- |
| `tempf` | Temp (out) | `#f97316` orange | Line |
| `tempinf` | Temp (in) | `#fbbf24` amber | Line |
| `feelsLike` | Feels Like | `#fb923c` red-orange | Line |
| `dewPoint` | Dew Point | `#2dd4bf` teal | Line |
| `humidity` | Humidity (out) | `#a78bfa` purple | Line |
| `humidityin` | Humidity (in) | `#c4b5fd` violet | Line |
| `windspeedmph` | Wind Speed | `#34d399` green | Line |
| `windgustmph` | Wind Gusts | `#6ee7b7` emerald | Line (dashed) |
| `baromrelin` | Pressure | `#94a3b8` slate | Line |
| `rainfallTotal` | Rainfall | `#38bdf8` sky | Bar |
| `uv` | UV Index | `#fde047` yellow | Line |
| `solarradiation` | Solar | `#fcd34d` amber-yellow | Line |

**Y-axis grouping:**

Each active metric gets its own `yAxisId` in Recharts with `hide={true}` (no rendered axis label), so each metric scales independently. This avoids the problem of incompatible scales (e.g., UV 0–11 vs. temperature 30–65°F on the same axis).

**Exception:** `tempf`, `tempinf`, `feelsLike`, and `dewPoint` share one visible left Y-axis (labeled °F) since they are the same unit and scale. All other metrics use hidden independent axes.

The shared tooltip shows all active metric values on hover with their units.

**Chart Area:**

- Library: **Recharts** with `<ComposedChart>` for all views (handles mixed lines + bars natively)
- Single-day mode: one point per 5-min reading, X axis = time of day (HH:MM format)
- Multi-day mode (line metrics): high line + low line + filled `<Area>` between them; single value (max) for metrics without a meaningful high/low (UV, solar)
- Multi-day mode (rainfall): `<Bar>` showing daily total
- `<ResponsiveContainer width="100%" height={350}>` — fills container width
- Tooltip on hover: all active metric values for that timestamp/day, with units
- **Loading state:** skeleton rectangle matching chart dimensions, shown while fetching
- **Empty state** (API returns `[]`): centered message — "No data for this date range. If you haven't run the backfill yet, use the Backfill button above."
- **Error state:** "Failed to load weather history." with a Retry button that re-triggers the fetch

---

## Component Structure

```text
src/
  app/
    dashboard/
      page.tsx                        # Adds tab state + URL param sync
  components/
    weather/
      graphs/
        WeatherGraph.tsx              # Recharts ComposedChart wrapper
        MetricToggle.tsx              # Pill toggle buttons + active state
        DateRangePicker.tsx           # Preset buttons + custom date inputs
  hooks/
    useWeatherHistory.ts              # Data fetching hook
  lib/
    db/
      prisma.ts                       # Prisma client singleton
      migrations/
        migrate-cocorahs-json.ts      # One-time JSON → SQLite migration
```

**Response types:**

```typescript
// Single-day: API strips id and macAddress — only weather fields returned
interface WeatherReading {
  timestamp: string; // ISO string
  tempf: number | null;
  tempinf: number | null;
  feelsLike: number | null;
  dewPoint: number | null;
  humidity: number | null;
  humidityin: number | null;
  windspeedmph: number | null;
  winddir: number | null;
  windgustmph: number | null;
  maxdailygust: number | null;
  baromrelin: number | null;
  baromabsin: number | null;
  solarradiation: number | null;
  uv: number | null;
  hourlyrainin: number | null;
  dailyrainin: number | null;
}

// Multi-day: one row per calendar day
interface DailyAggregate {
  date: string; // YYYY-MM-DD
  tempfMin: number | null;
  tempfMax: number | null;
  tempfAvg: number | null;
  tempinfMin: number | null;
  tempinfMax: number | null;
  feelsLikeMin: number | null;
  feelsLikeMax: number | null;
  dewPointMin: number | null;
  dewPointMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
  humidityinMin: number | null;
  humidityinMax: number | null;
  windspeedmphMax: number | null;
  windgustmphMax: number | null;
  baromrelinMin: number | null;
  baromrelinMax: number | null;
  solarradiationMax: number | null;
  uvMax: number | null;
  rainfallTotal: number | null;
  rainfallSource: 'cocorahs' | 'station' | null;
}
```

**`useWeatherHistory` hook interface:**

```typescript
type DateRange = { start: string; end: string }; // YYYY-MM-DD strings

interface WeatherHistoryResult {
  data: WeatherReading[] | DailyAggregate[]; // raw for single-day, aggregated for multi-day
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function useWeatherHistory(range: DateRange): WeatherHistoryResult
```

- Internally determines single-day vs. multi-day by comparing `range.start === range.end`
- Fetches from `/api/history/weather?start=...&end=...`
- Implemented with `useEffect` + `useState` (no new library dependency)
- Re-fetches automatically when `range` changes
- Returns `isLoading: true` while fetching, `error` string on failure, `data: []` on empty response

---

## Charting Library

**Recharts** — added as a runtime dependency.

Chosen because:

- First-class React/TypeScript support
- `ComposedChart` handles mixed line + bar natively
- `ResponsiveContainer` for fluid width
- Built-in tooltip support
- Lightweight for a personal dashboard

---

## Dependencies to Add

```text
recharts            # Chart components (runtime)
prisma              # ORM CLI + migrations (devDependency)
@prisma/client      # Runtime Prisma client
```

---

## Environment Variables

New variable required — add to `.env.example`:

```text
ADMIN_SECRET=        # Secret for triggering the backfill route (any random string)
```

---

## Out of Scope

- Real-time chart updates (charts load on demand, not live-streaming)
- Export button from the chart UI (use `sqlite3` CLI directly)
- Weather forecast data
- Indoor sensor graphs beyond temp and humidity
- Authentication / multi-user access
