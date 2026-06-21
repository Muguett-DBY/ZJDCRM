import { MiddlewareHandler } from "hono";
import { createId } from "../shared/ids";

type AppVariables = { requestId: string };

/**
 * Add a unique request ID to every request and response.
 */
export const requestIdMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const requestId = createId();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
};
