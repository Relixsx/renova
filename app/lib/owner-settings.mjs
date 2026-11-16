export function approvedOwnerEmails(env=process.env) {
  return new Set((env.ADMIN_EMAILS || 'relixsx@gmail.com,airebirth5@gmail.com').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));
}
export function approvedOwner(email,env=process.env) { return typeof email==='string' && approvedOwnerEmails(env).has(email.trim().toLowerCase()); }
export function siteOrigin(env=process.env) {
  const url=new URL(env.APP_URL || env.NEXT_PUBLIC_SITE_URL || 'https://shoprenova.com.ng');
  if(url.protocol!=='https:' && !(env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('APP_URL must use HTTPS in production.');
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('APP_URL must be the public website origin.');
  return url.origin;
}
export function trustedOwnerOrigins(env=process.env) {
  const origin=siteOrigin(env), origins=[origin];
  if(new URL(origin).hostname==='shoprenova.com.ng')origins.push('https://www.shoprenova.com.ng');
  if(env.NODE_ENV!=='production')origins.push('http://localhost:5173','http://127.0.0.1:5173');
  return origins;
}
