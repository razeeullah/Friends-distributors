import { ZodError } from "zod";

export class ApplicationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly expose: boolean;

  constructor(
    code: string,
    message: string,
    options: Readonly<{
      status?: number;
      expose?: boolean;
      cause?: unknown;
    }> = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "ApplicationError";
    this.code = code;
    this.status = options.status ?? 400;
    this.expose = options.expose ?? true;
  }
}

export interface NormalizedError {
  code: string;
  message: string;
  status: number;
}

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ApplicationError) {
    return {
      code: error.code,
      message: error.expose ? error.message : "An unexpected error occurred",
      status: error.status,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "The submitted data is invalid",
      status: 400,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    status: 500,
  };
}
