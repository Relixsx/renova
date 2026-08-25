import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { requireOwnerRequest } from "../../../lib/admin-auth";
import { recordOrderSales } from "../../../lib/order-payment";

const allowedStatuses = new Set(["confirmed", "processing", "packaged", "dispatched", "delivered", "refunded"]);

export async function PATCH(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as { orderNumber?: string; status?: string };
    const orderNumber = String(body.orderNumber ?? "").trim();
    const status = String(body.status ?? "").trim().toLowerCase();
    if (!orderNumber || !allowedStatuses.has(status)) return Response.json({ error: "A valid order number and fulfilment status are required." }, { status: 400 });
    const db = getDb();
    const [updated] = await db.update(orders).set({ status, updatedAt: new Date().toISOString() }).where(eq(orders.orderNumber, orderNumber)).returning();
    if (!updated) return Response.json({ error: "Order not found." }, { status: 404 });
    const order = status === "delivered" ? await recordOrderSales(updated) : updated;
    return Response.json({ order });
  } catch (error) {
    console.error("Admin order update failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "The order could not be updated." }, { status: 500 });
  }
}
