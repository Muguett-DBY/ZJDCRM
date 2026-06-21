import { handle } from "hono/cloudflare-pages";
import { createApi } from "../../server/app";

export const onRequest = handle(createApi());
