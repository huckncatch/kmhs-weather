/**
 * CoCoRaHS API Routes
 * CRUD operations for rainfall observations
 *
 * Endpoints:
 * - GET    /api/cocorahs - List all observations (with optional date filtering)
 * - POST   /api/cocorahs - Create new observation
 * - PUT    /api/cocorahs?id={id} - Update observation
 * - DELETE /api/cocorahs?id={id} - Delete observation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllObservations,
  getObservationById,
  createObservation,
  updateObservation,
  deleteObservation,
} from "@/lib/data/cocorahs-storage";
import type {
  CreateObservationRequest,
  UpdateObservationRequest,
  CoCoRaHSApiResponse,
  CoCoRaHSObservation,
} from "@/types/cocorahs";

/**
 * GET /api/cocorahs
 * List observations with optional filtering
 * Query params: startDate, endDate
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const observations = await getAllObservations({
      startDate,
      endDate,
    });

    const response: CoCoRaHSApiResponse<CoCoRaHSObservation[]> = {
      success: true,
      data: observations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/cocorahs error:", error);

    const response: CoCoRaHSApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch observations",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * POST /api/cocorahs
 * Create a new observation
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateObservationRequest = await request.json();

    // Validate required fields
    if (!body.date) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Missing required field: date",
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (body.rainfall === undefined || body.rainfall === null) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Missing required field: rainfall",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Invalid date format. Expected YYYY-MM-DD",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate rainfall is a non-negative number
    if (typeof body.rainfall !== "number" || body.rainfall < 0) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Rainfall must be a non-negative number",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const observation = await createObservation(body, "manual");

    const response: CoCoRaHSApiResponse<CoCoRaHSObservation> = {
      success: true,
      data: observation,
      message: "Observation created successfully",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/cocorahs error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to create observation";

    // Check if it's a duplicate date error
    const isDuplicate = errorMessage.includes("already exists");

    const response: CoCoRaHSApiResponse<never> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: isDuplicate ? 409 : 500 });
  }
}

/**
 * PUT /api/cocorahs
 * Update an existing observation
 * Query param: id (required)
 */
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Missing required query parameter: id",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const body: UpdateObservationRequest = await request.json();

    // Validate rainfall if provided
    if (body.rainfall !== undefined && (typeof body.rainfall !== "number" || body.rainfall < 0)) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Rainfall must be a non-negative number",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const observation = await updateObservation(id, body);

    const response: CoCoRaHSApiResponse<CoCoRaHSObservation> = {
      success: true,
      data: observation,
      message: "Observation updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("PUT /api/cocorahs error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to update observation";
    const isNotFound = errorMessage.includes("not found");

    const response: CoCoRaHSApiResponse<never> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: isNotFound ? 404 : 500 });
  }
}

/**
 * DELETE /api/cocorahs
 * Delete an observation
 * Query param: id (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      const response: CoCoRaHSApiResponse<never> = {
        success: false,
        error: "Missing required query parameter: id",
      };
      return NextResponse.json(response, { status: 400 });
    }

    await deleteObservation(id);

    const response: CoCoRaHSApiResponse<null> = {
      success: true,
      data: null,
      message: "Observation deleted successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("DELETE /api/cocorahs error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to delete observation";
    const isNotFound = errorMessage.includes("not found");

    const response: CoCoRaHSApiResponse<never> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: isNotFound ? 404 : 500 });
  }
}
