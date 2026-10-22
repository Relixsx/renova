const reminderWorker = {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runReminderSchedule(env).then((result) => {
      if (result.status !== 200) throw new Error(`Renova reminder check failed (${result.status}).`);
    }));
  },

  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!env.REMINDER_CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.REMINDER_CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
    const result = await runReminderSchedule(env);
    return Response.json(result.body, { status: result.status });
  },
};

export default reminderWorker;

async function runReminderSchedule(env) {
  const appUrl = String(env.RENOVA_APP_URL || "https://shoprenova.com.ng").replace(/\/$/, "");
  if (!env.REMINDER_CRON_SECRET) {
    return { status: 500, body: { ok: false, error: "REMINDER_CRON_SECRET is missing." } };
  }

  try {
    const response = await fetch(`${appUrl}/api/orders/reminders/run`, {
      method: "POST",
      signal: AbortSignal.timeout(55_000),
      headers: { authorization: `Bearer ${env.REMINDER_CRON_SECRET}` },
    });
    const body = await response.json().catch(() => ({ error: "Renova returned an unreadable response." }));
    return { status: response.ok ? 200 : 502, body: { ok: response.ok, renovaStatus: response.status, ...body } };
  } catch (error) {
    return { status: 502, body: { ok: false, error: error instanceof Error ? error.message : "Renova could not be reached." } };
  }
}
