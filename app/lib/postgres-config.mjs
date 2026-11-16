import { X509Certificate } from 'node:crypto';

export function databaseTarget(env = process.env) {
  let url;
  try { url = new URL(env.DATABASE_URL?.trim() || ''); } catch { throw new Error('DATABASE_URL is not configured correctly.'); }
  if (!['postgres:','postgresql:'].includes(url.protocol) || !url.username || !url.password || !url.pathname.slice(1)) throw new Error('DATABASE_URL must contain a PostgreSQL host, database and credentials.');
  const source = /^ep-sweet-cake-bah8seo5(?:-pooler)?\.c-8\.eu-central-1\.aws\.neon\.tech$/.test(url.hostname);
  const destination = url.hostname === 'pg-1c5cf951-renova.f.aivencloud.com' && url.port === '15591';
  if (!source && !destination) throw new Error('DATABASE_URL does not identify the Renova Neon or Aiven service.');
  if (destination && !/^\/renova_store_\d{8}t\d{6}_[a-f0-9]{8}$/.test(url.pathname)) throw new Error('Choose the verified Renova store database in Aiven, rather than defaultdb.');
  for (const [key] of url.searchParams) if (!['sslmode','channel_binding','connect_timeout','application_name'].includes(key)) throw new Error('DATABASE_URL contains an unsupported connection option.');
  return { url, provider: destination ? 'aiven' : 'neon' };
}

export function postgresConfig(env = process.env, purpose = 'store') {
  const {url,provider} = databaseTarget(env);
  let ca;
  if (provider === 'aiven') {
    ca = env.DATABASE_SSL_CA?.replaceAll('\\n','\n').trim();
    const blocks = ca?.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    if (!blocks?.length) throw new Error('DATABASE_SSL_CA must contain the Aiven project CA certificate.');
    try { for (const block of blocks) if (!new X509Certificate(block).ca) throw new Error(); }
    catch { throw new Error('DATABASE_SSL_CA is not a valid CA certificate.'); }
  }
  const host = url.hostname.replace('-pooler.','.');
  return {
    host, port:Number(url.port || 5432), database:decodeURIComponent(url.pathname.slice(1)),
    user:decodeURIComponent(url.username), password:decodeURIComponent(url.password),
    // Explicit fields keep URI sslmode parameters from replacing the verified
    // TLS configuration. Direct Neon sessions also support advisory locks.
    ssl:{rejectUnauthorized:true,servername:host,...(ca?{ca}:{})},
    enableChannelBinding:true, application_name:`renova_${purpose}`,
    max:purpose === 'owner' ? 1 : 4, idleTimeoutMillis:10000,
    connectionTimeoutMillis:15000, maxLifetimeSeconds:300,
    statement_timeout:120000, keepAlive:true, allowExitOnIdle:true,
  };
}
