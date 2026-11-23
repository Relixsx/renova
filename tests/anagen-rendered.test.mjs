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
  for(const text of ['id="order-form"','name="whatsappPhone"','name="availabilityDay"','₦11,200','₦20,400','₦28,600','TODAY /','24-HOUR DELIVERY','subject to address &amp; dispatch confirmation'])assert.ok(html.includes(text),text);
  if(theme==='lime')assert.ok(html.includes('1–2 working days'),'Electric Lime delivery note');
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

test('native production Anagen 3 serves an independent page with the shared checkout and local campaign media', async () => {
 const server = await nextServer('off');
 try {
  const response = await server.fetch('/anagen3');
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const text of [
   'https://shoprenova.com.ng/anagen3', 'id="anagen3-primary"', 'id="order-form"',
   'Anagen Hair Reviver', 'Two sealed sachets', 'Application illustration', 'Pay on delivery',
   'Before &amp; after photos', 'Photos shared by Anagen’s supplier', 'What comes in your pack',
   '₦11,200', '₦20,400', '₦28,600', 'Save ₦2,000', 'Save ₦5,000',
   'name="fullName"', 'name="phone"', 'name="whatsappPhone"', 'name="streetAddress"',
   'name="stateCode"', 'name="availabilityDay"', 'name="commitment"', 'data-anagen-funnel="anagen3"',
   'Use my delivery number for WhatsApp', 'Place my order — pay on delivery',
  ]) assert.ok(html.includes(text), text);
  const gallery = html.match(/<section id="customer-photos"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? "";
  const photoSources = [...gallery.matchAll(/<img\b[^>]*\ssrc="(\/anagen\/[^"]+)"/g)].map(([, src]) => src);
  const menFirst = [1, 7, 2, 3, 4, 5, 6, 8, 9].map(number => `/anagen/customer-gallery/photo-${String(number).padStart(2, "0")}.webp`);
  assert.deepEqual(photoSources, [...menFirst, "/anagen/hair1.jpg", "/anagen/hair2.jpg", "/anagen/hair3.jpg"]);
  assert.doesNotMatch(gallery, /<details\b/, "All comparisons are visible without expanding the gallery");
  assert.deepEqual([...gallery.matchAll(/<a href="(\/anagen\/[^"]+)"/g)].map(([, href]) => href), photoSources);
  assert.ok((html.match(/href="#order-form"/g) || []).length >= 7, "The order form is reachable from throughout the funnel");
  assert.doesNotMatch(html, /choicemartng\.com|shopibesta\.com/);
  assert.match(html, /<select(?=[^>]*id="anagen-lga")(?![^>]*required)[^>]*>/);
  for (const asset of ['pack-540.webp', 'pack-860.webp', 'application-540.webp', 'application-900.webp', 'concern-edges.webp', 'concern-breakage.webp', 'concern-scalp.webp', 'blend.webp', 'sachets.webp', 'pouch.webp']) {
   assert.ok(html.includes(`/anagen3/${asset}`), asset);
   const image = await server.fetch(`/anagen3/${asset}`);
   assert.equal(image.status, 200);
   assert.match(image.headers.get('content-type'), /image\/webp/);
   assert.ok((await image.arrayBuffer()).byteLength < 80000, `${asset} is optimized`);
  }
 } finally { await server.close(); }
});

test('native production maintenance serves a retryable page while health and owner sign-in stay available',async()=>{
 const server=await nextServer('on');
 try {
  for(const path of ['/','/anagen','/anagen2','/anagen3','/checkout','/api/anagen/order','/api/checkout/place-order','/api/orders/reminders/run','/api/whatsapp/webhook']){
   const response=await server.fetch(path);assert.equal(response.status,503,path);assert.equal(response.headers.get('retry-after'),'60');
  }
  assert.equal((await server.fetch('/api/health')).status,200);
  const login=await server.fetch('/admin/login');assert.equal(login.status,200);assert.match(await login.text(),/Owner sign in|Owner sign-in|Sign in/i);
 }finally{await server.close();}
});

