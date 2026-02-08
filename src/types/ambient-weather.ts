/**
 * Ambient Weather API Type Definitions
 * Based on official API documentation: https://github.com/ambient-weather/api-docs
 */

/**
 * Device information returned from the API
 */
export interface AmbientWeatherDevice {
  macAddress: string;
  info: {
    name: string;
    location?: string;
  };
  lastData: AmbientWeatherData;
}

/**
 * Weather data point from Ambient Weather station
 * Note: Not all fields may be present depending on device capabilities
 */
export interface AmbientWeatherData {
  dateutc: number; // Timestamp in milliseconds since epoch
  date: string; // Human-readable date string
  tz: string; // Timezone

  // Temperature (Fahrenheit)
  tempf?: number; // Outdoor temperature
  tempinf?: number; // Indoor temperature
  feelsLike?: number; // Feels like temperature
  dewPoint?: number; // Dew point

  // Humidity (%)
  humidity?: number; // Outdoor humidity
  humidityin?: number; // Indoor humidity

  // Wind (mph)
  windspeedmph?: number; // Current wind speed
  winddir?: number; // Wind direction in degrees (0-360)
  windgustmph?: number; // Wind gust speed
  maxdailygust?: number; // Maximum daily gust

  // Barometric Pressure (inHg)
  baromrelin?: number; // Relative barometric pressure
  baromabsin?: number; // Absolute barometric pressure

  // Rainfall (inches)
  hourlyrainin?: number; // Hourly rainfall
  dailyrainin?: number; // Daily rainfall
  weeklyrainin?: number; // Weekly rainfall
  monthlyrainin?: number; // Monthly rainfall
  yearlyrainin?: number; // Yearly rainfall
  totalrainin?: number; // Total rainfall since installation

  // Solar & UV
  solarradiation?: number; // Solar radiation (W/m²)
  uv?: number; // UV index

  // Additional sensors (battery status, etc.)
  battout?: number; // Outdoor sensor battery (0-1)
  battin?: number; // Indoor sensor battery (0-1)
}

/**
 * API Error Response
 */
export interface AmbientWeatherError {
  error: string;
  message?: string;
}

/**
 * API Request Parameters
 */
export interface AmbientWeatherApiParams {
  applicationKey: string;
  apiKey: string;
}

/**
 * Device Data Query Parameters
 */
export interface AmbientWeatherDeviceQueryParams extends AmbientWeatherApiParams {
  macAddress: string;
  endDate?: number | string; // Milliseconds since epoch or date string
  limit?: number; // Max 288, default 288
}
