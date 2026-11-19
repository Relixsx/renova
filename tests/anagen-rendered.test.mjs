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

test('native production Gold and Electric Lime pages keep their URLs, shared order form and local media',async()=>{
 const server=await nextServer('off');
 try {
  for(const [path,theme] of [['/anagen','gold'],['/anagen2','lime']]){
  const response=await server.fetch(path);assert.equal(response.status,200,path);
  const html=await response.text();
  assert.match(html,/Anagen Hair Reviver/);
  assert.ok(html.includes(`data-anagen-theme="${theme}"`),`${path}: intended colour variant`);
  const main=html.match(/<main(?=[^>]*data-anagen-theme=)[^>]*>/)?.[0]||'';
  if(theme==='lime')assert.match(main,/limeTheme/);else assert.doesNotMatch(main,/limeTheme/);
  assert.ok(html.includes(`href="${path}"`),`${path}: product wordmark stays on this page`);
  assert.match(html,/<img(?=[^>]*src="\/anagen\/product-studio\.webp")(?=[^>]*loading="eager")(?=[^>]*fetchPriority="high")[^>]*>/i);
  const productBytes=(await stat(resolve('public/anagen/product-studio.webp'))).size;
  assert.ok(productBytes>0 && productBytes<200000,'Hero product image is optimized for mobile');
  const productPhoto=await server.fetch('/anagen/product-studio.webp');
  assert.equal(productPhoto.status,200);assert.match(productPhoto.headers.get('content-type'),/image\/webp/);
  const canonical=html.match(/<link(?=[^>]*rel="canonical")[^>]*href="([^"]+)"[^>]*>/)?.[1];
  assert.equal(canonical,`https://shoprenova.com.ng${path}`);
  const productData=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match=>JSON.parse(match[1])).find(value=>value['@type']==='Product');
  assert.ok(productData,`${path}: product structured data is present`);
  assert.equal(productData.offers.url,`https://shoprenova.com.ng${path}`);
  assert.equal(productData.sku,'REN-ANAGEN-10G');
  for(const text of ['id="order-form"','name="whatsappPhone"','name="availabilityDay"','₦11,200','₦20,400','₦28,600','TODAY /','24-HOUR DELIVERY','subject to address &amp; dispatch confirmation','1–2 working days'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/name="(?:alternativePhone|cityTown)"/);
  assert.match(html,/<select(?=[^>]*id="anagen-lga")(?![^>]*required)[^>]*>/);
  assert.ok(html.includes('id="anagen-comparisons"'));
  assert.ok(html.includes('Previous photo') && html.includes('Next photo'));
  assert.equal((html.match(/alt="Before-and-after hair comparison supplied by Renova, photo /g)||[]).length,9);
  assert.doesNotMatch(html,/AI-generated|Illustrative example only|\/anagen\/illustrations\//);
  for(let number=1;number<=9;number++){
   const file=`photo-${String(number).padStart(2,'0')}.webp`;
   const bytes=(await stat(resolve('public/anagen/customer-gallery',file))).size;
   assert.ok(bytes>0 && bytes<250000,`${file}: optimized local image`);
   assert.ok(html.includes(`/anagen/customer-gallery/${file}`));
  }
  const picture=await server.fetch('/anagen/customer-gallery/photo-01.webp');
  assert.equal(picture.status,200);assert.match(picture.headers.get('content-type'),/image\/webp/);
  assert.doesNotMatch(html,/1023272507453983|2347032161983|process_order\.php|shortclicktechnologies|Reply STOP|<video|\/anagen\/[12]\.mp4/);
  for(const file of ['product-studio.webp','anagenraw.jpg','ari.jpg','hair1.jpg','hair2.jpg','hair3.jpg']){
   assert.ok((await stat(resolve('public/anagen',file))).size>0);assert.ok(html.includes('/anagen/'+file));
  }
  const cssPaths=[...html.matchAll(/<link(?=[^>]*rel="stylesheet")[^>]*href="([^"]+)"[^>]*>/g)].map(match=>match[1]);
  assert.ok(cssPaths.length>0,`${path}: production stylesheets are linked`);
  let css='';
  for(const cssPath of cssPaths){const response=await server.fetch(cssPath);assert.equal(response.status,200);css+=await response.text();}
  assert.match(css,/--radiant-gold:\s*(?:#ffd700|gold)/i);
  assert.match(css,/--accent:\s*#7fff00/i);
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
  for(const path of ['/','/anagen','/anagen2','/checkout','/api/anagen/order','/api/checkout/place-order','/api/orders/reminders/run','/api/whatsapp/webhook']){
   const response=await server.fetch(path);assert.equal(response.status,503,path);assert.equal(response.headers.get('retry-after'),'60');
  }
  assert.equal((await server.fetch('/api/health')).status,200);
  const login=await server.fetch('/admin/login');assert.equal(login.status,200);assert.match(await login.text(),/Owner sign in|Owner sign-in|Sign in/i);
 }finally{await server.close();}
});

