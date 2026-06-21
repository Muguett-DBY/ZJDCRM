import type { ErrorHandler, NotFoundHandler } from "hono";

/**
 * Unified error handler that catches unhandled exceptions
 * and returns a safe JSON envelope without stack traces.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  console.error("Unhandled error:", err?.message || err);
  return c.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误",
        requestId: c.get("requestId") || "unknown",
      },
    },
    500,
  );
};

/**
 * 404 handler for unknown routes.
 */
export const notFoundHandler: NotFoundHandler = (c) => {
  return c.json(
    {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "请求的资源不存在",
        requestId: c.get("requestId") || "unknown",
      },
    },
    404,
  );
};
