import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { createOwnerAuth } from '../app/lib/owner-auth.mjs';
import { approvedOwner, trustedOwnerOrigins } from '../app/lib/owner-settings.mjs';
import { setupAivenOwner } from '../scripts/aiven-owner-setup.mjs';
import * as schema from '../db/owner-schema.mjs';

const pg=new PGlite(),db=drizzle(pg,{schema});
const env={NODE_ENV:'production',APP_URL:'https://shoprenova.com.ng',BETTER_AUTH_SECRET:'qa-'.repeat(24),ADMIN_EMAILS:'owner@example.invalid'};
const email='owner@example.invalid',password='A-long-fixture-password-42!';
let sent=[],auth;
const pool={connect:async()=>({query:async(text,values)=>{if(values?.length)return pg.query(text,values);const results=await pg.exec(text);return results.at(-1)||{rows:[]};},release(){}})};
const request=(path,body,cookie,origin=env.APP_URL)=>new Request(env.APP_URL+'/api/auth/'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(origin?{origin}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
const cookies=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
before(async()=>{await pg.exec(await readFile(new URL('../scripts/aiven-owner-schema.sql',import.meta.url),'utf8'));});
beforeEach(async()=>{
 await pg.exec('TRUNCATE renova_auth.account,renova_auth.session,renova_auth.verification,renova_auth.rate_limit,renova_auth."user" CASCADE');
 sent=[];auth=createOwnerAuth(db,env,async data=>{sent.push(data);});
 await setupAivenOwner(pool,{email,password,name:'Owner'},env);
});
after(()=>pg.close());

test('an approved owner signs in and receives a secure, HTTP-only session; sign-out revokes it',async()=>{
 const login=await auth.handler(request('sign-in/email',{email,password}));
 assert.equal(login.status,200,await login.clone().text());
 const cookie=cookies(login);assert.match(cookie,/renova_owner/);
 assert.ok(login.headers.getSetCookie().some(value=>/HttpOnly/i.test(value)&&/Secure/i.test(value)));
 const session=await auth.api.getSession({headers:new Headers({cookie})});assert.equal(session.user.email,email);
 const logout=await auth.handler(request('sign-out',{},cookie));assert.equal(logout.status,200);
 assert.equal(await auth.api.getSession({headers:new Headers({cookie})}),null);
});

test('a wrong password and a modified session cookie grant no session',async()=>{
 const wrong=await auth.handler(request('sign-in/email',{email,password:'different-fixture-password'}));assert.equal(wrong.status,401);
 assert.equal(await auth.api.getSession({headers:new Headers({cookie:'__Secure-renova_owner.session_token=forged.signature'})}),null);
});

test('public sign-up is disabled, including an allowlisted email',async()=>{
 for(const address of ['new@example.invalid',email]){
  const response=await auth.handler(request('sign-up/email',{email:address,password,name:'Uninvited'}));
  assert.ok(response.status>=400);assert.ok(!response.headers.get('set-cookie'));
 }
 assert.equal((await pg.query('SELECT count(*)::int n FROM renova_auth."user"')).rows[0].n,1);
});

test('sign-in rejects an untrusted Origin',async()=>{
 const response=await auth.handler(request('sign-in/email',{email,password},undefined,'https://untrusted.example'));
 assert.equal(response.status,403);
});

test('password-reset tokens are one-use and invalidate existing sessions',async()=>{
 const login=await auth.handler(request('sign-in/email',{email,password})),cookie=cookies(login);
 const start=await auth.handler(request('request-password-reset',{email,redirectTo:env.APP_URL+'/admin/reset-password'}));
 assert.equal(start.status,200,await start.clone().text());assert.equal(sent.length,1);
 const link=new URL(sent[0].url),token=link.pathname.split('/').at(-1),newPassword='An-even-longer-fixture-password-84!';
 assert.notEqual(token,'');
 const reset=await auth.handler(request('reset-password',{token,newPassword}));assert.equal(reset.status,200,await reset.clone().text());
 assert.equal(await auth.api.getSession({headers:new Headers({cookie})}),null);
 const replay=await auth.handler(request('reset-password',{token,newPassword:'Still-another-fixture-password'}));assert.ok(replay.status>=400);
 const fresh=await auth.handler(request('sign-in/email',{email,password:newPassword}));assert.equal(fresh.status,200);
});

test('database-backed rate limits stop repeated login attempts',async()=>{
 let last;
 for(let i=0;i<7;i++)last=await auth.handler(request('sign-in/email',{email,password:'wrong-fixture-password'}));
 assert.equal(last.status,429);
 assert.ok((await pg.query('SELECT count(*)::int n FROM renova_auth.rate_limit')).rows[0].n>0);
});

test('owner setup is idempotent and refuses to overwrite an existing password without the explicit reset option',async()=>{
 const initial=(await pg.query('SELECT password FROM renova_auth.account')).rows[0].password;
 const result=await setupAivenOwner(pool,{email,password},env);assert.equal(result.created,false);
 await assert.rejects(setupAivenOwner(pool,{email,password:'A-different-fixture-password!'},env),/already exists/);
 assert.equal((await pg.query('SELECT password FROM renova_auth.account')).rows[0].password,initial);
 assert.equal((await pg.query('SELECT count(*)::int n FROM renova_auth."user"')).rows[0].n,1);
});

test('the private setup rejects a non-owner; removing an email revokes its application authorization',async()=>{
 await assert.rejects(setupAivenOwner(pool,{email:'other@example.invalid',password},env),/ADMIN_EMAILS/);
 assert.equal(approvedOwner(email,env),true);assert.equal(approvedOwner(email,{...env,ADMIN_EMAILS:'other@example.invalid'}),false);
 assert.ok(!trustedOwnerOrigins(env).includes('https://untrusted.example'));
});

test('the explicit private password reset revokes sessions and restores a missing credential account',async()=>{
 const login=await auth.handler(request('sign-in/email',{email,password}));
 const cookie=cookies(login);
 await pg.query('DELETE FROM renova_auth.account WHERE user_id=(SELECT id FROM renova_auth."user" WHERE email=$1)',[email]);
 const newPassword='A-recovered-private-owner-password-12!';
 await setupAivenOwner(pool,{email,password:newPassword,resetPassword:true},env);
 assert.equal(await auth.api.getSession({headers:new Headers({cookie})}),null);
 const fresh=await auth.handler(request('sign-in/email',{email,password:newPassword}));
 assert.equal(fresh.status,200,await fresh.clone().text());
 assert.equal((await pg.query('SELECT count(*)::int n FROM renova_auth.account')).rows[0].n,1);
});
