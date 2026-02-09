/**
 * CSV Parser for CoCoRaHS observations
 * Handles parsing and validation of CoCoRaHS CSV exports
 */

import type { CreateObservationRequest } from "@/types/cocorahs";

export interface ParsedCsvRow {
  date: string;
  rainfall: number;
  // Extended CoCoRaHS fields
  obsTime?: string;
  stationNumber?: string;
  stationName?: string;
  snowfallNewDepth?: number;
  snowfallWaterContent?: number;
  snowfallSLR?: number;
  snowpackTotalDepth?: number;
  snowpackWaterContent?: number;
  snowpackDensity?: number;
  state?: string;
  county?: string;
  notes?: string;
}

export interface CsvParseResult {
  success: boolean;
  data?: ParsedCsvRow[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Parse CoCoRaHS CSV file
 * Expected columns: Obs Date, Obs Time, Station Number, Station Name,
 * Gauge Catch in., snowfall fields, State, County
 */
export function parseCoCoRaHSCsv(csvContent: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: ParsedCsvRow[] = [];

  try {
    // Split into lines and remove empty lines
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return {
        success: false,
        errors: ["CSV file is empty"],
      };
    }

    // Parse header (first line)
    const header = lines[0].split(",").map((h) => h.trim());

    // Find column indexes
    const colIndexes = {
      obsDate: header.findIndex((h) => h === "Obs Date"),
      obsTime: header.findIndex((h) => h === "Obs Time"),
      stationNumber: header.findIndex((h) => h === "Station Number"),
      stationName: header.findIndex((h) => h === "Station Name"),
      gaugeCatch: header.findIndex((h) => h === "Gauge Catch in."),
      snowfallNewDepth: header.findIndex((h) => h === "24hr Snowfall New Snow Depth"),
      snowfallWaterContent: header.findIndex((h) => h === "24hr Snowfall in Water Content"),
      snowfallSLR: header.findIndex((h) => h === "24hr Snowfall in SLR"),
      snowpackTotalDepth: header.findIndex((h) => h === "Snowpack Total Snow Depth"),
      snowpackWaterContent: header.findIndex((h) => h === "Snowpack in Water Content"),
      snowpackDensity: header.findIndex((h) => h === "Snowpack in Density"),
      state: header.findIndex((h) => h === "State"),
      county: header.findIndex((h) => h === "County"),
    };

    if (colIndexes.obsDate === -1) {
      return {
        success: false,
        errors: ["CSV must have an 'Obs Date' column"],
      };
    }

    if (colIndexes.gaugeCatch === -1) {
      return {
        success: false,
        errors: ["CSV must have a 'Gauge Catch in.' column"],
      };
    }

    // Parse data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = parseCsvLine(line);

      try {
        // Parse date
        const dateStr = values[colIndexes.obsDate]?.trim();
        if (!dateStr) {
          warnings.push(`Row ${i + 1}: Missing date, skipping`);
          continue;
        }

        const date = normalizeDate(dateStr);
        if (!date) {
          errors.push(`Row ${i + 1}: Invalid date format "${dateStr}". Expected M/D/YYYY`);
          continue;
        }

        // Parse rainfall (Gauge Catch)
        const rainfallStr = values[colIndexes.gaugeCatch]?.trim();
        if (!rainfallStr || rainfallStr === "NA") {
          warnings.push(`Row ${i + 1}: Missing or NA rainfall value, skipping`);
          continue;
        }

        // Handle trace amounts (T)
        let rainfall: number;
        if (rainfallStr === "T") {
          rainfall = 0.01; // Trace amount
        } else {
          rainfall = parseFloat(rainfallStr);
          if (isNaN(rainfall) || rainfall < 0) {
            errors.push(`Row ${i + 1}: Invalid rainfall value "${rainfallStr}"`);
            continue;
          }
        }

        // Build observation object with all available fields
        const observation: ParsedCsvRow = {
          date,
          rainfall,
        };

        // Optional: Obs Time
        if (colIndexes.obsTime !== -1) {
          const obsTime = values[colIndexes.obsTime]?.trim();
          if (obsTime) observation.obsTime = obsTime;
        }

        // Optional: Station Number
        if (colIndexes.stationNumber !== -1) {
          const stationNumber = values[colIndexes.stationNumber]?.trim();
          if (stationNumber) observation.stationNumber = stationNumber;
        }

        // Optional: Station Name
        if (colIndexes.stationName !== -1) {
          const stationName = values[colIndexes.stationName]?.trim();
          if (stationName) observation.stationName = stationName;
        }

        // Optional: Snowfall New Depth
        if (colIndexes.snowfallNewDepth !== -1) {
          const val = parseOptionalNumber(values[colIndexes.snowfallNewDepth]);
          if (val !== undefined) observation.snowfallNewDepth = val;
        }

        // Optional: Snowfall Water Content
        if (colIndexes.snowfallWaterContent !== -1) {
          const val = parseOptionalNumber(values[colIndexes.snowfallWaterContent]);
          if (val !== undefined) observation.snowfallWaterContent = val;
        }

        // Optional: Snowfall SLR
        if (colIndexes.snowfallSLR !== -1) {
          const val = parseOptionalNumber(values[colIndexes.snowfallSLR]);
          if (val !== undefined) observation.snowfallSLR = val;
        }

        // Optional: Snowpack Total Depth
        if (colIndexes.snowpackTotalDepth !== -1) {
          const val = parseOptionalNumber(values[colIndexes.snowpackTotalDepth]);
          if (val !== undefined) observation.snowpackTotalDepth = val;
        }

        // Optional: Snowpack Water Content
        if (colIndexes.snowpackWaterContent !== -1) {
          const val = parseOptionalNumber(values[colIndexes.snowpackWaterContent]);
          if (val !== undefined) observation.snowpackWaterContent = val;
        }

        // Optional: Snowpack Density
        if (colIndexes.snowpackDensity !== -1) {
          const val = parseOptionalNumber(values[colIndexes.snowpackDensity]);
          if (val !== undefined) observation.snowpackDensity = val;
        }

        // Optional: State
        if (colIndexes.state !== -1) {
          const state = values[colIndexes.state]?.trim();
          if (state) observation.state = state;
        }

        // Optional: County
        if (colIndexes.county !== -1) {
          const county = values[colIndexes.county]?.trim();
          if (county) observation.county = county;
        }

        data.push(observation);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Parse error"}`);
      }
    }

    if (data.length === 0) {
      return {
        success: false,
        errors: ["No valid data rows found in CSV"],
        warnings,
      };
    }

    return {
      success: true,
      data,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    return {
      success: false,
      errors: [`Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}`],
    };
  }
}

/**
 * Parse a CSV line, handling quoted values with commas
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Normalize date to YYYY-MM-DD format
 * Accepts: M/D/YYYY format (CoCoRaHS standard)
 */
function normalizeDate(dateStr: string): string | null {
  // M/D/YYYY or MM/DD/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Parse optional number field (handles NA, T, and numeric values)
 */
function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "NA") return undefined;
  if (trimmed === "T") return 0.01; // Trace amount

  const num = parseFloat(trimmed);
  if (isNaN(num)) return undefined;

  return num;
}

/**
 * Convert parsed CSV data to CreateObservationRequest format
 */
export function csvToObservations(
  parsedData: ParsedCsvRow[]
): CreateObservationRequest[] {
  return parsedData.map((row) => ({
    date: row.date,
    rainfall: row.rainfall,
    snowfall: row.snowfallNewDepth,
    notes: row.notes,
    // Extended fields
    obsTime: row.obsTime,
    stationNumber: row.stationNumber,
    stationName: row.stationName,
    snowfallWaterContent: row.snowfallWaterContent,
    snowfallSLR: row.snowfallSLR,
    snowpackTotalDepth: row.snowpackTotalDepth,
    snowpackWaterContent: row.snowpackWaterContent,
    snowpackDensity: row.snowpackDensity,
    state: row.state,
    county: row.county,
  }));
}
