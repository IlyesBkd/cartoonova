import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire('/home/hermes/projects/cartoonova/package.json');
const ts=require('typescript');
const source=readFileSync('/home/hermes/projects/cartoonova/lib/supportCommande.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {estPhysique}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
export function aggregate(rows,now=new Date()) {
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit'});
 const monthKey=d=>{const parts=month.formatToParts(new Date(d));return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;};
 const empty=()=>({netCents:0,fallbackRevenueCents:0,costCents:0,unknownPayments:0,unknownCosts:0,estimatedCosts:0,count:0});
 const result={month:empty(),total:empty(),shippingToConfirm:[]};
 for(const row of rows){
  const buckets=[result.total];if(monthKey(row.paidAt)===monthKey(now))buckets.push(result.month);
  for(const b of buckets){b.count++;if(row.netCents===null){b.unknownPayments++;b.fallbackRevenueCents+=row.fallbackRevenueCents||0;}else b.netCents+=row.netCents;
   if(row.physical){if(row.costCents===null)b.unknownCosts++;else b.costCents+=row.costCents;if(row.estimated)b.estimatedCosts++;}}
  if(row.physical&&row.shipped&&(row.costCents===null||row.estimated||!row.costNote?.includes('[impression+port confirmé]')))result.shippingToConfirm.push({id:row.id,customer:row.customer});
 }
 return result;
}
export async function collectFinance(sql,stripe){
 const orders=await sql.begin('read only',async tx=>{
  await tx`SET LOCAL statement_timeout='10s'`;
  const rows=await tx`select id,payment_intent_id,paid_at,customer_name,total_price,currency,options,cout,cout_note,expedie_le from orders where paid_at is not null and coalesce(customer_name,'') !~* '(démonstration|demonstration|^test\\y|^démo\\y)'`;
  const gifts=await tx`select achat_payment_intent from promo_codes where achat_payment_intent like 'pi_%'`;
  const known=new Set(rows.map(r=>r.payment_intent_id));
  for(const g of gifts)if(!known.has(g.achat_payment_intent)){known.add(g.achat_payment_intent);rows.push({id:g.achat_payment_intent,payment_intent_id:g.achat_payment_intent,options:{},gift:true});}
  return rows;
 });
 const rows=[];
 for(const o of orders){
  let netCents=null,paidAt=o.paid_at,fallbackRevenueCents=0;
  try{
   const pi=await stripe.paymentIntents.retrieve(o.payment_intent_id,{expand:['latest_charge.balance_transaction']});
   if(!pi.livemode||pi.status!=='succeeded')continue;
   const charge=pi.latest_charge;
   paidAt=new Date(charge.created*1000).toISOString();
   const bt=charge.balance_transaction;
   if(bt?.currency==='eur'&&Number.isSafeInteger(bt.net)&&!charge.disputed){
    let net=bt.net,refunded=0;
    for await(const refund of stripe.refunds.list({charge:charge.id,limit:100,expand:['data.balance_transaction']})){
     if(refund.status!=='succeeded')continue;
     const rb=refund.balance_transaction;
     if(rb?.currency!=='eur'||!Number.isSafeInteger(rb.net))throw Error('Refund settlement unavailable');
     net+=rb.net;refunded+=refund.amount;
    }
    if(refunded!==charge.amount_refunded)throw Error('Refund mismatch');
    netCents=net;
   }
  }catch(error){if(error.code==='resource_missing'&&String(o.currency).toUpperCase()==='EUR'&&o.total_price!=null&&Number.isFinite(Number(o.total_price)))fallbackRevenueCents=Math.round(Number(o.total_price)*100);console.error(JSON.stringify({orderId:o.id,reason:error.code||error.type||'settlement_unavailable'}));/* Unknown must never become zero profit. */}
  if(!paidAt)paidAt=new Date().toISOString();
  rows.push({id:o.id,customer:o.customer_name||'Client',paidAt,netCents,fallbackRevenueCents,physical:!o.gift&&estPhysique(o.options),costCents:o.cout==null?null:Math.round(Number(o.cout)*100),costNote:o.cout_note,estimated:/estimation/i.test(o.cout_note||''),shipped:!!o.expedie_le});
 }
 return aggregate(rows);
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const sql=require('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:10});
 try{
  if(!process.env.STRIPE_SECRET_KEY)throw Error('Stripe read access missing');
  const Stripe=require('stripe');const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{maxNetworkRetries:1,timeout:15000});
  console.log(JSON.stringify(await collectFinance(sql,stripe)));
 }finally{await sql.end();}
}
