export const WRITER_LOCK_KEY='723481938474';
export const MIGRATION_REVISION='aiven-20261116-v1';
export function migrationMode(env=process.env) {
  const value=env.RENOVA_MAINTENANCE_MODE?.trim().toLowerCase();
  if(!value || ['off','false','0'].includes(value))return 'off';
  return value==='webhooks'?'webhooks':'on';
}
export function isRetryWebhook(path) {return ['/api/whatsapp/webhook','/api/paystack/webhook'].includes(path.replace(/\/$/,''));}
export function allowsStoreWrite(path,env=process.env) {
  const mode=migrationMode(env);
  return mode==='off' || (mode==='webhooks'&&isRetryWebhook(path));
}
export function maintenanceResponse(api=true) {
  const headers={'cache-control':'no-store','retry-after':'60'};
  if(api)return Response.json({error:'Renova is briefly unavailable for maintenance. Please try again shortly.'},{status:503,headers});
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Renova — back shortly</title><body style="margin:0;background:#faf7f2;color:#25160f;font-family:system-ui"><main style="max-width:560px;margin:18vh auto;padding:32px"><h1>We’ll be back shortly.</h1><p>Renova is completing a short maintenance update. Please try again in a few minutes.</p><p>Your existing orders remain saved.</p></main></body></html>',{status:503,headers:{...headers,'content-type':'text/html; charset=utf-8'}});
}
