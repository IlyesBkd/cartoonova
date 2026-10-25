import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createTranslator} from 'next-intl';

const root=path.resolve(import.meta.dirname,'..');
// Real pure financial modules; only the SELECT boundary is synthetic, all writes fail closed.
const compiled=await build({absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',
 stdin:{resolveDir:root,loader:'ts',contents:`export {validatePromoCode} from './lib/promoCodes';export {montantsBon} from './lib/bonCadeauMontants';`},
 plugins:[{name:'no-database',setup(b){b.onResolve({filter:/^\.\/db$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const runtimeSchemaBootstrapEnabled=false;export async function sql(strings){if(!strings[0].startsWith('SELECT * FROM promo_codes WHERE code = '))throw Error('database writes forbidden');return [globalThis.__giftCopyPromo]}`,loader:'js'}));}}],
});
const {validatePromoCode,montantsBon}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
function promo(currency,solde){globalThis.__giftCopyPromo={code:'CADEAU-FIXTURE',kind:'amount',value:solde,currency,solde,min_subtotal:0,max_uses:null,used_count:0,starts_at:null,ends_at:new Date(Date.now()+60000).toISOString(),active:true};}

for(const [currency,expected] of Object.entries({EUR:[20,40,60],GBP:[20,35,50],USD:[20,45,65]})){
 test(`${currency}: actual denomination grid and partial-use example agree with real discount cap`,async()=>{
  assert.deepEqual(montantsBon(currency),expected);
  for(const purchase of montantsBon(currency)){
   promo(currency,purchase);
   const result=await validatePromoCode('CADEAU-FIXTURE',purchase,currency);
   assert.equal(result.ok,true);assert.equal(result.discount,purchase-1);
   assert.equal(purchase-result.discount,1,'beneficiary payment is one native unit');
   assert.equal(globalThis.__giftCopyPromo.solde-result.discount,1,'one native unit remains on the voucher');
  }
 });
 test(`${currency}: underfunded voucher can leave more than minimum payable`,async()=>{
  promo(currency,20);const result=await validatePromoCode('CADEAU-FIXTURE',30,currency);
  assert.equal(result.discount,20);assert.equal(30-result.discount,10);
 });
 test(`${currency}: reuse cannot bypass original expiry or purchase currency`,async()=>{
  promo(currency,1);assert.deepEqual(await validatePromoCode('CADEAU-FIXTURE',20,currency==='EUR'?'USD':'EUR'),{ok:false,reason:'currency_mismatch'});
  globalThis.__giftCopyPromo.ends_at=new Date(Date.now()-60000).toISOString();
  assert.deepEqual(await validatePromoCode('CADEAU-FIXTURE',20,currency),{ok:false,reason:'expired'});
 });
}

test('ten catalogues use the same ICU argument contracts and render every balance-copy key',()=>{
 const contract={conditions:[],minimum:['minimum'],minimumLegal:['devises'],exemple:['achat','commande','paiement','reste','utilise']};
 for(const locale of ['fr','en','de','es','it','nl','pl','pt','sv','da']){
  const messages=JSON.parse(readFileSync(path.join(root,`messages/${locale}.json`),'utf8'));
  const t=createTranslator({locale,messages,namespace:'bonCadeau',onError:error=>{throw error}});
  for(const [key,args] of Object.entries(contract)){
   assert.deepEqual([...messages.bonCadeau[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),args,`${locale}/${key}`);
   const text=t(key,{minimum:'1 USD',devises:'1 EUR / 1 GBP / 1 USD',achat:'45 USD',commande:'45 USD',utilise:'44 USD',paiement:'1 USD',reste:'1 USD'});
   assert.ok(text.length>30);assert.doesNotMatch(text,/\{\w+\}/);
  }
 }
});

test('12-month copy follows the existing issuance rule rather than inventing a new deadline',()=>{
 const source=readFileSync(path.join(root,'lib/bonCadeau.ts'),'utf8');
 assert.match(source,/const VALIDITE_MOIS = 12;/);
 assert.match(source,/expire\.setMonth\(expire\.getMonth\(\) \+ VALIDITE_MOIS\)/);
 assert.match(source,/\$\{bon\.expireLe\}/);
});
