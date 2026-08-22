import { requireOwnerRequest } from "../../../lib/admin-auth";
import { getAdminOrders } from "../../../lib/server-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    return Response.json({ orders: await getAdminOrders() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not refresh orders." }, { status: 500 });
  }
}
