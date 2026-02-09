/**
 * Weather Data Aggregator
 * Combines data from multiple sources (Ambient Weather, CoCoRaHS, etc.)
 * following the priority rules defined in CLAUDE.md
 */

import type { AmbientWeatherData } from "@/types/ambient-weather";
import type { CoCoRaHSObservation } from "@/types/cocorahs";

/**
 * Unified rainfall data with source tracking
 */
export interface RainfallData {
  amount: number; // inches
  source: "cocorahs" | "station";
  date: string;
  hasCoCoRaHS: boolean; // Whether CoCoRaHS data exists for this date
  stationAmount?: number; // Station gauge reading for comparison
}

/**
 * Unified weather data combining all sources
 */
export interface UnifiedWeatherData {
  // Current conditions (from Ambient Weather)
  temperature: {
    current: number;
    feelsLike?: number;
    indoor?: number;
    unit: "F" | "C";
  };
  humidity: {
    outdoor?: number;
    indoor?: number;
  };
  wind: {
    speed: number;
    direction?: number;
    gust?: number;
  };
  pressure: {
    relative?: number;
    absolute?: number;
    unit: "inHg";
  };

  // Rainfall (prioritizes CoCoRaHS)
  rainfall: RainfallData;

  // Additional data
  uv?: number;
  solarRadiation?: number;

  // Metadata
  lastUpdate: string; // ISO timestamp
  stationName?: string;
  location?: string;
}

/**
 * Get rainfall for a specific date, prioritizing CoCoRaHS
 * @param date ISO date string (YYYY-MM-DD)
 * @param stationData Weather station data
 * @param cocorahsData CoCoRaHS observation for this date (if exists)
 */
export function getRainfallForDate(
  date: string,
  stationData?: { dailyrainin?: number },
  cocorahsData?: CoCoRaHSObservation
): RainfallData {
  // CoCoRaHS takes priority if available
  if (cocorahsData) {
    return {
      amount: cocorahsData.rainfall,
      source: "cocorahs",
      date,
      hasCoCoRaHS: true,
      stationAmount: stationData?.dailyrainin,
    };
  }

  // Fall back to station gauge
  return {
    amount: stationData?.dailyrainin ?? 0,
    source: "station",
    date,
    hasCoCoRaHS: false,
  };
}

/**
 * Aggregate current weather data from all sources
 */
export function aggregateCurrentWeather(
  ambientData: AmbientWeatherData,
  todaysCoCoRaHS?: CoCoRaHSObservation,
  stationInfo?: { name?: string; location?: string }
): UnifiedWeatherData {
  const today = new Date().toISOString().split("T")[0];

  return {
    temperature: {
      current: ambientData.tempf ?? 0,
      feelsLike: ambientData.feelsLike,
      indoor: ambientData.tempinf,
      unit: "F",
    },
    humidity: {
      outdoor: ambientData.humidity,
      indoor: ambientData.humidityin,
    },
    wind: {
      speed: ambientData.windspeedmph ?? 0,
      direction: ambientData.winddir,
      gust: ambientData.windgustmph,
    },
    pressure: {
      relative: ambientData.baromrelin,
      absolute: ambientData.baromabsin,
      unit: "inHg",
    },
    rainfall: getRainfallForDate(
      today,
      { dailyrainin: ambientData.dailyrainin },
      todaysCoCoRaHS
    ),
    uv: ambientData.uv,
    solarRadiation: ambientData.solarradiation,
    lastUpdate: ambientData.date,
    stationName: stationInfo?.name,
    location: stationInfo?.location,
  };
}

/**
 * Get rainfall history for the last N days
 */
export function getRainfallHistory(
  days: number,
  stationHistory: AmbientWeatherData[],
  cocorahsObservations: CoCoRaHSObservation[]
): RainfallData[] {
  const history: RainfallData[] = [];
  const today = new Date();

  // Create a map of CoCoRaHS observations by date for quick lookup
  const cocorahsMap = new Map<string, CoCoRaHSObservation>();
  cocorahsObservations.forEach((obs) => {
    cocorahsMap.set(obs.date, obs);
  });

  // Generate history for last N days
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    // Find station data for this date
    const stationData = stationHistory.find((data) => {
      const dataDate = new Date(data.date).toISOString().split("T")[0];
      return dataDate === dateStr;
    });

    // Get CoCoRaHS data if exists
    const cocorahs = cocorahsMap.get(dateStr);

    history.push(
      getRainfallForDate(
        dateStr,
        { dailyrainin: stationData?.dailyrainin },
        cocorahs
      )
    );
  }

  return history;
}
