// Boundary double for image/translation contract suites ONLY. Distributed SQL
// behaviour is exercised against PostgreSQL 18 in order-delivery.test.mjs.
import { createHash } from 'node:crypto';
export function deliveryBoundaryDouble(onSent=()=>{}) {
 return {
  OrderDeliveryError:class extends Error{},
  deliveryContentHash:bytes=>createHash('sha256').update(bytes).digest('hex'),
  executeDelivery:async(order,kind,hash,recipient,work)=>{
   let emailId=null;
   await work({artifacts:{},checkpoint:async()=>{},send:async provider=>{
    const result=await provider('synthetic-provider-key');
    if(result.error)throw Error(result.error.message||'Provider refusal');
    emailId=result.data?.id??null;await onSent(order.id);
   }});
   return {artifacts:{},emailId,duplicate:false};
  },
 };
}
