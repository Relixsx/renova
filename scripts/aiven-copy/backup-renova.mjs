import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const OLD_HOST = /^ep-sweet-cake-bah8seo5(?:-pooler)?\.c-8\.eu-central-1\.aws\.neon\.tech$/;
const CONNECTION_PARAMETERS = new Map([
  ['sslmode', 'PGSSLMODE'], ['channel_binding', 'PGCHANNELBINDING'],
  ['sslrootcert', 'PGSSLROOTCERT'], ['sslcert', 'PGSSLCERT'],
  ['sslkey', 'PGSSLKEY'], ['sslcrl', 'PGSSLCRL'], ['sslcrldir', 'PGSSLCRLDIR'],
  ['ssl_min_protocol_version', 'PGSSLMINPROTOCOLVERSION'],
  ['ssl_max_protocol_version', 'PGSSLMAXPROTOCOLVERSION'],
  ['options', 'PGOPTIONS'], ['connect_timeout', null], ['application_name', null],
]);

export function validateSource(value) {
  let source;
  try { source = new URL(value.trim()); } catch { throw new Error('Paste a complete PostgreSQL connection string without quotation marks.'); }
  if (!['postgres:', 'postgresql:'].includes(source.protocol) || !source.username || !source.password || !source.pathname.slice(1)) {
    throw new Error('The connection string must include its database name, username and password.');
  }
  if (!OLD_HOST.test(source.hostname)) throw new Error('This is not the restored Renova Neon project. Use its current connection string.');
  if (!['require', 'verify-ca', 'verify-full'].includes(source.searchParams.get('sslmode'))) {
    throw new Error('Use the SSL-enabled connection string from Neon, including sslmode=require or stronger.');
  }
  for (const [key] of source.searchParams) {
    if (!CONNECTION_PARAMETERS.has(key) || source.searchParams.getAll(key).length !== 1) {
      throw new Error('Use the standard PostgreSQL connection string from Neon. An unsupported or repeated connection option was found.');
    }
  }
  try {
    for (const value of [source.username, source.password, source.pathname.slice(1)]) {
      if (/[\u0000-\u001f\u007f]/.test(decodeURIComponent(value))) throw new Error();
    }
  } catch { throw new Error('The connection string contains invalid character encoding. Copy it again from Neon.'); }
  return source.toString();
}

export function databaseEnvironment(source, inherited = process.env) {
  const env = { ...inherited };
  for (const key of Object.keys(env)) if (key.startsWith('PG') || key === 'RENOVA_SOURCE_DATABASE_URL') delete env[key];
  const url = new URL(validateSource(source));
  // libpq does not expand a connection URI supplied only via PGDATABASE.
  // Pass explicit parameters; the password never appears in process arguments.
  const connection = {
    PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGCONNECT_TIMEOUT: '20', PGAPPNAME: 'renova_aiven_readonly_backup', PGCLIENTENCODING: 'UTF8',
  };
  for (const [key, value] of url.searchParams) {
    const target = CONNECTION_PARAMETERS.get(key);
    if (target) connection[target] = value;
  }
  return { ...env, ...connection };
}

export function identifier(value) { return '"' + String(value).replaceAll('"', '""') + '"'; }

export function failureMessage(code, detail = '') {
  if (/exceeded.{0,100}quota|quota.{0,100}(?:exceeded|exhausted)|compute.{0,100}allowance/i.test(detail)) {
    return 'Neon refused database access because a resource allowance is exhausted. No usable new backup was created. Email access alone cannot bypass this. Restore database access through Neon before rerunning; an upgrade may incur charges.';
  }
  if (code === '53000' || code === '53400') return 'Neon reported an exhausted resource or quota limit. Check the project Usage page to confirm which allowance is exhausted. No verified backup was completed.';
  if (code === '28P01' || /password authentication failed|no password supplied/i.test(detail)) return 'Neon rejected the database password. Copy the CURRENT connection string and retry.';
  if (code === '42501' || /permission denied|insufficient privilege|must be (?:the )?owner/i.test(detail)) return 'The selected Neon role cannot read every object required for a complete backup. Use the store database owner connection.';
  if (code === '3D000' || /database .{0,100}does not exist/i.test(detail)) return 'The selected database does not exist on Neon. Select the store database in the Neon Connect window and copy its connection string again.';
  if (/socket .{0,100}\.s\.PGSQL|on socket|on Unix domain socket/i.test(detail)) return 'PostgreSQL attempted a local Mac connection instead of Neon. Make sure you are running backup tool v2 from the newly extracted folder.';
  if (/could not translate host name|nodename nor servname|name or service not known|temporary failure in name resolution|ENOTFOUND/i.test(detail)) return 'Your Mac could not resolve the Neon server address (DNS). Check your internet connection and try again.';
  if (/timeout expired|timed out|ETIMEDOUT|connection refused|network is unreachable|no route to host|could not connect to server|server closed the connection unexpectedly|connection reset/i.test(detail)) return 'Your Mac could not reach the Neon database, or the server closed the connection. Check internet access and the Neon service status. This error alone does not prove a quota block.';
  if (/invalid connection option|invalid (?:sslmode|channel_binding)|unrecognized .*option/i.test(detail)) return 'A PostgreSQL client setting was not supported. Update your client tools with brew upgrade libpq, then retry.';
  if (/\bSSL(?:\s|:)|\bTLS\b|certificate|channel binding/i.test(detail)) return 'The encrypted connection to Neon failed (TLS or certificate validation). Copy the standard Neon PostgreSQL connection string and check that your PostgreSQL client tools are current. Encryption has not been disabled.';
  if (/dyld|library not loaded|image not found|bad CPU type|ENOEXEC|ENOENT|EACCES/i.test(detail)) return 'A PostgreSQL executable or one of its libraries could not run. Repair or reinstall the Homebrew libpq client tools, then retry.';
  return 'PostgreSQL returned an unclassified error. No verified new backup was completed. Send ChatGPT the safe diagnostic code and tool version printed here; keep the connection string private.';
}

export function databaseFailure(detail = '', stage = 'database connection', nodeCode = '') {
  const code = detail.match(/(?:ERROR|FATAL):\s*([0-9A-Z]{5})\b/)?.[1];
  const message = failureMessage(code, detail + ' ' + nodeCode);
  const category = code || (/^Neon (?:refused database access|reported an exhausted)/i.test(message) ? 'QUOTA' : /^Neon rejected the database password/i.test(message) ? 'AUTH' : /\(DNS\)/i.test(message) ? 'DNS' : /local Mac/i.test(message) ? 'LOCAL_CONNECTION' : /TLS or certificate/i.test(message) ? 'TLS' : /^Your Mac could not reach/i.test(message) ? 'NETWORK' : /setting was not supported/i.test(message) ? 'CLIENT_SETTING' : /executable/i.test(message) ? 'CLIENT_TOOL' : /role cannot read/i.test(message) ? 'PERMISSION' : /database does not exist/i.test(message) ? 'DATABASE' : 'UNCLASSIFIED');
  return new Error(`[${category}; ${stage}] ${message}`);
}

function binaries(env) {
  const dirs = new Set((env.PATH || '').split(':').filter(Boolean));
  if (env.RENOVA_PG_BIN) dirs.add(env.RENOVA_PG_BIN);
  for (const base of ['/opt/homebrew/opt', '/usr/local/opt']) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) if (name === 'libpq' || /^postgresql(?:@\d+)?$/.test(name)) dirs.add(join(base, name, 'bin'));
  }
  const candidates = [];
  for (const dir of dirs) {
    if (!['psql', 'pg_dump', 'pg_restore'].every(name => existsSync(join(dir, name)))) continue;
    const probe = spawnSync(join(dir, 'pg_dump'), ['--version'], { encoding: 'utf8', env, timeout: 5000 });
    const match = probe.status === 0 && probe.stdout.match(/PostgreSQL\)\s+(\d+)/);
    if (match) candidates.push({ dir, major: Number(match[1]) });
  }
  candidates.sort((a, b) => b.major - a.major);
  if (!candidates.length) throw new Error('PostgreSQL tools were not found. Install them with: brew install libpq, then rerun this script.');
  return candidates[0];
}

function sqlSession(path, env, children) {
  const child = spawn(path, ['--no-password', '--no-psqlrc', '--quiet', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(child);
  let lastError = '', pending, stopped = false, spawnCode = '', stage = 'database connection';
  child.stderr.on('data', chunk => { lastError = (lastError + chunk).slice(-4096); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    if (!line.trim() || !pending) return;
    const active = pending;
    pending = undefined;
    try { active.resolve(JSON.parse(line)); } catch { active.reject(new Error('The database returned an unexpected response. No backup was completed.')); }
  });
  const fail = () => {
    stopped = true;
    if (pending) { pending.reject(databaseFailure(lastError, stage, spawnCode)); pending = undefined; }
  };
  // 'close' follows stderr draining. Reporting on 'exit' or EPIPE can lose
  // the startup FATAL that identifies quota, credentials or network failures.
  child.stdin.on('error', () => {});
  child.once('error', error => { spawnCode = error.code || ''; });
  child.once('close', () => { children.delete(child); fail(); });
  return {
    query(sql, label = 'database query') {
      if (stopped || pending) return Promise.reject(new Error('The read-only database session is unavailable.'));
      return new Promise((resolveQuery, reject) => {
        stage = label;
        pending = { resolve: resolveQuery, reject };
        child.stdin.write(sql + '\n', () => {});
      });
    },
    close() { if (!child.stdin.destroyed && child.stdin.writable) child.stdin.end('ROLLBACK;\n'); }
  };
}

function run(path, args, env, children, { output = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(path, args, { env, stdio: ['ignore', output ? 'pipe' : 'ignore', 'pipe'] });
    children.add(child);
    let stdout = '', stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
    let spawnCode = '';
    child.once('error', error => { spawnCode = error.code || ''; });
    child.once('close', code => {
      children.delete(child);
      if (code === 0) resolveRun(stdout);
      else reject(databaseFailure(stderr, path.split('/').at(-1), spawnCode));
    });
  });
}

export async function backup({ backupParent = join(homedir(), 'Downloads') } = {}) {
  process.umask(0o077);
  const source = validateSource(process.env.RENOVA_SOURCE_DATABASE_URL || '');
  delete process.env.RENOVA_SOURCE_DATABASE_URL;
  const env = databaseEnvironment(source);
  const tool = binaries(env);
  console.log(`Renova backup tool v2 | PostgreSQL client ${tool.major}`);
  console.log(`Connecting to Neon: ${env.PGHOST}:${env.PGPORT}`);
  const children = new Set();
  let interrupted = false;
  const interrupt = () => { interrupted = true; for (const child of children) child.kill('SIGTERM'); };
  const checkInterrupted = () => { if (interrupted) throw new Error('Backup interrupted. A partial archive must not be used.'); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const session = sqlSession(join(tool.dir, 'psql'), env, children);
  try {
    console.log('Checking current Neon access and opening a read-only snapshot...');
    const metadata = await session.query(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT json_build_object('database',current_database(),'serverVersion',current_setting('server_version'),'serverVersionNum',current_setting('server_version_num')::integer,'sizeBytes',pg_database_size(current_database()),'snapshot',pg_export_snapshot(),'capturedAt',CURRENT_TIMESTAMP,'hasStore',to_regclass('public.orders') IS NOT NULL AND to_regclass('public.products') IS NOT NULL AND to_regclass('public.categories') IS NOT NULL AND to_regclass('public.reviews') IS NOT NULL);`, 'connection / read-only snapshot');
    if (!metadata.hasStore) throw new Error('This database is missing the Renova store tables. No archive was created; do not use an auth-only backup.');
    if (tool.major < Math.floor(metadata.serverVersionNum / 10000)) throw new Error('Your PostgreSQL tools are older than the Neon server. Run brew upgrade libpq and retry.');
    const relations = await session.query(`SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname) ORDER BY n.nspname,c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','drizzle');`);
    const counts = [];
    for (const relation of relations) {
      const count = await session.query(`SELECT json_build_object('rows',count(*)::text) FROM ONLY ${identifier(relation.schema)}.${identifier(relation.table)};`);
      counts.push({ ...relation, rows: count.rows });
    }
    if (!counts.some(row => row.schema === 'public' && row.table === 'orders' && BigInt(row.rows) > 0n)) throw new Error('This database has no store orders. Stop and check the selected Neon database before proceeding.');
    console.log(`Current database size: ${(metadata.sizeBytes / 1024 / 1024).toFixed(1)} MiB (capacity must also be checked after restoring).`);
    for (const name of ['products', 'orders', 'categories', 'reviews']) {
      console.log(`${name}: ${counts.find(row => row.schema === 'public' && row.table === name)?.rows ?? 'missing'}`);
    }
    const stamp = new Date().toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    checkInterrupted();
    const finalDir = join(backupParent, `Renova-migration-backup-${stamp}-${randomUUID().slice(0,8)}`);
    const partialDir = finalDir + '.partial';
    await mkdir(partialDir, { mode: 0o700, recursive: true });
    const archive = join(partialDir, 'renova.dump.partial');
    console.log(`Writing a new backup folder: ${partialDir}`);
    console.log('Backing up the database, including store data and available login records...');
    await run(join(tool.dir, 'pg_dump'), ['--no-password', '--format=custom', '--no-owner', '--no-acl', `--snapshot=${metadata.snapshot}`, `--file=${archive}`], env, children);
    checkInterrupted();
    console.log('Reading the complete archive to check that it is usable...');
    const contents = await run(join(tool.dir, 'pg_restore'), ['--list', archive], env, children, { output: true });
    if (!/TABLE DATA public orders\s/.test(contents) || !/TABLE DATA public products\s/.test(contents)) throw new Error('The archive did not contain the store data. It will not be marked complete.');
    await run(join(tool.dir, 'pg_restore'), ['--file=/dev/null', archive], env, children);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(archive)) hash.update(chunk);
    checkInterrupted();
    const manifest = { format: 'renova-neon-migration-backup-v1', verifiedArchiveRead: true, sourceHost: new URL(source).hostname, ...metadata, tableCounts: counts, archive: 'renova.dump', sha256: hash.digest('hex'), notes: 'Counts and dump use the same read-only snapshot. No live restore or destination validation has occurred. Later orders require a fresh final backup. Managed Neon Auth is not recreated by this archive.' };
    await writeFile(join(partialDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    await writeFile(join(partialDir, 'contents.txt'), contents, { mode: 0o600 });
    await rename(archive, join(partialDir, 'renova.dump'));
    await rename(partialDir, finalDir);
    console.log('\nFRESH BACKUP COMPLETED AND ARCHIVE READ SUCCESSFULLY');
    console.log(`Snapshot: ${new Date(metadata.capturedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} Nigeria time`);
    console.log(`Backup folder: ${finalDir}`);
    console.log('Keep this folder private. Send ChatGPT the terminal summary, not the connection string or database archive.');
    console.log('Next: restore and verify the Aiven database, update the app and admin login, then plan the final cutover. Nothing has been switched.');
    return finalDir;
  } finally {
    session.close();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  backup().catch(error => { console.error(`\nSTOPPED: ${error.message}`); process.exitCode = 1; });
}
