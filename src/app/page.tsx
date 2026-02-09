"use client";

import { useState, useEffect } from "react";
import { RainfallDisplay, RainfallBadge } from "@/components/weather/RainfallDisplay";
import type { AmbientWeatherDevice } from "@/types/ambient-weather";
import type { CoCoRaHSObservation, CoCoRaHSApiResponse } from "@/types/cocorahs";
import type { UnifiedWeatherData, RainfallData } from "@/lib/data/weather-aggregator";
import { aggregateCurrentWeather, getRainfallHistory } from "@/lib/data/weather-aggregator";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function Home() {
  const [weatherData, setWeatherData] = useState<UnifiedWeatherData | null>(null);
  const [rainfallHistory, setRainfallHistory] = useState<RainfallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Ambient Weather devices
      const devicesResponse = await fetch("/api/weather/ambient?action=devices");
      const devicesResult: ApiResponse<AmbientWeatherDevice[]> = await devicesResponse.json();

      if (!devicesResult.success || !devicesResult.data || devicesResult.data.length === 0) {
        throw new Error("No weather devices found");
      }

      const device = devicesResult.data[0];
      const latestData = device.lastData;

      // Fetch today's CoCoRaHS observation
      const today = new Date().toISOString().split("T")[0];
      const cocorahsResponse = await fetch("/api/cocorahs");
      const cocorahsResult: CoCoRaHSApiResponse<CoCoRaHSObservation[]> =
        await cocorahsResponse.json();

      const todaysCoCoRaHS = cocorahsResult.data?.find((obs) => obs.date === today);

      // Aggregate current weather
      const location = (device.info as any).coords?.location;
      const unified = aggregateCurrentWeather(latestData, todaysCoCoRaHS, {
        name: device.info.name,
        location,
      });

      setWeatherData(unified);

      // Get rainfall history (last 7 days)
      if (cocorahsResult.data) {
        const history = getRainfallHistory(7, [latestData], cocorahsResult.data);
        setRainfallHistory(history);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-xl text-gray-600 dark:text-gray-400">Loading weather data...</div>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error || "Failed to load weather data"}</p>
          <button
            onClick={fetchAllData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            {weatherData.stationName || "Weather Dashboard"}
          </h1>
          {weatherData.location && (
            <p className="text-gray-600 dark:text-gray-400">{weatherData.location}</p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Last updated: {new Date(weatherData.lastUpdate).toLocaleString()}
          </p>
        </div>

        {/* Main Weather Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Temperature */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Temperature
            </h2>
            <div className="text-5xl font-bold mb-2">{weatherData.temperature.current}°F</div>
            {weatherData.temperature.feelsLike && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Feels like {weatherData.temperature.feelsLike}°F
              </p>
            )}
            {weatherData.temperature.indoor && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Indoor: {weatherData.temperature.indoor}°F
              </p>
            )}
          </div>

          {/* Humidity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Humidity</h2>
            <div className="text-5xl font-bold mb-2">
              {weatherData.humidity.outdoor ?? "--"}%
            </div>
            {weatherData.humidity.indoor && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Indoor: {weatherData.humidity.indoor}%
              </p>
            )}
          </div>

          {/* Wind */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Wind</h2>
            <div className="text-5xl font-bold mb-2">{weatherData.wind.speed} mph</div>
            {weatherData.wind.direction !== undefined && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Direction: {weatherData.wind.direction}°
              </p>
            )}
            {weatherData.wind.gust && weatherData.wind.gust > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Gusts: {weatherData.wind.gust} mph
              </p>
            )}
          </div>

          {/* Rainfall - PRIORITY DISPLAY */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:col-span-2 lg:col-span-1">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              Rainfall Today
            </h2>
            <RainfallDisplay data={weatherData.rainfall} showComparison={true} />
          </div>

          {/* Pressure */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Barometric Pressure
            </h2>
            <div className="text-4xl font-bold mb-2">
              {weatherData.pressure.relative?.toFixed(2) ?? "--"} inHg
            </div>
          </div>

          {/* UV Index */}
          {weatherData.uv !== undefined && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                UV Index
              </h2>
              <div className="text-5xl font-bold mb-2">{weatherData.uv}</div>
            </div>
          )}
        </div>

        {/* Rainfall History */}
        {rainfallHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">Recent Rainfall (Last 7 Days)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                      Rainfall
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rainfallHistory.map((day) => (
                    <tr
                      key={day.date}
                      className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <td className="py-3 px-4">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold">{day.amount.toFixed(2)}"</td>
                      <td className="py-3 px-4">
                        <RainfallBadge data={day} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 flex gap-4 flex-wrap">
          <a
            href="/cocorahs"
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Enter Rainfall Observation
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Detailed View
          </a>
        </div>
      </div>
    </div>
  );
}
