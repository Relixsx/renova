import { Client, Pool } from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { postgresConfig, databaseTarget } from '../app/lib/postgres-config.mjs';
import { WRITER_LOCK_KEY, MIGRATION_REVISION } from '../app/lib/migration-mode.mjs';
import { approvedOwner } from '../app/lib/owner-settings.mjs';
import { backup } from './aiven-copy/backup-renova.mjs';
import { restore, validateDestination } from './aiven-copy/restore-renova.mjs';
import { setupAivenOwner, verifyOwnerLogin } from './aiven-owner-setup.mjs';
import { applyAnagenProductSetup } from './anagen-product-setup.mjs';

export async function frozenSiteStatus(control,sourceUrl,fetcher=fetch) {
  const response=await fetcher('https://shoprenova.com.ng/api/migration/status?check='+Date.now(),{headers:{authorization:`Bearer ${control}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('The new Render migration status could not be verified. Confirm the new commit is Live and MIGRATION_CONTROL_SECRET matches Render before retrying.');
  const status=await response.json();
  const source=databaseTarget({DATABASE_URL:sourceUrl});
  if(status.revision!==MIGRATION_REVISION||status.mode!=='on'||status.provider!=='neon'||source.provider!=='neon'||typeof status.host!=='string'||status.host.replace('-pooler.','.')!==source.url.hostname.replace('-pooler.','.')||status.database!==decodeURIComponent(source.url.pathname.slice(1))||!Number.isSafeInteger(status.orders)||status.orders<0)throw new Error('The website is not frozen on the expected Neon database with the new writer protocol. No final copy was made.');
  return status;
}

export function queryFacade(pool) {
  return {query:(text,params=[])=>pool.query(text,params),transaction:async statements=>{
    const client=await pool.connect();try{await client.query('BEGIN');for(const item of statements)await client.query(item.text,item.params);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }};
}

export async function prepareFinal() {
  process.umask(0o077);
  const input={control:process.env.RENOVA_CUTOVER_CONTROL,source:process.env.RENOVA_CUTOVER_SOURCE,destination:process.env.RENOVA_CUTOVER_DESTINATION,caPath:process.env.RENOVA_CUTOVER_CA,email:process.env.RENOVA_CUTOVER_EMAIL,password:process.env.RENOVA_CUTOVER_PASSWORD,stock:Number(process.env.ANAGEN_OPENING_STOCK)};
  for(const key of Object.keys(process.env))if(key.startsWith('RENOVA_CUTOVER_'))delete process.env[key];
  if(!input.control||input.control.length<32||!input.source||!input.destination||!input.caPath||!input.email||!input.password||input.password.length<12||input.password.length>128||!Number.isSafeInteger(input.stock)||input.stock<0)throw new Error('Use prepare-aiven-final.sh and complete all private prompts.');
  validateDestination(input.destination);
  const initial=await frozenSiteStatus(input.control,input.source);
  const owners=Array.isArray(initial.ownerEmails)?initial.ownerEmails.filter(value=>typeof value==='string'):[];
  const env={...process.env,ADMIN_EMAILS:owners.join(','),APP_URL:'https://shoprenova.com.ng',NODE_ENV:'production'};
  if(!owners.length||!approvedOwner(input.email,env))throw new Error('Use an owner email approved in the live Render ADMIN_EMAILS setting. No copy was made.');
  const sourceClient=new Client(postgresConfig({...env,DATABASE_URL:input.source},'store'));
  let locked=false,pool,aborted=false;
  const stop=()=>{aborted=true;void sourceClient.end();};
  const checkStop=()=>{if(aborted)throw new Error('Preparation interrupted. Keep Render in maintenance mode and verify the latest preparation result before continuing.');};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    console.log('Maintenance is on. Waiting for existing store writers and notifications to finish...');
    await sourceClient.connect();
    await sourceClient.query('SELECT pg_advisory_lock($1::bigint)',[WRITER_LOCK_KEY]);locked=true;
    const frozen=await frozenSiteStatus(input.control,input.source);checkStop();
    process.env.RENOVA_SOURCE_DATABASE_URL=input.source;
    const backupDirectory=await backup();
    const manifest=JSON.parse(await readFile(join(backupDirectory,'manifest.json'),'utf8'));
    if(Number(manifest.tableCounts.find(row=>row.schema==='public'&&row.table==='orders')?.rows)!==frozen.orders)throw new Error('The source order count changed while frozen. Keep maintenance on and investigate any external database writer.');
    checkStop();
    const receipt=await restore({backupDirectory,caPath:input.caPath,destinationUrl:input.destination});
    checkStop();
    const finalUrl=validateDestination(input.destination);finalUrl.pathname='/'+receipt.destinationDatabase;
    const ca=await readFile(input.caPath,'utf8');
    const destinationEnv={...env,DATABASE_URL:finalUrl.toString(),DATABASE_SSL_CA:ca};
    pool=new Pool(postgresConfig(destinationEnv,'owner'));
    console.log('Preparing the private Aiven owner account...');
    await setupAivenOwner(pool,{email:input.email,password:input.password},env);
    await verifyOwnerLogin(pool,{email:input.email,password:input.password},env);
    checkStop();
    const anagen=await applyAnagenProductSetup(queryFacade(pool),input.stock);
    const result=await pool.query('SELECT count(*)::int AS orders FROM public.orders');
    if(result.rows[0].orders!==frozen.orders)throw new Error('The final Aiven order count could not be verified. Keep maintenance on.');
    const ready={format:'renova-aiven-ready-v1',host:receipt.destinationHost,database:receipt.destinationDatabase,sourceSnapshot:receipt.sourceSnapshot,sourceOrders:frozen.orders,destinationOrders:result.rows[0].orders,ownerEmail:input.email.toLowerCase(),ownerLoginVerified:true,anagenReady:true,anagenStock:anagen.product.stock,caPath:input.caPath,preparedAt:new Date().toISOString(),websiteSwitched:false};
    await writeFile(join(backupDirectory,'aiven-ready.json'),JSON.stringify(ready,null,2)+'\n',{mode:0o600});
    const copied=spawnSync('pbcopy',[],{input:finalUrl.toString(),stdio:['pipe','ignore','ignore']});
    console.log('\nFINAL AIVEN DATABASE PREPARED AND OWNER LOGIN VERIFIED');
    console.log(`Database: ${ready.database}`);
    console.log(`Orders: ${ready.destinationOrders}; source orders: ${ready.sourceOrders}`);
    console.log(`Owner: ${ready.ownerEmail}; Anagen available packs: ${ready.anagenStock}`);
    console.log(`Preparation record: ${join(backupDirectory,'aiven-ready.json')}`);
    if(copied.status===0)console.log('The final DATABASE_URL is on your clipboard. Paste it directly into Render; do not paste it in chat.');
    else console.log('Clipboard copy failed. Use the Aiven database selector to copy the URI for the printed final database.');
    console.log('Keep RENOVA_MAINTENANCE_MODE=on. Add DATABASE_SSL_CA and BETTER_AUTH_SECRET before restarting Render on this final database.');
    console.log('Nothing was pushed, deployed or sent to customers. Read AIVEN_MIGRATION.md for the remaining verification and reopening steps.');
    return ready;
  }finally{
    if(pool)await pool.end();
    if(locked)await sourceClient.query('SELECT pg_advisory_unlock($1::bigint)',[WRITER_LOCK_KEY]).catch(()=>{});
    await sourceClient.end().catch(()=>{});
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    input.password='';input.source='';input.destination='';input.control='';
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)prepareFinal().catch(error=>{
 const message=error instanceof Error?error.message:'';
 if(/^(Use |The website |The new Render |The source order |The final Aiven |Preparation interrupted|Choose a password|This owner already|The owner account was saved|The saved owner session|PostgreSQL 18|\[(?:[A-Z0-9_]+);)/.test(message))console.error(message);
 else {
  const code=/^[A-Z0-9]{5}$/.test(error?.code||'')?error.code:'CONNECTION_OR_SETUP';
  console.error(`Final preparation stopped (${code}). Check the private connection settings, certificate and owner setup. No Render setting was changed.`);
 }
 console.error('Keep Render in maintenance mode. Your verified backups remain available.');process.exitCode=1;
});
