import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { postgresConfig } from "../app/lib/postgres-config.mjs";
import * as schema from "./schema";
import * as ownerSchema from "./owner-schema.mjs";

type StoreDatabase = NodePgDatabase<typeof schema>;
type Runtime = { store?: Pool; owner?: Pool; database?: StoreDatabase; ownerDatabase?: NodePgDatabase<typeof ownerSchema>; scope: AsyncLocalStorage<StoreDatabase> };
const key = Symbol.for("renova.postgres.runtime.v1");
const globals = globalThis as unknown as Record<symbol, Runtime>;
const runtime = globals[key] ||= { scope: new AsyncLocalStorage<StoreDatabase>() };

export function getPostgresPool(purpose: "store" | "owner" = "store") {
  if (!runtime[purpose]) {
    const pool = new Pool(postgresConfig(process.env, purpose));
    pool.on("error", () => console.error("A Renova database connection closed unexpectedly."));
    runtime[purpose] = pool;
  }
  return runtime[purpose]!;
}

export function getDb() {
  const scoped = runtime.scope.getStore();
  if (scoped) return scoped;
  if (!runtime.database) runtime.database = drizzle(getPostgresPool(), { schema });
  return runtime.database;
}

export function getOwnerDb() {
  if (!runtime.ownerDatabase) runtime.ownerDatabase = drizzle(getPostgresPool("owner"), { schema: ownerSchema });
  return runtime.ownerDatabase;
}

export function withStoreClient<T>(client: PoolClient, work: () => Promise<T>) {
  return runtime.scope.run(drizzle(client, { schema }), work);
}
