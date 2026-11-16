import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rootCertificates } from 'node:tls';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { databaseTarget, postgresConfig } from '../app/lib/postgres-config.mjs';
import { migrationMode, allowsStoreWrite, WRITER_LOCK_KEY, MIGRATION_REVISION } from '../app/lib/migration-mode.mjs';
import { frozenSiteStatus } from '../scripts/prepare-aiven-final.mjs';
import { setupAivenOwner } from '../scripts/aiven-owner-setup.mjs';
import * as ownerSchema from '../db/owner-schema.mjs';

const build=process.env.RENOVA_AIVEN_TEST_BUILD;
const load=file=>import(pathToFileURL(join(build,file)));
const runtime={scope:new AsyncLocalStorage()};
globalThis[Symbol.for('renova.postgres.runtime.v1')]=runtime;
const {getDb}=await load('db/index.mjs');
const {withStoreWriter}=await load('app/lib/store-writer.mjs');
const {proxy}=await load('proxy.mjs');
const status=await load('app/api/migration/status/route.mjs');
const ownerGuard=await load('app/lib/admin-auth.mjs');
const pg=new PGlite();
const originalEnv={...process.env};
before(async()=>{await pg.exec(await readFile(new URL('../scripts/aiven-owner-schema.sql',import.meta.url),'utf8'));});
after(async()=>{await pg.close();for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv);});

test('both providers use explicit verified TLS, bounded pools and direct Neon sessions',async()=>{
 const source='postgres://owner:TEST_ONLY_SECRET@ep-sweet-cake-bah8seo5-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require';
 const sourceConfig=postgresConfig({DATABASE_URL:source});
 assert.equal(sourceConfig.host,'ep-sweet-cake-bah8seo5.c-8.eu-central-1.aws.neon.tech');
 assert.equal(sourceConfig.ssl.rejectUnauthorized,true);assert.equal(sourceConfig.max,4);assert.equal(sourceConfig.connectionString,undefined);
 const cert=rootCertificates[0];
 const url='postgres://avnadmin:TEST_ONLY_SECRET@pg-1c5cf951-renova.f.aivencloud.com:15591/renova_store_20261116t130637_fc06d9f3?sslmode=require';
 assert.throws(()=>postgresConfig({DATABASE_URL:url}),/DATABASE_SSL_CA/);
 const config=postgresConfig({DATABASE_URL:url,DATABASE_SSL_CA:cert},'owner');
 assert.equal(config.max,1);assert.equal(config.ssl.ca,cert);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.connectionString,undefined);
 assert.throws(()=>databaseTarget({DATABASE_URL:url.replace('renova_store_20261116t130637_fc06d9f3','defaultdb')}),/verified Renova store/);
});

test('maintenance pauses new orders and cron sends; recovery admits only the two retry webhooks',()=>{
 assert.equal(migrationMode({RENOVA_MAINTENANCE_MODE:'typo'}),'on');
 for(const path of ['/api/checkout/place-order','/api/anagen/order','/api/paystack/verify','/api/orders/reminders/run','/api/orders/admin']){
  assert.equal(allowsStoreWrite(path,{RENOVA_MAINTENANCE_MODE:'on'}),false);
  assert.equal(allowsStoreWrite(path,{RENOVA_MAINTENANCE_MODE:'webhooks'}),false);
 }
 for(const path of ['/api/whatsapp/webhook','/api/paystack/webhook']){
  assert.equal(allowsStoreWrite(path,{RENOVA_MAINTENANCE_MODE:'on'}),false);
  assert.equal(allowsStoreWrite(path,{RENOVA_MAINTENANCE_MODE:'webhooks'}),true);
 }
});

test('the production proxy returns retryable maintenance for checkout and preserves owner sign-in and health',()=>{
 process.env.RENOVA_MAINTENANCE_MODE='on';
 const req=(path,method='GET')=>Object.assign(new Request('https://shoprenova.com.ng'+path,{method}),{nextUrl:new URL('https://shoprenova.com.ng'+path)});
 assert.equal(proxy(req('/api/checkout/place-order','POST')).status,503);
 assert.equal(proxy(req('/anagen')).status,503);
 assert.equal(proxy(req('/api/whatsapp/webhook','POST')).status,503);
 for(const path of ['/api/health','/admin/login','/api/migration/status','/api/auth/get-session'])assert.equal(proxy(req(path)).headers.get('x-renova-test-pass'),'yes');
 process.env.RENOVA_MAINTENANCE_MODE='webhooks';
 assert.equal(proxy(req('/api/whatsapp/webhook','POST')).headers.get('x-renova-test-pass'),'yes');
 assert.equal(proxy(req('/api/orders/reminders/run','POST')).status,503);
 process.env.RENOVA_MAINTENANCE_MODE='off';
});

test('paused writers never acquire a database client or call a customer provider',async()=>{
 process.env.RENOVA_MAINTENANCE_MODE='on';
 runtime.store={connect:()=>assert.fail('No connection while paused')};
 const result=await withStoreWriter(new Request('https://shoprenova.com.ng/api/checkout/place-order'),()=>assert.fail('No write while paused'));
 assert.equal(result.status,503);process.env.RENOVA_MAINTENANCE_MODE='off';
});

test('one writer reserves one client, uses its own Drizzle connection and releases the shared drain lock',async()=>{
 const events=[];
 const client={query:async(text,params)=>{events.push([text,params]);return {rows:[{}]};},release:damaged=>events.push(['release',damaged])};
 runtime.store={connect:async()=>client};
 const result=await withStoreWriter(new Request('https://shoprenova.com.ng/api/checkout/place-order'),async()=>{
  assert.equal(getDb().$client,client);return Response.json({ok:true});
 });
 assert.equal(result.status,200);assert.match(events[0][0],/lock_shared/);assert.equal(events[0][1][0],WRITER_LOCK_KEY);
 assert.match(events[1][0],/unlock_shared/);assert.deepEqual(events[2],['release',false]);
});

test('concurrent requests keep their database clients separate through asynchronous continuations',async()=>{
 let index=0;
 runtime.store={connect:async()=>({id:++index,query:async()=>({rows:[]}),release(){}})};
 let release;
 const wait=new Promise(resolve=>{release=resolve;});
 const work=async()=>{const client=getDb().$client;await wait;assert.equal(getDb().$client,client);return new Response(String(client.id));};
 const first=withStoreWriter(new Request('https://shoprenova.com.ng/api/checkout/place-order'),work);
 const second=withStoreWriter(new Request('https://shoprenova.com.ng/api/anagen/order'),work);
 await new Promise(resolve=>setTimeout(resolve,0));release();
 const results=await Promise.all([first,second]);assert.notEqual(await results[0].text(),await results[1].text());
});

test('a broken unlock destroys the reserved client instead of returning it to the pool',async()=>{
 let destroyed;
 runtime.store={connect:async()=>({query:async text=>{if(text.includes('unlock_shared'))throw new Error('connection lost');return {rows:[]};},release:value=>{destroyed=value;}})};
 const result=await withStoreWriter(new Request('https://shoprenova.com.ng/api/anagen/order'),async()=>new Response('OK'));
 assert.equal(result.status,200);assert.equal(destroyed,true);
});

test('private status rejects a wrong bearer before querying and final preparation refuses an unfrozen source',async()=>{
 process.env.MIGRATION_CONTROL_SECRET='control-fixture-'.repeat(4);
 runtime.store={connect:()=>assert.fail('No database access for a wrong status bearer')};runtime.database=undefined;
 assert.equal((await status.GET(new Request('https://shoprenova.com.ng/api/migration/status'))).status,404);
 const source='postgres://owner:TEST_ONLY@ep-sweet-cake-bah8seo5.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require';
 const fetcher=async()=>Response.json({revision:MIGRATION_REVISION,mode:'off',provider:'neon',host:'ep-sweet-cake-bah8seo5.c-8.eu-central-1.aws.neon.tech',database:'neondb'});
 await assert.rejects(frozenSiteStatus('fixture-control',source,fetcher),/not frozen/);
});

test('the actual owner guard validates the session and rejects non-owners and cross-origin mutations',async()=>{
 const env={APP_URL:'https://shoprenova.com.ng',NODE_ENV:'production',BETTER_AUTH_SECRET:'fixture-secret-'.repeat(4),ADMIN_EMAILS:'owner@example.invalid'};
 Object.assign(process.env,env,{DATABASE_URL:'postgres://avnadmin:TEST_ONLY@pg-1c5cf951-renova.f.aivencloud.com:15591/renova_store_20261116t130637_fc06d9f3?sslmode=require'});
 runtime.ownerDatabase=drizzle(pg,{schema:ownerSchema});
 const pool={connect:async()=>({query:async(text,params)=>params?.length?pg.query(text,params):(await pg.exec(text)).at(-1),release(){}})};
 const password='A-fixture-owner-password-123!';
 await setupAivenOwner(pool,{email:'owner@example.invalid',password},env);
 const login=await ownerGuard.getOwnerAuth().handler(new Request(env.APP_URL+'/api/auth/sign-in/email',{method:'POST',headers:{origin:env.APP_URL,'content-type':'application/json'},body:JSON.stringify({email:'owner@example.invalid',password})}));
 assert.equal(login.status,200,await login.clone().text());
 const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 globalThis[Symbol.for('renova.aiven.test.headers')]=new Headers({cookie});
 assert.equal(await ownerGuard.requireOwnerRequest(new Request(env.APP_URL+'/api/orders/admin',{method:'PATCH',headers:{origin:env.APP_URL}})),null);
 assert.equal((await ownerGuard.requireOwnerRequest(new Request(env.APP_URL+'/api/orders/admin',{method:'PATCH',headers:{origin:'https://untrusted.example'}}))).status,403);
 process.env.ADMIN_EMAILS='other@example.invalid';
 assert.equal((await ownerGuard.requireOwnerRequest(new Request(env.APP_URL+'/api/orders/admin'))).status,403);
 globalThis[Symbol.for('renova.aiven.test.headers')]=new Headers();
 assert.equal((await ownerGuard.requireOwnerRequest(new Request(env.APP_URL+'/api/orders/admin'))).status,401);
});
