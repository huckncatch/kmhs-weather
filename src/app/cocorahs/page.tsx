"use client";

import { useState, useEffect } from "react";
import type {
  CoCoRaHSObservation,
  CoCoRaHSApiResponse,
  CreateObservationRequest,
} from "@/types/cocorahs";
import { CoCoRaHSSyncPanel } from "@/components/weather/CoCoRaHSSyncPanel";

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

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);

  // CSV import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

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
      if (editingId) {
        // Update existing observation
        const updateData = {
          rainfall: parseFloat(formData.rainfall),
          ...(formData.snowfall && { snowfall: parseFloat(formData.snowfall) }),
          ...(formData.notes && { notes: formData.notes }),
        };

        const response = await fetch(`/api/cocorahs?id=${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        const result: CoCoRaHSApiResponse<CoCoRaHSObservation> = await response.json();

        if (result.success) {
          setSuccess("Observation updated successfully!");
          setEditingId(null);
          setFormData({
            date: new Date().toISOString().split("T")[0],
            rainfall: "",
            snowfall: "",
            notes: "",
          });
          fetchObservations();
        } else {
          setError(result.error || "Failed to update observation");
        }
      } else {
        // Create new observation
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save observation");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (obs: CoCoRaHSObservation) => {
    setEditingId(obs.id);
    setFormData({
      date: obs.date,
      rainfall: obs.rainfall.toString(),
      snowfall: obs.snowfall?.toString() || "",
      notes: obs.notes || "",
    });
    // Clear any previous messages
    setError(null);
    setSuccess(null);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      rainfall: "",
      snowfall: "",
      notes: "",
    });
    setError(null);
    setSuccess(null);
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
        // If we were editing this observation, cancel edit mode
        if (editingId === id) {
          handleCancelEdit();
        }
        fetchObservations();
      } else {
        setError(result.error || "Failed to delete observation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete observation");
    }
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const csvContent = await file.text();

      const response = await fetch("/api/cocorahs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });

      const result = await response.json();

      if (result.success) {
        const { imported, skipped, errors, parseWarnings } = result.data;
        let message = `✅ Import complete! ${imported} observations imported`;
        if (skipped > 0) message += `, ${skipped} skipped (already exist)`;
        if (errors && errors.length > 0) {
          message += `\n\n⚠️ ${errors.length} errors:\n${errors.slice(0, 5).join("\n")}`;
          if (errors.length > 5) message += `\n...and ${errors.length - 5} more`;
        }
        if (parseWarnings && parseWarnings.length > 0) {
          message += `\n\nWarnings:\n${parseWarnings.slice(0, 3).join("\n")}`;
        }
        setImportResult(message);
        fetchObservations();
      } else {
        setError(result.error || "Failed to import CSV");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = "";
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">
                {editingId ? "Edit Observation" : "New Observation"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕ Cancel
                </button>
              )}
            </div>
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
                  disabled={!!editingId}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:cursor-not-allowed"
                />
                {editingId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Date cannot be changed when editing
                  </p>
                )}
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
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading
                    ? editingId
                      ? "Updating..."
                      : "Saving..."
                    : editingId
                      ? "Update Observation"
                      : "Save Observation"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* CSV Import Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4">Import from CSV</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload a CoCoRaHS CSV export to bulk import historical observations.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="csv-upload"
                  className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                >
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="mt-2 text-sm font-medium">
                      {importing ? "Importing..." : "Click to upload CSV file"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      CoCoRaHS CSV export format
                    </p>
                  </div>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvImport}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>

              {importResult && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <pre className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap font-mono">
                    {importResult}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Sync from CoCoRaHS */}
          <div className="lg:col-span-2">
            <CoCoRaHSSyncPanel onSyncComplete={fetchObservations} />
          </div>

          {/* Observations List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 lg:col-span-2">
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
                    className={`border rounded-lg p-4 transition-colors ${
                      editingId === obs.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
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
                            {obs.rainfall}&quot; rain
                          </p>
                          {obs.snowfall !== undefined && obs.snowfall > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {obs.snowfall}&quot; snow
                            </p>
                          )}
                        </div>
                        {obs.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {obs.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(obs)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(obs.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
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
