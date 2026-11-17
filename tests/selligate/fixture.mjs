import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
export const moduleAt=async name=>import(pathToFileURL(join(process.env.SELLIGATE_TEST_BUILD,name+'.mjs')).href);
export const {SelligateService}=await moduleAt('service');
export const TEST='120363000000001@g.us',PRODUCTION='120363000000002@g.us';
export const instanceId=randomUUID();
export async function fixture(work,gates={liveAllowed:true,validatedBuild:true}){
 const url=process.env.SELLIGATE_TEST_DATABASE_URL;let database,pool;
 if(url){const parsed=new URL(url);if(!['localhost','127.0.0.1'].includes(parsed.hostname)||parsed.pathname!=='/selligate_test')throw Error('Refusing non-test database.');const {Pool}=await import('pg');pool=new Pool({connectionString:url,max:4});database=pool;}
 else {const {PGlite}=await import('@electric-sql/pglite');database=new PGlite();pool={query:(...a)=>database.query(...a),connect:async()=>({query:(...a)=>database.query(...a),release(){}})};}
 const q=(sql,values=[])=>pool.query(sql,values);
 try{
  await q('DROP SCHEMA IF EXISTS selligate CASCADE');await q('DROP TABLE IF EXISTS public.orders CASCADE');await q('DROP TABLE IF EXISTS public.products CASCADE');
  await q("CREATE TABLE public.products(id serial PRIMARY KEY,slug text UNIQUE NOT NULL,name text NOT NULL,sku text NOT NULL); CREATE TABLE public.orders(id serial PRIMARY KEY,order_number text UNIQUE NOT NULL,customer_name text NOT NULL,customer_phone text NOT NULL,customer_email text DEFAULT '',status text NOT NULL DEFAULT 'payment_pending',payment_status text DEFAULT 'pending',items_json text NOT NULL,address_json text NOT NULL,created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text);");
  await q(await readFile('db/selligate/001-dispatch.sql','utf8'));
  await q("INSERT INTO public.products(slug,name,sku) VALUES('anagen','Anagen test product','TEST-ANA'),('book','Fictional book','TEST-BOOK')");
  let queue=Promise.resolve();const perform=async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const v=await fn(new SelligateService(c,gates));await c.query('COMMIT');return v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};const tx=fn=>{if(url)return perform(fn);const next=queue.then(()=>perform(fn));queue=next.catch(()=>{});return next;};
  const heartbeat=()=>tx(s=>s.heartbeat({instanceId,status:'CONNECTED',account:'2340000000000',groups:[{id:TEST,name:'Fictional TEST group',canSend:true},{id:PRODUCTION,name:'Fictional production fixture',canSend:true}]}));
  const available=(productId=1,states=['LA'])=>tx(s=>s.configure('owner@example.test',{action:'availability',productId,states}));
  const configure=async(mode='LIVE')=>{await heartbeat();await available();await tx(s=>s.configure('owner@example.test',{action:'groups',testGroup:TEST,productionGroup:PRODUCTION}));await tx(s=>s.configure('owner@example.test',{action:'mode',mode,confirmation:'ENABLE LIVE DISPATCH'}));};
  let seq=0;const place=async({state='LA',items=[{slug:'anagen',name:'Anagen test product',quantity:1,variant:'Standard'}],status='confirmed',payment='pending'}={})=>(await q("INSERT INTO public.orders(order_number,customer_name,customer_phone,status,payment_status,items_json,address_json) VALUES($1,'Fictional Customer','+2340000000000',$2,$3,$4,$5) RETURNING *",['FAKE-'+(++seq),status,payment,JSON.stringify(items),JSON.stringify({stateCode:state,streetAddress:'Fictional address — do not deliver',lga:'Test area',cityTown:'Fictional town'})])).rows[0];
  const jobs=async()=>(await q('SELECT * FROM selligate.jobs ORDER BY created_at')).rows;
  const control=async()=>{const s=(await q('SELECT * FROM selligate.settings')).rows[0];return {mode:s.mode,stopped:s.stopped,testGroup:s.test_group,productionGroup:s.production_group,generation:s.generation,liveAllowed:true};};
  const api=async(action,i={})=>tx(s=>({claim:()=>s.claim(),authorize:()=>s.authorize(i),permit:()=>s.permit(i),outcome:()=>s.outcome(i),ack:()=>s.acknowledge(i),reject:()=>s.reject(i)})[action]());
  await work({q,tx,pool,heartbeat,available,configure,place,jobs,control,api});
 }finally{if(database?.close)await database.close();else await pool.end();}
}
export async function journalFixture(work){const dir=await mkdtemp(join(tmpdir(),'renova-selligate-'));const {Journal}=await moduleAt('journal');const path=join(dir,'journal.sqlite');const journal=new Journal(path);try{await work(journal,path,Journal);}finally{try{journal.close();}catch{}await rm(dir,{recursive:true,force:true});}}
