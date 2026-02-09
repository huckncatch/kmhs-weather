"use client";

import { useState, useEffect } from "react";
import type {
  CoCoRaHSObservation,
  CoCoRaHSApiResponse,
  CreateObservationRequest,
} from "@/types/cocorahs";

export default function CoCoRaHSPage() {
  const [observations, setObservations] = useState<CoCoRaHSObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0], // Today's date
    rainfall: "",
    snowfall: "",
    notes: "",
  });

  useEffect(() => {
    fetchObservations();
  }, []);

  const fetchObservations = async () => {
    try {
      const response = await fetch("/api/cocorahs");
      const result: CoCoRaHSApiResponse<CoCoRaHSObservation[]> = await response.json();

      if (result.success && result.data) {
        setObservations(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch observations:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const requestData: CreateObservationRequest = {
        date: formData.date,
        rainfall: parseFloat(formData.rainfall),
        ...(formData.snowfall && { snowfall: parseFloat(formData.snowfall) }),
        ...(formData.notes && { notes: formData.notes }),
      };

      const response = await fetch("/api/cocorahs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const result: CoCoRaHSApiResponse<CoCoRaHSObservation> = await response.json();

      if (result.success) {
        setSuccess("Observation saved successfully!");
        setFormData({
          date: new Date().toISOString().split("T")[0],
          rainfall: "",
          snowfall: "",
          notes: "",
        });
        fetchObservations();
      } else {
        setError(result.error || "Failed to save observation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save observation");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this observation?")) {
      return;
    }

    try {
      const response = await fetch(`/api/cocorahs?id=${id}`, {
        method: "DELETE",
      });

      const result: CoCoRaHSApiResponse<null> = await response.json();

      if (result.success) {
        setSuccess("Observation deleted successfully!");
        fetchObservations();
      } else {
        setError(result.error || "Failed to delete observation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete observation");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">CoCoRaHS Rainfall Entry</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manual rainfall observations - Primary source for accurate precipitation data
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Entry Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">New Observation</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Rainfall */}
              <div>
                <label htmlFor="rainfall" className="block text-sm font-medium mb-2">
                  Rainfall (inches) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="rainfall"
                  step="0.01"
                  min="0"
                  value={formData.rainfall}
                  onChange={(e) => setFormData({ ...formData, rainfall: e.target.value })}
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Snowfall */}
              <div>
                <label htmlFor="snowfall" className="block text-sm font-medium mb-2">
                  Snowfall (inches) <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  id="snowfall"
                  step="0.01"
                  min="0"
                  value={formData.snowfall}
                  onChange={(e) => setFormData({ ...formData, snowfall: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-2">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional observations..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? "Saving..." : "Save Observation"}
              </button>
            </form>
          </div>

          {/* Observations List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">Recent Observations</h2>

            {observations.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No observations yet.</p>
                <p className="text-sm mt-2">Add your first rainfall observation!</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">
                          {new Date(obs.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {obs.rainfall}" rain
                          </p>
                          {obs.snowfall !== undefined && obs.snowfall > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {obs.snowfall}" snow
                            </p>
                          )}
                        </div>
                        {obs.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {obs.notes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(obs.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {obs.source}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Added {new Date(obs.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
