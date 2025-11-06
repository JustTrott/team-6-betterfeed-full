import { NextApiResponse } from "next";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown, res: NextApiResponse) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
  }

  if (error instanceof Error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }

  return res.status(500).json({
    error: "Internal server error",
    details: "An unknown error occurred",
  });
}

export function createErrorResponse(
  statusCode: number,
  message: string,
  details?: string
) {
  return {
    error: message,
    details,
  };
}

