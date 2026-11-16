import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as ownerSchema from '../db/owner-schema.mjs';
import { approvedOwner } from '../app/lib/owner-settings.mjs';
import { createOwnerAuth } from '../app/lib/owner-auth.mjs';

export async function setupAivenOwner(pool,{email,password,name='Lateef',resetPassword=false},env=process.env) {
  email=email.trim().toLowerCase();
  if(!approvedOwner(email,env))throw new Error('Use an owner email listed in ADMIN_EMAILS.');
  if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('Choose a password between 12 and 128 characters.');
  const schema=await readFile(new URL('./aiven-owner-schema.sql',import.meta.url),'utf8');
  const client=await pool.connect();
  let ownerId,created=false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(723481938475::bigint)');
    await client.query(schema);
    const existing=await client.query('SELECT u.id,a.password FROM renova_auth."user" u LEFT JOIN renova_auth.account a ON a.user_id=u.id AND a.provider_id=$2 WHERE lower(u.email)=$1',[email,'credential']);
    if(existing.rows.length>1)throw new Error('The owner account has conflicting login records. No changes were saved.');
    if(existing.rows.length){
      ownerId=existing.rows[0].id;
      if(!resetPassword && (!existing.rows[0].password || !await verifyPassword({hash:existing.rows[0].password,password})))throw new Error('This owner already exists. Enter the existing Aiven owner password, or use the explicit --reset-password option.');
      if(resetPassword){
        await client.query('INSERT INTO renova_auth.account(id,account_id,provider_id,user_id,password)VALUES($1,$2,$3,$2,$4) ON CONFLICT(provider_id,account_id) DO UPDATE SET password=excluded.password,updated_at=now()',[randomUUID(),ownerId,'credential',await hashPassword(password)]);
        await client.query('DELETE FROM renova_auth.session WHERE user_id=$1',[ownerId]);
        await client.query('UPDATE renova_auth."user" SET email_verified=true,updated_at=now() WHERE id=$1',[ownerId]);
      }
    }else{
      ownerId=randomUUID();created=true;
      await client.query('INSERT INTO renova_auth."user"(id,name,email,email_verified)VALUES($1,$2,$3,true)',[ownerId,name.trim()||'Renova owner',email]);
      await client.query('INSERT INTO renova_auth.account(id,account_id,provider_id,user_id,password)VALUES($1,$2,$3,$2,$4)',[randomUUID(),ownerId,'credential',await hashPassword(password)]);
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  return {id:ownerId,email,created,reset:resetPassword};
}

export async function verifyOwnerLogin(pool,{email,password},env=process.env) {
  const auth=createOwnerAuth(drizzle(pool,{schema:ownerSchema}),{...env,BETTER_AUTH_SECRET:randomBytes(32).toString('hex')});
  const origin=auth.options.baseURL;
  const response=await auth.handler(new Request(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password})}));
  if(!response.ok)throw new Error('The owner account was saved, but the sign-in check failed. No customer messages were sent.');
  const cookies=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const headers=new Headers({cookie:cookies,origin});
  try {
    const session=await auth.api.getSession({headers});
    if(session?.user.email.toLowerCase()!==email.toLowerCase())throw new Error('The saved owner session could not be verified.');
  }finally{await auth.api.signOut({headers}).catch(()=>{});}
  return true;
}
