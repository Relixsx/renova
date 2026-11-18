import test from 'node:test';import assert from 'node:assert/strict';import {moduleAt} from './fixture.mjs';
const {STATES,canonicalState,parseOrder,evaluate,formatMessage,validateStateCodes,validateGroups,fictionalOrder}=await moduleAt('core');
const row=(state='LA',items=[{slug:'anagen',name:'Anagen test',quantity:1,variant:'Standard'}])=>({order_number:'FAKE-1',customer_name:'Fictional customer',customer_phone:'+2340000000000',created_at:'2026-11-17T10:00:00Z',address_json:{stateCode:state,streetAddress:'Fictional delivery address',lga:state==='OY'?'Ibadan North':'Ikeja'},items_json:items});
test('uses all 36 states and FCT in existing Renova code convention',()=>{assert.equal(STATES.length,37);assert.equal(canonicalState('Lagos'),'LA');assert.equal(canonicalState('NG-LA'),'LA');assert.equal(canonicalState('Lagos State'),'LA');});
test('Abuja and FCT normalize to FC',()=>{for(const s of ['Abuja','FCT','Abuja/FCT','Federal Capital Territory','FC'])assert.equal(canonicalState(s),'FC');});
test('invalid, missing and city-only names cannot qualify',()=>{for(const s of ['',null,'Ikeja','Port Harcourt','LA-bad'])assert.equal(canonicalState(s),null);});
test('available product is eligible and unavailable product is excluded',()=>{assert.equal(evaluate(parseOrder(row()),{anagen:['LA']}).eligible.length,1);assert.equal(evaluate(parseOrder(row('OY')),{anagen:['LA']}).eligible.length,0);});
test('unconfigured and empty product configurations default to excluded',()=>{for(const rules of [{},{anagen:[]}])assert.equal(evaluate(parseOrder(row()),rules).decisions[0].reason,'NO_AVAILABILITY_CONFIGURATION');});
test('missing or invalid delivery state never uses phone or city to infer state',()=>{const r=row('invalid');r.address_json.cityTown='Lagos';assert.equal(evaluate(parseOrder(r),{anagen:['LA']}).eligible.length,0);});
test('explicit invalid state code does not fall back to a different state name',()=>{const r=row('XX');r.address_json.state='Lagos';assert.equal(evaluate(parseOrder(r),{anagen:['LA']}).state,null);});
test('product-specific mixed order records every decision and only eligible items',()=>{const o=parseOrder(row('LA',[{slug:'anagen',name:'Eligible hair product',quantity:2,variant:'Standard'},{slug:'book',name:'Unavailable book',quantity:1}]));const r=evaluate(o,{anagen:['LA'],book:['KN']});const m=formatMessage(o,r,'LIVE');assert.equal(r.decisions.length,2);assert.equal(r.partial,true);assert.match(m,/PARTIAL FULFILMENT/);assert.match(m,/Eligible hair product/);assert.doesNotMatch(m,/Unavailable book/);});
test('missing state records exclusion for every item',()=>{const o=parseOrder(row(null));assert.equal(evaluate(o,{anagen:['LA']}).decisions[0].reason,'INVALID_DELIVERY_STATE');});
test('test message is labelled fictional and contains no payment data or email',()=>{const r=fictionalOrder({slug:'anagen',name:'Test product'},'LA',2,'TEST-PREVIEW','Ikeja');r.customer_email='never-share@example.test';r.payment_secret='secret';const o=parseOrder(r),m=formatMessage(o,evaluate(o,{anagen:['LA']}),'TEST');assert.match(m,/TEST ONLY/);assert.doesNotMatch(m,/never-share|payment_secret|secret/);});
test('bundles preserve pack quantities and variant without pricing changes',()=>{const r=row();r.items_json[0].packQuantity=3;r.items_json[0].variant='6 sachets';const o=parseOrder(r);assert.match(formatMessage(o,evaluate(o,{anagen:['LA']}),'LIVE'),/3 packs per bundle/);});
test('OFF formatter and unavailable orders cannot create messages',()=>{const o=parseOrder(row());assert.throws(()=>formatMessage(o,evaluate(o,{anagen:['LA']}),'OFF'));assert.throws(()=>formatMessage(o,evaluate(o,{}),'TEST'));});
test('rejects malformed JSON, missing items and unsafe quantities',()=>{for(const items of ['bad',[],[{}],[{slug:'a',name:'A',quantity:-1}],[{slug:'a',name:'A',quantity:1.2}]])assert.throws(()=>parseOrder(row('LA',items)));});
test('overlong message is rejected as one request instead of truncating fulfilment data',()=>{const o=parseOrder(row('LA',Array.from({length:30},()=>({slug:'anagen',name:'A'.repeat(200),variant:'B'.repeat(180),quantity:1}))));assert.throws(()=>formatMessage(o,evaluate(o,{anagen:['LA']}),'LIVE'),/MESSAGE_TOO_LONG/);});
test('rejects unknown state codes and equal or non-group destinations',()=>{assert.throws(()=>validateStateCodes(['Lagos']));assert.throws(()=>validateGroups('120363000000001@g.us','120363000000001@g.us'));assert.throws(()=>validateGroups('2340000000000@c.us',null));assert.deepEqual(validateStateCodes(['LA','LA','FC']),['FC','LA']);});
test('customer text cannot inject new WhatsApp sections',()=>{const r=row();r.customer_name='Fake\n*NEW ORDER*';const o=parseOrder(r),m=formatMessage(o,evaluate(o,{anagen:['LA']}),'TEST');assert.doesNotMatch(m,/Customer: Fake\n/);});

test('Anagen Today/Tomorrow delivery availability is preserved in dispatch',()=>{const r=row();r.address_json.availabilityDay='Tomorrow';const o=parseOrder(r);assert.match(formatMessage(o,evaluate(o,{anagen:['LA']}),'LIVE'),/Availability: Tomorrow/);});

const {SELLIGATE_AREAS, checkDeliveryArea, canonicalLga}=await moduleAt('areas');

test('the 34 listed hubs map to 29 authorities and every selected LGA matches checkout data',()=>{
 assert.equal(Object.keys(SELLIGATE_AREAS).length,29);
 assert.equal(Object.values(SELLIGATE_AREAS).reduce((n,a)=>n+a.hubs.length,0),34);
 for(const [state,area] of Object.entries(SELLIGATE_AREAS)){
  assert.equal(canonicalState(state),state);
  for(const lga of area.lgas??[]) assert.equal(canonicalLga(state,lga),lga,`Unrecognised ${state}: ${lga}`);
 }
});

test('Ekiti stock qualifies Ado Ekiti but not Oye or an ambiguous address',()=>{
 const order=parseOrder(row('EK'));
 const rules={anagen:['EK']};
 order.address={stateCode:'EK',lga:'Ado-Ekiti LGA',streetAddress:'Fictional address, Ado-Ekiti, Ekiti State'};
 assert.equal(evaluate(order,rules).decisions[0].reason,'AVAILABLE_IN_COVERED_LGA');
 assert.match(formatMessage(order,evaluate(order,rules),'LIVE'),/LGA: Ado Ekiti/);
 for(const streetAddress of ['Fictional address, Oye-Ekiti, Ekiti State','Fictional address Oye Ekiti Ekiti State']){
  order.address={stateCode:'EK',streetAddress};
  const result=evaluate(order,rules);
  assert.equal(result.area.lga,'Oye');
  assert.equal(result.decisions[0].reason,'SELLIGATE_LGA_NOT_COVERED');
  assert.throws(()=>formatMessage(order,result,'LIVE'),/NOT_ELIGIBLE/);
 }
 order.address={stateCode:'EK',streetAddress:'Fictional address, Ekiti State'};
 assert.equal(evaluate(order,rules).area.reason,'DELIVERY_LGA_REQUIRED');
});

test('a mismatching address or invalid LGA stays with the owner',()=>{
 const order=parseOrder(row('EK'));
 const rules={anagen:['EK']};
 order.address={stateCode:'EK',lga:'Ado Ekiti',streetAddress:'Fictional address, Oye Ekiti'};
 assert.equal(evaluate(order,rules).area.reason,'CONFLICTING_DELIVERY_LGA');
 order.address={stateCode:'EK',lga:'Ikeja',streetAddress:'Fictional address, Ado Ekiti'};
 assert.equal(evaluate(order,rules).area.reason,'INVALID_DELIVERY_LGA');
 order.address={stateCode:'EK',state:'Lagos',lga:'Ado Ekiti',streetAddress:'Fictional address'};
 assert.equal(evaluate(order,rules).area.reason,'CONFLICTING_DELIVERY_STATE');
 order.address={stateCode:'EK',lga:'Ado Ekiti',streetAddress:'Fictional address, Oye Ekiti Road, Ado Ekiti'};
 assert.equal(evaluate(order,rules).area.reason,null);
});

test('city restrictions and statewide coverage stay distinct',()=>{
 for(const [state,lga] of [['OY','Ibadan North-East'],['FC','AMAC'],['AN','Onitsha South'],['AN','Awka South'],['DE','Warri South'],['DE','Ughelli North'],['DE','Oshimili South'],['BY','Ekeremor']]){
  assert.equal(checkDeliveryArea(state,{lga}).reason,null,`${state} ${lga}`);
 }
 for(const [state,lga] of [['OY','Iseyin'],['FC','Gwagwalada'],['AN','Nnewi North'],['DE','Warri North']]){
  assert.equal(checkDeliveryArea(state,{lga}).reason,'SELLIGATE_LGA_NOT_COVERED',`${state} ${lga}`);
 }
 assert.equal(checkDeliveryArea('FC',{streetAddress:'Fictional address, Abuja'}).reason,'DELIVERY_LGA_REQUIRED');
 assert.equal(checkDeliveryArea('RI',{streetAddress:'Fictional address, Port Harcourt City'}).lga,'Port Harcourt');
 assert.equal(checkDeliveryArea('LA',{streetAddress:'Fictional address Lagos Mainland Lagos State'}).lga,'Lagos Mainland');
 assert.equal(canonicalLga('EK','constructor'),null);
 assert.equal(checkDeliveryArea('BY',{}).reason,'DELIVERY_LGA_REQUIRED');
 assert.equal(checkDeliveryArea('AD',{lga:'Yola North'}).reason,'SELLIGATE_STATE_NOT_COVERED');
});
