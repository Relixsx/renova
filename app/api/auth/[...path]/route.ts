import { getAuth } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

type AuthHandlerName = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type AuthRouteContext = { params: Promise<{ path: string[] }> };

function handle(method: AuthHandlerName) {
  return async (request: Request, context: AuthRouteContext) => {
    const handler = getAuth().handler()[method];
    return handler(request, context);
  };
}

export const GET = handle("GET");
export const POST = handle("POST");
export const PUT = handle("PUT");
export const DELETE = handle("DELETE");
export const PATCH = handle("PATCH");
