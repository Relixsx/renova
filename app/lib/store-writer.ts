import { getPostgresPool, withStoreClient } from "../../db";
import { allowsStoreWrite, maintenanceResponse, WRITER_LOCK_KEY } from "./migration-mode.mjs";

export async function withStoreWriter(request: Request, work: () => Promise<Response>) {
  if (!allowsStoreWrite(new URL(request.url).pathname)) return maintenanceResponse();
  let client;
  try { client = await getPostgresPool().connect(); } catch { client = null; }
  if (!client) return Response.json({ error: "The store is temporarily busy. Please try again shortly." }, { status: 503 });
  let locked = false, damaged = false;
  try {
    await client.query("SELECT pg_advisory_lock_shared($1::bigint)", [WRITER_LOCK_KEY]);
    locked = true;
    if (!allowsStoreWrite(new URL(request.url).pathname)) return maintenanceResponse();
    return await withStoreClient(client, work);
  } catch {
    damaged = true;
    return Response.json({ error: "The request could not be completed. Please check its status before retrying." }, { status: 503 });
  } finally {
    if (locked) { try { await client.query("SELECT pg_advisory_unlock_shared($1::bigint)", [WRITER_LOCK_KEY]); } catch { damaged = true; } }
    client.release(damaged);
  }
}
