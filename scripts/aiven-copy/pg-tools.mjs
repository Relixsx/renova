import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function safeDatabaseError(detail = '', stage = 'database operation', nodeCode = '') {
  const sqlstate = detail.match(/(?:ERROR|FATAL):\s*([0-9A-Z]{5})\b/)?.[1];
  let reason = 'PostgreSQL returned an unclassified error. Send ChatGPT this safe code and the operation name; keep credentials private.';
  let category = sqlstate || 'UNCLASSIFIED';
  if (/RENOVA_NOT_EMPTY/.test(detail)) { category = 'NOT_EMPTY'; reason = 'The separate target database already contains objects. They were not overwritten.'; }
  else if (/RENOVA_COUNT_MISMATCH|RENOVA_TABLE_SET_MISMATCH|RENOVA_SEQUENCE_UNSAFE/.test(detail)) { category = 'VERIFY_FAILED'; reason = 'The restored tables, row counts or next order IDs did not match the backup. The restore transaction was rolled back.'; }
  else if (/RENOVA_RECEIPT_MISMATCH/.test(detail)) { category = 'RECEIPT_MISMATCH'; reason = 'This database belongs to a different migration backup. It was not overwritten.'; }
  else if (sqlstate === '28P01' || /password authentication failed|no password supplied/i.test(detail)) { category = sqlstate || 'AUTH'; reason = 'Aiven rejected the password. Copy the current Service URI with its real password from Quick connect.'; }
  else if (sqlstate === '42501' || /permission denied|must be owner/i.test(detail)) { category = sqlstate || 'PERMISSION'; reason = 'The Aiven role lacks a required permission. Use the avnadmin Service URI from this Aiven service.'; }
  else if (/could not translate host name|nodename nor servname|name or service not known|ENOTFOUND/i.test(detail)) { category = 'DNS'; reason = 'Your Mac could not resolve the Aiven server address. Check the internet connection.'; }
  else if (/certificate|\bSSL(?:\s|:)|\bTLS\b|channel binding/i.test(detail)) { category = 'TLS'; reason = 'The Aiven certificate or encrypted connection could not be verified. Select the CA certificate from this Aiven project. Certificate verification remains enabled.'; }
  else if (/timeout expired|timed out|connection refused|network is unreachable|no route to host|server closed the connection/i.test(detail)) { category = 'NETWORK'; reason = 'The Aiven server could not be reached. Wait until the service is Running and check the network connection.'; }
  else if (/unsupported version.*file header|archive.*newer|version mismatch/i.test(detail)) { category = 'CLIENT_VERSION'; reason = 'The PostgreSQL client is too old to read or restore this archive. Update Homebrew libpq to PostgreSQL 18 or newer.'; }
  else if (/No space left|disk full|53100/i.test(detail)) { category = 'DISK_FULL'; reason = 'The Aiven service reported insufficient disk space. The restore did not complete.'; }
  else if (/invalid connection option|unrecognized .*option/i.test(detail)) { category = 'CLIENT_OPTION'; reason = 'A PostgreSQL option was not supported. Update the Homebrew libpq client tools.'; }
  else if (/ENOENT|EACCES|ENOEXEC|dyld|Library not loaded/.test(detail + ' ' + nodeCode)) { category = 'CLIENT_TOOL'; reason = 'A PostgreSQL executable or library could not run. Check the Homebrew libpq installation.'; }
  const error = new Error(`[${category}; ${stage}] ${reason}`);
  error.sqlstate = sqlstate;
  error.category = category;
  return error;
}

export function findTools(env) {
  const dirs = new Set((env.PATH || '').split(':').filter(Boolean));
  if (env.RENOVA_PG_BIN) dirs.add(env.RENOVA_PG_BIN);
  for (const root of ['/opt/homebrew/opt', '/usr/local/opt']) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) if (name === 'libpq' || /^postgresql(?:@\d+)?$/.test(name)) dirs.add(join(root, name, 'bin'));
  }
  const candidates = [];
  for (const dir of dirs) {
    if (!['psql', 'pg_restore'].every(name => existsSync(join(dir, name)))) continue;
    const probe = spawnSync(join(dir, 'pg_restore'), ['--version'], { env, encoding: 'utf8', timeout: 5000 });
    const match = probe.status === 0 && probe.stdout.match(/PostgreSQL\)\s+(\d+)/);
    if (match) candidates.push({ dir, major: Number(match[1]) });
  }
  candidates.sort((a, b) => b.major - a.major);
  if (!candidates.length || candidates[0].major < 18) throw new Error('PostgreSQL 18 or newer client tools are required. Run brew upgrade libpq (or brew install libpq if missing), then retry.');
  return candidates[0];
}

export async function runTool(path, args, env, children, { capture = false, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(path, args, { env, stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'ignore', 'pipe'] });
    children.add(child);
    let stdout = '', stderr = '', nodeCode = '';
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16384); });
    child.stdin?.on('error', () => {});
    child.once('error', error => { nodeCode = error.code || ''; });
    child.once('close', code => {
      children.delete(child);
      if (code === 0) resolve(stdout);
      else reject(safeDatabaseError(stderr, path.split('/').at(-1), nodeCode));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

export const PSQL_FLAGS = ['--no-password', '--no-psqlrc', '--quiet', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose'];

export async function queryJson(tool, sql, env, children) {
  const result = await runTool(join(tool.dir, 'psql'), [...PSQL_FLAGS, '--command=' + sql], env, children, { capture: true });
  try { return JSON.parse(result.trim()); }
  catch { throw new Error('PostgreSQL returned an unexpected response. No database switch has been made.'); }
}
