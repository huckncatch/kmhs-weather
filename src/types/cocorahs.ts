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

  /** Rainfall amount in inches */
  rainfall: number;

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
  snowfall?: number;
  notes?: string;
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
