/**
 * CoCoRaHS Data Storage Service
 * Handles persistence of rainfall observations to JSON file
 *
 * This is the data access layer - when migrating to a database later,
 * only this file needs to change. All API routes stay the same.
 */

import { promises as fs } from "fs";
import path from "path";
import type {
  CoCoRaHSObservation,
  CoCoRaHSStorage,
  CreateObservationRequest,
  UpdateObservationRequest,
} from "@/types/cocorahs";

const DATA_FILE = path.join(process.cwd(), "data", "cocorahs.json");
const STORAGE_VERSION = "1.0";

/**
 * Initialize storage file if it doesn't exist
 */
async function ensureStorageFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    // File doesn't exist, create it
    const initialData: CoCoRaHSStorage = {
      observations: [],
      version: STORAGE_VERSION,
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

/**
 * Read all observations from storage
 */
async function readStorage(): Promise<CoCoRaHSStorage> {
  await ensureStorageFile();
  const data = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

/**
 * Write observations to storage
 */
async function writeStorage(storage: CoCoRaHSStorage): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(storage, null, 2), "utf-8");
}

/**
 * Generate a unique ID for an observation
 */
function generateId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all observations, optionally filtered by date range
 */
export async function getAllObservations(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<CoCoRaHSObservation[]> {
  const storage = await readStorage();
  let observations = storage.observations;

  // Filter by date range if provided
  if (options?.startDate) {
    observations = observations.filter((obs) => obs.date >= options.startDate!);
  }
  if (options?.endDate) {
    observations = observations.filter((obs) => obs.date <= options.endDate!);
  }

  // Sort by date descending (most recent first)
  return observations.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get a single observation by ID
 */
export async function getObservationById(id: string): Promise<CoCoRaHSObservation | null> {
  const storage = await readStorage();
  return storage.observations.find((obs) => obs.id === id) || null;
}

/**
 * Get observation for a specific date
 */
export async function getObservationByDate(date: string): Promise<CoCoRaHSObservation | null> {
  const storage = await readStorage();
  return storage.observations.find((obs) => obs.date === date) || null;
}

/**
 * Create a new observation
 */
export async function createObservation(
  data: CreateObservationRequest,
  source: "manual" | "import" = "manual"
): Promise<CoCoRaHSObservation> {
  const storage = await readStorage();

  // Check if observation already exists for this date
  const existing = storage.observations.find((obs) => obs.date === data.date);
  if (existing) {
    throw new Error(`Observation already exists for date ${data.date}`);
  }

  const now = new Date().toISOString();
  const observation: CoCoRaHSObservation = {
    id: generateId(),
    date: data.date,
    rainfall: data.rainfall,
    snowfall: data.snowfall,
    notes: data.notes,
    source,
    createdAt: now,
    updatedAt: now,
  };

  storage.observations.push(observation);
  await writeStorage(storage);

  return observation;
}

/**
 * Update an existing observation
 */
export async function updateObservation(
  id: string,
  updates: UpdateObservationRequest
): Promise<CoCoRaHSObservation> {
  const storage = await readStorage();
  const index = storage.observations.findIndex((obs) => obs.id === id);

  if (index === -1) {
    throw new Error(`Observation not found: ${id}`);
  }

  const observation = storage.observations[index];
  storage.observations[index] = {
    ...observation,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeStorage(storage);
  return storage.observations[index];
}

/**
 * Delete an observation
 */
export async function deleteObservation(id: string): Promise<void> {
  const storage = await readStorage();
  const index = storage.observations.findIndex((obs) => obs.id === id);

  if (index === -1) {
    throw new Error(`Observation not found: ${id}`);
  }

  storage.observations.splice(index, 1);
  await writeStorage(storage);
}

/**
 * Bulk import observations (for CSV import - Phase 2)
 */
export async function bulkImportObservations(
  observations: CreateObservationRequest[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const storage = await readStorage();
  const existingDates = new Set(storage.observations.map((obs) => obs.date));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const obs of observations) {
    try {
      if (existingDates.has(obs.date)) {
        skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const observation: CoCoRaHSObservation = {
        id: generateId(),
        date: obs.date,
        rainfall: obs.rainfall,
        snowfall: obs.snowfall,
        notes: obs.notes,
        source: "import",
        createdAt: now,
        updatedAt: now,
      };

      storage.observations.push(observation);
      existingDates.add(obs.date);
      imported++;
    } catch (error) {
      errors.push(`Date ${obs.date}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  await writeStorage(storage);

  return { imported, skipped, errors };
}
