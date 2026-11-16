import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnerOrderEmail, sendOwnerOrderEmail, ownerOrderEmailStatus, OWNER_ORDER_EMAIL } from '../app/lib/owner-order-email.mjs';

const env={RESEND_API_KEY:'fixture-key-never-sent',RESEND_FROM_EMAIL:'Renova <orders@example.invalid>'};
const order={orderNumber:'REN-ANA-EMAIL-FIXTURE',trackingNumber:'REN-ANA-EMAIL-FIXTURE',customerName:'Amina Example',customerEmail:'',customerPhone:'08000000000',whatsappPhone:'2348000000001',paymentMethod:'cash_on_delivery',paymentStatus:'payment_due_on_delivery',totalKobo:2860000,itemsJson:JSON.stringify([{name:'Anagen — 3 packs',quantity:1,packQuantity:3,variant:'6 sachets'}]),addressJson:JSON.stringify({streetAddress:'12 Example Street',cityTown:'Ikeja',lga:'Ikeja',state:'Lagos',alternativePhone:'08000000002',availabilityDay:'Tomorrow'}),estimatedDelivery:'1–2 working days',createdAt:'2026-11-16T17:00:00.000Z'};

test('the owner alert goes to the requested Gmail and includes the saved Anagen bundle, exact total and full delivery details',()=>{
 const message=buildOwnerOrderEmail(order,env);
 assert.equal(OWNER_ORDER_EMAIL,'airebirth5@gmail.com');assert.deepEqual(message.to,['airebirth5@gmail.com']);
 assert.equal(message.from,env.RESEND_FROM_EMAIL);assert.equal(message.reply_to,undefined);
 for(const text of ['Amina Example','REN-ANA-EMAIL-FIXTURE','08000000000','2348000000001','08000000002','Tomorrow','Anagen — 3 packs','6 sachets','packs: 3','₦28,600','12 Example Street','Ikeja','Lagos','1–2 working days','Payment due on delivery'])assert.ok(message.text.includes(text),text);
 assert.doesNotMatch(message.text,/Paid via Paystack/);
});

test('a customer-supplied recipient cannot redirect the owner alert; a valid customer email is only Reply-To',()=>{
 const message=buildOwnerOrderEmail({...order,to:'attacker@example.invalid',recipient:'attacker@example.invalid',customerEmail:'customer@example.invalid'},env);
 assert.deepEqual(message.to,['airebirth5@gmail.com']);assert.equal(message.reply_to,'customer@example.invalid');
 assert.deepEqual(buildOwnerOrderEmail({...order,customerEmail:'customer@example.invalid\r\nBcc: attacker@example.invalid'},env).to,['airebirth5@gmail.com']);
 assert.equal(buildOwnerOrderEmail({...order,customerEmail:'customer@example.invalid\r\nBcc: attacker@example.invalid'},env).reply_to,undefined);
});

test('customer content is escaped in HTML and cannot become mail headers',()=>{
 const message=buildOwnerOrderEmail({...order,customerName:'<script>alert(1)</script>',orderNumber:'REN-EXAMPLE\r\nBcc: person@example.invalid',addressJson:'{"streetAddress":"<img src=x onerror=alert(1)>"}'},env);
 assert.doesNotMatch(message.html,/<script>|<img /);assert.match(message.html,/&lt;script&gt;/);assert.match(message.html,/&lt;img/);
 assert.doesNotMatch(message.subject,/[\r\n]/);assert.deepEqual(message.to,['airebirth5@gmail.com']);
});

test('paid Paystack alerts use paid wording; pending or mismatched payment states never send an alert',async()=>{
 const message=buildOwnerOrderEmail({...order,paymentMethod:'paystack',paymentStatus:'paid'},env);
 assert.match(message.text,/Paid via Paystack/);assert.match(message.text,/Amount Paid: ₦28,600/);assert.doesNotMatch(message.text,/Amount Due:/);
 for(const values of [{paymentMethod:'paystack',paymentStatus:'pending'},{paymentMethod:'cash_on_delivery',paymentStatus:'pending'},{paymentMethod:'other',paymentStatus:'paid'}]){
  assert.equal(await sendOwnerOrderEmail({...order,...values},{env,fetcher:()=>assert.fail('Unverified payment must not send')}),false);
 }
});

test('a successful request uses only the HTTPS email API, a separate order key, and a bounded timeout',async()=>{
 let calls=0;
 assert.equal(await sendOwnerOrderEmail(order,{env,fetcher:async(url,init)=>{
  calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
  assert.equal(init.headers.authorization,'Bearer '+env.RESEND_API_KEY);assert.equal(init.headers['Idempotency-Key'],'renova-owner-order-REN-ANA-EMAIL-FIXTURE');assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(init.body).to,['airebirth5@gmail.com']);assert.ok(!init.body.includes(env.RESEND_API_KEY));
  return Response.json({id:'fixture-receipt'});
 }}),true);assert.equal(calls,1);
});

test('the same order uses the same provider idempotency key and body across repeated attempts',async()=>{
 const requests=[];
 const fetcher=async(url,init)=>{requests.push(init);return Response.json({id:'fixture-receipt'});};
 await sendOwnerOrderEmail(order,{env,fetcher});await sendOwnerOrderEmail(order,{env,fetcher});
 assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);assert.equal(requests[0].body,requests[1].body);
});

test('missing mail configuration fails explicitly without contacting a provider',async()=>{
 for(const settings of [{}, {RESEND_API_KEY:env.RESEND_API_KEY},{RESEND_FROM_EMAIL:env.RESEND_FROM_EMAIL}]){
  await assert.rejects(sendOwnerOrderEmail(order,{env:settings,fetcher:()=>assert.fail('No mail call with missing settings')}),/RESEND_/);
 }
 assert.equal(ownerOrderEmailStatus({}).configured,false);assert.equal(ownerOrderEmailStatus(env).configured,true);
 assert.equal(ownerOrderEmailStatus(env).recipient,'airebirth5@gmail.com');
});

test('the existing sender alias is supported, while a sender containing header breaks is rejected',()=>{
 assert.equal(buildOwnerOrderEmail(order,{ORDER_FROM_EMAIL:env.RESEND_FROM_EMAIL}).from,env.RESEND_FROM_EMAIL);
 assert.equal(buildOwnerOrderEmail(order,{RESEND_FROM_EMAIL:' ',ORDER_FROM_EMAIL:env.RESEND_FROM_EMAIL}).from,env.RESEND_FROM_EMAIL);
 assert.throws(()=>buildOwnerOrderEmail(order,{RESEND_FROM_EMAIL:'bad\r\nBcc: target@example.invalid'}),/RESEND_FROM_EMAIL/);
});

test('a rejection or timeout is not retried or redirected to Formspree, and errors do not disclose private provider content',async()=>{
 let calls=0;
 await assert.rejects(sendOwnerOrderEmail(order,{env,fetcher:async()=>{calls++;return Response.json({error:'PRIVATE_PROVIDER_CONTENT'},{status:429});}}),error=>/HTTP 429/.test(error.message)&&!error.message.includes('PRIVATE_PROVIDER_CONTENT'));
 assert.equal(calls,1);
 await assert.rejects(sendOwnerOrderEmail(order,{env,fetcher:async()=>{throw new Error('PRIVATE_NETWORK_CONTENT '+env.RESEND_API_KEY);}}),error=>!error.message.includes('PRIVATE_')&&!error.message.includes(env.RESEND_API_KEY));
});

test('an invalid provider receipt is reported; malformed legacy JSON still produces a useful saved-order alert',async()=>{
 await assert.rejects(sendOwnerOrderEmail(order,{env,fetcher:async()=>Response.json({unexpected:true})}),/invalid receipt/);
 const message=buildOwnerOrderEmail({...order,itemsJson:'{broken',addressJson:'null'},env);
 assert.match(message.text,/See the saved order in Admin/);assert.match(message.text,/REN-ANA-EMAIL-FIXTURE/);
 assert.throws(()=>buildOwnerOrderEmail({...order,totalKobo:NaN},env),/amount is invalid/);
});
