"use client";

import { useState, useEffect } from "react";
import type { AmbientWeatherDevice, AmbientWeatherData } from "@/types/ambient-weather";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export default function DashboardPage() {
  const [devices, setDevices] = useState<AmbientWeatherDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<AmbientWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch latest data when device is selected
  useEffect(() => {
    if (selectedDevice) {
      fetchLatestData(selectedDevice);
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/weather/ambient?action=devices");
      const result: ApiResponse<AmbientWeatherDevice[]> = await response.json();

      if (result.success && result.data) {
        setDevices(result.data);
        // Auto-select first device
        if (result.data.length > 0) {
          setSelectedDevice(result.data[0].macAddress);
        }
      } else {
        setError(result.error || "Failed to fetch devices");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestData = async (macAddress: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/weather/ambient?action=latest&macAddress=${macAddress}`
      );
      const result: ApiResponse<AmbientWeatherData> = await response.json();

      if (result.success && result.data) {
        setLatestData(result.data);
      } else {
        setError(result.error || "Failed to fetch latest data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch latest data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Ambient Weather Dashboard</h1>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        )}

        {/* Devices List */}
        {devices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Devices</h2>
            <div className="grid gap-4">
              {devices.map((device) => (
                <button
                  key={device.macAddress}
                  onClick={() => setSelectedDevice(device.macAddress)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedDevice === device.macAddress
                      ? "bg-blue-100 border-blue-500 dark:bg-blue-900"
                      : "bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                  }`}
                >
                  <h3 className="font-semibold">{device.info.name}</h3>
                  {device.info.location && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {device.info.location}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {device.macAddress}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Latest Data */}
        {latestData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">Current Conditions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Temperature */}
              {latestData.tempf !== undefined && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Temperature</p>
                  <p className="text-3xl font-bold">{latestData.tempf}°F</p>
                  {latestData.feelsLike && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Feels like {latestData.feelsLike}°F
                    </p>
                  )}
                </div>
              )}

              {/* Humidity */}
              {latestData.humidity !== undefined && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Humidity</p>
                  <p className="text-3xl font-bold">{latestData.humidity}%</p>
                </div>
              )}

              {/* Wind */}
              {latestData.windspeedmph !== undefined && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Wind Speed</p>
                  <p className="text-3xl font-bold">{latestData.windspeedmph} mph</p>
                  {latestData.winddir && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Direction: {latestData.winddir}°
                    </p>
                  )}
                </div>
              )}

              {/* Pressure */}
              {latestData.baromrelin !== undefined && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Barometric Pressure</p>
                  <p className="text-3xl font-bold">{latestData.baromrelin} inHg</p>
                </div>
              )}

              {/* Rainfall */}
              {latestData.dailyrainin !== undefined && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Daily Rainfall</p>
                  <p className="text-3xl font-bold">{latestData.dailyrainin} in</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Note: Use CoCoRaHS data for accurate rainfall
                  </p>
                </div>
              )}

              {/* UV Index */}
              {latestData.uv !== undefined && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">UV Index</p>
                  <p className="text-3xl font-bold">{latestData.uv}</p>
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last updated: {new Date(latestData.dateutc).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* No devices message */}
        {!loading && devices.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No devices found. Please check your API credentials.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Make sure AMBIENT_WEATHER_API_KEY and AMBIENT_WEATHER_APP_KEY are set in .env.local
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
