import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, isAppError } from "../lib/app-error.js";
import { logger } from "../lib/logger.js";

interface BodyParserError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    error instanceof Error &&
    typeof (error as BodyParserError).type === "string"
  );
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      "NOT_FOUND",
      404,
      `Route ${req.method} ${req.path} does not exist`,
    ),
  );
};

/**
 * The single error boundary. Known errors keep their code, status, and
 * message; unknown errors are logged in full and returned as a generic 500.
 * Never leaks stack traces, SQL, or internal paths to the client.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let details: AppError["details"];

  if (isAppError(error)) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Request validation failed";
    details = error.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      issue: issue.message,
    }));
  } else if (isBodyParserError(error) && error.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body is not valid JSON";
  } else if (isBodyParserError(error) && error.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large";
  }

  if (status >= 500) {
    logger.error(
      {
        err: error,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
      },
      "request failed",
    );
  } else {
    logger.warn(
      {
        code,
        status,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
      },
      "request rejected",
    );
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
      requestId: req.id,
    },
  });
};
