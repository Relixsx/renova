import { getAllStates } from "ng-geo-data";
import { checkDeliveryArea, ROUTE_REASONS } from './delivery-areas';
export const RELEASE = "selligate-v2";
export const STATES = getAllStates().map(({code,name}) => ({code,name}));
export type Mode = "OFF" | "TEST" | "LIVE";
export class DispatchError extends Error { constructor(public code:string,public status=400){super(code);} }
const object=(v:unknown):Record<string,unknown>=>{if(typeof v==='string'){try{v=JSON.parse(v);}catch{throw new DispatchError('MALFORMED_ORDER');}}if(!v||typeof v!=='object'||Array.isArray(v))throw new DispatchError('MALFORMED_ORDER');return v as Record<string,unknown>;};
export function canonicalState(v:unknown):string|null {
 if(typeof v!=='string')return null;const s=v.trim().replace(/^NG[-_ ]/i,'').replace(/\s+state$/i,'').trim().toLowerCase();
 if(['abuja','fct','abuja/fct','abuja / fct','federal capital territory','federal capital territory (abuja)'].includes(s))return 'FC';
 return STATES.find(x=>x.code.toLowerCase()===s||x.name.toLowerCase()===s)?.code??null;
}
export function deliveryState(a:Record<string,unknown>){const v=a.stateCode??a.state_code??a.state??a.stateName;return canonicalState(v&&typeof v==='object'?(v as Record<string,unknown>).code??(v as Record<string,unknown>).name:v);}
export function validateStateCodes(v:unknown):string[]{if(!Array.isArray(v)||v.length>37||v.some(c=>!STATES.some(s=>s.code===c)))throw new DispatchError('INVALID_STATE_CODES');return [...new Set(v as string[])].sort();}
export type Item={slug:string;name:string;variant:string;quantity:number;packQuantity?:number};
export type Order={number:string;customer:string;phone:string;whatsappPhone:string;date:string;address:Record<string,unknown>;items:Item[]};
export type Decision={index:number;slug:string;name:string;quantity:number;eligible:boolean;reason:keyof typeof ROUTE_REASONS};
function text(v:unknown,max:number,required=false):string {if(typeof v!=='string'||v.length>max||(required&&!v.trim())){if(!required&&v==null)return '';throw new DispatchError('MALFORMED_ORDER');}return v.replace(/[\u0000-\u001f\u007f*_~`@]/g,' ').replace(/\s+/g,' ').trim();}
export function parseOrder(r:Record<string,unknown>):Order {
 const address=object(r.address_json??r.addressJson);let items=r.items_json??r.itemsJson;
 if(typeof items==='string'){try{items=JSON.parse(items);}catch{throw new DispatchError('MALFORMED_ORDER');}}
 if(!Array.isArray(items)||!items.length||items.length>50)throw new DispatchError('MALFORMED_ORDER');
 const whatsapp=r.whatsapp_phone??r.whatsappPhone;
 const whatsappPhone=typeof whatsapp==='string'&&/^\+?[1-9]\d{9,14}$/.test(whatsapp.trim())?whatsapp.trim():'';
 return {number:text(r.order_number??r.orderNumber,100,true),customer:text(r.customer_name??r.customerName,150,true),phone:text(r.customer_phone??r.customerPhone,32,true),whatsappPhone,date:text(String(r.created_at??r.createdAt??''),100,true),address,
 items:items.map(v=>{const i=object(v);if(!Number.isSafeInteger(i.quantity)||Number(i.quantity)<1||Number(i.quantity)>1000)throw new DispatchError('MALFORMED_ORDER');if(i.packQuantity!=null&&(!Number.isSafeInteger(i.packQuantity)||Number(i.packQuantity)<1||Number(i.packQuantity)>1000))throw new DispatchError('MALFORMED_ORDER');return {slug:text(i.slug,180,true),name:text(i.name,240,true),variant:text(i.variant,200),quantity:Number(i.quantity),...(i.packQuantity?{packQuantity:Number(i.packQuantity)}:{})};})};
}
export function evaluate(o:Order,rules:Record<string,string[]>) {
 const state=deliveryState(o.address);
 const conflictingState=state!==null&&[o.address.stateCode,o.address.state_code,o.address.state,o.address.stateName].some(value=>{
  const other=deliveryState({state:value});return other!==null&&other!==state;
 });
 const area=checkDeliveryArea(state,o.address,conflictingState);
 const decisions:Decision[]=o.items.map((i,index)=>{
  const available=rules[i.slug];
  const eligible=Boolean(!area.reason&&state&&Array.isArray(available)&&available.includes(state));
  return {index,slug:i.slug,name:i.name,quantity:i.quantity,eligible,reason:area.reason??(!Array.isArray(available)||!available.length?'NO_AVAILABILITY_CONFIGURATION':eligible?'AVAILABLE_IN_COVERED_LGA':'UNAVAILABLE_IN_STATE')};
 });
 const eligible=o.items.filter((_,i)=>decisions[i].eligible);
 return {state,area,decisions,eligible,partial:eligible.length>0&&eligible.length<o.items.length};
}
export function formatMessage(o:Order,r:ReturnType<typeof evaluate>,mode:Mode){
 if(mode==='OFF'||!r.eligible.length||!r.state)throw new DispatchError('NOT_ELIGIBLE');
 const a=o.address;
 const testHeader='*TEST ONLY — FICTIONAL ORDER*';
 const deliveryStateLine=`Delivery State: ${STATES.find(s=>s.code===r.state)?.name} (${r.state})`;
 const addressLine=`Delivery Address: ${text(a.streetAddress??a.address,800,true)}`;
 const availability=a.availabilityDay??a.deliveryAvailability??a.availability??a.receiveWhen;
 const field=(label:string,value:unknown)=>value?[`${label}: ${text(value,600)}`]:[];
 const anagenOnly=!r.partial&&r.eligible.every(i=>i.slug==='anagen');
 const anagenDate=o.date.replace(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i,'$1 $2');
 const packSuffix=/\s*[—–-]\s*\d+\s+packs?$/i;
 const lines=anagenOnly?[
  ...(mode==='TEST'?[testHeader,'']:[]),
  '*NEW ANAGEN ORDER*',
  '',
  `Customer: ${o.customer}`,
  `Delivery phone: ${o.phone}`,
  o.whatsappPhone?`WhatsApp no: ${o.whatsappPhone}`:'WhatsApp no:',
  '',
  ...r.eligible.flatMap((i,n)=>[`${n+1}. ${i.name.replace(packSuffix,'')}`,`Quantity: ${i.quantity*(i.packQuantity??1)}`,'']),
  deliveryStateLine,
  ...field('LGA',r.area.lga),
  ...field('Availability',availability),
  addressLine,
  `Order Date: ${anagenDate}`,
  '',
  'Thanks',
 ]:[
  mode==='TEST'?testHeader:'*NEW RENOVA FULFILMENT ORDER*',
  ...(r.partial?['*PARTIAL FULFILMENT REQUEST — eligible items only*']:[]),
  `Dispatch reference: ${o.number}`,`Customer: ${o.customer}`,`Delivery phone: ${o.phone}`,'',
  ...r.eligible.flatMap((i,n)=>[`${n+1}. ${i.name}`,`Variant: ${i.variant||'Standard'}`,`Quantity: ${i.quantity}${i.packQuantity?` bundle(s); ${i.packQuantity} packs per bundle`:''}`,'']),
  deliveryStateLine,
  ...field('LGA',r.area.lga),
  ...field('City / town',a.cityTown??a.town),
  ...field('Landmark',a.landmark),
  ...field('Delivery instructions',a.deliveryInstructions??a.instructions??a.deliveryNote),
  ...field('Availability',availability),
  addressLine,`Order Date: ${o.date}`,'Source: Renova Store','','*Action Required: Selligate Fulfilment*',
 ];
 const body=lines.join('\n');
 // One actionable request; oversized messages require manual review, never truncation.
 if(body.length>7000)throw new DispatchError('MESSAGE_TOO_LONG_MANUAL_REVIEW');return body;
}
export function groupId(v:unknown):string{if(typeof v!=='string'||!/^\d{5,25}(?:-\d{5,20})?@g\.us$/.test(v))throw new DispatchError('INVALID_GROUP_ID');return v;}
export function validateGroups(t:string|null,p:string|null){if(t)groupId(t);if(p)groupId(p);if(t&&t===p)throw new DispatchError('GROUPS_MUST_DIFFER');}
export function fictionalOrder(p:{slug:string;name:string},state:string,quantity:number,number='TEST-PREVIEW',lga?:unknown){if(!STATES.some(s=>s.code===state)||!Number.isSafeInteger(quantity)||quantity<1||quantity>10||(lga!=null&&(typeof lga!=='string'||lga.length>140)))throw new DispatchError('INVALID_SIMULATION');return {order_number:number,customer_name:'Fictional Renova Test Customer',customer_phone:'+2340000000000',created_at:new Date().toISOString(),address_json:{stateCode:state,streetAddress:'TEST ONLY — fictional address; do not deliver',cityTown:'Fictional town',lga},items_json:[{slug:p.slug,name:p.name,quantity,variant:'TEST — Standard'}]};}
