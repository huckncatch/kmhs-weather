/**
 * Ambient Weather API Route
 * Server-side endpoint that securely fetches data from Ambient Weather API
 * Keeps API keys secure and never exposes them to the client
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDevices,
  getDeviceData,
  getLatestDeviceData,
  validateApiCredentials,
} from "@/lib/api/ambient";
import { saveReading, getLatestTimestamp } from '@/lib/data/ambient-storage'
import { fetchAndSaveAmbientHistory } from '@/lib/data/ambient-history-fetcher'

/**
 * GET /api/weather/ambient
 * Query parameters:
 * - action: "devices" | "data" | "latest" (default: "latest")
 * - macAddress: required for "data" and "latest" actions
 * - limit: optional, max 288 (for "data" action)
 * - endDate: optional, milliseconds since epoch or date string (for "data" action)
 */
let gapFillAttempted = false

export async function GET(request: NextRequest) {
  try {
    // Validate API credentials are configured
    const credentials = validateApiCredentials();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action") || "latest";
    const macAddress = searchParams.get("macAddress");
    const limit = searchParams.get("limit");
    const endDate = searchParams.get("endDate");

    switch (action) {
      case "devices": {
        // Fetch all user devices
        const devices = await getDevices(credentials);
        return NextResponse.json({ success: true, data: devices });
      }

      case "data": {
        // Fetch historical data for a specific device
        if (!macAddress) {
          return NextResponse.json(
            { success: false, error: "macAddress parameter is required for data action" },
            { status: 400 }
          );
        }

        const params = {
          ...credentials,
          macAddress,
          ...(limit && { limit: parseInt(limit, 10) }),
          ...(endDate && { endDate }),
        };

        const data = await getDeviceData(params);
        return NextResponse.json({ success: true, data });
      }

      case "latest": {
        // Fetch latest data for a specific device
        if (!macAddress) {
          return NextResponse.json(
            { success: false, error: "macAddress parameter is required for latest action" },
            { status: 400 }
          );
        }

        const latestData = await getLatestDeviceData({
          ...credentials,
          macAddress,
        });

        if (!latestData) {
          return NextResponse.json(
            { success: false, error: "No data available for this device" },
            { status: 404 }
          );
        }

        // Auto-save this reading to the database
        try {
          saveReading(latestData)
        } catch (err) {
          console.error('[ambient-storage] saveReading failed:', err)
        }

        // On first request after cold start, fill any gap since last saved reading
        if (!gapFillAttempted) {
          gapFillAttempted = true
          const latestSaved = getLatestTimestamp()
          if (latestSaved) {
            const latestSavedMs = new Date(latestSaved).getTime()
            const gapMinutes = (Date.now() - latestSavedMs) / 60000
            if (gapMinutes > 5) {
              // Fire-and-forget: don't await, don't block the response
              fetchAndSaveAmbientHistory(latestSavedMs, Date.now(), {
                ...credentials,
                macAddress,
              }).catch((err) => console.error('[gap-fill] failed:', err))
            }
          }
        }

        return NextResponse.json({ success: true, data: latestData });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid action: ${action}. Valid actions: devices, data, latest`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Ambient Weather API route error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Check for rate limiting error
    if (errorMessage.includes("Rate limit")) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 429 }
      );
    }

    // Check for missing credentials
    if (errorMessage.includes("not configured")) {
      return NextResponse.json(
        {
          success: false,
          error: "API credentials not configured",
          message: "Please configure AMBIENT_WEATHER_API_KEY and AMBIENT_WEATHER_APP_KEY",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
