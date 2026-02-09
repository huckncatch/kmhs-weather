/**
 * Rainfall Display Component
 * Shows rainfall with source badge (CoCoRaHS green, Station gray)
 * Displays station value in smaller text when CoCoRaHS data exists
 */

import type { RainfallData } from "@/lib/data/weather-aggregator";

interface RainfallDisplayProps {
  data: RainfallData;
  showComparison?: boolean; // Show station value when CoCoRaHS exists
}

export function RainfallDisplay({ data, showComparison = true }: RainfallDisplayProps) {
  const isCoCoRaHS = data.source === "cocorahs";

  return (
    <div className="space-y-3">
      {/* Main rainfall value with larger text */}
      <div className="flex items-baseline gap-4">
        <span className="text-6xl font-bold text-green-700 dark:text-green-300">
          {data.amount.toFixed(2)}&quot;
        </span>
        <span
          className={`px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide shadow-md ${
            isCoCoRaHS
              ? "bg-green-600 text-white dark:bg-green-700"
              : "bg-gray-400 text-white dark:bg-gray-600"
          }`}
        >
          {isCoCoRaHS ? "CoCoRaHS" : "Station Gauge"}
        </span>
      </div>

      {/* Show station comparison if CoCoRaHS data exists */}
      {showComparison && isCoCoRaHS && data.stationAmount !== undefined && (
        <div className="text-base text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-900/30 p-3 rounded-lg">
          <span className="font-medium">Station gauge:</span> {data.stationAmount.toFixed(2)}&quot;
          {Math.abs(data.amount - data.stationAmount) > 0.01 && (
            <span className="ml-2 font-semibold text-gray-600 dark:text-gray-400">
              ({data.amount > data.stationAmount ? "+" : ""}
              {(data.amount - data.stationAmount).toFixed(2)}&quot;)
            </span>
          )}
        </div>
      )}

      {/* Note about CoCoRaHS priority */}
      {!isCoCoRaHS && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border-l-3 border-yellow-400">
          ℹ️ Manual CoCoRaHS observations take priority when available
        </div>
      )}
    </div>
  );
}

/**
 * Compact rainfall display for cards/summaries
 */
export function RainfallBadge({ data }: { data: RainfallData }) {
  const isCoCoRaHS = data.source === "cocorahs";

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm ${
          isCoCoRaHS
            ? "bg-green-600 text-white dark:bg-green-700"
            : "bg-gray-400 text-white dark:bg-gray-600"
        }`}
      >
        {isCoCoRaHS ? "🌧️ CoCoRaHS" : "📡 Gauge"}
      </span>
    </div>
  );
}
