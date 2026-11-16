import { withStoreWriter } from "../../../../lib/store-writer";
import { runDueReminders } from "../../../../lib/customer-reminders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.REMINDER_CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied || supplied !== expected) {
    return Response.json({ error: "Unauthorised scheduler request." }, { status: 401 });
  }
  return withStoreWriter(request, async () => {
  try {
    return Response.json(await runDueReminders());
  } catch (error) {
    console.error("Reminder scheduler failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Reminder scheduler failed." }, { status: 500 });
  }

  });
}
