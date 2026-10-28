import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
function load(file,stubs={},cache=new Map()){
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const req=createRequire(file);
 m.require=name=>{if(name in stubs)return stubs[name];if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);for(const ext of ['.ts','.tsx'])if(existsSync(base+ext))return load(base+ext,stubs,cache);}return req(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
test('shared Pop layout has real logo, email tables, ten localized footers and escaped title',()=>{
 const e=load('lib/emailTemplate.ts');
 for(const lang of ['fr','en','es','de','it','nl','pl','sv','da','pt']){
  const html=e.emailLayout({lang,title:'Portrait <Test> & cadeau',bodyHtml:e.emailParagraph('Bonjour <img src=x onerror=alert(1)>\nMerci !')});
  assert.match(html,new RegExp(`<html lang="${lang}"`));assert.match(html,/logo-detoure\.png/);assert.match(html,/bgcolor="#2A2552"/);assert.match(html,/role="presentation"/);assert.match(html,/max-width:600px/);assert.match(html,/&lt;Test&gt; &amp;/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/<br\s*\/?>(?:Merci)/);assert.doesNotMatch(html,/<script|@import|fonts\.google/i);assert.equal((html.match(/<h1\b/g)||[]).length,1);
  if(lang!=='fr')assert.doesNotMatch(html,/Une question|Répondez directement/);
 }
 assert.match(e.emailLayout({lang:'<script>',title:'Test',bodyHtml:''}),/<html lang="en"/);
});
test('blocks validate URLs, escape user text and preserve exact signed links',()=>{
 const e=load('lib/emailTemplate.ts');const url='https://www.cartoonova.com/fr/commande/token?a=1&b=%22x%22#detail';
 assert.match(e.emailButton('Voir <portrait>',url),/Voir &lt;portrait&gt;/);assert.match(e.emailButton('Voir',url),/a=1&amp;b=%22x%22#detail/);
 for(const bad of ['javascript:alert(1)','data:text/html,bad','/commande/foo','https://user:password@example.invalid/','https://example.invalid/\nfoo'])for(const helper of [()=>e.emailButton('Test',bad),()=>e.emailImage(bad,'Test')])assert.throws(helper);
 assert.match(e.emailImage(url,'Portrait <client>'),/alt="Portrait &lt;client&gt;"/);assert.match(e.emailNotice('Info <script>'),/&lt;script&gt;/);
});
test('plain alternative keeps links and meaningful content without styles or hidden preheader',()=>{
 const e=load('lib/emailTemplate.ts');
 const html=e.emailLayout({lang:'fr',title:'Votre portrait',preheader:'Hidden teaser',bodyHtml:e.emailParagraph('Bonjour Léa & Tom')+e.emailButton('Voir mon portrait','https://example.invalid/a?x=1&y=2')});
 const text=e.emailText(html);assert.match(text,/Bonjour Léa & Tom/);assert.match(text,/https:\/\/example.invalid\/a\?x=1&y=2/);assert.doesNotMatch(text,/<table|padding:|Hidden teaser/);
});
test('transport adds text fallback without changing headers, attachments, recipients or idempotency',async()=>{
 let captured;
 const {envoyerEmail}=load('lib/envoiEmail.ts',{'resend':{Resend:class{emails={send:async(...args)=>{captured=args;return {data:{id:'synthetic-id'},error:null};}};}}});
 const payload={from:'support@example.invalid',to:['client@example.invalid'],subject:'Test',html:'<p>Bonjour &amp; merci</p>',headers:{References:'<synthetic>'},attachments:[{filename:'test.txt',content:'hello'}]};
 await envoyerEmail(payload,{idempotencyKey:'synthetic-key'});
 assert.equal(captured[0].text,'Bonjour & merci');for(const key of ['to','headers','attachments'])assert.deepEqual(captured[0][key],payload[key]);assert.equal(captured[1].idempotencyKey,'synthetic-key');assert.equal(payload.text,undefined);
 await envoyerEmail({...payload,text:'Texte déjà approuvé'});assert.equal(captured[0].text,'Texte déjà approuvé');
});
test('support adds branded safe HTML while preserving approved text, recipient and threading',async()=>{
 let payload;let saved;const noop=async()=>{};
 const db={getSupportMessageById:async()=>({id:178,order_id:'synthetic-order',from_email:'sender@example.invalid',subject:'Une question',message_id:'synthetic@message',read_at:'already-read'}),getOrderById:async()=>({id:'synthetic-order',customer_email:'buyer@example.invalid',langue:'sv'}),insertSupportReply:async data=>{saved=data;return data;},markSupportMessageRead:noop,setOrderLastOutboundMessageId:noop};
 const route=load('app/api/support/reply/route.ts',{'@/lib/db':db,'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},'@/lib/envoiEmail':{envoyerEmail:async p=>{payload=p;return {data:{id:'synthetic-id'},error:null};}}});
 const text='Hej <script>alert(1)</script>\n\nDin tavla är på väg.';
 const response=await route.POST(new Request('https://example.invalid/api/support/reply',{method:'POST',body:JSON.stringify({messageId:178,corps:text})}));
 assert.equal(response.status,200);assert.equal(payload.text,text);assert.equal(saved.bodyText,text);assert.deepEqual(payload.to,['sender@example.invalid']);assert.equal(payload.headers['In-Reply-To'],'<synthetic@message>');assert.equal(payload.subject,'Re: Une question');assert.match(payload.html,/logo-detoure\.png/);assert.match(payload.html,/<html lang="sv"/);assert.doesNotMatch(payload.html,/<script>/);assert.match(payload.html,/&lt;script&gt;/);
});
