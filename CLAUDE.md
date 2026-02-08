# CLAUDE.md - KMHS Weather Dashboard

## Global Instructions

**IMPORTANT: Before proceeding with any task in this project, always read the global CLAUDE.md file at `~/.config/claude/CLAUDE.md` first.**

This project-specific CLAUDE.md extends and occasionally overrides the global instructions. When conflicts arise, project-specific guidance takes precedence.

## Project Overview

**KMHS Weather Dashboard** is a personal weather station web application that aggregates and displays data from your Ambient Weather WS2000 weather station.

### Purpose

Create a customized weather dashboard with a look and feel similar to existing weather platforms, tailored to your specific preferences and needs.

### Data Sources

This application integrates data from multiple sources:

1. **Ambient Weather** - Primary weather station data (temperature, humidity, wind, pressure, etc.)
   - Your personal Ambient Weather WS2000 weather station account

2. **PWS Weather (pwsweather.com)** - Shared weather station data
   - Weather station data shared with PWS Weather network

3. **Weather Underground (Wunderground)** - Shared weather station data
   - Weather station data shared with Wunderground network

4. **CoCoRaHS (Community Collaborative Rain, Hail and Snow Network)** - Manual rainfall observations
   - **Primary source for rainfall data** - CoCoRaHS manual observations are more accurate than the weather station's rain gauge
   - Daily manual rainfall observations

### Key Features

- Real-time weather data display from your personal weather station
- Accurate rainfall reporting using CoCoRaHS manual observations instead of automated rain gauge
- Customized UI/UX combining the best aspects of Ambient Weather, PWS Weather, and Wunderground interfaces
- Historical data visualization and trends

### Current Status

**In Development** - Project is in the initial setup and planning phase.

## Technology Stack & Framework Selection

### Recommended Stack

**TypeScript** is the recommended language for this project for the following reasons:

- **Type Safety**: Strong typing prevents bugs when working with multiple API data sources with different formats
- **Better Developer Experience**: Autocomplete, IntelliSense, and refactoring support
- **API Data Modeling**: Define interfaces for Ambient Weather, PWS Weather, Wunderground, and CoCoRaHS data structures
- **Maintainability**: Self-documenting code with type definitions

### Framework: Next.js

**Next.js** is a React framework that runs on **Node.js**. Here's how the pieces fit together:

- **Node.js**: JavaScript runtime that executes your code on the server
- **Next.js**: Framework built on top of Node.js and React
- **React**: UI library for building components

**Why Next.js:**

- Built-in API routes for secure server-side API key management (runs on Node.js)
- Server-Side Rendering (SSR) for initial weather data load
- File-based routing
- Built-in optimization (images, fonts, code splitting)
- Great development experience with Fast Refresh

**Node.js Benefits:**

- Server-side API routes keep your API keys secure (never exposed to browser)
- Can fetch data from multiple sources server-side before rendering
- Run scheduled tasks (e.g., periodic CoCoRaHS data updates)

### Build & Development Tools

- **Package Manager**: pnpm (faster, more efficient) or npm
- **Styling**: Tailwind CSS (utility-first, rapid development) or CSS Modules
- **Data Fetching**: TanStack Query (React Query) or SWR for caching and automatic revalidation
- **Charts/Visualizations**: Recharts (React-based) or Chart.js
- **Date/Time Handling**: date-fns (lightweight) or Luxon (more features)
- **HTTP Client**: fetch API (built-in) or axios

### Development Focus

**Current Priority**: Local development and personal use

- Run locally with `npm run dev` or `pnpm dev`
- Access via `localhost:3000`
- Deployment considerations can wait until closer to release-ready

### Project Structure

Recommended directory layout:

```text
kmhs-weather/
├── src/
│   ├── app/             # Next.js App Router (pages & layouts)
│   ├── components/      # React components
│   ├── lib/             # Utilities and helpers
│   ├── types/           # TypeScript type definitions
│   ├── api/             # API integration logic
│   │   ├── ambient.ts      # Ambient Weather API
│   │   ├── pwsweather.ts   # PWS Weather API
│   │   ├── wunderground.ts # Weather Underground API
│   │   └── cocorahs.ts     # CoCoRaHS integration
│   ├── hooks/           # Custom React hooks
│   └── styles/          # CSS/styling files
├── public/              # Static assets
├── .env.local           # Environment variables (not committed)
├── .env.example         # Template for required env vars
└── package.json
```

## Architecture Principles

### Multi-Source Data Aggregation

The application integrates data from four different sources, each with different formats and update frequencies:

1. **Ambient Weather API** - Real-time automated weather station data
2. **PWS Weather** - Shared/syndicated weather station data
3. **Weather Underground** - Shared/syndicated weather station data
4. **CoCoRaHS** - Manual rainfall observations (primary source for precipitation)

### Data Flow Architecture

```text
┌─────────────────────┐
│   Data Sources      │
│  (External APIs)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  API Routes         │
│  (Next.js /api)     │  ← Secure API key storage
│  - Server-side only │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Data Layer         │
│  - Normalization    │
│  - Transformation   │
│  - Validation       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  State Management   │
│  (TanStack Query)   │  ← Caching & revalidation
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  React Components   │
│  (UI Display)       │
└─────────────────────┘
```

### Component Structure

**Atomic Design Pattern:**

- **Atoms**: Basic UI elements (Temperature display, Wind icon, etc.)
- **Molecules**: Combined elements (Weather card, Stat group, etc.)
- **Organisms**: Complex sections (Current conditions panel, Forecast section, etc.)
- **Templates**: Page layouts
- **Pages**: Actual routes in the app

### Data Fetching Strategy

**Server-Side Rendering (SSR) for Initial Load:**

- Fetch initial weather data on the server
- Fast first paint with data already loaded
- Better SEO if public-facing

**Client-Side Updates:**

- Use TanStack Query or SWR for automatic background updates
- Configurable refresh intervals (e.g., every 5 minutes for weather data)
- Automatic retries on failures

### State Management

**Recommended Approach:**

- **TanStack Query (React Query)** for server state (API data)
  - Automatic caching
  - Background refetching
  - Stale-while-revalidate pattern
  - No need for Redux/Zustand for API data

- **React Context** or **Zustand** for UI state (if needed)
  - User preferences (units, display options)
  - Dashboard customization settings

### Caching Strategy

**API Response Caching:**

- Cache Ambient Weather data for 5 minutes (updates frequently)
- Cache PWS/Wunderground data for 10 minutes (less frequent updates)
- Cache CoCoRaHS data for 24 hours (manual daily observations)
- Use stale-while-revalidate for seamless UX

**Browser Caching:**

- Static assets cached indefinitely
- API responses with appropriate Cache-Control headers

### Data Normalization

**Problem**: Each API returns data in different formats

**Solution**: Create a unified internal data model

```typescript
// Unified weather data interface
interface WeatherData {
  timestamp: Date;
  temperature: {
    current: number;
    feelsLike: number;
    unit: 'F' | 'C';
  };
  rainfall: {
    today: number;
    source: 'cocorahs' | 'station'; // Prioritize CoCoRaHS
    unit: 'in' | 'mm';
  };
  // ... other normalized fields
}
```

Transform each API's response into this unified format for consistent component rendering.

### Error Handling

**Graceful Degradation:**

- If one API fails, display data from other sources
- Show clear error messages for failed sources
- Use cached data when APIs are unavailable
- Implement retry logic with exponential backoff

**User Feedback:**

- Loading states for data fetching
- Error boundaries to prevent full app crashes
- Toast notifications for background update failures

## Data Source Integration

### Ambient Weather API

**Purpose**: Primary source for automated weather station data

**Authentication:**

- Requires API key and Application key
- Store credentials in `.env.local` (never commit this file)
- Reference in code as `process.env.AMBIENT_WEATHER_API_KEY` and `process.env.AMBIENT_WEATHER_APP_KEY`

**API Documentation:**

- Official docs: <https://ambientweather.docs.apiary.io/>
- Rate limits: 1 request per second per API key
- Data update frequency: Typically every 5 minutes

**Available Data:**

- Temperature (indoor/outdoor, feels like)
- Humidity (indoor/outdoor)
- Barometric pressure
- Wind speed and direction
- Rain gauge readings (use CoCoRaHS instead for rainfall)
- UV index, solar radiation
- Device battery status

**Implementation Notes:**

- Use server-side API routes to protect keys
- Cache responses for 5 minutes
- Handle rate limiting with exponential backoff
- Consider WebSocket connections for real-time updates (if available)

### PWS Weather API

**Purpose**: Alternative/backup source for weather station data

**Authentication:**

- Station ID required
- API key may be required depending on access method
- Store credentials in `.env.local`

**Implementation Notes:**

- Check documentation at pwsweather.com for API endpoints
- May require less frequent polling than Ambient Weather
- Use as fallback when Ambient Weather API is unavailable

### Weather Underground API

**Purpose**: Alternative/backup source and historical data access

**Authentication:**

- Personal Weather Station ID (PWS ID)
- API key may be required for API access
- Store credentials in `.env.local`

**Implementation Notes:**

- Wunderground API access has changed over time; verify current API availability
- May provide historical data access
- Can serve as backup data source

### CoCoRaHS Integration

**Purpose**: Primary source for accurate rainfall measurements

**Data Type**: Manual observations (not automated API)

**Integration Approach:**

Since CoCoRaHS doesn't provide a traditional API for personal station data:

#### Option 1: Manual Entry

- Create a simple form in the dashboard to enter daily rainfall observations
- Store in local database or state
- Timestamp entries for historical tracking

#### Option 2: Data Export/Import

- Export your CoCoRaHS observations (if available through their website)
- Import into the application
- Parse and store for display

#### Option 3: Web Scraping (Use with Caution)

- Only if no API is available and you have permission
- Scrape your own observation data from CoCoRaHS website
- Implement responsibly with appropriate delays

**Data Storage:**

```typescript
interface CoCoRaHSObservation {
  date: Date;
  rainfall: number; // in inches or mm
  snowfall?: number; // optional
  notes?: string;
  source: 'manual' | 'import';
}
```

**Implementation Priority:**

- Start with manual entry form
- CoCoRaHS data overrides weather station rain gauge for all rainfall displays
- Display indicator showing rainfall source (CoCoRaHS vs. station)

### General API Best Practices

**Environment Variables:**

- **CRITICAL**: Never commit API keys to git
- All credentials go in `.env.local` (already in .gitignore)
- Create `.env.example` with variable names only (no values) to document required variables
- Document all required environment variables in README or separate documentation

**Error Handling:**

- Implement try-catch blocks for all API calls
- Log errors for debugging (use appropriate logging level)
- Return graceful fallbacks when APIs fail
- Display user-friendly error messages

**Rate Limiting:**

- Respect API rate limits
- Implement request queuing if needed
- Use exponential backoff for retries
- Cache responses appropriately

**Data Validation:**

- Validate API responses before using
- Check for expected data structure
- Handle missing or null values
- Use TypeScript interfaces for type safety

**Security:**

- All API calls should go through Next.js API routes (server-side)
- Never expose API keys in client-side code
- Sanitize any user input before using in API calls
- Use HTTPS for all external API requests

## Development Workflow & Code Quality

### Git Workflow

**Branch Strategy:**

- `main` - Stable, working code
- Feature branches for new functionality (e.g., `feature/ambient-api`, `feature/rainfall-form`)
- Bug fix branches (e.g., `fix/api-caching`)

**Commit Practices:**

- Follow global CLAUDE.md guidelines for commits
- Present commit messages for approval before committing
- Commit frequently with focused, atomic changes
- Never commit API keys or sensitive data

### TypeScript Configuration

**tsconfig.json settings:**

- Enable strict mode (`"strict": true`)
- Enable all type checking options
- Configure path aliases for cleaner imports (e.g., `@/components`, `@/lib`)
- Target modern JavaScript (ES2020+)

### Code Quality Tools

**ESLint:**

- Install and configure ESLint for TypeScript
- Use Next.js recommended config as base
- Add rules for React hooks
- Run before every commit

**Prettier:**

- Install Prettier for consistent formatting
- Configure to work with ESLint
- Set up format-on-save in your editor
- Add `.prettierrc` configuration file

**Example npm scripts:**

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit"
  }
}
```

### Testing Strategy

**Unit Testing:**

- Use Vitest or Jest for unit tests
- Test data transformation functions
- Test utility functions
- Test CoCoRaHS observation logic

**Integration Testing:**

- Mock API responses for consistent testing
- Test API route handlers
- Test data normalization across sources
- Use MSW (Mock Service Worker) for API mocking

**Component Testing:**

- Use React Testing Library
- Test component rendering with different data states
- Test loading states and error states
- Test user interactions (forms, buttons)

**Example test structure:**

```typescript
describe('Weather Data Normalization', () => {
  it('should normalize Ambient Weather API response', () => {
    const rawData = mockAmbientWeatherResponse;
    const normalized = normalizeAmbientData(rawData);
    expect(normalized.temperature.unit).toBe('F');
  });

  it('should prioritize CoCoRaHS rainfall over station data', () => {
    const weatherData = mockWeatherData;
    const cocorahsData = mockCoCoRaHSData;
    const combined = combineWeatherData(weatherData, cocorahsData);
    expect(combined.rainfall.source).toBe('cocorahs');
  });
});
```

### Development Environment Setup

**Required Tools:**

- Node.js (LTS version)
- pnpm or npm
- Git
- Code editor (VS Code recommended with TypeScript/ESLint extensions)

**Initial Setup:**

1. Clone repository
2. Copy `.env.example` to `.env.local` and fill in API credentials
3. Run `pnpm install` (or `npm install`)
4. Run `pnpm dev` to start development server
5. Access at `http://localhost:3000`

### Pre-commit Checklist

Before committing code:

- [ ] Run linter and fix all errors
- [ ] Run type checker (no TypeScript errors)
- [ ] Run tests (if test suite exists)
- [ ] Format code with Prettier
- [ ] Review changes with `git diff`
- [ ] Verify no API keys or secrets in code
- [ ] Write clear commit message

### Build Process

**Development Build:**

```bash
pnpm dev          # Start dev server with hot reload
```

**Production Build:**

```bash
pnpm build        # Create optimized production build
pnpm start        # Start production server locally
```

**Build Verification:**

- Ensure no TypeScript errors
- Check for build warnings
- Verify bundle size is reasonable
- Test production build locally before deploying

## Project-Specific Notes

### Rainfall Data Priority

**Critical Requirement**: CoCoRaHS manual observations ALWAYS take priority over automated rain gauge data.

- When displaying rainfall, check for CoCoRaHS data first
- If CoCoRaHS data is unavailable for a given date, fall back to weather station data
- Always indicate the data source in the UI (badge or icon showing "CoCoRaHS" vs "Station")
- Consider showing both values when available for comparison

### Data Source Reliability

**Primary Sources:**

- Temperature, humidity, wind, pressure: Ambient Weather (most current)
- Rainfall: CoCoRaHS (most accurate)

**Backup Sources:**

- PWS Weather and Wunderground serve as fallbacks if primary sources fail
- Display warnings when using backup/cached data

### UI/UX Inspiration

Draw design inspiration from:

- Ambient Weather dashboard - Clean data presentation
- PWS Weather - Specific features you prefer (document as you discover them)
- Weather Underground - Specific features you prefer (document as you discover them)

Document specific UI elements you want to replicate as you develop the application.

### Future Enhancements

Ideas to consider for future development:

- Historical data visualization and trends
- Weather alerts and notifications
- Mobile-responsive design
- Data export functionality
- Comparison views (CoCoRaHS vs station rainfall)
- Weather statistics (monthly/yearly summaries)

### Project Status Updates

As the project evolves, update the "Current Status" section in Project Overview to reflect:

- Current development phase
- Completed features
- Known issues or limitations
- Next priorities

### Remember

- This is a personal project - prioritize features that matter to you
- Don't over-engineer - start simple and add complexity as needed
- Document decisions and learnings in this file or project documentation
- Update this CLAUDE.md as patterns emerge and requirements change
