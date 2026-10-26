import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDeep} from './order-delivery-harness.mjs';

test('delivery policy refuses unpaid, unconfirmed current print and future gifts without effects',()=>{
 const {assertDeliveryEligible}=loadDeep('lib/deliveryPolicy.ts');
 const order={paid_at:'2026-01-01',customer_email:'test@example.invalid',final_image_url:'https://synthetic/image',options:{printKey:'digital'}};
 assert.doesNotThrow(()=>assertDeliveryEligible(order,'schedule'));
 for(const phase of ['schedule','final_image','extras']) {
  assert.throws(()=>assertDeliveryEligible({...order,paid_at:null},phase));
  assert.throws(()=>assertDeliveryEligible({...order,options:{printKey:'posterSimple'}},phase));
  assert.throws(()=>assertDeliveryEligible({...order,options:{gift:{deliverAfter:'2999-01-01'}}},phase));
 }
 assert.throws(()=>assertDeliveryEligible({...order,options:{printKey:'digital',carteVoeux:true}},'extras'));
 assert.doesNotThrow(()=>assertDeliveryEligible({...order,final_image_sent_at:'2026-01-02',options:{printKey:'digital',carteVoeux:true}},'extras'));
});

test('gift page preserves stored locale and never retrieves internal reward keys from Stripe',async()=>{
 let retrieves=0;
 for(const lang of ['fr','en','de']) for(const key of ['avis:uuid','parrainage:uuid']) {
  const {default:Page}=loadDeep('app/(hors-langue)/bon/[token]/page.tsx',{
   stripe:class {paymentIntents={retrieve:async()=>{retrieves++;throw Error('must not retrieve');}}},
   '@/lib/emailToken':{parseBonToken:()=> 'CADEAU-TEST-TEST'},
   '@/lib/bonCadeau':{lireBon:async()=>({code:'CADEAU-TEST-TEST',lang,montant:20,devise:'EUR',solde:20,expireLe:'2027-01-01'}),formatMontant:()=> '20',formatDate:()=> '2027'},
   '@/lib/db':{sql:async()=>[{achat_payment_intent:key}]},
   '@/app/(hors-langue)/bon/[token]/BoutonImprimer':()=>null,
  });
  const {renderToStaticMarkup}=await import('react-dom/server');
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({token:'fixture'})}));
  const {bonCadeauTextes}=loadDeep('lib/email-i18n.ts');assert.ok(html.includes(bonCadeauTextes[lang].carteTitre));
 }
 assert.equal(retrieves,0);
});

test('sitemap omits invented static dates and retains persisted article updatedAt',async()=>{
 const {default:sitemap}=loadDeep('app/sitemap.ts',{'@/lib/blogDb':{getAllPublishedArticleRefs:async()=>[{locale:'fr',slug:'fixture',updatedAt:'2026-01-02',topicId:null}]},'@/lib/productFeed':{GIFT_PRODUCTS:[]},'@/lib/visuels':{visuelsProduit:()=>({galerie:[]})}});
 const entries=await sitemap();
 assert.ok(entries.filter(e=>!e.url.endsWith('/blog/fixture')).every(e=>e.lastModified===undefined));
 assert.equal(entries.find(e=>e.url.endsWith('/blog/fixture')).lastModified.toISOString(),'2026-01-02T00:00:00.000Z');
});
