/**
 * CoCoRaHS CSV Import API
 * Handles bulk importing of observations from CSV files
 */

import { NextRequest, NextResponse } from "next/server";
import { bulkImportObservations } from "@/lib/data/cocorahs-storage";
import { parseCoCoRaHSCsv, csvToObservations } from "@/lib/utils/csv-parser";
import type { CoCoRaHSApiResponse } from "@/types/cocorahs";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  parseWarnings?: string[];
}

/**
 * POST /api/cocorahs/import
 * Import observations from CSV
 * Body: { csvContent: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const csvContent = body.csvContent;

    if (!csvContent || typeof csvContent !== "string") {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Missing or invalid CSV content",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Parse CSV
    const parseResult = parseCoCoRaHSCsv(csvContent);

    if (!parseResult.success || !parseResult.data) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Failed to parse CSV",
        message: parseResult.errors?.join("; "),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Convert to observation requests
    const observations = csvToObservations(parseResult.data);

    // Bulk import
    const importResult = await bulkImportObservations(observations);

    const result: ImportResult = {
      ...importResult,
      parseWarnings: parseResult.warnings,
    };

    const response: CoCoRaHSApiResponse<ImportResult> = {
      success: true,
      data: result,
      message: `Successfully imported ${importResult.imported} observations. ${importResult.skipped} were skipped (already exist).`,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("POST /api/cocorahs/import error:", error);

    const response: CoCoRaHSApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import observations",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
