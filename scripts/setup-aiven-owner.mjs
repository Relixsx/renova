import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { postgresConfig, databaseTarget } from '../app/lib/postgres-config.mjs';
import { setupAivenOwner, verifyOwnerLogin } from './aiven-owner-setup.mjs';

process.umask(0o077);
let pool;
try {
  const env={...process.env,APP_URL:'https://shoprenova.com.ng',NODE_ENV:'production'};
  for(const key of ['DATABASE_URL','DATABASE_SSL_CA','RENOVA_OWNER_EMAIL','RENOVA_OWNER_PASSWORD','RENOVA_OWNER_CA'])delete process.env[key];
  if(databaseTarget(env).provider!=='aiven')throw new Error('Use the final Aiven STORE database URI.');
  env.DATABASE_SSL_CA=await readFile(env.RENOVA_OWNER_CA,'utf8');
  pool=new Pool(postgresConfig(env,'owner'));
  const resetPassword=process.argv.slice(2).includes('--reset-password');
  const owner=await setupAivenOwner(pool,{email:env.RENOVA_OWNER_EMAIL,password:env.RENOVA_OWNER_PASSWORD,resetPassword},env);
  await verifyOwnerLogin(pool,{email:owner.email,password:env.RENOVA_OWNER_PASSWORD},env);
  console.log(`Aiven owner ${resetPassword?'password reset':'setup'} completed and sign-in verified for ${owner.email}.`);
  console.log('No store records were changed and no customer messages were sent.');
}catch(error){
  const message=error instanceof Error?error.message:'';
  if(/^(Use |Choose a password|This owner already|The owner account|The saved owner session)/.test(message))console.error(message);
  else console.error('Owner setup stopped. Check the private Aiven STORE URI, certificate and approved owner email.');
  process.exitCode=1;
}finally{if(pool)await pool.end();}
