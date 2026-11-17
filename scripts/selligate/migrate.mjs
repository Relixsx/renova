import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {postgresConfig} from '../../app/lib/postgres-config.mjs';
if(process.env.SELLIGATE_APPLY_MIGRATION!=='yes')throw Error('Set SELLIGATE_APPLY_MIGRATION=yes only after reviewing the migration and verifying a fresh backup.');
if(!process.argv[2])throw Error('Pass the private backup folder path, never a connection string.');
const dir=resolve(process.argv[2]),cfg=postgresConfig(process.env),m=JSON.parse(await readFile(join(dir,'verified-backup.json'),'utf8'));
if(m.format!=='renova-selligate-backup-v1'||m.host!==cfg.host||m.database!==cfg.database||Date.now()-Date.parse(m.createdAt)>86400000||Date.parse(m.createdAt)>Date.now()+60000)throw Error('A verified backup of this exact database from the past 24 hours is required.');
const hash=createHash('sha256');for await(const chunk of createReadStream(join(dir,'renova.dump')))hash.update(chunk);
if(hash.digest('hex')!==m.sha256||(await stat(join(dir,'renova.dump'))).size!==m.bytes)throw Error('Backup integrity check failed.');
const pool=new Pool(cfg),c=await pool.connect();
try{
 await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='30s'");await c.query('SELECT pg_advisory_xact_lock(730410105)');
 if(process.argv.includes('--detach'))await c.query(await readFile(new URL('../../db/selligate/rollback-detach.sql',import.meta.url),'utf8'));
 else {const present=(await c.query("SELECT to_regclass('selligate.settings') AS table_name")).rows[0].table_name;if(present)throw Error('Selligate is already installed; this migration will not reset existing configuration.');await c.query(await readFile(new URL('../../db/selligate/001-dispatch.sql',import.meta.url),'utf8'));}
 await c.query('COMMIT');console.log(process.argv.includes('--detach')?'Dispatch disabled and trigger detached. History preserved.':'Selligate migration installed with automation OFF and STOP active.');
}catch(e){await c.query('ROLLBACK');console.error(e instanceof Error&&e.message.startsWith('Selligate')?e.message:'Migration stopped safely. No partial migration was committed.');process.exitCode=1;}
finally{c.release();await pool.end();}
