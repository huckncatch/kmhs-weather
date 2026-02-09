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
      const deviceInfo = device.info as { name: string; coords?: { location?: string } };
      const location = deviceInfo.coords?.location;
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
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Header with enhanced styling */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-l-4 border-blue-600">
          <h1 className="text-5xl font-bold mb-3 text-gray-900 dark:text-white">
            {weatherData.stationName || "Weather Dashboard"}
          </h1>
          {weatherData.location && (
            <p className="text-lg text-gray-600 dark:text-gray-300 flex items-center gap-2">
              📍 {weatherData.location}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: {new Date(weatherData.lastUpdate).toLocaleString()}
          </p>
        </div>

        {/* Main Weather Grid with improved styling */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Temperature - Larger, more prominent */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
              🌡️ Temperature
            </h2>
            <div className="text-7xl font-bold mb-3 text-blue-600 dark:text-blue-400">
              {weatherData.temperature.current}°
            </div>
            {weatherData.temperature.feelsLike && (
              <p className="text-base text-gray-700 dark:text-gray-300">
                Feels like <span className="font-semibold">{weatherData.temperature.feelsLike}°F</span>
              </p>
            )}
            {weatherData.temperature.indoor && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                Indoor: {weatherData.temperature.indoor}°F
              </p>
            )}
          </div>

          {/* Humidity with visual enhancement */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
              💧 Humidity
            </h2>
            <div className="text-7xl font-bold mb-3 text-cyan-600 dark:text-cyan-400">
              {weatherData.humidity.outdoor ?? "--"}%
            </div>
            {weatherData.humidity.indoor && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                Indoor: {weatherData.humidity.indoor}%
              </p>
            )}
          </div>

          {/* Wind with circular direction indicator */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
              💨 Wind
            </h2>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-6xl font-bold text-green-600 dark:text-green-400">
                {weatherData.wind.speed}
              </div>
              <div className="text-2xl text-gray-600 dark:text-gray-400">mph</div>
            </div>
            {weatherData.wind.direction !== undefined && (
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center"
                  style={{ transform: `rotate(${weatherData.wind.direction}deg)` }}
                >
                  <span className="text-xl">↑</span>
                </div>
                <p className="text-base text-gray-700 dark:text-gray-300">
                  {weatherData.wind.direction}°
                </p>
              </div>
            )}
            {weatherData.wind.gust && weatherData.wind.gust > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                Gusts: <span className="font-semibold">{weatherData.wind.gust} mph</span>
              </p>
            )}
          </div>

          {/* Rainfall - PRIORITY DISPLAY with enhanced styling */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl shadow-lg p-8 border-2 border-green-300 dark:border-green-700 md:col-span-2 lg:col-span-1 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-sm font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide mb-4">
              🌧️ Rainfall Today
            </h2>
            <RainfallDisplay data={weatherData.rainfall} showComparison={true} />
          </div>

          {/* Pressure */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
              🔽 Barometric Pressure
            </h2>
            <div className="text-5xl font-bold mb-2 text-purple-600 dark:text-purple-400">
              {weatherData.pressure.relative?.toFixed(2) ?? "--"}
            </div>
            <div className="text-base text-gray-600 dark:text-gray-400">inHg</div>
          </div>

          {/* UV Index with color coding */}
          {weatherData.uv !== undefined && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300">
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
                ☀️ UV Index
              </h2>
              <div
                className={`text-7xl font-bold mb-2 ${
                  weatherData.uv <= 2 ? "text-green-600 dark:text-green-400" :
                  weatherData.uv <= 5 ? "text-yellow-600 dark:text-yellow-400" :
                  weatherData.uv <= 7 ? "text-orange-600 dark:text-orange-400" :
                  "text-red-600 dark:text-red-400"
                }`}
              >
                {weatherData.uv}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {weatherData.uv <= 2 ? "Low" :
                 weatherData.uv <= 5 ? "Moderate" :
                 weatherData.uv <= 7 ? "High" :
                 "Very High"}
              </p>
            </div>
          )}
        </div>

        {/* Rainfall History with enhanced styling */}
        {rainfallHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              📊 Recent Rainfall <span className="text-lg font-normal text-gray-500">(Last 7 Days)</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 uppercase text-sm">
                      Date
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 uppercase text-sm">
                      Rainfall
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 uppercase text-sm">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rainfallHistory.map((day) => (
                    <tr
                      key={day.date}
                      className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200"
                    >
                      <td className="py-4 px-4 text-gray-900 dark:text-gray-100">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4 text-xl font-bold text-blue-600 dark:text-blue-400">
                        {day.amount.toFixed(2)}&quot;
                      </td>
                      <td className="py-4 px-4">
                        <RainfallBadge data={day} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
