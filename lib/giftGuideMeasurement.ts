/** Offline measurement only. Input must be a consented, already joined export.
 * Never guesses attribution from an email, IP, CTA click or temporal proximity.
 * Amounts are minor units AFTER refunds/tax; caller supplies actual variable costs.
 */
type Session = {sessionId:string;cohort:string;consent:boolean};
type Payment = {orderId:string;sessionId:string;paid:boolean;currency:string;netRevenueMinor:number|null;variableCostMinor:number|null};
export function measureGiftGuide(input:{sessions:Session[];orders:Payment[]}) {
 const sessions=new Map<string,Session>();
 for(const s of input.sessions){
  if(!s.sessionId||!s.cohort||typeof s.consent!=="boolean")throw Error("Invalid session");
  const previous=sessions.get(s.sessionId);
  if(previous&&(previous.cohort!==s.cohort||previous.consent!==s.consent))throw Error("Ambiguous session attribution");
  sessions.set(s.sessionId,s);
 }
 const denominators=new Map<string,number>();
 for(const s of sessions.values())if(s.consent)denominators.set(s.cohort,(denominators.get(s.cohort)??0)+1);
 const orders=new Map<string,Payment>();
 for(const o of input.orders){
  if(!o.orderId||!o.sessionId||typeof o.paid!=="boolean"||!/^[A-Z]{3}$/.test(o.currency)||(o.netRevenueMinor!==null&&!Number.isSafeInteger(o.netRevenueMinor))||(o.variableCostMinor!==null&&(!Number.isSafeInteger(o.variableCostMinor)||o.variableCostMinor<0)))throw Error("Invalid payment");
  const previous=orders.get(o.orderId);
  if(previous&&["sessionId","paid","currency","netRevenueMinor","variableCostMinor"].some(k=>previous[k as keyof Payment]!==o[k as keyof Payment]))throw Error("Conflicting duplicate order");
  orders.set(o.orderId,o);
 }
 // Conversion has no currency: keep every consented cohort, even without sales.
 const cohorts=new Map([...denominators].map(([cohort,sessions])=>[cohort,{cohort,sessions,paidSessions:new Set<string>(),paidOrders:0}]));
 const groups=new Map<string,{cohort:string;currency:string;sessions:number;paidSessions:Set<string>;paidOrders:number;revenueMinor:number|null;marginMinor:number|null}>();
 let unattributedPaidOrders=0;
 for(const o of orders.values()){
  if(!o.paid)continue;
  const session=sessions.get(o.sessionId);
  if(!session?.consent){unattributedPaidOrders++;continue;}
  const cohort=cohorts.get(session.cohort)!;
  cohort.paidSessions.add(o.sessionId);cohort.paidOrders++;
  const key=JSON.stringify([session.cohort,o.currency]);
  const group=groups.get(key)??{cohort:session.cohort,currency:o.currency,sessions:denominators.get(session.cohort)!,paidSessions:new Set<string>(),paidOrders:0,revenueMinor:0,marginMinor:0};
  group.paidSessions.add(o.sessionId);group.paidOrders++;
  group.revenueMinor=group.revenueMinor===null||o.netRevenueMinor===null?null:group.revenueMinor+o.netRevenueMinor;
  group.marginMinor=group.marginMinor===null||o.variableCostMinor===null||o.netRevenueMinor===null?null:group.marginMinor+o.netRevenueMinor-o.variableCostMinor;
  if((group.revenueMinor!==null&&!Number.isSafeInteger(group.revenueMinor))||(group.marginMinor!==null&&!Number.isSafeInteger(group.marginMinor)))throw Error("Financial total overflow");
  groups.set(key,group);
 }
 return {mode:"offline_observational_no_uplift_claim",unattributedPaidOrders,consentedSessions:[...denominators.values()].reduce((a,b)=>a+b,0),cohorts:[...cohorts.values()].sort((a,b)=>a.cohort.localeCompare(b.cohort)).map(c=>({...c,paidSessions:c.paidSessions.size,conversion:c.paidSessions.size/c.sessions})),groups:[...groups.values()].sort((a,b)=>a.cohort.localeCompare(b.cohort)||a.currency.localeCompare(b.currency)).map(g=>({...g,paidSessions:g.paidSessions.size,conversion:g.paidSessions.size/g.sessions,revenuePerSessionMinor:g.revenueMinor===null?null:g.revenueMinor/g.sessions,marginPerSessionMinor:g.marginMinor===null?null:g.marginMinor/g.sessions}))};
}
