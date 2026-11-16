import { getAuth, getOwnerAuth } from "../../../lib/admin-auth";
import { databaseTarget } from "../../../lib/postgres-config.mjs";

export const dynamic = "force-dynamic";

type AuthHandlerName = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type AuthRouteContext = { params: Promise<{ path: string[] }> };

function handle(method: AuthHandlerName) {
  return async (request: Request, context: AuthRouteContext) => {
    if (databaseTarget().provider === "aiven") {
      if (method !== "GET" && method !== "POST") return new Response("Method not allowed", { status: 405 });
      return getOwnerAuth().handler(request);
    }
    const handler = getAuth().handler()[method];
    return handler(request, context);
  };
}

export const GET = handle("GET");
export const POST = handle("POST");
export const PUT = handle("PUT");
export const DELETE = handle("DELETE");
export const PATCH = handle("PATCH");
