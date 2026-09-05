export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runReminderSchedule(env));
  },

  async fetch(_request, env) {
    const result = await runReminderSchedule(env);
    return Response.json(result.body, { status: result.status });
  },
};

async function runReminderSchedule(env) {
  const appUrl = String(env.RENOVA_APP_URL || "https://shoprenova.com.ng").replace(/\/$/, "");
  if (!env.REMINDER_CRON_SECRET) {
    return { status: 500, body: { ok: false, error: "REMINDER_CRON_SECRET is missing." } };
  }

  try {
    const response = await fetch(`${appUrl}/api/orders/reminders/run`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.REMINDER_CRON_SECRET}` },
    });
    const body = await response.json().catch(() => ({ error: "Renova returned an unreadable response." }));
    return { status: response.ok ? 200 : 502, body: { ok: response.ok, renovaStatus: response.status, ...body } };
  } catch (error) {
    return { status: 502, body: { ok: false, error: error instanceof Error ? error.message : "Renova could not be reached." } };
  }
}
