import {mkdir,mkdtemp,writeFile,chmod,rm,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {postgresConfig} from '../../app/lib/postgres-config.mjs';
const cfg=postgresConfig(process.env),dir=resolve(process.argv[2]||join(homedir(),'Downloads','Renova-private-backup-'+new Date().toISOString().replace(/[:.]/g,'-')));
await mkdir(dir,{recursive:false,mode:0o700});await chmod(dir,0o700);
const temp=await mkdtemp(join(tmpdir(),'renova-backup-ca-')),archive=join(dir,'renova.dump');
try{
 const env={...process.env,PGHOST:cfg.host,PGPORT:String(cfg.port),PGDATABASE:cfg.database,PGUSER:cfg.user,PGPASSWORD:cfg.password,PGSSLMODE:'verify-full',PGCONNECT_TIMEOUT:'15'};
 if(cfg.ssl.ca){const ca=join(temp,'ca.pem');await writeFile(ca,cfg.ssl.ca,{mode:0o600});env.PGSSLROOTCERT=ca;}
 const run=(command,args)=>{const r=spawnSync(command,args,{env,stdio:['ignore','ignore','pipe']});if(r.status!==0)throw Error(command+' failed. Check PostgreSQL 18 tools, credentials and connectivity. No verified backup was completed.');};
 run('pg_dump',['--format=custom','--no-owner','--no-acl','--file',archive]);
 run('pg_restore',['--list',archive]);run('pg_restore',['--no-owner','--no-acl','--file',process.platform==='win32'?'NUL':'/dev/null',archive]);
 const hash=createHash('sha256');for await(const chunk of createReadStream(archive))hash.update(chunk);
 const manifest={format:'renova-selligate-backup-v1',host:cfg.host,database:cfg.database,createdAt:new Date().toISOString(),sha256:hash.digest('hex'),bytes:(await stat(archive)).size};
 await writeFile(join(dir,'verified-backup.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
 console.log('Verified private database archive:',dir);console.log('Keep the archive private. Do not upload it to chat or GitHub.');
}catch(e){console.error(e instanceof Error?e.message:'Backup failed.');process.exitCode=1;}
finally{await rm(temp,{recursive:true,force:true});}
