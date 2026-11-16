import { createHash, X509Certificate } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findTools, PSQL_FLAGS, queryJson, runTool } from './pg-tools.mjs';
import { countVerificationSql, emptyCheckSql, preparationSql, quoteIdentifier, quoteLiteral, receiptAssertionSql, verificationAndReceiptSql } from './restore-sql.mjs';

const DESTINATION_HOST = 'pg-1c5cf951-renova.f.aivencloud.com';
const SOURCE_HOST = /^ep-sweet-cake-bah8seo5(?:-pooler)?\.c-8\.eu-central-1\.aws\.neon\.tech$/;
const schemas = new Set(['public','drizzle']);
const requiredTables = ['categories','orders','products','reviews'];

export function validateDestination(input) {
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('Copy the complete Aiven Service URI with its password from Quick connect.'); }
  if (!['postgres:','postgresql:'].includes(url.protocol) || url.hostname !== DESTINATION_HOST || url.port !== '15591' || url.pathname !== '/defaultdb' || decodeURIComponent(url.username) !== 'avnadmin' || !url.password || /CLICK_TO|REVEAL_PASSWORD|YOUR_PASSWORD/i.test(url.password)) {
    throw new Error('Use the avnadmin Service URI for the Aiven service pg-1c5cf951, port 15591, database defaultdb. Include its actual password. A Neon connection string is not accepted.');
  }
  for (const [key] of url.searchParams) if (!['sslmode','channel_binding','connect_timeout','application_name'].includes(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Use the standard Service URI copied from Aiven Quick connect, without extra connection options.');
  if (url.searchParams.has('sslmode') && !['require','verify-ca','verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error('The destination connection must use SSL. Certificate verification will be required.');
  if (/[\u0000-\u001f\u007f]/.test(decodeURIComponent(url.password))) throw new Error('Copy the connection string again; its password contains invalid control characters.');
  return url;
}

export function validateManifest(value) {
  if (!value || value.format !== 'renova-neon-migration-backup-v1' || value.verifiedArchiveRead !== true || value.hasStore !== true || !SOURCE_HOST.test(value.sourceHost) || !/^[a-f0-9]{64}$/.test(value.sha256) || value.archive !== 'renova.dump' || !Number.isFinite(Date.parse(value.capturedAt)) || !Number.isInteger(value.serverVersionNum) || value.serverVersionNum < 100000 || value.serverVersionNum > 189999 || !Number.isFinite(value.sizeBytes) || value.sizeBytes < 0 || !Array.isArray(value.tableCounts) || value.tableCounts.length < 4 || value.tableCounts.length > 500) {
    throw new Error('Select the completed migration backup folder made by the corrected backup tool, with its original manifest.json and renova.dump.');
  }
  const seen = new Set();
  for (const row of value.tableCounts) {
    const key = row.schema + '.' + row.table;
    if (!schemas.has(row.schema) || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(row.table) || typeof row.rows !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(row.rows) || BigInt(row.rows) > 9223372036854775807n || seen.has(key)) throw new Error('The backup manifest has invalid or duplicate table information. Do not edit it.');
    seen.add(key);
  }
  for (const name of requiredTables) if (!seen.has('public.' + name)) throw new Error('This is not the verified Renova store backup; a core store table is missing.');
  if (value.tableCounts.find(row => row.schema === 'public' && row.table === 'orders').rows === '0') throw new Error('The selected backup has no orders. Use the completed current store backup.');
  return value;
}

export function databaseName(manifest) {
  const stamp = new Date(manifest.capturedAt).toISOString().replaceAll(/[-:]/g,'').slice(0,15).toLowerCase();
  return `renova_store_${stamp}_${manifest.sha256.slice(0,8)}`;
}

export function connectionEnvironment(url, caPath, inherited = process.env) {
  const clean = { ...inherited };
  for (const key of Object.keys(clean)) if (key.startsWith('PG') || ['RENOVA_AIVEN_DATABASE_URL','RENOVA_SOURCE_DATABASE_URL'].includes(key)) delete clean[key];
  return { ...clean, PGHOST:url.hostname, PGPORT:url.port, PGDATABASE:decodeURIComponent(url.pathname.slice(1)), PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password), PGSSLMODE:'verify-full', PGSSLROOTCERT:caPath, PGCONNECT_TIMEOUT:'20', PGAPPNAME:'renova_aiven_initial_restore', PGCLIENTENCODING:'UTF8', ...(url.searchParams.has('channel_binding') ? {PGCHANNELBINDING:url.searchParams.get('channel_binding')} : {}) };
}

export function selectedArchiveList(contents) {
  const selected = contents.split('\n').filter(line => !/^\s*\d+;\s+\d+\s+\d+\s+(?:SCHEMA\s+-|DATABASE(?: PROPERTIES)?\s+-|EXTENSION\s+-|COMMENT\s+-\s+(?:DATABASE|SCHEMA)\s)/.test(line)).join('\n') + '\n';
  for (const name of ['orders','products']) if (!new RegExp('TABLE DATA public ' + name + '\\s').test(selected)) throw new Error('The archive listing is missing the store table data. Nothing has been restored.');
  return selected;
}

async function loadBackup(directory) {
  const dir = await realpath(directory);
  if (dir.endsWith('.partial')) throw new Error('A .partial backup cannot be restored. Choose the completed backup folder.');
  const manifestPath = join(dir,'manifest.json'), archive = join(dir,'renova.dump');
  for (const file of [manifestPath,archive]) { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('The manifest and archive must be regular files in the selected backup folder.'); }
  if ((await lstat(manifestPath)).size > 1024*1024) throw new Error('The backup manifest is too large. Select the original completed backup folder.');
  let manifest;
  try { manifest = validateManifest(JSON.parse(await readFile(manifestPath,'utf8'))); } catch(error) { throw new Error(error instanceof SyntaxError ? 'The backup manifest is not valid JSON. Select the original completed backup folder.' : error.message); }
  const hash = createHash('sha256');
  let header;
  for await (const chunk of createReadStream(archive)) { if (!header) header=chunk.subarray(0,5).toString(); hash.update(chunk); }
  if (header !== 'PGDMP' || hash.digest('hex') !== manifest.sha256) throw new Error('The archive checksum does not match its original manifest. Nothing was restored. Select the unchanged completed backup.');
  return {dir,archive,manifest};
}

async function certificate(path) {
  const resolved = await realpath(path), stat = await lstat(resolved);
  if (!stat.isFile() || stat.size > 256*1024) throw new Error('Select the CA certificate downloaded from the Aiven service.');
  const pem = await readFile(resolved,'utf8');
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!blocks?.length) throw new Error('The selected file is not a PEM CA certificate. Download the CA certificate from Aiven Connection information.');
  try { for (const block of blocks) if (!new X509Certificate(block).ca) throw new Error(); } catch { throw new Error('Select the project CA certificate from Aiven, rather than a different file.'); }
  return resolved;
}

async function ensureVerifiedCopy(tool, env, manifest, children) {
  const sql = 'BEGIN READ ONLY; ' + receiptAssertionSql(manifest) + countVerificationSql(manifest) + `SELECT json_build_object('database',current_database(),'sizeBytes',pg_database_size(current_database()),'serverVersion',current_setting('server_version'),'verified',true); COMMIT;`;
  return queryJson(tool,sql,env,children);
}

export async function restore({ backupDirectory=process.env.RENOVA_BACKUP_DIRECTORY, caPath=process.env.RENOVA_AIVEN_CA_PATH, destinationUrl=process.env.RENOVA_AIVEN_DATABASE_URL }={}) {
  process.umask(0o077);
  if (!backupDirectory || !caPath || !destinationUrl) throw new Error('Use restore-renova-to-aiven.sh so the backup folder, certificate and hidden connection string are supplied.');
  const url = validateDestination(destinationUrl);
  delete process.env.RENOVA_AIVEN_DATABASE_URL;
  const ca = await certificate(caPath);
  const backup = await loadBackup(backupDirectory);
  const env = connectionEnvironment(url,ca);
  const targetName = databaseName(backup.manifest), targetEnv={...env,PGDATABASE:targetName};
  const tool = findTools(env), children=new Set();
  let interrupted=false, temp;
  const stop=()=>{interrupted=true;for(const child of children)child.kill('SIGTERM');};
  const checkStop=()=>{if(interrupted)throw new Error('Restore interrupted. The destination is not verified. Do not switch Render.');};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    console.log(`Verified backup snapshot: ${new Date(backup.manifest.capturedAt).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})} Nigeria time`);
    for (const name of requiredTables) console.log(`${name}: ${backup.manifest.tableCounts.find(row=>row.schema==='public'&&row.table===name).rows}`);
    console.log(`Checking Aiven: ${url.hostname}:${url.port} (certificate verification required)`);
    const info=await queryJson(tool,`BEGIN READ ONLY; SELECT json_build_object('serverVersionNum',current_setting('server_version_num')::integer,'canCreate',(SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname=current_user),'readOnly',current_setting('transaction_read_only'),'inRecovery',pg_is_in_recovery(),'visibleBytes',(SELECT coalesce(sum(pg_database_size(oid)),0)::text FROM pg_database WHERE datallowconn AND NOT datistemplate AND has_database_privilege(oid,'CONNECT')),'exists',EXISTS(SELECT 1 FROM pg_database WHERE datname=${quoteLiteral(targetName)})); COMMIT;`,env,children);
    if (info.inRecovery || Math.floor(info.serverVersionNum/10000)<Math.floor(backup.manifest.serverVersionNum/10000)) throw new Error('The destination is read-only or has an older PostgreSQL major version than the source. No restore was started.');
    if (!info.exists && !info.canCreate) throw new Error('This Aiven role cannot create the separate migration database. Use the avnadmin connection, or create an empty migration database in Aiven before continuing with ChatGPT.');
    if (!info.exists && BigInt(info.visibleBytes)+BigInt(Math.ceil(backup.manifest.sizeBytes*2))>900n*1024n*1024n) throw new Error('The source and existing database sizes leave too little conservative headroom for an additional copy on the Free plan. Check Aiven storage before proceeding.');
    checkStop();
    if (info.exists) {
      const existing=await queryJson(tool,`BEGIN READ ONLY; SELECT json_build_object('receipt',to_regclass('renova_migration.backup_receipt') IS NOT NULL,'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())); COMMIT;`,targetEnv,children);
      if(existing.owner!=='avnadmin')throw new Error('The separate target database is not owned by avnadmin. It was not overwritten.');
      if(existing.receipt){const verified=await ensureVerifiedCopy(tool,targetEnv,backup.manifest,children);return await finish(backup,url,targetName,verified,true);}
      await queryJson(tool,`BEGIN READ ONLY; ${emptyCheckSql()} SELECT json_build_object('empty',true); COMMIT;`,targetEnv,children);
    }
    temp=await mkdtemp(join(tmpdir(),'renova-aiven-restore-'));
    const contents=await runTool(join(tool.dir,'pg_restore'),['--list','--schema=public','--schema=drizzle',backup.archive],env,children,{capture:true});
    const listPath=join(temp,'store.list'),payloadPath=join(temp,'store.sql'),prepPath=join(temp,'prepare.sql'),verifyPath=join(temp,'verify.sql');
    await writeFile(listPath,selectedArchiveList(contents),{mode:0o600});
    await runTool(join(tool.dir,'pg_restore'),['--no-owner','--no-acl','--no-tablespaces','--no-publications','--no-subscriptions','--no-security-labels','--schema=public','--schema=drizzle',`--use-list=${listPath}`,`--file=${payloadPath}`,backup.archive],env,children);
    await writeFile(prepPath,preparationSql(),{mode:0o600});
    await writeFile(verifyPath,verificationAndReceiptSql(backup.manifest),{mode:0o600});
    checkStop();
    if(!info.exists){
      console.log(`Creating separate database: ${targetName}`);
      try { await runTool(join(tool.dir,'psql'),[...PSQL_FLAGS,`--command=CREATE DATABASE ${quoteIdentifier(targetName)} WITH TEMPLATE template0 OWNER avnadmin`],env,children); }
      catch(error){if(error.sqlstate!=='42P04')throw error;}
    }
    console.log('Restoring store tables and verifying every saved row count and sequence in one transaction...');
    try {await runTool(join(tool.dir,'psql'),[...PSQL_FLAGS,'--single-transaction',`--file=${prepPath}`,`--file=${payloadPath}`,`--file=${verifyPath}`],targetEnv,children);}
    catch(error){if(error.category!=='NOT_EMPTY')throw error;await ensureVerifiedCopy(tool,targetEnv,backup.manifest,children);}
    checkStop();
    const verified=await ensureVerifiedCopy(tool,targetEnv,backup.manifest,children);
    return await finish(backup,url,targetName,verified,false);
  } finally {
    for(const child of children)child.kill('SIGTERM');
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    if(temp)await rm(temp,{recursive:true,force:true});
    delete env.PGPASSWORD;delete targetEnv.PGPASSWORD;
  }
}

async function finish(backup,url,database,verified,already) {
  const receipt={format:'renova-aiven-store-copy-v1',destinationHost:url.hostname,destinationPort:url.port,destinationDatabase:database,sourceSnapshot:backup.manifest.capturedAt,archiveSha256:backup.manifest.sha256,tableCounts:backup.manifest.tableCounts,restoredSizeBytes:verified.sizeBytes,serverVersion:verified.serverVersion,verifiedAt:new Date().toISOString(),purpose:'initial-store-copy',websiteSwitched:false,ownerLoginConfigured:false};
  await writeFile(join(backup.dir,'aiven-store-copy.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log(`\n${already?'EXISTING AIVEN COPY VERIFIED':'AIVEN STORE COPY RESTORED AND VERIFIED'}`);
  console.log(`Database: ${database}`);
  console.log(`Every table count matched: ${backup.manifest.tableCounts.length} tables. Sequence checks passed.`);
  for(const row of backup.manifest.tableCounts)console.log(`${row.schema}.${row.table}: ${row.rows}`);
  console.log(`Restored database size: ${(verified.sizeBytes/1024/1024).toFixed(1)} MiB`);
  console.log(`Snapshot: ${new Date(backup.manifest.capturedAt).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})} Nigeria time`);
  console.log('This is the initial copy. Newer Neon writes are not included. Render and all customer messaging remain on the existing system.');
  console.log('The original login records remain in the private backup. Aiven admin login and application changes are the next step.');
  console.log('Send ChatGPT this terminal summary. Do not change Render yet.');
  return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  restore().catch(error=>{console.error(`\nSTOPPED: ${error.code==='ENOENT'?'A selected file or folder could not be found. Check the completed backup folder and Aiven certificate.':error.message}`);process.exitCode=1;});
}
