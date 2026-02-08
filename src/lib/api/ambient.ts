/**
 * Ambient Weather API Client
 * Handles communication with the Ambient Weather REST API
 * Documentation: https://github.com/ambient-weather/api-docs
 */

import type {
  AmbientWeatherDevice,
  AmbientWeatherData,
  AmbientWeatherApiParams,
  AmbientWeatherDeviceQueryParams,
} from "@/types/ambient-weather";

const BASE_URL = "https://rt.ambientweather.net/v1";

/**
 * Rate limiting: 1 request/second per apiKey, 3 requests/second per applicationKey
 * Consider implementing a rate limiter if making frequent requests
 */

/**
 * Fetch all devices for a user
 */
export async function getDevices(
  params: AmbientWeatherApiParams
): Promise<AmbientWeatherDevice[]> {
  const url = new URL(`${BASE_URL}/devices`);
  url.searchParams.append("applicationKey", params.applicationKey);
  url.searchParams.append("apiKey", params.apiKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    // Cache for 5 minutes as recommended in CLAUDE.md
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ambient Weather API error (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Fetch data from a specific device
 */
export async function getDeviceData(
  params: AmbientWeatherDeviceQueryParams
): Promise<AmbientWeatherData[]> {
  const { macAddress, applicationKey, apiKey, endDate, limit } = params;

  const url = new URL(`${BASE_URL}/devices/${macAddress}`);
  url.searchParams.append("applicationKey", applicationKey);
  url.searchParams.append("apiKey", apiKey);

  if (endDate !== undefined) {
    url.searchParams.append("endDate", String(endDate));
  }

  if (limit !== undefined) {
    url.searchParams.append("limit", String(Math.min(limit, 288)));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    // Cache for 5 minutes
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Rate limit exceeded. Ambient Weather API: 1 req/sec per apiKey, 3 req/sec per applicationKey"
      );
    }

    const errorText = await response.text();
    throw new Error(
      `Ambient Weather API error (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Get the most recent data from a device
 * Convenience wrapper around getDeviceData with limit=1
 */
export async function getLatestDeviceData(
  params: Omit<AmbientWeatherDeviceQueryParams, "limit" | "endDate">
): Promise<AmbientWeatherData | null> {
  const data = await getDeviceData({ ...params, limit: 1 });
  return data.length > 0 ? data[0] : null;
}

/**
 * Helper to validate API credentials are configured
 */
export function validateApiCredentials(): {
  applicationKey: string;
  apiKey: string;
} {
  const applicationKey = process.env.AMBIENT_WEATHER_APP_KEY;
  const apiKey = process.env.AMBIENT_WEATHER_API_KEY;

  if (!applicationKey || !apiKey) {
    throw new Error(
      "Ambient Weather API credentials not configured. Please set AMBIENT_WEATHER_APP_KEY and AMBIENT_WEATHER_API_KEY in .env.local"
    );
  }

  return { applicationKey, apiKey };
}
