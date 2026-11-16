import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

async function nextServer(mode) {
 const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  stdio:['ignore','pipe','pipe'],env:{...process.env,DATABASE_URL:'',RENOVA_MAINTENANCE_MODE:mode,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production'}
 });
 let ready=false,output='';
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Local production server did not start.')),20000);
  child.on('exit',()=>{clearTimeout(timeout);if(!ready)reject(new Error('Local production server stopped before readiness.'));});
  const data=bytes=>{output+=bytes.toString();if(!ready&&/Ready in/.test(output)){ready=true;clearTimeout(timeout);resolve();}};
  child.stdout.on('data',data);child.stderr.on('data',data);
 }).catch(error=>{child.kill('SIGTERM');throw error;});
 return {fetch:path=>fetch(`http://127.0.0.1:${port}${path}`,{redirect:'manual',signal:AbortSignal.timeout(10000)}),close:async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');}};
}

test('native production Anagen renders the canonical URL, correct prices, order form and local media',async()=>{
 const server=await nextServer('off');
 try {
  const response=await server.fetch('/anagen');assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Anagen Hair Reviver/);
  assert.match(html,/<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/shoprenova\.com\.ng\/anagen")[^>]*>/);
  for(const text of ['id="order-form"','name="whatsappPhone"','name="availabilityDay"','₦11,200','₦20,400','₦28,600','Same Day Delivery in State Capitals','1–2 working days'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/1023272507453983|2347032161983|process_order\.php|shortclicktechnologies|Reply STOP|<video|\/anagen\/[12]\.mp4/);
  for(const file of ['raw.jpg','anagenraw.jpg','ari.jpg','hair1.jpg','hair2.jpg','hair3.jpg']){
   assert.ok((await stat(resolve('public/anagen',file))).size>0);assert.ok(html.includes('/anagen/'+file));
  }
  for(const path of ['/products/anagen','/offers/anagen']){
   const redirect=await server.fetch(path);assert.ok([307,308].includes(redirect.status),`${path}: ${redirect.status}`);
   assert.equal(new URL(redirect.headers.get('location'),'http://localhost').pathname,'/anagen');
  }
  assert.equal((await server.fetch('/api/health')).status,200);
  assert.equal((await server.fetch('/api/migration/status')).status,404);
 }finally{await server.close();}
 const stylesheet=await readFile('app/anagen/anagen.module.css','utf8');
 assert.match(stylesheet,/@media \(max-width: 700px\)/);assert.match(stylesheet,/prefers-reduced-motion/);
});

test('native production maintenance serves a retryable page while health and owner sign-in stay available',async()=>{
 const server=await nextServer('on');
 try {
  for(const path of ['/','/anagen','/checkout','/api/checkout/place-order','/api/orders/reminders/run','/api/whatsapp/webhook']){
   const response=await server.fetch(path);assert.equal(response.status,503,path);assert.equal(response.headers.get('retry-after'),'60');
  }
  assert.equal((await server.fetch('/api/health')).status,200);
  const login=await server.fetch('/admin/login');assert.equal(login.status,200);assert.match(await login.text(),/Owner sign in|Owner sign-in|Sign in/i);
 }finally{await server.close();}
});
