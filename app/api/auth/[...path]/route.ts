import { getAuth } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

type AuthHandlerName = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function handle(method: AuthHandlerName) {
  return async (request: Request) => {
    const handler = getAuth().handler()[method];
    return handler(request);
  };
}

export const GET = handle("GET");
export const POST = handle("POST");
export const PUT = handle("PUT");
export const DELETE = handle("DELETE");
export const PATCH = handle("PATCH");
