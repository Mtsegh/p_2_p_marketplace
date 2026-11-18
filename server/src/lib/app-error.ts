export interface ErrorDetail {
  field: string;
  issue: string;
}

/**
 * Expected failure with a stable UPPER_SNAKE `code` that clients can switch on.
 * Anything that is not an AppError is treated as an unexpected error and
 * returned as a generic 500 without internal details.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(
    code: string,
    status: number,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError("NOT_FOUND", 404, message);
  }

  static badRequest(message: string, code = "BAD_REQUEST"): AppError {
    return new AppError(code, 400, message);
  }

  static validation(details: ErrorDetail[]): AppError {
    return new AppError(
      "VALIDATION_ERROR",
      422,
      "Request validation failed",
      details,
    );
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHENTICATED", 401, message);
  }

  static forbidden(
    message = "You do not have access to this resource",
  ): AppError {
    return new AppError("FORBIDDEN", 403, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
