'use client'

import { useState } from 'react'
import type { CoCoRaHSApiResponse } from '@/types/cocorahs'

type SyncMode = 'missing' | 'recent' | 'all' | 'range'

interface SyncResult {
  imported: number
  skipped: number
  errors: string[]
}

interface CoCoRaHSSyncPanelProps {
  onSyncComplete: () => void
}

export function CoCoRaHSSyncPanel({ onSyncComplete }: CoCoRaHSSyncPanelProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<SyncMode>('recent')
  const [days, setDays] = useState(30)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)
    setError(null)

    const body: Record<string, unknown> = { mode }
    if (mode === 'recent') body.days = days
    if (mode === 'range') { body.startDate = startDate; body.endDate = endDate }

    try {
      const res = await fetch('/api/cocorahs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: CoCoRaHSApiResponse<SyncResult> = await res.json()

      if (data.success && data.data) {
        setResult(data.data)
        onSyncComplete()
      } else {
        setError(data.error ?? 'Sync failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        Sync from CoCoRaHS
        <span className="text-sm font-normal text-gray-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Mode selector */}
          <div className="space-y-2">
            {(['missing', 'recent', 'all', 'range'] as SyncMode[]).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sync-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  disabled={syncing}
                />
                <span className="text-sm">
                  {m === 'missing' && 'Missing dates only'}
                  {m === 'recent' && (
                    <span className="flex items-center gap-2">
                      Last
                      <input
                        type="number"
                        min={1}
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value) || 30)}
                        disabled={syncing || mode !== 'recent'}
                        className="w-16 px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-50"
                      />
                      days
                    </span>
                  )}
                  {m === 'all' && 'All history (since 2000-01-01)'}
                  {m === 'range' && (
                    <span className="flex items-center gap-2">
                      Date range
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={syncing || mode !== 'range'}
                        className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-50"
                      />
                      to
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={syncing || mode !== 'range'}
                        className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-50"
                      />
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleSync}
            disabled={syncing || (mode === 'range' && (!startDate || !endDate))}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            {syncing && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {syncing ? 'Syncing…' : 'Run Sync'}
          </button>

          {/* Result */}
          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-900 dark:text-green-100">
              Imported {result.imported}, skipped {result.skipped}
              {result.errors.length > 0 && (
                <div className="mt-1 text-yellow-700 dark:text-yellow-300">
                  {result.errors.length} error(s): {result.errors[0]}
                  {result.errors.length > 1 && ` (+${result.errors.length - 1} more)`}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-900 dark:text-red-100">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
