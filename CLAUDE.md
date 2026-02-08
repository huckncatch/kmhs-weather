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
