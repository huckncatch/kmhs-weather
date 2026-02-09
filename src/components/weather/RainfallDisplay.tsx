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
    <div className="space-y-2">
      {/* Main rainfall value */}
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-bold">{data.amount.toFixed(2)}"</span>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${
            isCoCoRaHS
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          }`}
        >
          {isCoCoRaHS ? "CoCoRaHS" : "Station Gauge"}
        </span>
      </div>

      {/* Show station comparison if CoCoRaHS data exists */}
      {showComparison && isCoCoRaHS && data.stationAmount !== undefined && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Station gauge: {data.stationAmount.toFixed(2)}"
          {Math.abs(data.amount - data.stationAmount) > 0.01 && (
            <span className="ml-2">
              ({data.amount > data.stationAmount ? "+" : ""}
              {(data.amount - data.stationAmount).toFixed(2)}")
            </span>
          )}
        </div>
      )}

      {/* Note about CoCoRaHS priority */}
      {!isCoCoRaHS && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Note: Manual CoCoRaHS observations take priority when available
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
      <span className="font-semibold">{data.amount.toFixed(2)}"</span>
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${
          isCoCoRaHS
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        }`}
      >
        {isCoCoRaHS ? "CoCoRaHS" : "Gauge"}
      </span>
    </div>
  );
}
