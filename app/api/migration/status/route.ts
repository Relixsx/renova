import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { databaseTarget } from "../../../lib/postgres-config.mjs";
import { migrationMode, MIGRATION_REVISION } from "../../../lib/migration-mode.mjs";
import { equalSecret } from "../../../lib/whatsapp-webhook-security";
import { approvedOwnerEmails } from "../../../lib/owner-settings.mjs";

import { ownerOrderEmailStatus } from "../../../lib/owner-order-email.mjs";

export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const expected=process.env.MIGRATION_CONTROL_SECRET?.trim();
  const supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim() || '';
  if(!expected||expected.length<32||!await equalSecret(supplied,expected))return new Response('Not found',{status:404});
  try {
    const result=await getDb().execute(sql`SELECT current_database() AS database, (SELECT count(*)::int FROM public.orders) AS orders, (SELECT count(*)::int FROM public.products) AS products, to_regclass('renova_auth.user') IS NOT NULL AS owner_schema`);
    const target=databaseTarget();
    return Response.json({revision:MIGRATION_REVISION,mode:migrationMode(),provider:target.provider,host:target.url.hostname,ownerEmails:[...approvedOwnerEmails()],orderEmail:ownerOrderEmailStatus(),...result.rows[0]},{headers:{'cache-control':'no-store'}});
  } catch { return Response.json({error:'The configured database could not be verified.'},{status:503,headers:{'cache-control':'no-store'}}); }
}
