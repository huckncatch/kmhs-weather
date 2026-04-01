/**
 * CoCoRaHS (Community Collaborative Rain, Hail and Snow Network)
 * Type definitions for manual rainfall observations
 *
 * CoCoRaHS data is the primary source for accurate rainfall measurements,
 * taking priority over automated weather station rain gauges.
 */

/**
 * Single rainfall observation from CoCoRaHS
 * This is the primary data model for rainfall data in the application
 */
export interface CoCoRaHSObservation {
  /** Unique identifier for this observation */
  id: string;

  /** Date of observation in ISO format (YYYY-MM-DD) */
  date: string;

  /** Rainfall amount in inches (Gauge Catch); 0.01 when isTrace is true */
  rainfall: number;

  /** True when the original CoCoRaHS observation was "T" (trace), not a measured value */
  isTrace?: boolean;

  /** Snowfall amount in inches (optional) */
  snowfall?: number;

  /** Additional notes or observations */
  notes?: string;

  /** Source of the data entry */
  source: 'manual' | 'import';

  /** When this record was created (ISO timestamp) */
  createdAt: string;

  /** When this record was last updated (ISO timestamp) */
  updatedAt: string;

  // Extended fields from CoCoRaHS CSV export (all optional)
  /** Time of observation (e.g., "7:00 AM") */
  obsTime?: string;

  /** Station number (e.g., "OR-CC-140") */
  stationNumber?: string;

  /** Station name (e.g., "Sandy 7.3 E") */
  stationName?: string;

  /** 24-hour snowfall - new snow depth in inches */
  snowfallNewDepth?: number;

  /** 24-hour snowfall - water content in inches */
  snowfallWaterContent?: number;

  /** 24-hour snowfall - snow-to-liquid ratio */
  snowfallSLR?: number;

  /** Total snowpack depth in inches */
  snowpackTotalDepth?: number;

  /** Snowpack water content in inches */
  snowpackWaterContent?: number;

  /** Snowpack density */
  snowpackDensity?: number;

  /** State (e.g., "OR") */
  state?: string;

  /** County (e.g., "Clackamas") */
  county?: string;
}

/**
 * Storage format for CoCoRaHS observations
 * Used for JSON file persistence
 */
export interface CoCoRaHSStorage {
  observations: CoCoRaHSObservation[];
  version: string; // Schema version for future migrations
}

/**
 * Request body for creating a new observation
 */
export interface CreateObservationRequest {
  date: string;
  rainfall: number;
  isTrace?: boolean;
  snowfall?: number;
  /** 24-hour new snow depth in inches */
  snowfallNewDepth?: number;
  notes?: string;
  // Extended fields from CSV import
  obsTime?: string;
  stationNumber?: string;
  stationName?: string;
  snowfallWaterContent?: number;
  snowfallSLR?: number;
  snowpackTotalDepth?: number;
  snowpackWaterContent?: number;
  snowpackDensity?: number;
  state?: string;
  county?: string;
}

/**
 * Request body for updating an existing observation
 */
export interface UpdateObservationRequest {
  rainfall?: number;
  snowfall?: number;
  notes?: string;
}

/**
 * API response wrapper
 */
export interface CoCoRaHSApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
